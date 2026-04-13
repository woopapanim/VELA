import type { Vector2D } from '@/domain';

export function renderMeasureLine(
  ctx: CanvasRenderingContext2D,
  pointA: Vector2D | null,
  pointB: Vector2D | null,
  scale: number, // px to meters
  isDark: boolean,
) {
  if (!pointA) return;

  ctx.save();

  // Draw point A
  ctx.beginPath();
  ctx.arc(pointA.x, pointA.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  if (pointB) {
    // Draw point B
    ctx.beginPath();
    ctx.arc(pointB.x, pointB.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(pointA.x, pointA.y);
    ctx.lineTo(pointB.x, pointB.y);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance label
    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const distM = distPx * scale;

    const midX = (pointA.x + pointB.x) / 2;
    const midY = (pointA.y + pointB.y) / 2;

    // Background
    ctx.fillStyle = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)';
    const text = `${distM.toFixed(1)}m (${Math.round(distPx)}px)`;
    const textWidth = ctx.measureText(text).width || 60;
    ctx.fillRect(midX - textWidth / 2 - 4, midY - 8, textWidth + 8, 16);

    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, midX, midY);
  }

  ctx.restore();
}
