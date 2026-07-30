import logging
import urllib.parse
from concurrent.futures import Future, ThreadPoolExecutor

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from groq import RateLimitError
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.db import insert, select, update
from app.llm import chat
from app.memory import (
    clear_memories,
    clear_messages,
    delete_memory,
    extract_and_store_memories,
    list_memories,
    list_messages,
    retrieve_relevant_memories,
    save_message,
)
from app.roast import generate_roast_line, judge_round
from app.docs import (
    UNCERTAIN_PHRASES,
    add_document,
    ask_docs,
    delete_document,
    extract_text,
    list_documents,
)
from app.notes import add_note, delete_note, list_notes, maybe_create_note, update_note

logger = logging.getLogger("kairos")

app = FastAPI(title="Kairos", docs_url=None, redoc_url=None)

# Fire-and-forget background work (e.g. auto note creation) that shouldn't make the
# user wait on the main chat reply. Long-lived, unlike the per-request executor below.
BACKGROUND = ThreadPoolExecutor(max_workers=4)


def _log_background_failure(future: Future) -> None:
    # .submit() swallows exceptions unless something reads the Future - without this,
    # a failing background task (e.g. a Groq rate limit or a bug) fails completely
    # silently with zero trace anywhere.
    exc = future.exception()
    if exc is not None:
        logger.exception("Background task failed", exc_info=exc)


def run_in_background(fn, *args) -> None:
    future = BACKGROUND.submit(fn, *args)
    future.add_done_callback(_log_background_failure)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    # chrome-extension origins (random per install) and ngrok tunnel URLs (random per
    # session when sharing the project) - both change every time, so match by pattern.
    allow_origin_regex=r"chrome-extension://.*|https://.*\.ngrok-free\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RateLimitError)
async def groq_rate_limit_handler(request: Request, exc: RateLimitError) -> JSONResponse:
    # Groq's free tier has a daily token cap - surface this as a clear, expected
    # condition instead of a bare 500 that reads as "the backend is broken".
    return JSONResponse(
        status_code=429,
        content={"detail": "Kairos hit Groq's free-tier rate limit for today. Try again later."},
    )

ABOUT_KAIROS = """If asked about your own architecture, tech stack, database, or how you
were built, answer accurately using these facts (don't guess or make anything up beyond this):

ARCHITECTURE
- Frontend: Next.js (App Router) - pages for chat, a coding assistant ("Kairos Code"),
  document Q&A, notes, memories, a roast battle game, and an about page (this one).
- Backend: FastAPI (Python) - talks to Supabase over its HTTPS REST/RPC API, not a raw
  database connection (chosen so it still works on networks that block direct Postgres).
- Database: Supabase Postgres with the pgvector extension for similarity search.
- Auth: Supabase Auth (email/password + OTP email code + Google OAuth), tokens verified
  via Supabase's JWKS endpoint so it keeps working across key rotations.
- LLM: Groq's API, serving open-weight Llama models.
- Embeddings: generated locally via fastembed (ONNX), not an external API.
- Chrome extension: proactively starts roast battles based on the user's current
  browser tab, and links out to every page of the web app.
- Open-source stack.

DATABASE TABLES
- messages: every chat message, tagged with a "channel" (chat vs code) so the main
  companion chat and Kairos Code have separate histories.
- memories: short facts extracted from conversations (chat, Kairos Code, and doc Q&A
  all feed into this same table), each with a vector embedding for similarity search.
- documents / doc_chunks: uploaded files, split into chunks, each chunk embedded for
  retrieval when answering questions about them.
- notes: user-created notes, plus notes Kairos writes on its own when a chat or
  Kairos Code exchange contains something worth saving (a decision, a plan, a
  calculation, etc.) - no separate "generate" step, it just happens as you talk.
- roast_battles / roast_rounds: one row per battle and one row per round, tracking
  scores and the winner.
All tables are scoped per-user via a user_id column tied to Supabase Auth.

HOW DATA FLOWS
1. Chat/Code message comes in -> embedded locally -> similar past memories retrieved
   from Postgres -> sent to Groq along with the message -> reply comes back.
2. After replying, a second Groq call decides if anything's worth remembering -> if so,
   it's embedded and stored in memories. A third Groq call separately decides if the
   exchange is worth saving as a note -> if so, a title/content note is created
   automatically, no user action needed.
3. Doc upload -> text extracted (pypdf/python-docx/plain text) -> split into chunks ->
   each chunk embedded -> stored in doc_chunks.
4. Doc question -> embedded -> most similar chunks retrieved -> sent to Groq as context
   -> answer generated (and also feeds back into memories).
5. Roast battle: Kairos generates a line (from memories or, in the extension, from
   your current browser tab) -> you reply -> a separate Groq call judges both lines ->
   scores update -> repeat for 5 rounds.
What's common across every feature: the same Postgres database, the same embedding
model, the same Groq LLM, and the same per-user memory store.
"""

