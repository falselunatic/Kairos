from functools import lru_cache

from fastembed import TextEmbedding
from groq import Groq

from app.config import settings

groq_client = Groq(api_key=settings.groq_api_key)


@lru_cache(maxsize=1)
def _embedder() -> TextEmbedding:
    return TextEmbedding("BAAI/bge-small-en-v1.5")


def embed(text: str) -> list[float]:
    return next(iter(_embedder().embed([text]))).tolist()


def chat(messages: list[dict], temperature: float = 0.7, model: str | None = None) -> str:
    response = groq_client.chat.completions.create(
        model=model or settings.groq_model,
        messages=messages,
        temperature=temperature,
    )
    return response.choices[0].message.content
