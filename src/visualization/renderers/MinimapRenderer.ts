import type { ZoneConfig, Visitor, Vector2D } from '@/domain';
import { ZONE_COLORS } from '@/domain';

const MINIMAP_W = 160;
const MINIMAP_H = 100;
const MINIMAP_PAD = 12;

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  zones: readonly ZoneConfig[],
  visitors: readonly Visitor[],
  canvasWidth: number,
  canvasHeight: number,
  cameraX: number,
  cameraY: number,
  cameraZoom: number,
  isDark: boolean,
) {
  if (zones.length === 0) return;

  // Position: bottom-left of canvas
  const ox = MINIMAP_PAD;
  const oy = canvasHeight - MINIMAP_H - MINIMAP_PAD - 50; // above timeline

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Background
  ctx.fillStyle = isDark ? 'rgba(9,9,11,0.85)' : 'rgba(244,244,245,0.9)';
  ctx.strokeStyle = isDark ? 'rgba(39,39,42,0.8)' : 'rgba(228,228,231,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(ox, oy, MINIMAP_W, MINIMAP_H, 8);
  ctx.fill();
  ctx.stroke();

  // Find world bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const z of zones) {
    minX = Math.min(minX, z.bounds.x);
    minY = Math.min(minY, z.bounds.y);
    maxX = Math.max(maxX, z.bounds.x + z.bounds.w);
    maxY = Math.max(maxY, z.bounds.y + z.bounds.h);
  }
  const worldW = maxX - minX || 1;
  const worldH = maxY - minY || 1;
  const pad = 8;
  const scaleX = (MINIMAP_W - pad * 2) / worldW;
  const scaleY = (MINIMAP_H - pad * 2) / worldH;
  const scale = Math.min(scaleX, scaleY);

  const toMini = (wx: number, wy: number): Vector2D => ({
    x: ox + pad + (wx - minX) * scale,
    y: oy + pad + (wy - minY) * scale,
  });

  // Draw zones
  for (const z of zones) {
    const p = toMini(z.bounds.x, z.bounds.y);
    const w = z.bounds.w * scale;
    const h = z.bounds.h * scale;
    const color = z.color ?? ZONE_COLORS[z.type] ?? '#3b82f6';
    ctx.fillStyle = isDark ? color + '40' : color + '30';
    ctx.fillRect(p.x, p.y, w, h);
    ctx.strokeStyle = color + '80';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(p.x, p.y, w, h);
  }

  // Draw visitors as tiny dots
  for (const v of visitors) {
    if (!v.isActive) continue;
    const p = toMini(v.position.x, v.position.y);
    ctx.fillStyle = isDark ? 'rgba(96,165,250,0.6)' : 'rgba(59,130,246,0.5)';
    ctx.fillRect(p.x - 0.5, p.y - 0.5, 1.5, 1.5);
  }

  // Draw camera viewport
  const vpLeft = cameraX;
  const vpTop = cameraY;
  const vpW = canvasWidth / cameraZoom;
  const vpH = canvasHeight / cameraZoom;
  const vpMini = toMini(vpLeft, vpTop);
  const vpMiniW = vpW * scale;
  const vpMiniH = vpH * scale;

  ctx.strokeStyle = isDark ? 'rgba(250,250,250,0.4)' : 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(vpMini.x, vpMini.y, vpMiniW, vpMiniH);
  ctx.setLineDash([]);

  ctx.restore();
}