SYSTEM_PROMPT = """You are Kairos, a warm, curious companion who remembers the person
you're talking to over time. Use the memories you're given about them naturally in
conversation, without listing them out like a report. Keep replies conversational
and reasonably short.

""" + ABOUT_KAIROS + """
What you remember about this person so far:
{memories}
"""

CODE_SYSTEM_PROMPT = """You are Kairos Code, a sharp, no-nonsense coding assistant.
- Give direct, correct answers. Prefer showing code over long explanations.
- When you show code, use fenced code blocks with the language tag.
- If the question is ambiguous, make a reasonable assumption and say what you assumed,
  rather than asking a clarifying question first.
- Keep prose short - the code is the point.

""" + ABOUT_KAIROS


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    memories_recalled: list[str]
    memories_learned: list[str]


@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest, user_id: str = Depends(get_current_user_id)) -> ChatResponse:
    recalled = retrieve_relevant_memories(user_id, req.message)
    memories_block = "\n".join(f"- {m}" for m in recalled) if recalled else "(nothing yet)"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(memories=memories_block)},
        {"role": "user", "content": req.message},
    ]
    reply = chat(messages)

    save_message(user_id, "user", req.message)
    save_message(user_id, "assistant", reply)
    # Both of these are LLM calls of their own - run them after the reply is already on
    # its way back to the user instead of making them wait on two extra Groq round-trips.
    run_in_background(extract_and_store_memories, user_id, req.message, reply)
    run_in_background(maybe_create_note, user_id, req.message, reply)

    return ChatResponse(reply=reply, memories_recalled=recalled, memories_learned=[])


@app.get("/history")
def history_endpoint(channel: str = "chat", user_id: str = Depends(get_current_user_id)):
    return list_messages(user_id, channel)


@app.delete("/history")
def clear_history_endpoint(channel: str = "chat", user_id: str = Depends(get_current_user_id)):
    clear_messages(user_id, channel)
    return {"status": "cleared"}


@app.get("/memories")
def memories_endpoint(user_id: str = Depends(get_current_user_id)):
    return list_memories(user_id)


@app.delete("/memories/{memory_id}")
def delete_memory_endpoint(memory_id: int, user_id: str = Depends(get_current_user_id)):
    delete_memory(user_id, memory_id)
    return {"status": "deleted"}


@app.delete("/memories")
def clear_memories_endpoint(user_id: str = Depends(get_current_user_id)):
    clear_memories(user_id)
    return {"status": "cleared"}


TOTAL_ROUNDS = 5


class RoastContextRequest(BaseModel):
    tab_title: str = ""
    tab_url: str = ""


class RoastReplyRequest(BaseModel):
    message: str


def _start_battle(user_id: str, context: str | None) -> dict:
    kairos_line = generate_roast_line(user_id, context)
    battle = insert("roast_battles", {"user_id": user_id, "round": 1})
    insert(
        "roast_rounds",
        {"battle_id": battle["id"], "round": 1, "kairos_line": kairos_line},
    )
    return {"battle_id": battle["id"], "round": 1, "kairos_line": kairos_line}


