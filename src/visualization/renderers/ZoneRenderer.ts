import type { ZoneConfig, Visitor } from '@/domain';
import { ZONE_COLORS } from '@/domain';

let _zoneAnimFrame = 0;

export function renderZones(
  ctx: CanvasRenderingContext2D,
  zones: readonly ZoneConfig[],
  selectedZoneId: string | null,
  showLabels: boolean,
  isDark: boolean,
  visitors?: readonly Visitor[],
) {
  _zoneAnimFrame++;

  // Pre-compute occupancy per zone
  const occupancy = new Map<string, number>();
  if (visitors) {
    for (const v of visitors) {
      if (!v.isActive || !v.currentZoneId) continue;
      const key = v.currentZoneId as string;
      occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
    }
  }

  for (const zone of zones) {
    const { bounds, polygon, type, name, color, capacity } = zone;
    const isSelected = (zone.id as string) === selectedZoneId;
    const occ = occupancy.get(zone.id as string) ?? 0;

    ctx.save();

    // Draw zone shape
    const { shape } = zone;
    if (polygon && polygon.length > 2) {
      ctx.beginPath();
      ctx.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i++) ctx.lineTo(polygon[i].x, polygon[i].y);
      ctx.closePath();
    } else if (shape === 'circle') {
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      const r = Math.min(bounds.w, bounds.h) / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    } else if (shape === 'o_ring') {
      // O-ring: donut (outer circle with inner hole)
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      const outerR = Math.min(bounds.w, bounds.h) / 2;
      const innerR = outerR * 0.45;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.moveTo(cx + innerR, cy);
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    } else if (shape.startsWith('l_')) {
      const { x, y, w, h } = bounds;
      const rx = (zone.lRatioX ?? 0.5);
      const ry = (zone.lRatioY ?? 0.5);
      const bx = w * rx; // bend x offset
      const by = h * ry; // bend y offset
      ctx.beginPath();
      if (shape === 'l_top_right') {
        ctx.moveTo(x, y); ctx.lineTo(x + bx, y); ctx.lineTo(x + bx, y + by);
        ctx.lineTo(x + w, y + by); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
      } else if (shape === 'l_top_left') {
        ctx.moveTo(x + bx, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h); ctx.lineTo(x, y + by); ctx.lineTo(x + bx, y + by);
      } else if (shape === 'l_bottom_right') {
        ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + by);
        ctx.lineTo(x + bx, y + by); ctx.lineTo(x + bx, y + h); ctx.lineTo(x, y + h);
      } else { // l_bottom_left
        ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + bx, y + h); ctx.lineTo(x + bx, y + by); ctx.lineTo(x, y + by);
      }
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
    }

    // Fill
    const zoneColor = color ?? ZONE_COLORS[type] ?? '#3b82f6';
    ctx.fillStyle = isDark
      ? hexToRgba(zoneColor, isSelected ? 0.25 : 0.12)
      : hexToRgba(zoneColor, isSelected ? 0.2 : 0.08);
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected
      ? zoneColor
      : isDark
        ? hexToRgba(zoneColor, 0.4)
        : hexToRgba(zoneColor, 0.3);
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    // Resize handles (selected zone only)
    if (isSelected) {
      const handleSize = 6;
      const handleColor = isDark ? '#60a5fa' : '#2563eb';
      const corners = [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.w, y: bounds.y },
        { x: bounds.x, y: bounds.y + bounds.h },
        { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
      ];
      for (const c of corners) {
        ctx.fillStyle = handleColor;
        ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
      }
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? 'rgba(96,165,250,0.7)' : 'rgba(37,99,235,0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${bounds.w}×${bounds.h}`, bounds.x + bounds.w / 2, bounds.y + bounds.h + 4);

      // L-shape inner corner handle
      if (shape.startsWith('l_')) {
        const rx = (zone.lRatioX ?? 0.5);
        const ry = (zone.lRatioY ?? 0.5);
        const lx = bounds.x + bounds.w * rx;
        const ly = bounds.y + bounds.h * ry;
        const lHandleSize = 7;
        ctx.fillStyle = isDark ? '#fbbf24' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(lx, ly, lHandleSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#fbbf2480' : '#f59e0b80';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Occupancy bar (bottom of zone)
    if (occ > 0 && capacity > 0) {
      const barH = 3;
      const barY = bounds.y + bounds.h - barH - 2;
      const barX = bounds.x + 4;
      const barW = bounds.w - 8;
      const fillRatio = Math.min(1.2, occ / capacity);

      // Background
      ctx.fillStyle = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)';
      ctx.fillRect(barX, barY, barW, barH);

      // Fill
      const barColor = fillRatio > 0.9 ? '#ef4444' : fillRatio > 0.6 ? '#f59e0b' : '#22c55e';
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barW * Math.min(1, fillRatio), barH);

      // Count label
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${occ}/${capacity}`, bounds.x + bounds.w - 4, barY - 1);

      // Bottleneck pulse: red border glow when over capacity
      if (fillRatio > 0.9) {
        const pulse = (Math.sin(_zoneAnimFrame * 0.06) + 1) * 0.5;
        ctx.strokeStyle = `rgba(239,68,68,${0.2 + pulse * 0.4})`;
        ctx.lineWidth = 2 + pulse * 2;
        ctx.setLineDash([]);
        if (polygon && polygon.length > 2) {
          ctx.beginPath();
          ctx.moveTo(polygon[0].x, polygon[0].y);
          for (let i = 1; i < polygon.length; i++) ctx.lineTo(polygon[i].x, polygon[i].y);
          ctx.closePath();
        } else {
          ctx.beginPath();
          ctx.rect(bounds.x, bounds.y, bounds.w, bounds.h);
        }
        ctx.stroke();
      }

      // Capacity warning icon
      if (fillRatio > 1.0) {
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️', bounds.x + bounds.w - 12, bounds.y + 12);
      }
    }

    // Label
    if (showLabels) {
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, cx, cy);

      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
      ctx.fillText(type.toUpperCase(), cx, cy + 14);
    }

    ctx.restore();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
