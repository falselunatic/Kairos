"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GraphEdge, GraphNode, initNodes, stepSimulation } from "@/lib/forceGraph";
import styles from "./galaxy.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type RawNode = { id: number; content: string; created_at: string; cluster: number };
type GraphResponse = { nodes: RawNode[]; edges: GraphEdge[] };

function clusterColor(cluster: number): string {
  const hue = (cluster * 137.508) % 360;
  return `hsl(${hue}, 70%, 62%)`;
}

export default function MemoryGalaxyPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [empty, setEmpty] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const draggingRef = useRef<number | null>(null);
  const hoveredRef = useRef<GraphNode | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/memories/graph`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data: GraphResponse) => {
        if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
          setEmpty(true);
          return;
        }
        const wrap = wrapRef.current;
        const width = wrap?.clientWidth || 800;
        const height = wrap?.clientHeight || 500;
        nodesRef.current = initNodes(data.nodes, width, height);
        edgesRef.current = Array.isArray(data.edges) ? data.edges : [];
        setEdges(edgesRef.current);
      })
      .catch(() => setEmpty(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    const nodes = nodesRef.current;
    const byId = new Map(nodes.map((n) => [n.id, n]));

    ctx.lineCap = "round";
    for (const edge of edgesRef.current) {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(180, 100, 140, ${edge.weight * 0.35})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const n of nodes) {
      const isHovered = hoveredRef.current?.id === n.id;
      const color = clusterColor(n.cluster);
      ctx.save();
      ctx.shadowBlur = isHovered ? 22 : 12;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, isHovered ? n.radius + 2 : n.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || empty) return;
    const maybeContext = canvas.getContext("2d");
    if (!maybeContext) return;
    const context: CanvasRenderingContext2D = maybeContext;

    let raf = 0;
    let stopped = false;

    function resize() {
      if (!canvas || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      sizeRef.current = { width, height };
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function tick() {
      if (stopped) return;
      const { width, height } = sizeRef.current;
      stepSimulation(nodesRef.current, edgesRef.current, width, height, draggingRef.current);
      draw(context, width, height);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [draw, empty, loading]);

  function nodeAt(clientX: number, clientY: number): GraphNode | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (const n of nodesRef.current) {
      const dx = n.x - x;
      const dy = n.y - y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return n;
    }
    return null;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const node = nodeAt(e.clientX, e.clientY);
    if (node) {
      draggingRef.current = node.id;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggingRef.current !== null) {
      const dragged = nodesRef.current.find((n) => n.id === draggingRef.current);
      if (dragged) {
        dragged.x = x;
        dragged.y = y;
        dragged.vx = 0;
        dragged.vy = 0;
      }
      return;
    }

    hoveredRef.current = nodeAt(e.clientX, e.clientY);
    canvas.style.cursor = hoveredRef.current ? "pointer" : "grab";
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (draggingRef.current !== null) {
      const node = nodesRef.current.find((n) => n.id === draggingRef.current);
      draggingRef.current = null;
      // A drag that never really moved is treated as a click/tap on the node.
      if (node && Math.hypot(e.movementX, e.movementY) < 40) {
        setSelected(node);
      }
      return;
    }
    const node = nodeAt(e.clientX, e.clientY);
    if (node) setSelected(node);
  }

  async function handleDeleteSelected() {
    if (!selected || !session) return;
    const id = selected.id;
    nodesRef.current = nodesRef.current.filter((n) => n.id !== id);
    edgesRef.current = edgesRef.current.filter((e) => e.source !== id && e.target !== id);
    setEdges(edgesRef.current);
    setSelected(null);
    setConfirmingDelete(false);
    await fetch(`${API_URL}/memories/${id}`, {
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
            <div className={styles.title}>Memory Galaxy</div>
            <div className={styles.subtitle}>
              Every memory Kairos has, laid out by how related they are. Drag stars around, tap one to read it.
            </div>
          </div>
          <Link href="/memories" className={styles.backButton}>
            List view
          </Link>
        </div>

        <div className={styles.canvasWrap} ref={wrapRef}>
          {loading ? (
            <div className={styles.empty}>Loading your galaxy...</div>
          ) : empty ? (
            <div className={styles.empty}>
              Nothing to show yet.
              <br />
              Go chat with Kairos and come back once it's remembered a few things.
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          )}

          {selected && (
            <div className={styles.detailPanel}>
              <div className={styles.detailContent}>{selected.content}</div>
              <div className={styles.detailMeta}>
                {new Date(selected.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className={styles.detailActions}>
                <button className={styles.detailButton} onClick={() => setSelected(null)}>
                  Close
                </button>
                <button
                  className={`${styles.detailButton} ${styles.detailDelete}`}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Forget
                </button>
              </div>
            </div>
          )}
        </div>

        {!loading && !empty && edges.length === 0 && (
          <div className={styles.hint}>
            No strong connections found yet between your memories - as Kairos learns more, related ones will start drifting together.
          </div>
        )}

        <ConfirmDialog
          open={confirmingDelete}
          message="Forget this memory? This can't be undone."
          confirmLabel="Forget it"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDeleteSelected}
        />
      </div>
    </div>
  );
}
