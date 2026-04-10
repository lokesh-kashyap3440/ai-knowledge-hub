# app/services/chunking.py
def chunk_text(text: str, size=1200, overlap=150):
    cleaned = " ".join(text.split())
    if not cleaned:
        return []

    chunks = []
    step = max(size - overlap, 1)

    for start in range(0, len(cleaned), step):
        chunk = cleaned[start:start + size].strip()
        if chunk:
            chunks.append(chunk)

    return chunks
