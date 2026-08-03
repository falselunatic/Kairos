import json
import math

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


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


NEIGHBOR_THRESHOLD = 0.35  # below this, two memories aren't considered related at all
NEIGHBORS_PER_NODE = 4  # keep the graph sparse - a full mesh is unreadable past a few dozen nodes
CLUSTER_THRESHOLD = 0.55  # edges at least this similar pull their nodes into the same cluster


def get_memory_graph(user_id: str) -> dict:
    rows = rpc("get_memories_with_embeddings", {"p_user_id": user_id})
    if len(rows) < 2:
        nodes = [
            {"id": r["id"], "content": r["content"], "created_at": r["created_at"], "cluster": 0}
            for r in rows
        ]
        return {"nodes": nodes, "edges": []}

    n = len(rows)
    embeddings = [r["embedding"] for r in rows]

    # Full pairwise similarity - fine at this scale (RPC already caps at 400 memories).
    similarities: dict[tuple[int, int], float] = {}
    for i in range(n):
        for j in range(i + 1, n):
            sim = _cosine_similarity(embeddings[i], embeddings[j])
            if sim >= NEIGHBOR_THRESHOLD:
                similarities[(i, j)] = sim

    # Keep only each node's strongest few connections so the graph stays a legible
    # constellation instead of a solid mesh of lines.
    neighbors_by_node: dict[int, list[tuple[int, float]]] = {i: [] for i in range(n)}
    for (i, j), sim in similarities.items():
        neighbors_by_node[i].append((j, sim))
        neighbors_by_node[j].append((i, sim))

    kept_edges: set[tuple[int, int]] = set()
    for i, neighbors in neighbors_by_node.items():
        neighbors.sort(key=lambda pair: pair[1], reverse=True)
        for j, _sim in neighbors[:NEIGHBORS_PER_NODE]:
            kept_edges.add((min(i, j), max(i, j)))

    # Union-find so tightly related memories share a cluster/color.
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x: int, y: int) -> None:
        root_x, root_y = find(x), find(y)
        if root_x != root_y:
            parent[root_y] = root_x

    for (i, j) in kept_edges:
        if similarities[(i, j)] >= CLUSTER_THRESHOLD:
            union(i, j)

    cluster_ids: dict[int, int] = {}
    for i in range(n):
        root = find(i)
        if root not in cluster_ids:
            cluster_ids[root] = len(cluster_ids)

    nodes = [
        {
            "id": rows[i]["id"],
            "content": rows[i]["content"],
            "created_at": rows[i]["created_at"],
            "cluster": cluster_ids[find(i)],
        }
        for i in range(n)
    ]
    edges = [
        {"source": rows[i]["id"], "target": rows[j]["id"], "weight": round(similarities[(i, j)], 3)}
        for (i, j) in kept_edges
    ]
    return {"nodes": nodes, "edges": edges}
