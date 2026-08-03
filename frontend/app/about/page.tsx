"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { BrandName } from "@/components/BrandName";
import { Markdown } from "@/components/Markdown";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { SchemaDiagram } from "@/components/SchemaDiagram";
import { extractErrorDetail, friendlyFetchError } from "@/lib/errors";
import { blurActiveElement } from "@/lib/dom";
import { DataFlowDiagram } from "@/components/DataFlowDiagram";
import styles from "./about.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STACK = [
  {
    title: "Frontend",
    body: "Next.js (App Router). Pages for chat, a coding assistant, document Q&A, notes, memories, a roast battle game, and this about page, all sharing one persistent left sidebar.",
  },
  {
    title: "Backend",
    body: "FastAPI (Python). Talks to Supabase over its HTTPS REST/RPC API rather than a raw database connection, so it keeps working even on networks that block direct Postgres connections.",
  },
  {
    title: "Auth",
    body: "Supabase Auth: email/password with an OTP code for verification, plus Google sign-in. Tokens are verified on the backend via Supabase's JWKS endpoint, not a static secret, so it keeps working across key rotations.",
  },
  {
    title: "AI",
    body: "Groq serves the LLM (open-weight Llama models). Embeddings are generated locally via fastembed (ONNX), not an external API.",
  },
  {
    title: "Chrome extension",
    body: "Manifest V3, no build step. Proactively checks in and starts a roast battle based on your current browser tab, and links out to Chat, Code, and Docs Q&A.",
  },
];

const TABLES = [
  { name: "messages", desc: "Every chat message, tagged with a channel (chat vs code) so the two have separate histories." },
  { name: "memories", desc: "Short facts extracted from conversations across chat, Kairos Code, and doc Q&A. Each has a vector embedding for similarity search." },
  { name: "documents", desc: "Metadata for each uploaded file: title, owner, upload time." },
  { name: "doc_chunks", desc: "Uploaded files split into chunks, each with its own embedding, used to answer questions about them." },
  { name: "notes", desc: "Notes you write yourself, plus notes Kairos writes on its own when a conversation has something worth saving." },
  { name: "roast_battles", desc: "One row per battle: running scores, status, and the eventual winner." },
  { name: "roast_rounds", desc: "One row per round of a battle: each line thrown and its wit score." },
];

const DATA_FLOW = [
  "You send a message. It's embedded locally, then used to search Postgres for similar past memories.",
  "That message plus any relevant memories go to Groq, which generates a reply.",
  "A second Groq call decides if anything from the exchange is worth remembering. If so, it's embedded and saved to memories.",
  "A third Groq call decides, separately, if the exchange is worth saving as a note. If so, Kairos writes one on its own, no need to ask.",
  "Uploading a doc extracts its text, splits it into chunks, and embeds each chunk into doc_chunks.",
  "Asking a question about a doc embeds the question, finds the closest chunks, and sends them to Groq as context for the answer.",
  "A roast battle line comes from the same memory store (or, via the extension, your current browser tab), and a separate Groq call judges each round.",
];

export default function AboutPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    }
  }, [authLoading, session, router]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    blurActiveElement();
    if (!question.trim() || !session) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await fetch(`${API_URL}/about/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(await extractErrorDetail(res));
      const data = await res.json();
      setAnswer(data.reply);
    } catch (err) {
      setAnswer(friendlyFetchError(err, "Something went wrong, try again."));
    } finally {
      setAsking(false);
    }
  }

  if (authLoading || !session) {
    return null;
  }

  let delay = 0;
  const nextDelay = () => {
    delay += 0.06;
    return { animationDelay: `${delay}s` };
  };

  return (
    <div className={styles.page}>
      <Sidebar />
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.title}>
            How <BrandName showTooltip={false} /> is built
          </div>
          <div className={styles.subtitle}>
            The full tech stack, the database, and how data actually moves.
          </div>
        </div>

        <div className={styles.panel} style={nextDelay()}>
          <div className={styles.sectionTitle}>The stack</div>
          {STACK.map((s) => (
            <div key={s.title} className={styles.sectionBody} style={{ marginBottom: "0.6rem" }}>
              <strong>{s.title}:</strong> {s.body}
            </div>
          ))}
        </div>

        <div className={styles.panel} style={nextDelay()}>
          <div className={styles.sectionTitle}>Database tables</div>
          <SchemaDiagram />
          <div className={styles.tableGrid}>
            {TABLES.map((t) => (
              <div key={t.name} className={styles.tableCard}>
                <div className={styles.tableName}>{t.name}</div>
                <div className={styles.tableDesc}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panel} style={nextDelay()}>
          <div className={styles.sectionTitle}>Architecture diagram</div>
          <ArchitectureDiagram />
        </div>

        <div className={styles.panel} style={nextDelay()}>
          <div className={styles.sectionTitle}>How a document gets split, embedded, and searched</div>
          <DataFlowDiagram />
        </div>

        <div className={styles.panel} style={nextDelay()}>
          <div className={styles.sectionTitle}>How data flows</div>
          <div className={styles.flow}>
            {DATA_FLOW.map((step, i) => (
              <div key={i} className={styles.flowStep}>
                <div className={styles.flowNumber}>{i + 1}</div>
                <div>{step}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panel} style={nextDelay()}>
          <div className={styles.sectionTitle}>What's common across every feature</div>
          <div className={styles.sectionBody}>
            The same Postgres database, the same local embedding model, the same Groq
            LLM, and the same per-user memory store, every feature reads from and
            writes to the same shared foundation, which is how Kairos Code or a doc
            question can end up shaping what it recalls in regular chat later.
          </div>
        </div>

        <div className={styles.panel} style={nextDelay()}>
          <div className={styles.sectionTitle}>Ask Kairos about itself</div>
          <form className={styles.askForm} onSubmit={handleAsk}>
            <input
              className={styles.askInput}
              placeholder="e.g. what happens when I upload a PDF?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button className={styles.askButton} type="submit" disabled={asking}>
              {asking ? "Thinking..." : "Ask"}
            </button>
          </form>
          {answer && (
            <div className={styles.askAnswer}>
              <Markdown content={answer} />
            </div>
          )}
        </div>

        <div className={styles.free}>Open source, end to end.</div>
      </div>
    </div>
  );
}
