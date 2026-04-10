# app/services/llm.py
from openai import OpenAI
from app.config import OPENAI_API_KEY, BASE_URL, MODEL_NAME

client = OpenAI(
    api_key=OPENAI_API_KEY,
    base_url=BASE_URL
)

def generate_answer(context: str, query: str):
    prompt = f"""
You are a strict knowledge assistant.

Rules:
- Use ONLY the given context
- If answer is not present, say: "Not found in documents"
- Be concise

Context:
{context}

Question:
{query}
"""

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )

    if isinstance(response, str):
        return response

    if isinstance(response, dict):
        choices = response.get("choices") or []
        if choices:
            message = choices[0].get("message", {})
            content = message.get("content")
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                return "".join(
                    item.get("text", "")
                    for item in content
                    if isinstance(item, dict)
                )

        output_text = response.get("output_text")
        if isinstance(output_text, str):
            return output_text

    if hasattr(response, "choices") and response.choices:
        message = response.choices[0].message
        content = message.content
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(
                item.text
                for item in content
                if hasattr(item, "text") and isinstance(item.text, str)
            )

    if hasattr(response, "output_text") and isinstance(response.output_text, str):
        return response.output_text

    return str(response)
