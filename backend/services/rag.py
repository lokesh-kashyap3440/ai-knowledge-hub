from services.embedding import get_embedding
from services.vectorstore import search
from services.llm import client
from app.config import MODEL_NAME


def ask(query: str, selected_documents=None):
    query_emb = get_embedding(query)
    chunks = search(query_emb, selected_documents=selected_documents)
    context = "\n".join(chunks)

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": f"""
Answer ONLY from context.

Context:
{context}

Question:
{query}
"""
            }
        ],
    )

    if hasattr(response, "choices") and response.choices:
        message = response.choices[0].message.content
        if isinstance(message, str):
            return message

    if isinstance(response, str):
        return response

    return str(response)


async def stream_answer(query: str, selected_documents=None):
    query_emb = get_embedding(query)
    chunks = search(query_emb, selected_documents=selected_documents)

    context = "\n".join(chunks)

    stream = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": f"""
Answer ONLY from context.

Context:
{context}

Question:
{query}
"""
            }
        ],
        stream=True
    )

    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield {"data": delta}
