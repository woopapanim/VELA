import type { MediaPlacement, Visitor } from '@/domain';
import { VISITOR_ACTION, MEDIA_SCALE } from '@/domain';

const CATEGORY_BORDER_COLORS: Record<string, string> = {
  analog: '#a78bfa',
  passive_media: '#3b82f6',
  active: '#f59e0b',
  immersive: '#ec4899',
};

export function renderMedia(
  ctx: CanvasRenderingContext2D,
  media: readonly MediaPlacement[],
  selectedMediaId: string | null,
  isDark: boolean,
  visitors?: readonly Visitor[],
  showDebug?: boolean,
) {
  // Pre-compute queue/watch counts
  const queueCounts = new Map<string, number>();
  const watchCounts = new Map<string, number>();
  if (visitors) {
    for (const v of visitors) {
      if (!v.isActive || !v.targetMediaId) continue;
      const key = v.targetMediaId as string;
      if (v.currentAction === VISITOR_ACTION.WAITING) {
        queueCounts.set(key, (queueCounts.get(key) ?? 0) + 1);
      } else if (v.currentAction === VISITOR_ACTION.WATCHING) {
        watchCounts.set(key, (watchCounts.get(key) ?? 0) + 1);
      }
    }
  }

  for (const m of media) {
    const { position } = m;
    const isSelected = (m.id as string) === selectedMediaId;
    const pw = m.size.width * MEDIA_SCALE;
    const ph = m.size.height * MEDIA_SCALE;
    const rad = (m.orientation * Math.PI) / 180;
    const watchCount = watchCounts.get(m.id as string) ?? 0;
    const queueCount = queueCounts.get(m.id as string) ?? 0;
    const isActive = (m as any).interactionType === 'active';

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(rad);

    // ── Debug: viewing area (only when showDebug) ──
    if (showDebug) {
      const halfDepth = ph / 2;
      const margin = 15;
      const iaH = halfDepth + margin;
      const iaW = pw + 10;
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(-iaW / 2, -ph / 2 - iaH, iaW, iaH);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(-iaW / 2, -ph / 2 - iaH, iaW, iaH);
      ctx.setLineDash([]);
    }

    // ── Media body (filled rect) ──
    const ratio = m.capacity > 0 ? watchCount / m.capacity : 0;
    let bodyColor: string;
    if (isSelected) bodyColor = isDark ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.25)';
    else if (ratio >= 1) bodyColor = isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)';
    else if (ratio >= 0.7) bodyColor = isDark ? 'rgba(250,204,21,0.15)' : 'rgba(250,204,21,0.1)';
    else bodyColor = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.1)';

    const isCircle = (m as any).shape === 'circle';
    const circleR = Math.max(pw, ph) / 2;

    ctx.fillStyle = bodyColor;
    if (isCircle) {
      ctx.beginPath();
      ctx.arc(0, 0, circleR, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    }

    // Border — category-colored
    const catColor = CATEGORY_BORDER_COLORS[(m as any).category] ?? null;
    ctx.strokeStyle = isSelected
      ? (isDark ? '#3b82f6' : '#2563eb')
      : catColor
        ? (isDark ? catColor + '80' : catColor + '60') // 50%/37% alpha via hex
        : (isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.3)');
    ctx.lineWidth = isSelected ? 1.5 : catColor ? 1.2 : 0.8;
    if (isCircle) {
      ctx.beginPath();
      ctx.arc(0, 0, circleR, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
    }

    // ── Front indicator (orientation arrow) ──
    const edgeDist = isCircle ? circleR : ph / 2;
    ctx.beginPath();
    ctx.moveTo(-pw / 4, -edgeDist);
    ctx.lineTo(0, -edgeDist - 5);
    ctx.lineTo(pw / 4, -edgeDist);
    ctx.fillStyle = isDark ? 'rgba(59,130,246,0.5)' : 'rgba(37,99,235,0.4)';
    ctx.fill();

    // ── Media name (instead of icon) ──
    ctx.rotate(-rad); // un-rotate for readable text
    const name = (m as any).name || m.type.replace(/_/g, ' ');
    const fontSize = Math.max(7, Math.min(10, pw * 0.15));
    ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
    ctx.fillText(name, 0, 0);

    // ── Category badge ──
    const cat = (m as any).category as string;
    const catBadgeColor = CATEGORY_BORDER_COLORS[cat];
    if (catBadgeColor) {
      const catLabels: Record<string, string> = { analog: 'ANALOG', passive_media: 'PASSIVE', active: 'ACTIVE', immersive: 'IMMERSIVE' };
      ctx.font = '5px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? catBadgeColor + 'aa' : catBadgeColor + '99';
      ctx.fillText(catLabels[cat] ?? '', 0, fontSize * 0.8);
    } else {
      const isStaged = (m as any).interactionType === 'staged';
      if (isActive) {
        ctx.font = '6px "JetBrains Mono", monospace';
        ctx.fillStyle = isDark ? 'rgba(250,204,21,0.6)' : 'rgba(202,138,4,0.6)';
        ctx.fillText('ACTIVE', 0, fontSize * 0.8);
      } else if (isStaged) {
        ctx.font = '6px "JetBrains Mono", monospace';
        ctx.fillStyle = isDark ? 'rgba(168,85,247,0.6)' : 'rgba(126,34,206,0.6)';
        ctx.fillText('STAGED', 0, fontSize * 0.8);
      }
    }

    ctx.restore();

    // ── Labels (not rotated) ──
    ctx.save();

    // Queue count (ACTIVE only)
    if (isActive && queueCount > 0) {
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? '#fbbf24' : '#f59e0b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${queueCount}↻`, position.x + pw / 2 + 4, position.y - 4);
    }

    // Watch count / capacity
    if (watchCount > 0 || isSelected) {
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillStyle = ratio >= 1 ? '#ef4444' : ratio >= 0.7 ? '#fbbf24' : (isDark ? '#4ade80' : '#22c55e');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${watchCount}/${m.capacity}`, position.x, position.y + ph / 2 + 3);
    }

    // Resize handles (selected only, not rotated)
    if (isSelected) {
      const hr = 3;
      const corners = [
        { x: position.x - pw/2, y: position.y - ph/2 },
        { x: position.x + pw/2, y: position.y - ph/2 },
        { x: position.x + pw/2, y: position.y + ph/2 },
        { x: position.x - pw/2, y: position.y + ph/2 },
      ];
      for (const c of corners) {
        ctx.fillStyle = isDark ? '#3b82f6' : '#2563eb';
        ctx.fillRect(c.x - hr, c.y - hr, hr * 2, hr * 2);
      }
    }

    ctx.restore();
  }
}
