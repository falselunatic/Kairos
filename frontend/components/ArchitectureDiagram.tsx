import styles from "./ArchitectureDiagram.module.css";

function Box({ x, y, w, h, title, subtitle }: { x: number; y: number; w: number; h: number; title: string; subtitle?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} className={styles.box} />
      <text x={x + w / 2} y={y + h / 2 + (subtitle ? -4 : 5)} textAnchor="middle" className={styles.boxTitle}>
        {title}
      </text>
      {subtitle && (
        <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" className={styles.boxSubtitle}>
          {subtitle}
        </text>
      )}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label?: string }) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const labelY = midY - 8;
  // Rough width estimate so the backing rect covers the text without measuring the DOM.
  const labelW = label ? label.length * 6.4 + 10 : 0;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles.arrow} markerEnd="url(#arrowhead)" />
      {label && (
        <>
          <rect
            x={midX - labelW / 2}
            y={labelY - 11}
            width={labelW}
            height={16}
            rx={4}
            className={styles.arrowLabelBg}
          />
          <text x={midX} y={labelY} textAnchor="middle" className={styles.arrowLabel}>
            {label}
          </text>
        </>
      )}
    </g>
  );
}

export function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 760 380" xmlns="http://www.w3.org/2000/svg" className={styles.svg}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" className={styles.arrowHead} />
        </marker>
      </defs>

      {/* row 1: entry points */}
      <Box x={30} y={20} w={190} h={60} title="Chrome extension" subtitle="Manifest V3, no build step" />
      <Box x={280} y={20} w={200} h={60} title="Frontend" subtitle="Next.js, :3000" />
      <Box x={540} y={20} w={190} h={60} title="You" subtitle="browser" />

      {/* row 2: backend hub */}
      <Box x={280} y={160} w={200} h={60} title="Backend" subtitle="FastAPI, :8000" />

      {/* row 3: everything the backend talks to */}
      <Box x={30} y={300} w={210} h={60} title="Supabase" subtitle="Postgres + pgvector + Auth" />
      <Box x={275} y={300} w={210} h={60} title="fastembed" subtitle="local embeddings (ONNX)" />
      <Box x={520} y={300} w={210} h={60} title="Groq API" subtitle="LLM" />

      <Arrow x1={125} y1={80} x2={300} y2={160} label="HTTP" />
      <Arrow x1={380} y1={80} x2={380} y2={160} label="HTTP" />
      <Arrow x1={635} y1={80} x2={460} y2={160} label="HTTP" />

      <Arrow x1={340} y1={220} x2={150} y2={300} label="REST/RPC" />
      <Arrow x1={380} y1={220} x2={380} y2={300} />
      <Arrow x1={420} y1={220} x2={600} y2={300} label="chat calls" />
    </svg>
  );
}
