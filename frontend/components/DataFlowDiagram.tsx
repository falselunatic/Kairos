import styles from "./DataFlowDiagram.module.css";

const STEPS = [
  { title: "Document uploaded", subtitle: ".txt / .md / .pdf / .docx" },
  { title: "Split into chunks", subtitle: "~800 characters each, on paragraph breaks" },
  { title: "Each chunk embedded", subtitle: "fastembed (local, ONNX) → a 384-number vector" },
  { title: "Stored in doc_chunks", subtitle: "the vector goes in a pgvector column" },
];

const DIVIDER = "later, when you ask a question about it";

const STEPS_2 = [
  { title: "Your question embedded", subtitle: "same fastembed model, same 384-number vector" },
  { title: "Compared to every stored vector", subtitle: "cosine similarity, via the match_doc_chunks RPC" },
  { title: "Closest 5 chunks retrieved", subtitle: "the ones whose vectors are nearest to your question's" },
  { title: "Sent to Groq with your question", subtitle: "the LLM reads them and writes the answer" },
];

function Step({ title, subtitle, y }: { title: string; subtitle: string; y: number }) {
  return (
    <g>
      <rect x={40} y={y} width={340} height={54} rx={12} className={styles.box} />
      <text x={210} y={y + 22} textAnchor="middle" className={styles.boxTitle}>
        {title}
      </text>
      <text x={210} y={y + 40} textAnchor="middle" className={styles.boxSubtitle}>
        {subtitle}
      </text>
    </g>
  );
}

function DownArrow({ y }: { y: number }) {
  return <line x1={210} y1={y} x2={210} y2={y + 22} className={styles.arrow} markerEnd="url(#df-arrowhead)" />;
}

export function DataFlowDiagram() {
  const stepGap = 78;
  const dividerY = 40 + STEPS.length * stepGap + 6;

  return (
    <svg viewBox={`0 0 420 ${dividerY + 34 + STEPS_2.length * stepGap + 30}`} xmlns="http://www.w3.org/2000/svg" className={styles.svg}>
      <defs>
        <marker id="df-arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="6" orient="auto">
          <path d="M0,0 L4,6 L8,0 L4,4 Z" className={styles.arrowHead} />
        </marker>
      </defs>

      {STEPS.map((step, i) => (
        <g key={step.title}>
          <Step {...step} y={40 + i * stepGap} />
          {i < STEPS.length - 1 && <DownArrow y={40 + i * stepGap + 54} />}
        </g>
      ))}

      <line x1={20} y1={dividerY} x2={400} y2={dividerY} className={styles.divider} />
      <text x={210} y={dividerY + 20} textAnchor="middle" className={styles.dividerLabel}>
        {DIVIDER}
      </text>

      {STEPS_2.map((step, i) => {
        const y = dividerY + 34 + i * stepGap;
        return (
          <g key={step.title}>
            <Step {...step} y={y} />
            {i < STEPS_2.length - 1 && <DownArrow y={y + 54} />}
          </g>
        );
      })}
    </svg>
  );
}
