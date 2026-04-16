# app/routes/chat.py
import json
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db import ChatMessage, ChatSession, User, get_db, SessionLocal
from services.auth import get_current_user
from services.rag import ask, stream_answer

router = APIRouter()

# UUID v4 regex pattern for session_id validation
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.I)


class Query(BaseModel):
    query: str
    selected_documents: list[str] = []
    session_id: str | None = None

    @field_validator('session_id', mode='before')
    @classmethod
    def validate_or_generate_session_id(cls, v):
        """Ensure session_id is a non-empty string or generate a new UUID."""
        if v is None or v == "":
            return str(uuid.uuid4())
        
        # Accept any non-empty string to avoid 422 errors from legacy/incognito values
        val = str(v).strip()
        if not val:
            return str(uuid.uuid4())
            
        return val.lower()


def _ensure_session(db: Session, session_id: str, current_user: User, query: str):
    """
    Ensure a chat session exists for the user.
    
    Uses PostgreSQL's ON CONFLICT DO NOTHING for atomic, race-condition-safe insertion.
    This prevents UniqueViolation errors when concurrent requests try to create
    the same session_id simultaneously.
    """
    # First, try to fetch existing session for THIS user
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if session:
        return session

    # Use PostgreSQL's ON CONFLICT DO NOTHING for atomic insert
    # This is race-condition safe: if another request inserted first, this becomes a no-op
    stmt = pg_insert(ChatSession).values(
        id=session_id,
        user_id=current_user.id,
        title=query[:80] or "New Chat"
    ).on_conflict_do_nothing(index_elements=["id"])

    db.execute(stmt)
    db.commit()

    # Fetch the session - use .first() not .one() because:
    # 1. The insert might have been skipped (conflict with different user's session)
    # 2. We need to verify ownership before returning
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    
    if session is None:
        # Session exists but belongs to a different user, or UUID collision occurred
        # This should be extremely rare with proper UUID v4 generation
        raise HTTPException(
            status_code=403,
            detail="Session not found or access denied"
        )
    
    return session


@router.post("/chat")
def chat(
    q: Query,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_session(db, q.session_id, current_user, q.query)
    db.add(ChatMessage(session_id=q.session_id, role="user", content=q.query))
    answer = ask(q.query, q.selected_documents)
    db.add(ChatMessage(session_id=q.session_id, role="assistant", content=answer))
    db.commit()
    return {"answer": answer}


@router.post("/chat/stream")
async def chat_stream(
    q: Query,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_session(db, q.session_id, current_user, q.query)
    db.add(ChatMessage(session_id=q.session_id, role="user", content=q.query))
    db.commit()

    async def event_stream():
        # Create a new session for the generator because the request's 'db' session
        # might be closed by FastAPI after chat_stream returns the StreamingResponse.
        stream_db = SessionLocal()
        try:
            answer_parts = []
            async for chunk in stream_answer(q.query, q.selected_documents):
                yield f"data: {json.dumps(chunk)}\n\n"
                if chunk.get("data"):
                    answer_parts.append(chunk["data"])
            
            if answer_parts:
                assistant_message = ChatMessage(
                    session_id=q.session_id,
                    role="assistant",
                    content="".join(answer_parts),
                )
                stream_db.add(assistant_message)
                stream_db.commit()
        finally:
            stream_db.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")