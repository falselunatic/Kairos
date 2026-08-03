import json
import re

from app.db import delete, insert, select, update
from app.llm import chat

AUTO_NOTE_PROMPT = """You are Kairos's note-taking system. Read the exchange below and decide
whether it contains something worth saving as a standalone note ABOUT THE USER: a decision
they made, a plan, a to-do, a deadline, a project or task they mentioned, a preference, or any
other fact about their own life, work, or plans that they'd plausibly want to look back at later.
This includes small everyday to-dos and reminders, even short ones - e.g. "I need to buy
groceries today" or "gotta call the dentist tomorrow" ARE worth saving, they're real to-dos,
not small talk.

Do NOT save generic explanations, definitions, tutorials, or how-to answers that aren't
specific to the user - e.g. "what does npm run do" or "explain recursion" are Kairos teaching
a general concept, not something about the user, so those must return null even though they're
informative. Only save it if it's actually about the user's own situation, not a fact Kairos
supplied about the world in general. Skip pure conversational filler with no actual content
(e.g. "lol", "cool thanks", "haha ok") - but don't confuse that with a genuine short to-do,
which should always be saved even if brief.

The user's existing notes are listed below. If this exchange is about the SAME topic as one of
them (e.g. more detail about the same project/plan), do NOT create a duplicate note - instead
return an update to that note, with "content" being the existing content plus whatever is new
(don't drop old information). If it's a genuinely new topic, create a new note. If there's
nothing new or note-worthy at all, return null.

Existing notes:
{existing_notes}

If it's a NEW note, return ONLY this JSON, nothing else: {{"title": "...", "content": "..."}}
If it UPDATES an existing note, return ONLY: {{"update_id": <id>, "title": "...", "content": "..."}}
If nothing is worth saving, return ONLY: null

Exchange:
User: {user_message}
Kairos: {assistant_message}
"""


def add_note(user_id: str, title: str, content: str) -> dict:
    return insert("notes", {"user_id": user_id, "title": title, "content": content})


def list_notes(user_id: str) -> list[dict]:
    return select("notes", {"user_id": user_id}, order="created_at.desc")


def update_note(user_id: str, note_id: int, title: str, content: str) -> None:
    update("notes", {"id": note_id, "user_id": user_id}, {"title": title, "content": content})


def delete_note(user_id: str, note_id: int) -> None:
    delete("notes", {"id": note_id, "user_id": user_id})


def maybe_create_note(user_id: str, user_message: str, assistant_message: str) -> dict | None:
    existing = list_notes(user_id)
    existing_block = (
        "\n".join(f"- id {n['id']}: {n['title']}" for n in existing) if existing else "(none yet)"
    )
    prompt = AUTO_NOTE_PROMPT.format(
        existing_notes=existing_block, user_message=user_message, assistant_message=assistant_message
    )
    raw = chat([{"role": "user", "content": prompt}], temperature=0.0)

    # Models don't always follow "return ONLY JSON" - pull the first {...} block out of
    # whatever prose it wraps it in rather than failing the whole thing on a strict parse.
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return None

    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None

    if not isinstance(data, dict) or not data.get("title") or not data.get("content"):
        return None

    update_id = data.get("update_id")
    valid_ids = {n["id"] for n in existing}
    if update_id in valid_ids:
        update_note(user_id, update_id, data["title"], data["content"])
        return {"id": update_id, "title": data["title"], "content": data["content"]}

    return add_note(user_id, data["title"], data["content"])
