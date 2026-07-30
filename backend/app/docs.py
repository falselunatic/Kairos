import io
import urllib.parse

from docx import Document as DocxDocument
from pypdf import PdfReader

from app.db import delete, insert, rpc, select
from app.llm import chat, embed

CHUNK_SIZE = 800  # characters per chunk - simple, no token-aware splitting needed at this scale

ASK_PROMPT = """Answer the user's question. Prefer the context from their uploaded docs below
when it's relevant - if it answers the question, use it and make clear the answer comes from
their docs. If the context doesn't cover the question, answer using your own general
knowledge instead, and say plainly that this isn't from their uploaded docs. Never invent
details and claim they came from the docs - only state what's actually in the context below.
If you don't know the answer at all, from the docs or otherwise, say so plainly rather than
guessing.

The question may be a short follow-up to the recent conversation below (e.g. "and for X",
"what about that") - use it to figure out what the user actually means, don't ask them to
repeat themselves if the recent conversation makes it clear.

The context below is only the chunks that matched THIS question - it's not everything the
user has uploaded. The full list of uploaded document titles is given separately below, so
if the user asks about "the other doc" or something not in the matched context, check that
list before saying nothing was uploaded - it may just mean that document's content didn't
match this specific question.

All uploaded document titles: {titles}

Recent conversation:
{history}

Context matched for this question:
{context}

Question: {question}
"""

UNCERTAIN_PHRASES = ("don't know", "doesn't contain", "not in the", "no information")


def extract_text(filename: str, raw: bytes) -> str:
    name = filename.lower()

    if name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(raw))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)

    if name.endswith(".docx"):
        doc = DocxDocument(io.BytesIO(raw))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())

    return raw.decode("utf-8", errors="ignore")


def chunk_text(text: str) -> list[str]:
    normalized = text.replace("\r\n", "\n")
    # Prefer paragraph breaks; PDFs often lose blank lines, so fall back to
    # single newlines when there's no paragraph structure to split on.
    separator = "\n\n" if "\n\n" in normalized else "\n"
    pieces = [p.strip() for p in normalized.split(separator) if p.strip()]

    chunks: list[str] = []
    current = ""

    for piece in pieces:
        # Hard-split any single piece that alone exceeds the chunk size, so no
        # chunk ever balloons past a size that hurts retrieval granularity.
        while len(piece) > CHUNK_SIZE:
            head, piece = piece[:CHUNK_SIZE], piece[CHUNK_SIZE:]
            if current:
                chunks.append(current)
                current = ""
            chunks.append(head)

        if len(current) + len(piece) + 1 <= CHUNK_SIZE:
            current = f"{current}\n{piece}" if current else piece
        else:
            if current:
                chunks.append(current)
            current = piece

    if current:
        chunks.append(current)

    return chunks or [text[:CHUNK_SIZE]]


def add_document(user_id: str, title: str, content: str) -> dict:
    document = insert("documents", {"user_id": user_id, "title": title})

    for chunk in chunk_text(content):
        vector = embed(chunk)
        rpc(
            "add_doc_chunk",
            {
                "p_document_id": document["id"],
                "p_user_id": user_id,
                "p_content": chunk,
                "p_embedding": vector,
            },
        )

    return document


def list_documents(user_id: str) -> list[dict]:
    return select("documents", {"user_id": user_id}, order="created_at.desc")


def delete_document(user_id: str, document_id: int) -> None:
    delete("documents", {"user_id": user_id, "id": document_id})


def ask_docs(
    user_id: str, question: str, history: list[dict] | None = None
) -> tuple[str, list[str], str | None]:
    history = history or []
    # A short follow-up ("and for X") often isn't a good standalone search query by
    # itself - fold in the last question so retrieval still finds the right chunks.
    search_query = f"{history[-1]['question']} {question}" if history else question

    vector = embed(search_query)
    rows = rpc(
        "match_doc_chunks",
        {"p_user_id": user_id, "p_query_embedding": vector, "p_match_count": 5},
    )
    chunks = [r["content"] for r in rows]
    search_url = f"https://www.google.com/search?q={urllib.parse.quote(question)}"
    context = "\n\n---\n\n".join(chunks) if chunks else "(no relevant uploaded docs found)"
    history_block = (
        "\n".join(f"User: {h['question']}\nKairos: {h['answer']}" for h in history[-3:])
        if history
        else "(none)"
    )
    titles = [d["title"] for d in list_documents(user_id)]
    titles_block = ", ".join(titles) if titles else "(none uploaded yet)"
    prompt = ASK_PROMPT.format(
        titles=titles_block, history=history_block, context=context, question=question
    )
    answer = chat([{"role": "user", "content": prompt}], temperature=0.2)

    uncertain = any(phrase in answer.lower() for phrase in UNCERTAIN_PHRASES)
    return answer, chunks, (search_url if uncertain else None)
