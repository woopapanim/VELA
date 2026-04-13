import type { Visitor, Vector2D } from '@/domain';

// Store recent positions per visitor for trail rendering
const trailHistory = new Map<string, Vector2D[]>();
const MAX_TRAIL_LENGTH = 30;
let frameCount = 0;

export function updateTrails(visitors: readonly Visitor[]) {
  frameCount++;
  if (frameCount % 3 !== 0) return; // sample every 3rd frame

  const activeIds = new Set<string>();

  for (const v of visitors) {
    if (!v.isActive) continue;
    const key = v.id as string;
    activeIds.add(key);

    let trail = trailHistory.get(key);
    if (!trail) {
      trail = [];
      trailHistory.set(key, trail);
    }

    trail.push({ x: v.position.x, y: v.position.y });
    if (trail.length > MAX_TRAIL_LENGTH) {
      trail.shift();
    }
  }

  // Clean up inactive visitors
  for (const key of trailHistory.keys()) {
    if (!activeIds.has(key)) trailHistory.delete(key);
  }
}

export function renderPathTrails(
  ctx: CanvasRenderingContext2D,
  isDark: boolean,
) {
  ctx.save();

  for (const trail of trailHistory.values()) {
    if (trail.length < 3) continue;

    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);

    for (let i = 1; i < trail.length; i++) {
      ctx.lineTo(trail[i].x, trail[i].y);
    }

    ctx.strokeStyle = isDark
      ? 'rgba(96,165,250,0.08)'
      : 'rgba(59,130,246,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

export function clearTrails() {
  trailHistory.clear();
  frameCount = 0;
}