@app.post("/roast/start")
def roast_start(user_id: str = Depends(get_current_user_id)):
    return _start_battle(user_id, context=None)


@app.post("/roast/start-with-context")
def roast_start_with_context(
    req: RoastContextRequest, user_id: str = Depends(get_current_user_id)
):
    context = f"Currently browsing: \"{req.tab_title}\" ({req.tab_url})" if req.tab_title else None
    return _start_battle(user_id, context=context)


@app.get("/roast")
def roast_list(user_id: str = Depends(get_current_user_id)):
    return select("roast_battles", {"user_id": user_id}, order="created_at.desc")


@app.get("/roast/{battle_id}")
def roast_get(battle_id: int, user_id: str = Depends(get_current_user_id)):
    battles = select("roast_battles", {"id": battle_id, "user_id": user_id})
    if not battles:
        raise HTTPException(404, "Battle not found")
    rounds = select("roast_rounds", {"battle_id": battle_id}, order="round.asc")
    return {**battles[0], "rounds": rounds}


@app.post("/roast/{battle_id}/reply")
def roast_reply(
    battle_id: int, req: RoastReplyRequest, user_id: str = Depends(get_current_user_id)
):
    battles = select("roast_battles", {"id": battle_id, "user_id": user_id})
    if not battles:
        raise HTTPException(404, "Battle not found")
    battle = battles[0]
    if battle["status"] == "finished":
        raise HTTPException(400, "This battle is already finished")

    current_round = battle["round"]
    round_rows = select(
        "roast_rounds", {"battle_id": battle_id, "round": current_round}
    )
    if not round_rows:
        raise HTTPException(404, "Round not found")
    round_row = round_rows[0]

    is_final_round = current_round >= TOTAL_ROUNDS

    # Judging this round and generating the next line don't depend on each other,
    # so run them in parallel rather than back-to-back - roughly halves latency.
    if is_final_round:
        kairos_score, user_score = judge_round(round_row["kairos_line"], req.message)
        next_kairos_line = None
    else:
        previous_rounds = select("roast_rounds", {"battle_id": battle_id}, order="round.asc")
        previous_lines = [r["kairos_line"] for r in previous_rounds]

        with ThreadPoolExecutor(max_workers=2) as executor:
            judge_future = executor.submit(judge_round, round_row["kairos_line"], req.message)
            next_line_future = executor.submit(
                generate_roast_line, user_id, None, previous_lines
            )
            kairos_score, user_score = judge_future.result()
            next_kairos_line = next_line_future.result()

    update(
        "roast_rounds",
        {"id": round_row["id"]},
        {"user_line": req.message, "kairos_score": kairos_score, "user_score": user_score},
    )

    user_total = battle["user_score"] + user_score
    kairos_total = battle["kairos_score"] + kairos_score

    if is_final_round:
        winner = "tie" if user_total == kairos_total else ("user" if user_total > kairos_total else "kairos")
        update(
            "roast_battles",
            {"id": battle_id},
            {
                "status": "finished",
                "user_score": user_total,
                "kairos_score": kairos_total,
                "winner": winner,
            },
        )
        return {
            "round": current_round,
            "user_line": req.message,
            "kairos_score": kairos_score,
            "user_score": user_score,
            "user_total": user_total,
            "kairos_total": kairos_total,
            "finished": True,
            "next_kairos_line": None,
            "winner": winner,
        }

    next_round = current_round + 1
    insert(
        "roast_rounds",
        {"battle_id": battle_id, "round": next_round, "kairos_line": next_kairos_line},
    )
    update(
        "roast_battles",
        {"id": battle_id},
        {"round": next_round, "user_score": user_total, "kairos_score": kairos_total},
    )

    return {
        "round": current_round,
        "user_line": req.message,
        "kairos_score": kairos_score,
        "user_score": user_score,
        "user_total": user_total,
        "kairos_total": kairos_total,
        "finished": False,
        "next_kairos_line": next_kairos_line,
        "winner": None,
    }


