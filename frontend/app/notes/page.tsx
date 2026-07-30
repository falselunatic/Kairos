"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { evalArithmeticLine } from "@/lib/calc";
import { fetchWithRetry, friendlyFetchError } from "@/lib/errors";
import styles from "./notes.module.css";

type Note = { id: number; title: string; content: string; created_at: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function NoteCalculations({ content }: { content: string }) {
  const lines = content.split("\n");
  const results = lines
    .map((line) => ({ line, value: evalArithmeticLine(line) }))
    .filter((r) => r.value !== null);
  if (results.length === 0) return null;
  return (
    <div className={styles.calcBox}>
      {results.map((r, i) => (
        <div key={i} className={styles.calcLine}>
          <span>{r.line.trim()}</span>
          <span className={styles.calcResult}>= {r.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function NotesPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    loadNotes();
    // Kairos can create notes on its own from conversation, so poll for new
    // ones instead of requiring a manual refresh.
    const interval = setInterval(loadNotes, 10000);
    return () => clearInterval(interval);
    // Depend on the token string, not the Session object - AuthProvider emits a new
    // Session reference (same token) shortly after mount via onAuthStateChange, which
    // would otherwise tear down and restart this interval every time that fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  function loadNotes() {
    if (!session) return;
    fetchWithRetry(`${API_URL}/notes`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load your notes.");
        return res.json();
      })
      .then((data) => {
        setNotes(Array.isArray(data) ? data : []);
        setLoadError("");
      })
      .catch((err) => setLoadError(friendlyFetchError(err, "Could not load your notes.")));
  }

  function resetForm() {
    setTitle("");
    setContent("");
    setEditingId(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim() || !content.trim()) {
      setError("Give the note a title and some content.");
      return;
    }
    if (!session) return;
    setSaving(true);
    try {
      const url = editingId ? `${API_URL}/notes/${editingId}` : `${API_URL}/notes`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetchWithRetry(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) throw new Error("Could not save the note.");
      resetForm();
      loadNotes();
    } catch (err) {
      setError(friendlyFetchError(err, "Could not save the note."));
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(note: Note) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
  }

  async function handleDelete(id: number) {
    if (!session) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingId === id) resetForm();
    await fetchWithRetry(`${API_URL}/notes/${id}`, {
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
          <div className={styles.title}>Notes</div>
          <div className={styles.subtitle}>
            Create notes yourself, and Kairos will also save its own from things worth
            remembering in your conversations. Lines with plain arithmetic (e.g. 12 * 3 + 4)
            show their computed result automatically.
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitle}>{editingId ? "Edit note" : "New note"}</div>
          <form className={styles.form} onSubmit={handleSave}>
            <input
              className={styles.input}
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className={styles.textarea}
              placeholder="Write your note here. Arithmetic lines like 45 + 55 get computed automatically."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <NoteCalculations content={content} />
            <div className={styles.row}>
              <button className={styles.button} type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Create note"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
            {error && <div className={styles.errorText}>{error}</div>}
          </form>
        </div>

        {loadError && <div className={styles.errorText}>{loadError}</div>}

        <div className={styles.noteGrid}>
          {notes.length === 0 ? (
            <div className={styles.empty}>{loadError ? "" : "No notes yet."}</div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className={`${styles.noteCard} ${editingId === n.id ? styles.noteCardEditing : ""}`}
              >
                <div className={styles.noteCardHeader}>
                  <span className={styles.noteCardTitle}>{n.title}</span>
                  <div className={styles.noteCardActions}>
                    <button className={styles.editButton} onClick={() => handleEdit(n)}>
                      Edit
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() => setConfirmingDeleteId(n.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className={styles.noteCardContent}>{n.content}</div>
                <NoteCalculations content={n.content} />
              </div>
            ))
          )}
        </div>

        <ConfirmDialog
          open={confirmingDeleteId !== null}
          message="Delete this note? This can't be undone."
          confirmLabel="Delete it"
          onCancel={() => setConfirmingDeleteId(null)}
          onConfirm={() => {
            if (confirmingDeleteId !== null) handleDelete(confirmingDeleteId);
            setConfirmingDeleteId(null);
          }}
        />
      </div>
    </div>
  );
}
