# app/services/embedding.py
from sentence_transformers import SentenceTransformer

from app.config import EMBEDDING_MODEL, HF_TOKEN


model = SentenceTransformer(EMBEDDING_MODEL, token=HF_TOKEN)


def get_embedding(text: str):
    if not text or not text.strip():
        raise ValueError("Cannot create an embedding from empty text.")

    embedding = model.encode(
        text,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return embedding.tolist()
