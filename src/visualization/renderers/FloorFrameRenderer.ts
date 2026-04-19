import type { FloorConfig, ZoneConfig } from '@/domain';
import { getFloorFrameBounds } from '@/domain/floorLayout';

const LABEL_OFFSET = 12;

export function renderFloorFrames(
  ctx: CanvasRenderingContext2D,
  floors: readonly FloorConfig[],
  zones: readonly ZoneConfig[],
  isDark: boolean,
  zoom: number,
  showResizeHandles = false,
  activeFloorId: string | null = null,
) {
  if (floors.length <= 1) return; // single floor — no grouping needed

  const fs = (basePx: number) => Math.max(6, basePx / Math.max(zoom, 0.3));
  const px = 1 / Math.max(zoom, 0.3);

  for (const floor of floors) {
    const frame = getFloorFrameBounds(floor, zones);
    if (!frame) continue;

    const { x, y, w, h } = frame;

    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.3)' : 'rgba(71,85,105,0.25)';
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([8 * px, 4 * px]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Label badge top-left
    ctx.font = `600 ${fs(13)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const label = floor.name;
    const labelMetrics = ctx.measureText(label);
    const labelW = labelMetrics.width + 16 * px;
    const labelH = fs(18);
    const labelX = x;
    const labelY = y - labelH - LABEL_OFFSET * px;

    ctx.fillStyle = isDark ? 'rgba(59,130,246,0.85)' : 'rgba(59,130,246,0.9)';
    roundedRect(ctx, labelX, labelY, labelW, labelH, 6 * px);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, labelX + 8 * px, labelY + 3 * px);

    // Corner resize handles — selected active floor only, sim not running.
    // Match ZoneRenderer rect handles: 6*px square, 1*px stroke, zone-handle blue.
    const isActive = activeFloorId != null && (floor.id as string) === activeFloorId;
    if (showResizeHandles && isActive) {
      const handleSq = 6 * px;
      const handleStroke = 1 * px;
      const handleColor = isDark ? '#60a5fa' : '#2563eb';
      const corners = [
        { x, y }, { x: x + w, y },
        { x, y: y + h }, { x: x + w, y: y + h },
      ];
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = handleColor;
      ctx.lineWidth = handleStroke;
      for (const c of corners) {
        ctx.fillRect(c.x - handleSq / 2, c.y - handleSq / 2, handleSq, handleSq);
        ctx.strokeRect(c.x - handleSq / 2, c.y - handleSq / 2, handleSq, handleSq);
      }
    }
    ctx.restore();
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
