"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { BrandName } from "@/components/BrandName";
import { Markdown } from "@/components/Markdown";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { extractErrorDetail, friendlyFetchError } from "@/lib/errors";
import styles from "./code.module.css";

type Message = { role: "user" | "assistant"; content: string; searchUrl?: string | null };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function CodePage() {
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
    fetch(`${API_URL}/history?channel=code`, {
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
      const res = await fetch(`${API_URL}/code/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error(await extractErrorDetail(res));
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, searchUrl: data.search_url ?? null },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `(${friendlyFetchError(err, "something went wrong, try again.")})` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleClearChat() {
    if (!session) return;
    setMessages([]);
    await fetch(`${API_URL}/history?channel=code`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  }

  if (authLoading || !session) {
    return null;
  }

  return (
    <div className={styles.page}>
      <Sidebar />
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>
              <BrandName showTooltip={false} /> Code
            </div>
            <div className={styles.subtitle}>Direct answers, code first, prose second.</div>
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
                <div className={styles.emptyState}>Ask a coding question to get started.</div>
              )
            )}
            {messages.map((m, i) => (
              <div key={i} className={`${styles.row} ${m.role === "user" ? styles.rowUser : ""}`}>
                <div className={`${styles.bubble} ${styles[m.role]}`}>
                  <Markdown content={m.content} />
                  {m.searchUrl && (
                    <a
                      className={styles.searchLink}
                      href={m.searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Search Google for this instead
                    </a>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className={styles.row}>
                <div className={`${styles.bubble} ${styles.assistant}`}>…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form className={styles.form} onSubmit={sendMessage}>
            <input
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a coding question..."
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
