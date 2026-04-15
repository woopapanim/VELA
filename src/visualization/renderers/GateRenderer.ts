import type { ZoneConfig } from '@/domain';

let _animFrame = 0;

type Pt = { x: number; y: number };

function getShapeEdges(b: { x: number; y: number; w: number; h: number }, shape: string, rx = 0.5, ry = 0.5): [Pt, Pt][] {
  const { x, y, w, h } = b;
  const bx = w * rx, by = h * ry;
  if (!shape.startsWith('l_')) {
    return [
      [{ x, y }, { x: x + w, y }], [{ x: x + w, y }, { x: x + w, y: y + h }],
      [{ x: x + w, y: y + h }, { x, y: y + h }], [{ x, y: y + h }, { x, y }],
    ];
  }
  let pts: Pt[];
  if (shape === 'l_top_right') pts = [{x,y},{x:x+bx,y},{x:x+bx,y:y+by},{x:x+w,y:y+by},{x:x+w,y:y+h},{x,y:y+h}];
  else if (shape === 'l_top_left') pts = [{x:x+bx,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h},{x,y:y+by},{x:x+bx,y:y+by}];
  else if (shape === 'l_bottom_right') pts = [{x,y},{x:x+w,y},{x:x+w,y:y+by},{x:x+bx,y:y+by},{x:x+bx,y:y+h},{x,y:y+h}];
  else pts = [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x:x+bx,y:y+h},{x:x+bx,y:y+by},{x,y:y+by}];
  return pts.map((p, i) => [p, pts[(i + 1) % pts.length]] as [Pt, Pt]);
}

function closestPt(px: number, py: number, ax: number, ay: number, bx: number, by: number): Pt {
  const dx = bx - ax, dy = by - ay, lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return { x: ax + t * dx, y: ay + t * dy };
}

