import pytest
import uuid
from unittest.mock import patch, MagicMock
from app.db import ChatMessage, ChatSession, User

# A constant for a test user's credentials
TEST_USERNAME = "testuser_chat"
TEST_PASSWORD = "testpassword123"

@pytest.fixture
def authenticated_client(test_client):
    """Fixture to get an authenticated client and token."""
    response = test_client.post(
        "/auth/register",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    token = response.json()["access_token"]
    test_client.headers["Authorization"] = f"Bearer {token}"
    return test_client


@patch("routes.chat.stream_answer")
def test_chat_stream_creates_session_and_messages(mock_stream_answer, authenticated_client, db_session):
    """
    Test that the chat stream endpoint correctly:
    1. Creates a new chat session.
    2. Stores the user's message.
    3. Stores the assistant's message after the stream.
    """
    # Configure the mock to return an async iterator
    async def mock_generator(*args, **kwargs):
        yield {"type": "data", "data": "Hello"}
        yield {"type": "data", "data": " there"}
        yield {"type": "end"}

    mock_stream_answer.side_effect = mock_generator

    session_id = str(uuid.uuid4())
    query = "What is the capital of France?"

    # Make the streaming request (now with /chat prefix)
    with authenticated_client.stream("POST", "/chat/stream", json={
        "query": query,
        "session_id": session_id
    }) as response:
        # Consume the stream to ensure the full logic runs
        for _ in response.iter_lines():
            pass

    assert response.status_code == 200

    # Verify the database state after the stream
    # Check that the user message was saved
    user_message = db_session.query(ChatMessage).filter(ChatMessage.role == "user").first()
    assert user_message is not None
    assert user_message.session_id == session_id
    assert user_message.content == query

    # Check that the assistant message was saved
    assistant_message = db_session.query(ChatMessage).filter(ChatMessage.role == "assistant").first()
    assert assistant_message is not None
    assert assistant_message.session_id == session_id
    assert assistant_message.content == "Hello there"


@patch("routes.chat.stream_answer")
def test_chat_stream_uses_existing_session(mock_stream_answer, authenticated_client, db_session):
    """Test that the chat stream endpoint uses an existing session if one is provided."""
    # Mock the answer stream
    async def mock_generator(*args, **kwargs):
        yield {"type": "end"}
    mock_stream_answer.side_effect = mock_generator
    
    # Get current user from DB
    user = db_session.query(User).filter(User.username == TEST_USERNAME).first()
    
    session_id = str(uuid.uuid4())
    session = ChatSession(id=session_id, user_id=user.id, title="Existing Chat")
    db_session.add(session)
    db_session.commit()

    # Make the request
    with authenticated_client.stream("POST", "/chat/stream", json={
        "query": "Another question",
        "session_id": session_id
    }) as response:
        for _ in response.iter_lines():
            pass
    
    assert response.status_code == 200
    
    # Verify no new session was created
    session_count = db_session.query(ChatSession).count()
    assert session_count == 1
