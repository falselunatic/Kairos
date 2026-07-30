import json

from app.llm import chat
from app.memory import retrieve_relevant_memories

ROAST_SYSTEM = """You are Kairos in a real roast battle with the user. This is a roast, not a
compliment session - go for it. Rules:
- Use simple, everyday English - short words, short sentences, no fancy vocabulary or idioms.
- Actually roast them. Be savage, cutting, and a little mean - that's the point of the game.
- Off-limits even here: no slurs or hate speech, nothing about protected traits (race,
  religion, disability, etc), no body-shaming, nothing about family, tragedy, or real harm.
  Inside those lines, don't hold back.
- Write ONE short roast line, under 15 words. Return ONLY the line, nothing else.
"""

JUDGE_PROMPT = """Rate these two roast lines for wittiness, 1-10 each. Use simple criteria:
funny + clever + on-topic. Return ONLY JSON, nothing else: {{"kairos_score": n, "user_score": n}}

Kairos said: "{kairos_line}"
User said: "{user_line}"
"""


def generate_roast_line(
    user_id: str, context: str | None = None, previous_lines: list[str] | None = None
) -> str:
    if context:
        material = f"What the user is currently doing: {context}"
    else:
        memories = retrieve_relevant_memories(user_id, "roast battle material", top_k=5)
        material = (
            "Facts you know about the user: " + "; ".join(memories)
            if memories
            else "You don't know much about this user yet - keep it generic and friendly."
        )

    if previous_lines:
        avoid = "\n".join(f'- "{line}"' for line in previous_lines)
        material += f"\n\nYou already said these lines in this battle - do NOT repeat them or anything too similar:\n{avoid}"

    messages = [
        {"role": "system", "content": ROAST_SYSTEM + "\n" + material},
        {"role": "user", "content": "Throw your roast."},
    ]
    return chat(messages, temperature=1.0).strip()


def judge_round(kairos_line: str, user_line: str) -> tuple[int, int]:
    prompt = JUDGE_PROMPT.format(kairos_line=kairos_line, user_line=user_line)
    raw = chat([{"role": "user", "content": prompt}], temperature=0.0)

    try:
        data = json.loads(raw)
        return int(data["kairos_score"]), int(data["user_score"])
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return 5, 5
