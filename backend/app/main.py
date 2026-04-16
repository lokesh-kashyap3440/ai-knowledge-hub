# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_db
from routes import auth, upload, chat

app = FastAPI(
    title="AI Knowledge Hub API",
    description="Backend API for document upload and chat over indexed knowledge.",
    version="1.0.0",
    docs_url="/swagger",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS configuration - extended for development and production environments
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost",
        "http://127.0.0.1",
        "http://ai_knowledge_hub_backend:8000",
        "http://192.168.1.12:5173",
        "https://brave.com",
        "https://brave-intl.com",
        "https://sso.brave.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(chat.router)