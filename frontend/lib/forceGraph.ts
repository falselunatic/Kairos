export type GraphNode = {
  id: number;
  content: string;
  created_at: string;
  cluster: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

export type GraphEdge = {
  source: number;
  target: number;
  weight: number;
};

const REPULSION = 1400;
const SPRING_LENGTH = 90;
const SPRING_STRENGTH = 0.02;
const CENTER_PULL = 0.006;
const DAMPING = 0.9;
const JITTER = 0.05;
const MAX_SIMULATED_NODES = 200;

export function initNodes(
  raw: { id: number; content: string; created_at: string; cluster: number }[],
  width: number,
  height: number
): GraphNode[] {
  const cx = width / 2;
  const cy = height / 2;
  return raw.slice(0, MAX_SIMULATED_NODES).map((n) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * Math.min(width, height) * 0.4;
    return {
      ...n,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      radius: Math.min(14, 5 + n.content.length / 22),
    };
  });
}

export function stepSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  draggingId: number | null
) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cx = width / 2;
  const cy = height / 2;

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    if (a.id === draggingId) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let distSq = dx * dx + dy * dy;
      if (distSq < 1) distSq = 1;
      const force = REPULSION / distSq;
      const dist = Math.sqrt(distSq);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      if (b.id !== draggingId) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }
  }

  for (const edge of edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    // Stronger similarity = shorter resting length, so tightly related memories cluster closer.
    const restLength = SPRING_LENGTH * (1.4 - edge.weight);
    const stretch = dist - restLength;
    const fx = (dx / dist) * stretch * SPRING_STRENGTH;
    const fy = (dy / dist) * stretch * SPRING_STRENGTH;
    if (a.id !== draggingId) {
      a.vx += fx;
      a.vy += fy;
    }
    if (b.id !== draggingId) {
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  for (const n of nodes) {
    if (n.id === draggingId) continue;
    n.vx += (cx - n.x) * CENTER_PULL;
    n.vy += (cy - n.y) * CENTER_PULL;
    n.vx += (Math.random() - 0.5) * JITTER;
    n.vy += (Math.random() - 0.5) * JITTER;
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;

    const margin = n.radius + 10;
    n.x = Math.max(margin, Math.min(width - margin, n.x));
    n.y = Math.max(margin, Math.min(height - margin, n.y));
  }
}
