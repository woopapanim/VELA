import type { ZoneConfig, Gate } from '@/domain';

export function renderGateConnections(
  ctx: CanvasRenderingContext2D,
  zones: readonly ZoneConfig[],
  isDark: boolean,
) {
  // Build gate position map
  const gateMap = new Map<string, { gate: Gate; zoneColor: string }>();
  for (const zone of zones) {
    for (const gate of zone.gates) {
      gateMap.set(gate.id as string, { gate, zoneColor: zone.color });
    }
  }

  const drawn = new Set<string>();

  ctx.save();

  for (const [gateId, { gate }] of gateMap) {
    if (!gate.connectedGateId) continue;
    const connId = gate.connectedGateId as string;

    // Avoid drawing same connection twice
    const pairKey = [gateId, connId].sort().join('-');
    if (drawn.has(pairKey)) continue;
    drawn.add(pairKey);

    const connected = gateMap.get(connId);
    if (!connected) continue;

    const from = gate.position;
    const to = connected.gate.position;

    // Draw thin dashed connection line
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);

    // Slight curve for visual clarity
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const cpX = midX - dy * 0.08;
    const cpY = midY + dx * 0.08;

    ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);

    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
