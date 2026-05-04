import type { WaypointGraph, WaypointNode, WaypointEdge } from '@/domain';
import type { ShaftQueueSnapshot } from '@/stores';

const NODE_RADIUS = 10;
const NODE_RADIUS_SELECTED = 14;
const EDGE_WIDTH = 1.5;
const ARROW_SIZE = 8;

// 노드 타입별 색상
const NODE_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  entry:     { fill: '#22c55e', stroke: '#16a34a', label: 'E' },    // 초록
  exit:      { fill: '#ef4444', stroke: '#dc2626', label: 'X' },    // 빨강
  zone:      { fill: '#3b82f6', stroke: '#2563eb', label: 'Z' },    // 파랑
  attractor: { fill: '#f59e0b', stroke: '#d97706', label: 'A' },    // 노랑
  hub:       { fill: '#8b5cf6', stroke: '#7c3aed', label: 'H' },    // 보라
  rest:      { fill: '#f59e0b', stroke: '#d97706', label: 'R' },    // 앰버 (rest zone 컬러와 일치)
  bend:      { fill: '#64748b', stroke: '#475569', label: '·' },    // slate (작은 점)
  portal:    { fill: '#06b6d4', stroke: '#0891b2', label: '↕' },    // cyan (층/동 간 이동)
};

const EDGE_COLOR_DARK = 'rgba(148, 163, 184, 0.6)';  // slate-400 (dark bg)
const EDGE_COLOR_LIGHT = 'rgba(71, 85, 105, 0.5)';   // slate-600 (light bg) — soft but legible
const EDGE_COLOR_SELECTED = 'rgba(99, 102, 241, 0.8)'; // indigo-500

/**
 * 웨이포인트 그래프 렌더러
 * - 에지: 노드 간 선분 + 방향 화살표
 * - 노드: 타입별 색상 원 + 라벨
 */
