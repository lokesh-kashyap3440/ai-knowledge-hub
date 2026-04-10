import chromadb
from chromadb.config import Settings
from app.config import (
    CHROMA_API_KEY,
    CHROMA_COLLECTION,
    CHROMA_DATABASE,
    CHROMA_HOST,
    CHROMA_PERSIST_DIRECTORY,
    CHROMA_TENANT,
)


def get_chroma_client():
    if CHROMA_API_KEY and CHROMA_TENANT and CHROMA_DATABASE:
        try:
            return chromadb.CloudClient(
                api_key=CHROMA_API_KEY,
                tenant=CHROMA_TENANT,
                database=CHROMA_DATABASE,
                cloud_host=CHROMA_HOST,
            )
        except Exception:
            # Fall back to local persistence when Chroma Cloud is unreachable.
            pass

    return chromadb.Client(Settings(persist_directory=CHROMA_PERSIST_DIRECTORY))


client = get_chroma_client()

collection = client.get_or_create_collection(CHROMA_COLLECTION)


def has_document(filename: str):
    results = collection.get(
        where={"source": filename},
        include=[],
        limit=1,
    )
    return bool(results["ids"])


def list_documents():
    results = collection.get(include=["metadatas"])
    metadatas = results.get("metadatas") or []

    documents = {}
    for metadata in metadatas:
        if not metadata:
            continue
        source = metadata.get("source")
        if not source:
            continue

        if source not in documents:
            documents[source] = {
                "name": source,
                "chunks": 0,
            }
        documents[source]["chunks"] += 1

    return sorted(documents.values(), key=lambda item: item["name"].lower())


def add_chunks(filename, chunks, embeddings):
    ids = []
    metadatas = []
    for index, _chunk in enumerate(chunks):
        ids.append(f"{filename}:{index}")
        metadatas.append(
            {
                "source": filename,
                "chunk_index": index,
            }
        )

    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )


def _build_where_clause(selected_documents):
    if not selected_documents:
        return None

    if len(selected_documents) == 1:
        return {"source": selected_documents[0]}

    return {
        "$or": [{"source": document} for document in selected_documents],
    }


def search(query_embedding, top_k=5, selected_documents=None):
    where_clause = _build_where_clause(selected_documents)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where_clause,  # type: ignore
    )
    return results["documents"][0] if results["documents"] else []
