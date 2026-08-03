"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { BrandName } from "@/components/BrandName";
import { Markdown } from "@/components/Markdown";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { extractErrorDetail, fetchWithRetry, friendlyFetchError } from "@/lib/errors";
import { blurActiveElement } from "@/lib/dom";
import styles from "./docs.module.css";

type Doc = { id: number; title: string; created_at: string };
type QA = { question: string; answer: string; searchUrl: string | null };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

export default function DocsPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState<QA[]>([]);
  const [asking, setAsking] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [confirmingClearQa, setConfirmingClearQa] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    loadDocs();
    loadQaHistory();
    // Depend on the token string, not the Session object - AuthProvider emits a new
    // Session reference (same token) shortly after mount, which would otherwise
    // re-trigger this effect a couple seconds after the page already loaded fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  function loadQaHistory() {
    if (!session) return;
    fetchWithRetry(`${API_URL}/history?channel=docs`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!Array.isArray(data)) return;
        const pairs: QA[] = [];
        for (let i = 0; i + 1 < data.length; i += 2) {
          pairs.push({ question: data[i].content, answer: data[i + 1].content, searchUrl: null });
        }
        setQaHistory(pairs);
      })
      .catch(() => {});
  }

  function loadDocs() {
    if (!session) return;
    fetchWithRetry(`${API_URL}/docs`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load your documents.");
        return res.json();
      })
      .then((data) => {
        setDocs(Array.isArray(data) ? data : []);
        setLoadError("");
      })
      .catch((err) => setLoadError(friendlyFetchError(err, "Could not load your documents.")));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setFiles(selected);
    setContent("");
    // Always reflect the newly chosen file(s), not just when the title was empty.
    setTitle(selected.length === 1 ? stripExtension(selected[0].name) : "");
  }

  async function uploadOne(title: string, file: File) {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);
    const res = await fetch(`${API_URL}/docs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: formData,
    });
    if (!res.ok) {
      throw new Error(
        `Upload failed for "${title}" (${res.status}). Check the backend is running and the documents schema is set up.`
      );
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError("");

    if (files.length === 0 && !content.trim()) {
      setUploadError("Paste some text, or choose file(s) to upload.");
      return;
    }
    if (files.length === 0 && !title.trim()) {
      setUploadError("Give the document a title.");
      return;
    }
    if (!session) return;

    setUploading(true);
    const failures: string[] = [];
    try {
      if (files.length > 0) {
        for (const file of files) {
          const fileTitle = files.length === 1 && title.trim() ? title : stripExtension(file.name);
          try {
            await uploadOne(fileTitle, file);
          } catch (err) {
            failures.push(friendlyFetchError(err, `Upload failed for "${fileTitle}".`));
          }
        }
      } else {
        await uploadOne(title, new File([content], `${title}.txt`, { type: "text/plain" }));
      }
      if (failures.length > 0) {
        setUploadError(failures.join(" "));
      } else {
        setTitle("");
        setContent("");
        setFiles([]);
      }
    } catch (err) {
      setUploadError(friendlyFetchError(err, "Upload failed."));
    } finally {
      // Always refresh so any files that did succeed show up, even if a later
      // one in the batch failed.
      loadDocs();
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!session) return;
    const previous = docs;
    setDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      const res = await fetch(`${API_URL}/docs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Could not delete the document.");
    } catch (err) {
      setDocs(previous);
      setLoadError(friendlyFetchError(err, "Could not delete the document."));
    }
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    blurActiveElement();
    if (!question.trim() || !session) return;
    const asked = question;
    setAsking(true);
    try {
      const res = await fetch(`${API_URL}/docs/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question: asked,
          history: qaHistory.slice(-3).map((qa) => ({ question: qa.question, answer: qa.answer })),
        }),
      });
      if (!res.ok) throw new Error(await extractErrorDetail(res));
      const data = await res.json();
      setQaHistory((prev) => [
        ...prev,
        { question: asked, answer: data.answer, searchUrl: data.search_url ?? null },
      ]);
      setQuestion("");
    } catch (err) {
      setQaHistory((prev) => [
        ...prev,
        { question: asked, answer: friendlyFetchError(err, "Could not get an answer."), searchUrl: null },
      ]);
    } finally {
      setAsking(false);
    }
  }

  if (authLoading || !session) {
    return null;
  }

  const fileButtonLabel =
    files.length === 0
      ? "Choose file(s) (.txt, .md, .pdf, .docx)"
      : files.length === 1
        ? files[0].name
        : `${files.length} files selected`;

  return (
    <div className={styles.page}>
      <Sidebar />
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.title}>Docs Q&A</div>
          <div className={styles.subtitle}>
            Upload text, then ask <BrandName /> questions about it.
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitle}>Upload a document</div>
          <form className={styles.uploadForm} onSubmit={handleUpload}>
            {files.length <= 1 && (
              <input
                className={styles.input}
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
            {files.length === 0 && (
              <textarea
                className={styles.textarea}
                placeholder="Paste text here, or choose file(s) below (.txt, .md, .pdf, .docx)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            )}
            <div className={styles.row}>
              <button
                type="button"
                className={styles.fileButton}
                onClick={() => fileInputRef.current?.click()}
              >
                {fileButtonLabel}
              </button>
              <input
                ref={fileInputRef}
                className={styles.hiddenFileInput}
                type="file"
                accept=".txt,.md,.pdf,.docx"
                multiple
                onChange={handleFileChange}
              />
              <button className={styles.button} type="submit" disabled={uploading}>
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
            {uploadError && <div className={styles.errorText}>{uploadError}</div>}
          </form>

          {loadError && <div className={styles.errorText}>{loadError}</div>}

          <div className={styles.docList}>
            {docs.length === 0 ? (
              <div className={styles.empty}>{loadError ? "" : "No documents uploaded yet."}</div>
            ) : (
              docs.map((d) => (
                <div key={d.id} className={styles.docItem}>
                  <span>{d.title}</span>
                  <button
                    className={styles.deleteButton}
                    onClick={() => setConfirmingDeleteId(d.id)}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.row} style={{ justifyContent: "space-between" }}>
            <div className={styles.panelTitle}>Ask a question</div>
            {qaHistory.length > 0 && (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => setConfirmingClearQa(true)}
              >
                Clear
              </button>
            )}
          </div>
          <form className={styles.uploadForm} onSubmit={handleAsk}>
            <div className={styles.row}>
              <input
                className={styles.input}
                style={{ flex: 1, minWidth: 0 }}
                placeholder="What do you want to know?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button className={styles.button} type="submit" disabled={asking}>
                {asking ? "Thinking..." : "Ask"}
              </button>
            </div>
          </form>

          <div className={styles.qaHistory}>
            {[...qaHistory].reverse().map((qa, i) => (
              <div key={qaHistory.length - 1 - i} className={styles.qaItem}>
                <div className={styles.qaQuestion}>{qa.question}</div>
                <div className={styles.answer}>
                  <Markdown content={qa.answer} />
                  {qa.searchUrl && (
                    <a
                      className={styles.searchLink}
                      href={qa.searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Search Google for this instead
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <ConfirmDialog
          open={confirmingClearQa}
          message="Clear this question history? This can't be undone."
          confirmLabel="Clear it"
          onCancel={() => setConfirmingClearQa(false)}
          onConfirm={() => {
            setConfirmingClearQa(false);
            setQaHistory([]);
            if (session) {
              fetch(`${API_URL}/history?channel=docs`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
            }
          }}
        />

        <ConfirmDialog
          open={confirmingDeleteId !== null}
          message="Delete this document? This can't be undone."
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