export function renderWaypoints(
  ctx: CanvasRenderingContext2D,
  graph: WaypointGraph,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  isDark: boolean,
  ghostNode: { position: { x: number; y: number }; type: string } | null = null,
  zoom: number = 1,
  showLabels: boolean = true,
  shaftQueues?: ReadonlyMap<string, ShaftQueueSnapshot>,
  showNodes: boolean = true,
  showEdges: boolean = true,
) {
  // Build a per-portal lookup { count, maxProgress } so each portal can render its
  // own badge + progress arc regardless of which shaft it belongs to.
  const portalStats = new Map<string, { total: number; maxProgress: number; boarding: number }>();
  if (shaftQueues) {
    for (const { boarding, queued } of shaftQueues.values()) {
      for (const b of boarding) {
        const s = portalStats.get(b.nodeId) ?? { total: 0, maxProgress: 0, boarding: 0 };
        s.total++;
        s.boarding++;
        if (b.progress > s.maxProgress) s.maxProgress = b.progress;
        portalStats.set(b.nodeId, s);
      }
      for (const q of queued) {
        const s = portalStats.get(q.nodeId) ?? { total: 0, maxProgress: 0, boarding: 0 };
        s.total++;
        portalStats.set(q.nodeId, s);
      }
    }
  }

  const fs = (basePx: number) => Math.max(4, basePx / Math.max(zoom, 0.3));
  // Keep strokes at constant screen-pixel width regardless of zoom
  const px = 1 / Math.max(zoom, 0.3);
  const arrowSize = ARROW_SIZE * px;
  const edgeColor = isDark ? EDGE_COLOR_DARK : EDGE_COLOR_LIGHT;
  const nodeMap = new Map<string, WaypointNode>();
  for (const node of graph.nodes) nodeMap.set(node.id as string, node);

  // ── 1. Edges ──
  if (showEdges) for (const edge of graph.edges) {
    const from = nodeMap.get(edge.fromId as string);
    const to = nodeMap.get(edge.toId as string);
    if (!from || !to) continue;

    const isSelected = (edge.id as string) === selectedEdgeId;
    const lineColor = isSelected ? EDGE_COLOR_SELECTED : edgeColor;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = (isSelected ? EDGE_WIDTH + 0.75 : EDGE_WIDTH) * px;
    ctx.setLineDash([]);

    // Line
    ctx.beginPath();
    ctx.moveTo(from.position.x, from.position.y);
    ctx.lineTo(to.position.x, to.position.y);
    ctx.stroke();

    // Arrow head (at "to" end) — uses same color as line
    ctx.fillStyle = lineColor;
    drawArrow(ctx, from.position.x, from.position.y, to.position.x, to.position.y, NODE_RADIUS, arrowSize);

    // Bidirectional: arrow at "from" end too
    if (edge.direction === 'bidirectional') {
      drawArrow(ctx, to.position.x, to.position.y, from.position.x, from.position.y, NODE_RADIUS, arrowSize);
    }

    // passWeight label on edge midpoint (if != 1.0)
    if (edge.passWeight !== 1.0) {
      const mx = (from.position.x + to.position.x) / 2;
      const my = (from.position.y + to.position.y) / 2;
      ctx.font = `${fs(10)}px sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(edge.passWeight.toFixed(1), mx, my - 4);
    }
  }

  // ── 2. Nodes ──
  if (showNodes) for (const node of graph.nodes) {
    const isSelected = (node.id as string) === selectedNodeId;
    const r = isSelected ? NODE_RADIUS_SELECTED : NODE_RADIUS;
    const colors = NODE_COLORS[node.type] ?? NODE_COLORS.zone;
    const { x, y } = node.position;

    // Shadow for selected
    if (isSelected) {
      ctx.shadowColor = colors.fill;
      ctx.shadowBlur = 12;
    }

    // Circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    // Unshafted portal: warning orange stroke
    const unshaftedPortal = node.type === 'portal' && !node.shaftId;
    ctx.strokeStyle = isSelected ? '#ffffff' : (unshaftedPortal ? '#f97316' : colors.stroke);
    ctx.lineWidth = (isSelected ? 2 : unshaftedPortal ? 2 : 1.25) * px;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Type letter inside
    ctx.font = `bold ${fs(isSelected ? 13 : 11)}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(colors.label, x, y);

    // ── Shaft queue overlay (portal only) ──
    if (node.type === 'portal') {
      const stats = portalStats.get(node.id as string);
      if (stats && stats.total > 0) {
        // Travel progress arc (only when someone is boarding)
        if (stats.boarding > 0 && stats.maxProgress > 0) {
          const arcR = r + 4 * px;
          ctx.beginPath();
          ctx.arc(x, y, arcR, -Math.PI / 2, -Math.PI / 2 + stats.maxProgress * Math.PI * 2);
          ctx.strokeStyle = '#22d3ee'; // cyan-400
          ctx.lineWidth = 2 * px;
          ctx.stroke();
        }
        // Queue count badge (top-right)
        const badgeR = 7 * px;
        const bx = x + r * 0.75;
        const by = y - r * 0.75;
        ctx.beginPath();
        ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = '#0891b2'; // cyan-600
        ctx.fill();
        ctx.strokeStyle = isDark ? '#0e7490' : '#ffffff';
        ctx.lineWidth = 1.25 * px;
        ctx.stroke();
        ctx.font = `bold ${fs(9)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(stats.total), bx, by);
      }
    }

    // Label above (hidden when labels are toggled off)
    if (showLabels && node.label) {
      ctx.font = `${fs(11)}px sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(node.label, x, y - r - 4);
    }
  }

  // ── 3. Ghost node preview ──
  if (ghostNode) {
    const colors = NODE_COLORS[ghostNode.type] ?? NODE_COLORS.zone;
    const { x, y } = ghostNode.position;
    const r = NODE_RADIUS;

    ctx.globalAlpha = 0.45;

    // Dashed circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    ctx.setLineDash([4 * px, 3 * px]);
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.25 * px;
    ctx.stroke();
    ctx.setLineDash([]);

    // Type letter
    ctx.font = `bold ${fs(11)}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(colors.label, x, y);

    ctx.globalAlpha = 1.0;
  }
}

/** Draw an arrowhead pointing toward (tx, ty) stopping at nodeRadius from target */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  fx: number, fy: number, tx: number, ty: number,
  nodeRadius: number,
  size: number,
) {
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < nodeRadius * 2) return;

  const angle = Math.atan2(dy, dx);
  const tipX = tx - Math.cos(angle) * nodeRadius;
  const tipY = ty - Math.sin(angle) * nodeRadius;

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - size * Math.cos(angle - Math.PI / 6),
    tipY - size * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    tipX - size * Math.cos(angle + Math.PI / 6),
    tipY - size * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}
