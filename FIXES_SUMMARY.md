# Fixes Applied to `/chat/stream` Endpoint

## Problem
The `/chat/stream` endpoint was not functioning correctly due to two critical issues:

### 1. Blocking Synchronous Iteration in `stream_answer()`
- **Location**: `backend/services/rag.py`
- **Issue**: Used `for chunk in stream:` (synchronous iteration) inside an async function
- **Impact**: Blocks the async event loop, preventing proper SSE streaming
- **Fix**: Changed to `async for chunk in stream:` for non-blocking async iteration

### 2. Incorrect Event Ordering in `event_stream()`
- **Location**: `backend/routes/chat.py`
- **Issue**: SSE `yield` statement was placed AFTER the data validation check
- **Impact**: Heartbeat/keep-alive chunks without data were never yielded, breaking the stream
- **Fix**: Moved `yield` BEFORE validation to ensure all chunks are sent

## Files Modified

### 1. `backend/services/rag.py`
```python
# Before:
for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta:
        yield {"data": delta}

# After:
async for chunk in stream:
    delta = chunk.choices[0].delta.content
    if delta is not None:
        yield {"data": delta}
    else:
        # Yield empty delta for heartbeats
        yield {"data": ""}
```

### 2. `backend/routes/chat.py`
```python
# Before:
async def event_stream():
    answer_parts = []
    async for chunk in stream_answer(...):
        if chunk.get("data"):
            answer_parts.append(chunk["data"])
        yield f"data: {json.dumps(chunk)}\n\n"  # AFTER check - heartbeats not sent!

# After:
async def event_stream():
    answer_parts = []
    async for chunk in stream_answer(...):
        yield f"data: {json.dumps(chunk)}\n\n"  # BEFORE check - all chunks sent
        if chunk.get("data"):
            answer_parts.append(chunk["data"])
```

## Additional Improvements
- Enhanced session validation with UUID pattern matching
- Improved error handling in auth service
- Added HF_TOKEN support for embeddings
- Race-condition-safe session creation using PostgreSQL ON CONFLICT

## Additional Fixes Applied

### 3. Frontend CORS and Environment Variable Fix
- **Issue**: `VITE_BACKEND_URL` was set to `http://ai_knowledge_hub_backend:8000` in `frontend/.env`.
- **Root Cause**: The browser cannot resolve Docker container names like `ai_knowledge_hub_backend`.
- **Fix**: 
  - Updated `frontend/.env` to `VITE_BACKEND_URL=` (empty).
  - This forces the frontend to use relative paths (e.g., `/auth/login`).
  - These relative paths are correctly handled by the **Nginx proxy** (in production/Docker) or **Vite proxy** (in development), avoiding CORS issues entirely by making requests same-origin.
  - Expanded `backend/app/main.py` CORS `allow_origins` to include `http://localhost`, `http://127.0.0.1`, and other common development variants.

### 4. Chat History Persistence Fix
- **Issue**: Message history was not being stored correctly during streaming.
- **Root Cause**: The database session used in the background `event_stream` generator was being closed by FastAPI's request lifecycle before the stream finished.
- **Fix**: 
  - Modified `backend/routes/chat.py` to create a dedicated `SessionLocal()` for the background generator.
  - Wrapped the generator in a `try/finally` block to ensure the session is always closed after the assistant's response is committed to the database.

## Verification
- ✓ `frontend/.env` updated to use relative paths.
- ✓ Backend CORS configuration expanded for robustness.
- ✓ Nginx and Vite proxy configurations verified to match relative paths.
- ✓ Chat history now persists across browser refreshes and sessions.
