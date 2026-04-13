import type { ZoneConfig } from '@/domain';

let _flowAnimFrame = 0;

export function renderFlowArrows(
  ctx: CanvasRenderingContext2D,
  zones: readonly ZoneConfig[],
  isDark: boolean,
) {
  _flowAnimFrame++;

  for (const zone of zones) {
    if (zone.flowType === 'free') continue;

    const { bounds } = zone;
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;

    ctx.save();

    if (zone.flowType === 'one_way') {
      // Single direction arrow (left → right by default)
      const pulse = (Math.sin(_flowAnimFrame * 0.04) + 1) * 0.5;
      const arrowLen = 25;
      const startX = cx - arrowLen;
      const endX = cx + arrowLen;

      ctx.beginPath();
      ctx.moveTo(startX, cy);
      ctx.lineTo(endX, cy);
      ctx.strokeStyle = isDark
        ? `rgba(239,68,68,${0.15 + pulse * 0.15})`
        : `rgba(220,38,38,${0.12 + pulse * 0.1})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow head
      ctx.beginPath();
      ctx.moveTo(endX, cy);
      ctx.lineTo(endX - 6, cy - 4);
      ctx.lineTo(endX - 6, cy + 4);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();

      // Label
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? 'rgba(239,68,68,0.3)' : 'rgba(220,38,38,0.25)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('ONE-WAY →', cx, cy - 8);

    } else if (zone.flowType === 'guided') {
      // Sequential numbered dots
      const dotCount = 3;
      const spacing = bounds.w * 0.25;
      const startX = cx - spacing;
      const pulse = (Math.sin(_flowAnimFrame * 0.05) + 1) * 0.5;

      for (let i = 0; i < dotCount; i++) {
        const dx = startX + i * spacing;
        const alpha = 0.15 + (i / dotCount) * 0.2 + pulse * 0.1;

        ctx.beginPath();
        ctx.arc(dx, cy - bounds.h * 0.35, 6, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(139,92,246,${alpha})`
          : `rgba(124,58,237,${alpha * 0.8})`;
        ctx.fill();

        ctx.font = '7px "JetBrains Mono", monospace';
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, dx, cy - bounds.h * 0.35);

        // Arrow between dots
        if (i < dotCount - 1) {
          ctx.beginPath();
          ctx.moveTo(dx + 8, cy - bounds.h * 0.35);
          ctx.lineTo(dx + spacing - 8, cy - bounds.h * 0.35);
          ctx.strokeStyle = isDark ? 'rgba(139,92,246,0.15)' : 'rgba(124,58,237,0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? 'rgba(139,92,246,0.3)' : 'rgba(124,58,237,0.25)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('GUIDED', cx, cy - bounds.h * 0.35 - 10);
    }

    ctx.restore();
  }
}
