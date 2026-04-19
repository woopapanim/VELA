import type { FloorConfig, ZoneConfig } from '@/domain';

const PADDING = 40; // world px padding around zone bounding box
const LABEL_OFFSET = 12;

export function renderFloorFrames(
  ctx: CanvasRenderingContext2D,
  floors: readonly FloorConfig[],
  zones: readonly ZoneConfig[],
  isDark: boolean,
  zoom: number,
) {
  if (floors.length <= 1) return; // single floor — no grouping needed

  const fs = (basePx: number) => Math.max(6, basePx / Math.max(zoom, 0.3));
  const px = 1 / Math.max(zoom, 0.3);

  for (const floor of floors) {
    const frame = floor.bounds ?? deriveBounds(floor, zones);
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
    ctx.restore();
  }
}

function deriveBounds(
  floor: FloorConfig,
  zones: readonly ZoneConfig[],
): { x: number; y: number; w: number; h: number } | null {
  // ZoneConfig has no floorId — membership lives on FloorConfig.zoneIds.
  const memberSet = new Set(floor.zoneIds.map((id) => id as string));
  const floorZones = zones.filter((z) => memberSet.has(z.id as string));
  if (floorZones.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const z of floorZones) {
    const b = z.bounds;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }

  return {
    x: minX - PADDING,
    y: minY - PADDING,
    w: maxX - minX + PADDING * 2,
    h: maxY - minY + PADDING * 2,
  };
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
