import type { ZoneConfig } from '@/domain';

let _spawnAnimFrame = 0;

export function renderSpawnPoints(
  ctx: CanvasRenderingContext2D,
  zones: readonly ZoneConfig[],
  isDark: boolean,
) {
  _spawnAnimFrame++;

  for (const zone of zones) {
    if (zone.type !== 'entrance') continue;

    const entranceGate = zone.gates.find((g) => g.type === 'entrance');
    if (!entranceGate) continue;

    const { x, y } = entranceGate.position;
    const pulse = (Math.sin(_spawnAnimFrame * 0.06) + 1) * 0.5;

    ctx.save();

    // Outer ring pulse
    ctx.beginPath();
    ctx.arc(x, y, 12 + pulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = isDark
      ? `rgba(34,197,94,${0.1 + pulse * 0.15})`
      : `rgba(22,163,74,${0.08 + pulse * 0.1})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? 'rgba(34,197,94,0.3)' : 'rgba(22,163,74,0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Spawn icon
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚪', x, y);

    // Label
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillStyle = isDark ? 'rgba(34,197,94,0.5)' : 'rgba(22,163,74,0.4)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('SPAWN', x, y + 14);

    ctx.restore();
  }
}
