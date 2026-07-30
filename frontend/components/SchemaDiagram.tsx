import styles from "./SchemaDiagram.module.css";

function Table({ x, y, w = 150, h = 58, title, cols }: { x: number; y: number; w?: number; h?: number; title: string; cols: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} className={styles.box} />
      <text x={x + w / 2} y={y + 22} textAnchor="middle" className={styles.boxTitle}>
        {title}
      </text>
      <text x={x + w / 2} y={y + 40} textAnchor="middle" className={styles.boxSubtitle}>
        {cols}
      </text>
    </g>
  );
}

function Link({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles.link} />;
}

const ROW2 = [
  { x: 15, title: "messages", cols: "role, content, channel" },
  { x: 185, title: "memories", cols: "content, embedding" },
  { x: 355, title: "documents", cols: "title" },
  { x: 525, title: "notes", cols: "title, content" },
  { x: 695, title: "roast_battles", cols: "scores, winner" },
];

export function SchemaDiagram() {
  const usersX = 340;
  const usersY = 15;
  const usersW = 210;
  const row2Y = 105;
  const row3Y = 200;

  return (
    <svg viewBox="0 0 870 265" xmlns="http://www.w3.org/2000/svg" className={styles.svg}>
      <Table x={usersX} y={usersY} w={usersW} title="auth.users" cols="Supabase Auth - one row per signed-up user" />

      {ROW2.map((t) => (
        <Link key={t.title} x1={usersX + usersW / 2} y1={usersY + 58} x2={t.x + 75} y2={row2Y} />
      ))}
      {ROW2.map((t) => (
        <Table key={t.title} x={t.x} y={row2Y} title={t.title} cols={t.cols} />
      ))}

      <Link x1={355 + 75} y1={row2Y + 58} x2={355 + 75} y2={row3Y} />
      <Table x={355} y={row3Y} title="doc_chunks" cols="content, embedding, document_id" />

      <Link x1={695 + 75} y1={row2Y + 58} x2={695 + 75} y2={row3Y} />
      <Table x={695} y={row3Y} title="roast_rounds" cols="line, score, battle_id" />
    </svg>
  );
}
