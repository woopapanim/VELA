/**
 * OutsideQueueRenderer — Phase 1 (2026-04-25)
 *
 * 입장 정책 (concurrent-cap / rate-limit / time-slot / hybrid) 으로
 * admit 이 throttle 될 때, entry node 바깥에서 대기 중인 사람들을 시각화.
 *
 * unlimited 모드에선 entryQueue 가 항상 비어있어 no-op (회귀 0).
 *
 * 표시 요소:
 *   1) Entry node 주위에 동심 dot ring — 큐 인원수 ≤ 10 명까진 1:1, 초과는 "+N"
 *   2) 노드 위에 count badge + 가장 오래 기다린 시간 (mm:ss)
 *   3) 색상: 30s 미만 = 초록, 60s 미만 = 노랑, 그 이상 = 빨강 (urgency)
 *
 * 관련 spec: docs/specs/phase-1-operations-policy.md §3.2
 */

import type { WaypointGraph, WaypointNode } from '@/domain';
import type { EntryQueueState } from '@/stores';

const RING_RADIUS_BASE = 22;       // entry node 반경 ~12 보다 살짝 바깥
const DOT_RADIUS = 3;
const MAX_VISIBLE_DOTS = 10;

function urgencyColor(oldestWaitMs: number, isDark: boolean): { fill: string; stroke: string } {
  if (oldestWaitMs >= 60_000) {
    return { fill: '#ef4444', stroke: '#b91c1c' }; // red — over 1min
  }
  if (oldestWaitMs >= 30_000) {
    return { fill: '#f59e0b', stroke: '#d97706' }; // amber — 30-60s
  }
  return isDark
    ? { fill: '#22c55e', stroke: '#15803d' } // green — fresh
    : { fill: '#16a34a', stroke: '#15803d' };
}

function fmtWait(ms: number): string {
  if (ms < 1000) return '0s';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function renderOutsideQueue(
  ctx: CanvasRenderingContext2D,
  graph: WaypointGraph | null | undefined,
  entryQueue: EntryQueueState | null | undefined,
  isDark: boolean,
  zoom: number,
) {
  if (!graph || !entryQueue || entryQueue.totalQueueLength === 0) return;
  if (entryQueue.byNode.size === 0) return;

  const px = 1 / Math.max(zoom, 0.3);
  const fs = (base: number) => Math.max(6, base / Math.max(zoom, 0.3));

  const nodeMap = new Map<string, WaypointNode>();
  for (const n of graph.nodes) nodeMap.set(n.id as string, n);

  for (const [nodeId, bucket] of entryQueue.byNode) {
    const node = nodeMap.get(nodeId);
    if (!node || node.type !== 'entry') continue;
    if (bucket.count <= 0) continue;

    const { x, y } = node.position;
    const colors = urgencyColor(bucket.oldestWaitMs, isDark);
    const ringR = RING_RADIUS_BASE * px;

    // ── 1) Soft halo background — 사람들이 모여있는 영역 표시 ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, ringR + DOT_RADIUS * px * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = isDark
      ? `${colors.fill}22`  // 13% opacity
      : `${colors.fill}1f`;
    ctx.fill();
    ctx.restore();

    // ── 2) Dot ring — 인원 수만큼 점 ──
    const dotsToDraw = Math.min(bucket.count, MAX_VISIBLE_DOTS);
    const dotR = DOT_RADIUS * px;
    for (let i = 0; i < dotsToDraw; i++) {
      const angle = (i / Math.max(dotsToDraw, 1)) * Math.PI * 2 - Math.PI / 2;
      const dx = x + Math.cos(angle) * ringR;
      const dy = y + Math.sin(angle) * ringR;
      ctx.beginPath();
      ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = colors.fill;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 0.8 * px;
      ctx.fill();
      ctx.stroke();
    }

    // ── 3) Count badge (위쪽) — "N대기" + 대기시간 ──
    const badgeText = bucket.count > MAX_VISIBLE_DOTS
      ? `+${bucket.count}`
      : `${bucket.count}`;
    const waitText = fmtWait(bucket.oldestWaitMs);
    const labelY = y - ringR - 6 * px;

    ctx.save();
    ctx.font = `bold ${fs(10)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // bg pill
    const padX = 4 * px;
    const padY = 2 * px;
    const tw = ctx.measureText(`${badgeText} · ${waitText}`).width;
    const pillW = tw + padX * 2;
    const pillH = fs(11) + padY * 2;
    ctx.fillStyle = isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1 * px;
    const pillX = x - pillW / 2;
    const pillY = labelY - pillH;
    const r = 3 * px;
    ctx.beginPath();
    ctx.moveTo(pillX + r, pillY);
    ctx.lineTo(pillX + pillW - r, pillY);
    ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + r);
    ctx.lineTo(pillX + pillW, pillY + pillH - r);
    ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH);
    ctx.lineTo(pillX + r, pillY + pillH);
    ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - r);
    ctx.lineTo(pillX, pillY + r);
    ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.fill;
    ctx.fillText(`${badgeText} · ${waitText}`, x, labelY - padY);
    ctx.restore();
  }
}
