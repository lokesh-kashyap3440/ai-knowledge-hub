# app/routes/chat.py
import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import ChatMessage, ChatSession, User, get_db
from services.auth import get_current_user
from services.rag import ask, stream_answer

router = APIRouter()

class Query(BaseModel):
    query: str
    selected_documents: list[str] = []
    session_id: str


def _ensure_session(db: Session, session_id: str, current_user: User, query: str):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if session is None:
        session = ChatSession(id=session_id, user_id=current_user.id, title=query[:80] or "New Chat")
        db.add(session)
        db.commit()
        db.refresh(session)
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
        answer_parts = []
        async for chunk in stream_answer(q.query, q.selected_documents):
            if chunk.get("data"):
                answer_parts.append(chunk["data"])
            yield f"data: {json.dumps(chunk)}\n\n"
        db.add(
            ChatMessage(
                session_id=q.session_id,
                role="assistant",
                content="".join(answer_parts),
            )
        )
        db.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream")
