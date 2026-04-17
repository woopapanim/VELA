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
  zoom: number = 1,
) {
  // Scale font sizes inversely with zoom
  const fs = (basePx: number) => Math.max(3, basePx / Math.max(zoom, 0.3));
  // Keep strokes/handles at constant screen-pixel size regardless of zoom
  const px = 1 / Math.max(zoom, 0.3);

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
      let dbgHalfDepth: number, dbgW: number;
      if (isCustom) {
        let minY = Infinity, maxAbsX = 0;
        for (const p of m.polygon!) { if (p.y < minY) minY = p.y; if (Math.abs(p.x) > maxAbsX) maxAbsX = Math.abs(p.x); }
        dbgHalfDepth = -minY; // front edge (negative Y in local)
        dbgW = maxAbsX * 2 + 10;
      } else {
        dbgHalfDepth = ph / 2;
        dbgW = pw + 10;
      }
      const margin = 15;
      const iaH = dbgHalfDepth + margin;
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(-dbgW / 2, -dbgHalfDepth - iaH, dbgW, iaH);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5 * px;
      ctx.setLineDash([3 * px, 3 * px]);
      ctx.strokeRect(-dbgW / 2, -dbgHalfDepth - iaH, dbgW, iaH);
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
    const isCustom = (m as any).shape === 'custom' && m.polygon && m.polygon.length > 2;
    const circleR = Math.max(pw, ph) / 2;

    // Build polygon path helper (local coords, already in rotated space)
    const polyPath = () => {
      const poly = m.polygon!;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
    };

    ctx.fillStyle = bodyColor;
    if (isCustom) {
      polyPath();
      ctx.fill();
    } else if (isCircle) {
      ctx.beginPath();
      ctx.arc(0, 0, circleR, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    }

    // Border — category-colored
    const catColor = CATEGORY_BORDER_COLORS[(m as any).category] ?? null;
    ctx.strokeStyle = isSelected
      ? (isDark ? '#60a5fa' : '#3b82f6')
      : catColor
        ? (isDark ? catColor + '80' : catColor + '60')
        : (isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.3)');
    ctx.lineWidth = (isSelected ? 1.25 : catColor ? 0.75 : 0.5) * px;
    if (isCustom) {
      polyPath();
      ctx.stroke();
    } else if (isCircle) {
      ctx.beginPath();
      ctx.arc(0, 0, circleR, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
    }

    // ── Front indicator / rotation handle ──
    let edgeDist: number;
    if (isCustom) {
      // Use max negative Y extent as front edge distance
      let maxNegY = 0;
      for (const p of m.polygon!) if (-p.y > maxNegY) maxNegY = -p.y;
      edgeDist = maxNegY || ph / 2;
    } else {
      edgeDist = isCircle ? circleR : ph / 2;
    }
    // Front indicator: thick colored line on the front edge (category color)
    const frontColor = catColor ?? (isDark ? '#60a5fa' : '#3b82f6');
    const frontLineWidth = 3 * px;
    ctx.strokeStyle = frontColor;
    ctx.lineWidth = frontLineWidth;
    ctx.lineCap = 'round';
    if (isCustom) {
      // Find edge whose midpoint has smallest Y (most forward)
      const poly = m.polygon!;
      let bestIdx = 0, bestMidY = Infinity;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const midY = (a.y + b.y) / 2;
        if (midY < bestMidY) { bestMidY = midY; bestIdx = i; }
      }
      const a = poly[bestIdx], b = poly[(bestIdx + 1) % poly.length];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (isCircle) {
      // Top arc spanning 90° (from -3π/4 to -π/4, centered at top)
      ctx.beginPath();
      ctx.arc(0, 0, circleR, -Math.PI * 3 / 4, -Math.PI / 4);
      ctx.stroke();
    } else {
      // Rect: line on top edge
      ctx.beginPath();
      ctx.moveTo(-pw / 2, -ph / 2);
      ctx.lineTo(pw / 2, -ph / 2);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // Rotation handle (selected only) — line + green circle above the front edge
    if (isSelected) {
      const handleDist = edgeDist + 15 * px;
      ctx.beginPath();
      ctx.moveTo(0, -edgeDist);
      ctx.lineTo(0, -handleDist);
      ctx.strokeStyle = isDark ? 'rgba(96,165,250,0.6)' : 'rgba(59,130,246,0.5)';
      ctx.lineWidth = 0.75 * px;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -handleDist, 3.5 * px, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.strokeStyle = isDark ? '#166534' : '#fff';
      ctx.lineWidth = 0.6 * px;
      ctx.stroke();
    }

    // ── Media name (instead of icon) ──
    ctx.rotate(-rad); // un-rotate for readable text
    const name = (m as any).name || m.type.replace(/_/g, ' ');
    const fontSize = fs(Math.max(7, Math.min(10, pw * 0.15)));
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
      ctx.font = `${fs(5)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = isDark ? catBadgeColor + 'aa' : catBadgeColor + '99';
      ctx.fillText(catLabels[cat] ?? '', 0, fontSize * 0.8);
    } else {
      const isStaged = (m as any).interactionType === 'staged';
      if (isActive) {
        ctx.font = `${fs(6)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = isDark ? 'rgba(250,204,21,0.6)' : 'rgba(202,138,4,0.6)';
        ctx.fillText('ACTIVE', 0, fontSize * 0.8);
      } else if (isStaged) {
        ctx.font = `${fs(6)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = isDark ? 'rgba(168,85,247,0.6)' : 'rgba(126,34,206,0.6)';
        ctx.fillText('STAGED', 0, fontSize * 0.8);
      }
    }

    ctx.restore();

    // ── Labels (not rotated) ──
    ctx.save();

    // Queue count (ACTIVE only)
    if (isActive && queueCount > 0) {
      ctx.font = `${fs(7)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = isDark ? '#fbbf24' : '#f59e0b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${queueCount}↻`, position.x + pw / 2 + 4, position.y - 4);
    }

    // Watch count / capacity
    if (watchCount > 0 || isSelected) {
      ctx.font = `${fs(7)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = ratio >= 1 ? '#ef4444' : ratio >= 0.7 ? '#fbbf24' : (isDark ? '#4ade80' : '#22c55e');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${watchCount}/${m.capacity}`, position.x, position.y + ph / 2 + 3);
    }

    // Resize handles / vertex handles (selected only)
    if (isSelected) {
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const handleR = 4 * px;
      const handleSq = 6 * px;
      const handleStroke = 1 * px;
      const handleColor = isDark ? '#60a5fa' : '#3b82f6';
      if (isCustom) {
        // Vertex handles for polygon (white circles with blue stroke, like zone)
        for (const p of m.polygon!) {
          const wx = position.x + p.x * cos - p.y * sin;
          const wy = position.y + p.x * sin + p.y * cos;
          ctx.beginPath();
          ctx.arc(wx, wy, handleR, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = handleColor;
          ctx.lineWidth = handleStroke;
          ctx.stroke();
        }
      } else {
        // Corner resize handles for rect/circle (figma-style: white fill + blue stroke)
        const localCorners = [
          { lx: -pw/2, ly: -ph/2 },
          { lx:  pw/2, ly: -ph/2 },
          { lx:  pw/2, ly:  ph/2 },
          { lx: -pw/2, ly:  ph/2 },
        ];
        for (const { lx, ly } of localCorners) {
          const rx = position.x + lx * cos - ly * sin;
          const ry = position.y + lx * sin + ly * cos;
          ctx.fillStyle = '#fff';
          ctx.fillRect(rx - handleSq / 2, ry - handleSq / 2, handleSq, handleSq);
          ctx.strokeStyle = handleColor;
          ctx.lineWidth = handleStroke;
          ctx.strokeRect(rx - handleSq / 2, ry - handleSq / 2, handleSq, handleSq);
        }
      }
    }

    ctx.restore();
  }
}