class CodeChatRequest(BaseModel):
    message: str


@app.post("/code/chat")
def code_chat(req: CodeChatRequest, user_id: str = Depends(get_current_user_id)):
    history = list_messages(user_id, channel="code")
    messages = (
        [{"role": "system", "content": CODE_SYSTEM_PROMPT}]
        + [{"role": m["role"], "content": m["content"]} for m in history]
        + [{"role": "user", "content": req.message}]
    )
    reply = chat(messages, temperature=0.3)

    save_message(user_id, "user", req.message, channel="code")
    save_message(user_id, "assistant", reply, channel="code")
    run_in_background(extract_and_store_memories, user_id, req.message, reply)
    run_in_background(maybe_create_note, user_id, req.message, reply)

    uncertain = any(phrase in reply.lower() for phrase in UNCERTAIN_PHRASES)
    search_url = (
        f"https://www.google.com/search?q={urllib.parse.quote(req.message)}"
        if uncertain
        else None
    )

    return {"reply": reply, "search_url": search_url}


ABOUT_SYSTEM_PROMPT = """You are Kairos, answering questions about your own architecture
and how you were built. Be precise and concrete - reference actual table names, actual
services, actual data flow. Keep answers short and clear, a few sentences unless the
question asks for more detail. Don't invent anything beyond the facts below.

""" + ABOUT_KAIROS


class AboutChatRequest(BaseModel):
    question: str


@app.post("/about/chat")
def about_chat(req: AboutChatRequest, user_id: str = Depends(get_current_user_id)):
    messages = [
        {"role": "system", "content": ABOUT_SYSTEM_PROMPT},
        {"role": "user", "content": req.question},
    ]
    reply = chat(messages, temperature=0.2)
    return {"reply": reply}


class QAPair(BaseModel):
    question: str
    answer: str


class AskDocsRequest(BaseModel):
    question: str
    history: list[QAPair] = []


@app.post("/docs")
async def upload_doc(
    title: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    raw = await file.read()
    content = extract_text(file.filename or title, raw)
    return add_document(user_id, title, content)


@app.get("/docs")
def docs_list(user_id: str = Depends(get_current_user_id)):
    return list_documents(user_id)


@app.delete("/docs/{document_id}")
def docs_delete(document_id: int, user_id: str = Depends(get_current_user_id)):
    delete_document(user_id, document_id)
    return {"status": "deleted"}


@app.post("/docs/ask")
def docs_ask(req: AskDocsRequest, user_id: str = Depends(get_current_user_id)):
    history = [h.model_dump() for h in req.history]
    answer, sources, search_url = ask_docs(user_id, req.question, history)
    save_message(user_id, "user", req.question, channel="docs")
    save_message(user_id, "assistant", answer, channel="docs")
    run_in_background(extract_and_store_memories, user_id, req.question, answer)
    return {"answer": answer, "sources": sources, "search_url": search_url}


class NoteRequest(BaseModel):
    title: str
    content: str


@app.post("/notes")
def notes_create(req: NoteRequest, user_id: str = Depends(get_current_user_id)):
    return add_note(user_id, req.title, req.content)


@app.get("/notes")
def notes_list(user_id: str = Depends(get_current_user_id)):
    return list_notes(user_id)


@app.put("/notes/{note_id}")
def notes_update(note_id: int, req: NoteRequest, user_id: str = Depends(get_current_user_id)):
    update_note(user_id, note_id, req.title, req.content)
    return {"status": "updated"}


@app.delete("/notes/{note_id}")
def notes_delete(note_id: int, user_id: str = Depends(get_current_user_id)):
    delete_note(user_id, note_id)
    return {"status": "deleted"}


@app.get("/health")
def health():
    return {"status": "ok"}
