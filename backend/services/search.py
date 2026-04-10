# app/services/search.py
import json
import numpy as np
from app.db import conn

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def search(query_embedding, top_k=5):
    rows = conn.execute("SELECT content, embedding FROM chunks").fetchall()

    scored = []
    for content, emb in rows:
        emb = np.array(json.loads(emb))
        score = cosine_similarity(query_embedding, emb)
        scored.append((content, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [s[0] for s in scored[:top_k]]