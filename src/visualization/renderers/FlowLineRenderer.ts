import type { Visitor, ZoneConfig, Vector2D } from '@/domain';

interface FlowData {
  fromCenter: Vector2D;
  toCenter: Vector2D;
  count: number;
}

export function renderFlowLines(
  ctx: CanvasRenderingContext2D,
  zones: readonly ZoneConfig[],
  visitors: readonly Visitor[],
  isDark: boolean,
) {
  // Count transitions: how many visitors are moving from zone A to zone B
  const flows = new Map<string, FlowData>();
  const zoneMap = new Map(zones.map((z) => [z.id as string, z]));

  for (const v of visitors) {
    if (!v.isActive || !v.currentZoneId || !v.targetZoneId) continue;
    if (v.currentZoneId === v.targetZoneId) continue;

    const key = `${v.currentZoneId as string}->${v.targetZoneId as string}`;
    const existing = flows.get(key);
    if (existing) {
      existing.count++;
    } else {
      const fromZone = zoneMap.get(v.currentZoneId as string);
      const toZone = zoneMap.get(v.targetZoneId as string);
      if (fromZone && toZone) {
        flows.set(key, {
          fromCenter: {
            x: fromZone.bounds.x + fromZone.bounds.w / 2,
            y: fromZone.bounds.y + fromZone.bounds.h / 2,
          },
          toCenter: {
            x: toZone.bounds.x + toZone.bounds.w / 2,
            y: toZone.bounds.y + toZone.bounds.h / 2,
          },
          count: 1,
        });
      }
    }
  }

  if (flows.size === 0) return;

  // Find max flow for normalization
  let maxFlow = 0;
  for (const f of flows.values()) {
    if (f.count > maxFlow) maxFlow = f.count;
  }
  if (maxFlow === 0) return;

  ctx.save();

  for (const flow of flows.values()) {
    const { fromCenter, toCenter, count } = flow;
    const intensity = count / maxFlow;
    const lineWidth = 1 + intensity * 4;
    const alpha = 0.15 + intensity * 0.4;

    // Curved flow line
    const midX = (fromCenter.x + toCenter.x) / 2;
    const midY = (fromCenter.y + toCenter.y) / 2;
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    // Offset control point perpendicular to line
    const cpX = midX - dy * 0.15;
    const cpY = midY + dx * 0.15;

    ctx.beginPath();
    ctx.moveTo(fromCenter.x, fromCenter.y);
    ctx.quadraticCurveTo(cpX, cpY, toCenter.x, toCenter.y);

    ctx.strokeStyle = isDark
      ? `rgba(96,165,250,${alpha})`
      : `rgba(59,130,246,${alpha})`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Arrow head at destination
    const t = 0.85;
    const arrowX = (1 - t) * (1 - t) * fromCenter.x + 2 * (1 - t) * t * cpX + t * t * toCenter.x;
    const arrowY = (1 - t) * (1 - t) * fromCenter.y + 2 * (1 - t) * t * cpY + t * t * toCenter.y;
    const tangentX = 2 * (1 - t) * (cpX - fromCenter.x) + 2 * t * (toCenter.x - cpX);
    const tangentY = 2 * (1 - t) * (cpY - fromCenter.y) + 2 * t * (toCenter.y - cpY);
    const angle = Math.atan2(tangentY, tangentX);
    const arrowSize = 4 + intensity * 4;

    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - arrowSize * Math.cos(angle - 0.4),
      arrowY - arrowSize * Math.sin(angle - 0.4),
    );
    ctx.lineTo(
      arrowX - arrowSize * Math.cos(angle + 0.4),
      arrowY - arrowSize * Math.sin(angle + 0.4),
    );
    ctx.closePath();
    ctx.fillStyle = isDark
      ? `rgba(96,165,250,${alpha + 0.1})`
      : `rgba(59,130,246,${alpha + 0.1})`;
    ctx.fill();

    // Flow count badge at midpoint
    if (count >= 3) {
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), cpX, cpY);
    }
  }

  ctx.restore();
}