export function renderGates(
  ctx: CanvasRenderingContext2D,
  zones: readonly ZoneConfig[],
  isDark: boolean,
) {
  _animFrame++;

  for (const zone of zones) {
    const b = zone.bounds;

    for (const gate of zone.gates) {
      const { position, width, type } = gate;
      const halfW = width / 2;

      const isCircular = zone.shape === 'circle' || zone.shape === 'o_ring';
      const gx = (position as any).x;
      const gy = (position as any).y;

      // Determine gate orientation (angle of the wall it sits on)
      let angle = 0;
      if (isCircular) {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        angle = Math.atan2(gy - cy, gx - cx) + Math.PI / 2;
      } else if (zone.shape === 'custom' && zone.polygon && zone.polygon.length > 2) {
        // Custom polygon: find closest polygon edge
        const vts = zone.polygon as Pt[];
        let bestDist = Infinity;
        for (let i = 0; i < vts.length; i++) {
          const a = vts[i], e = vts[(i + 1) % vts.length];
          const cp = closestPt(gx, gy, a.x, a.y, e.x, e.y);
          const d = (cp.x - gx) ** 2 + (cp.y - gy) ** 2;
          if (d < bestDist) {
            bestDist = d;
            angle = Math.atan2(e.y - a.y, e.x - a.x);
          }
        }
      } else {
        // Find closest edge and use its angle
        const edges = getShapeEdges(b, zone.shape as string, (zone as any).lRatioX ?? 0.5, (zone as any).lRatioY ?? 0.5);
        let bestDist = Infinity;
        for (const [a, e] of edges) {
          const cp = closestPt(gx, gy, a.x, a.y, e.x, e.y);
          const d = (cp.x - gx) ** 2 + (cp.y - gy) ** 2;
          if (d < bestDist) {
            bestDist = d;
            angle = Math.atan2(e.y - a.y, e.x - a.x);
          }
        }
      }

      ctx.save();

      // Gate color
      let color: string;
      if (type === 'portal') {
        color = isDark ? '#c084fc' : '#7c3aed';
      } else if (type === 'entrance') {
        color = isDark ? '#4ade80' : '#16a34a';
      } else if (type === 'exit') {
        color = isDark ? '#f87171' : '#dc2626';
      } else {
        color = isDark ? '#60a5fa' : '#2563eb';
      }

      if (type === 'portal') {
        const pulse = (Math.sin(_animFrame * 0.08) + 1) * 0.5;
        ctx.beginPath();
        ctx.arc(gx, gy, 6 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3 + pulse * 0.3;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.7;
        const d = 3;
        ctx.beginPath();
        ctx.moveTo(gx, gy - d); ctx.lineTo(gx + d, gy); ctx.lineTo(gx, gy + d); ctx.lineTo(gx - d, gy);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        // Draw gate line along the angle (tangent to wall/circle)
        const dx = Math.cos(angle) * halfW;
        const dy = Math.sin(angle) * halfW;

        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(gx - dx, gy - dy);
        ctx.lineTo(gx + dx, gy + dy);
        ctx.stroke();

        // Notch marks at ends (perpendicular to gate line)
        const nx = Math.cos(angle + Math.PI / 2) * 4;
        const ny = Math.sin(angle + Math.PI / 2) * 4;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(gx - dx - nx, gy - dy - ny); ctx.lineTo(gx - dx + nx, gy - dy + ny);
        ctx.moveTo(gx + dx - nx, gy + dy - ny); ctx.lineTo(gx + dx + nx, gy + dy + ny);
        ctx.stroke();

        // Gateway direction arrow
        if (zone.type === 'gateway') {
          const gwMode = (zone as any).gatewayMode ?? 'both';
          const cx = zone.bounds.x + zone.bounds.w / 2;
          const cy = zone.bounds.y + zone.bounds.h / 2;
          // Outward direction = away from zone center
          const outX = gx - cx;
          const outY = gy - cy;
          const outLen = Math.sqrt(outX * outX + outY * outY) || 1;
          const normX = outX / outLen;
          const normY = outY / outLen;
          const arrowLen = 10;
          const arrowHead = 4;

          ctx.globalAlpha = 0.8;
          ctx.lineWidth = 2;
          ctx.strokeStyle = color;
          ctx.fillStyle = color;

          if (gwMode === 'spawn' || gwMode === 'both') {
            // Inward arrow (outside → inside)
            const startX = gx + normX * 12;
            const startY = gy + normY * 12;
            const endX = gx + normX * 2;
            const endY = gy + normY * 2;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            // Arrowhead pointing inward
            const aAngle = Math.atan2(endY - startY, endX - startX);
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - arrowHead * Math.cos(aAngle - 0.5), endY - arrowHead * Math.sin(aAngle - 0.5));
            ctx.lineTo(endX - arrowHead * Math.cos(aAngle + 0.5), endY - arrowHead * Math.sin(aAngle + 0.5));
            ctx.closePath();
            ctx.fill();
          }
          if (gwMode === 'exit' || gwMode === 'both') {
            // Outward arrow (inside → outside)
            const off = gwMode === 'both' ? -5 : 0;
            const startX = gx - normX * 2;
            const startY = gy - normY * 2;
            const endX = gx + normX * 12;
            const endY = gy + normY * 12;
            ctx.beginPath();
            ctx.moveTo(startX + normY * off, startY - normX * off);
            ctx.lineTo(endX + normY * off, endY - normX * off);
            ctx.stroke();
            const aAngle = Math.atan2(endY - startY, endX - startX);
            ctx.beginPath();
            ctx.moveTo(endX + normY * off, endY - normX * off);
            ctx.lineTo(endX + normY * off - arrowHead * Math.cos(aAngle - 0.5), endY - normX * off - arrowHead * Math.sin(aAngle - 0.5));
            ctx.lineTo(endX + normY * off - arrowHead * Math.cos(aAngle + 0.5), endY - normX * off - arrowHead * Math.sin(aAngle + 0.5));
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      ctx.restore();
    }
  }
}
