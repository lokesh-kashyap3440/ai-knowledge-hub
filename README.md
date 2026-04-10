# AI Knowledge Hub

AI Knowledge Hub is a full-stack RAG app where users can:
- register/login with JWT auth
- upload PDF documents
- index documents into ChromaDB
- select one or more indexed documents
- chat with streaming responses grounded in selected documents
- persist chat sessions/messages in PostgreSQL

## Tech Stack

- Frontend: React + Vite + TailwindCSS
- Backend: FastAPI
- Vector DB: ChromaDB (Cloud with local fallback)
- Relational DB: PostgreSQL (users, sessions, messages)
- Embeddings: local `sentence-transformers`
- Auth: JWT
- Containerization: Docker + Docker Compose

## Project Structure

```text
ai-knowledge-hub/
  backend/
    app/
    routes/
    services/
    Dockerfile
  frontend/
    src/
    Dockerfile
    nginx.conf
  docker-compose.yml
```

## Environment Variables (Backend)

Create/update `backend/.env` with values like:

```env
OPENAI_API_KEY=your_key
BASE_URL=https://your-llm-endpoint
MODEL_NAME=your-model
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/ai_knowledge_hub
JWT_SECRET_KEY=change-me
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

CHROMA_API_KEY=
CHROMA_TENANT=
CHROMA_DATABASE=
CHROMA_COLLECTION=documents
CHROMA_HOST=api.trychroma.com
CHROMA_PERSIST_DIRECTORY=./chroma
```

## Run with Docker (Recommended)

From project root:

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Swagger: `http://localhost:8000/swagger`
- Postgres: `localhost:5432`

## Run Locally (Without Docker)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Main API Endpoints

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/change-password`
- `GET /auth/sessions/{session_id}/messages`

### Documents
- `POST /upload` (JWT required)
- `GET /documents` (JWT required)

### Chat
- `POST /chat` (JWT required)
- `POST /chat/stream` (JWT required, SSE stream)

## Notes

- Duplicate uploads are blocked by filename.
- Indexed document list is reusable; users can chat without re-uploading.
- If Chroma Cloud is unreachable, backend can fall back to local Chroma persistence.
- Rotate any real secrets if they were ever committed or shared.
