from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Depends, HTTPException, UploadFile
import shutil
import os

from services.parser import parse_pdf
from services.chunking import chunk_text
from services.auth import get_current_user
from services.embedding import get_embedding
from services.vectorstore import add_chunks, has_document, list_documents, delete_document
from app.db import User

router = APIRouter()
EMBEDDING_WORKERS = 4


@router.post("")
async def upload(file: UploadFile, current_user: User = Depends(get_current_user)):
    if has_document(file.filename):
        raise HTTPException(
            status_code=409,
            detail=f"{file.filename} has already been indexed.",
        )

    temp_path = f"temp_{file.filename}"

    # Save file
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Parse PDF
    text = parse_pdf(temp_path)

    # Chunk
    chunks = chunk_text(text)
    if not chunks:
        os.remove(temp_path)
        raise HTTPException(
            status_code=400,
            detail="No extractable text was found in this PDF.",
        )

    # Embeddings
    with ThreadPoolExecutor(max_workers=EMBEDDING_WORKERS) as executor:
        embeddings = list(executor.map(get_embedding, chunks))

    # Store in ChromaDB
    add_chunks(file.filename, chunks, embeddings)

    # Cleanup
    os.remove(temp_path)

    return {
        "status": "processed",
        "file": file.filename,
        "chunks": len(chunks)
    }


@router.get("/documents")
def documents(current_user: User = Depends(get_current_user)):
    return {"documents": list_documents()}


@router.delete("/documents/{filename}")
def remove_document(filename: str, current_user: User = Depends(get_current_user)):
    if not has_document(filename):
        raise HTTPException(
            status_code=404,
            detail=f"Document {filename} not found."
        )
    
    delete_document(filename)
    return {"status": "deleted", "filename": filename}
