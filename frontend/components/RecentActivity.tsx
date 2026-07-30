"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import styles from "./RecentActivity.module.css";

type FeedItem = { kind: string; text: string; created_at: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function RecentActivity() {
  const { session } = useAuth();
  const [items, setItems] = useState<FeedItem[] | null>(null);

  useEffect(() => {
    if (!session) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    Promise.all([
      fetch(`${API_URL}/history`, { headers }).then((r) => r.json()).catch(() => []),
      fetch(`${API_URL}/memories`, { headers }).then((r) => r.json()).catch(() => []),
      fetch(`${API_URL}/roast`, { headers }).then((r) => r.json()).catch(() => []),
    ]).then(([messages, memories, battles]) => {
      const feed: FeedItem[] = [];

      if (Array.isArray(messages)) {
        for (const m of messages.slice(-5)) {
          feed.push({ kind: "Chat", text: m.content, created_at: m.created_at });
        }
      }
      if (Array.isArray(memories)) {
        for (const m of memories.slice(0, 5)) {
          feed.push({ kind: "Memory", text: m.content, created_at: m.created_at });
        }
      }
      if (Array.isArray(battles)) {
        for (const b of battles.slice(0, 3)) {
          const text =
            b.status === "finished"
              ? b.winner === "user"
                ? "Roast battle: you won"
                : b.winner === "kairos"
                  ? "Roast battle: Kairos won"
                  : "Roast battle: tie"
              : "Roast battle in progress";
          feed.push({ kind: "Roast Battle", text, created_at: b.created_at });
        }
      }

      feed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(feed.slice(0, 8));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>Recent activity</div>
      {!items ? (
        <div className={styles.empty}>Loading...</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>Nothing yet.</div>
      ) : (
        items.map((item, i) => (
          <div key={i} className={styles.item}>
            <div className={styles.itemKind}>{item.kind}</div>
            <div className={styles.itemText}>{item.text}</div>
          </div>
        ))
      )}
    </div>
  );
}
