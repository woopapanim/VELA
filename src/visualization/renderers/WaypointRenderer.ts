import type { WaypointGraph, WaypointNode, WaypointEdge } from '@/domain';

const NODE_RADIUS = 10;
const NODE_RADIUS_SELECTED = 14;
const EDGE_WIDTH = 2;
const ARROW_SIZE = 8;
const LABEL_FONT = '11px sans-serif';

// 노드 타입별 색상
const NODE_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  entry:     { fill: '#22c55e', stroke: '#16a34a', label: 'E' },    // 초록
  exit:      { fill: '#ef4444', stroke: '#dc2626', label: 'X' },    // 빨강
  zone:      { fill: '#3b82f6', stroke: '#2563eb', label: 'Z' },    // 파랑
  attractor: { fill: '#f59e0b', stroke: '#d97706', label: 'A' },    // 노랑
  hub:       { fill: '#8b5cf6', stroke: '#7c3aed', label: 'H' },    // 보라
  rest:      { fill: '#9ca3af', stroke: '#6b7280', label: 'R' },    // 회색
  bend:      { fill: '#64748b', stroke: '#475569', label: '·' },    // slate (작은 점)
};

const EDGE_COLOR = 'rgba(148, 163, 184, 0.6)';      // slate-400
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
) {
  const fs = (basePx: number) => Math.max(4, basePx / Math.max(zoom, 0.3));
  const nodeMap = new Map<string, WaypointNode>();
  for (const node of graph.nodes) nodeMap.set(node.id as string, node);

  // ── 1. Edges ──
  for (const edge of graph.edges) {
    const from = nodeMap.get(edge.fromId as string);
    const to = nodeMap.get(edge.toId as string);
    if (!from || !to) continue;

    const isSelected = (edge.id as string) === selectedEdgeId;
    ctx.strokeStyle = isSelected ? EDGE_COLOR_SELECTED : EDGE_COLOR;
    ctx.lineWidth = isSelected ? EDGE_WIDTH + 1 : EDGE_WIDTH;
    ctx.setLineDash([]);

    // Line
    ctx.beginPath();
    ctx.moveTo(from.position.x, from.position.y);
    ctx.lineTo(to.position.x, to.position.y);
    ctx.stroke();

    // Arrow head (at "to" end)
    drawArrow(ctx, from.position.x, from.position.y, to.position.x, to.position.y, NODE_RADIUS);

    // Bidirectional: arrow at "from" end too
    if (edge.direction === 'bidirectional') {
      drawArrow(ctx, to.position.x, to.position.y, from.position.x, from.position.y, NODE_RADIUS);
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
  for (const node of graph.nodes) {
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
    ctx.strokeStyle = isSelected ? '#ffffff' : colors.stroke;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Type letter inside
    ctx.font = `bold ${fs(isSelected ? 13 : 11)}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(colors.label, x, y);

    // Label above
    if (node.label && showLabels) {
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
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 2;
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
) {
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < nodeRadius * 2) return;

  const angle = Math.atan2(dy, dx);
  // Arrow tip stops at nodeRadius from target center
  const tipX = tx - Math.cos(angle) * nodeRadius;
  const tipY = ty - Math.sin(angle) * nodeRadius;

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - ARROW_SIZE * Math.cos(angle - Math.PI / 6),
    tipY - ARROW_SIZE * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    tipX - ARROW_SIZE * Math.cos(angle + Math.PI / 6),
    tipY - ARROW_SIZE * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}
