import json

from app.db import delete, insert, rpc, select
from app.llm import chat, embed

EXTRACT_PROMPT = """You are Kairos's memory system. Read the exchange below and decide what,
if anything, is worth remembering long-term about the user (preferences, interests,
running jokes, struggles, facts about their life). Ignore small talk and anything
already obvious. Return a JSON array of short standalone facts (strings). If nothing
is worth remembering, return an empty array. Return ONLY the JSON array, nothing else.

Exchange:
User: {user_message}
Kairos: {assistant_message}
"""


def save_message(user_id: str, role: str, content: str, channel: str = "chat") -> None:
    insert("messages", {"user_id": user_id, "role": role, "content": content, "channel": channel})


def list_messages(user_id: str, channel: str = "chat") -> list[dict]:
    return select(
        "messages", {"user_id": user_id, "channel": channel}, order="created_at.asc"
    )


def clear_messages(user_id: str, channel: str = "chat") -> None:
    delete("messages", {"user_id": user_id, "channel": channel})


def extract_and_store_memories(user_id: str, user_message: str, assistant_message: str) -> list[str]:
    prompt = EXTRACT_PROMPT.format(
        user_message=user_message, assistant_message=assistant_message
    )
    raw = chat([{"role": "user", "content": prompt}], temperature=0.0)

    try:
        facts = json.loads(raw)
    except json.JSONDecodeError:
        facts = []

    if not facts:
        return []

    for fact in facts:
        vector = embed(fact)
        rpc("add_memory", {"p_user_id": user_id, "p_content": fact, "p_embedding": vector})

    return facts


def retrieve_relevant_memories(user_id: str, query: str, top_k: int = 5) -> list[str]:
    vector = embed(query)
    rows = rpc(
        "match_memories",
        {"p_user_id": user_id, "p_query_embedding": vector, "p_match_count": top_k},
    )
    return [row["content"] for row in rows]


def list_memories(user_id: str) -> list[dict]:
    return select("memories", {"user_id": user_id}, order="created_at.desc")


def delete_memory(user_id: str, memory_id: int) -> None:
    delete("memories", {"user_id": user_id, "id": memory_id})


def clear_memories(user_id: str) -> None:
    delete("memories", {"user_id": user_id})
