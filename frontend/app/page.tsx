"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { RecentActivity } from "@/components/RecentActivity";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import styles from "./page.module.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  memoriesLearned?: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    setHistoryLoading(true);
    fetch(`${API_URL}/history`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setMessages(data.map((m: { role: "user" | "assistant"; content: string }) => ({
          role: m.role,
          content: m.content,
        })));
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function handleClearChat() {
    if (!session) return;
    setMessages([]);
    await fetch(`${API_URL}/history`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !session) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          memoriesLearned: data.memories_learned,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "(couldn't reach the backend, is it running?)" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !session) {
    return null;
  }

  return (
    <div className={styles.page}>
      <Sidebar />
      <RecentActivity />
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>What&apos;s on your mind?</div>
            <div className={styles.subtitle}>
              A companion that remembers you, chat about anything.
            </div>
          </div>
          {messages.length > 0 && (
            <button className={styles.clearButton} onClick={() => setConfirmingClear(true)}>
              Clear chat
            </button>
          )}
        </div>

        <ConfirmDialog
          open={confirmingClear}
          message="Clear this chat history? This can't be undone."
          confirmLabel="Clear it"
          onCancel={() => setConfirmingClear(false)}
          onConfirm={() => {
            setConfirmingClear(false);
            handleClearChat();
          }}
        />

        <div className={styles.panel}>
          <div className={styles.messages}>
            {historyLoading ? (
              <div className={styles.emptyState}>Loading...</div>
            ) : (
              messages.length === 0 && (
                <div className={styles.emptyState}>
                  Say hi, Kairos is listening and remembering.
                </div>
              )
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`${styles.row} ${m.role === "user" ? styles.rowUser : ""}`}
              >
                {m.role === "assistant" && <div className={styles.avatar}>K</div>}
                <div className={styles.bubbleGroup}>
                  <div className={`${styles.bubble} ${styles[m.role]}`}>{m.content}</div>
                  {m.memoriesLearned && m.memoriesLearned.length > 0 && (
                    <div className={styles.memories}>
                      remembered: {m.memoriesLearned.join("; ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className={styles.row}>
                <div className={styles.avatar}>K</div>
                <div className={`${styles.bubble} ${styles.assistant} ${styles.typing}`}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form className={styles.form} onSubmit={sendMessage}>
            <input
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Say something..."
              autoFocus
            />
            <button className={styles.button} type="submit" disabled={loading}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
