"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { RecentActivity } from "@/components/RecentActivity";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { extractErrorDetail, friendlyFetchError } from "@/lib/errors";
import { blurActiveElement } from "@/lib/dom";
import { useVoiceInput, useVoiceOutput } from "@/lib/useVoice";
import styles from "./page.module.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  memoriesLearned?: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SpeakerOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 6a9 9 0 0 1 0 12" strokeLinecap="round" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
      <path d="M16 9l5 5M21 9l-5 5" strokeLinecap="round" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { listening, supported: voiceInputSupported, toggle: toggleListening } = useVoiceInput(
    (text) => setInput((prev) => (prev ? `${prev} ${text}` : text))
  );
  const { enabled: speakEnabled, setEnabled: setSpeakEnabled, supported: voiceOutputSupported, speak } =
    useVoiceOutput();

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
    blurActiveElement();
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
      if (!res.ok) throw new Error(await extractErrorDetail(res));
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          memoriesLearned: data.memories_learned,
        },
      ]);
      speak(data.reply);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `(${friendlyFetchError(err, "something went wrong, try again.")})` },
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
          <div className={styles.headerActions}>
            {voiceOutputSupported && (
              <button
                type="button"
                className={`${styles.voiceToggle} ${speakEnabled ? styles.voiceToggleActive : ""}`}
                onClick={() => setSpeakEnabled((v) => !v)}
                title={speakEnabled ? "Kairos will speak replies aloud" : "Replies are text-only"}
              >
                {speakEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
                {speakEnabled ? "Voice on" : "Voice off"}
              </button>
            )}
            {messages.length > 0 && (
              <button className={styles.clearButton} onClick={() => setConfirmingClear(true)}>
                Clear chat
              </button>
            )}
          </div>
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
            {voiceInputSupported && (
              <button
                type="button"
                className={`${styles.micButton} ${listening ? styles.micButtonActive : ""}`}
                onClick={toggleListening}
                title={listening ? "Stop listening" : "Speak your message"}
                aria-label={listening ? "Stop listening" : "Speak your message"}
              >
                {listening ? <StopIcon /> : <MicIcon />}
              </button>
            )}
            <input
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Listening..." : "Say something..."}
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
