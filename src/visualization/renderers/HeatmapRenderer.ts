import type { Visitor, HeatmapConfig } from '@/domain';
import { DEFAULT_HEATMAP } from '@/domain';

export class HeatmapRenderer {
  private config: HeatmapConfig;
  private fadeCanvas: OffscreenCanvas | null = null;
  private fadeCtx: OffscreenCanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;

  constructor(config: HeatmapConfig = DEFAULT_HEATMAP) {
    this.config = config;
  }

  init(canvasWidth: number, canvasHeight: number) {
    this.width = canvasWidth;
    this.height = canvasHeight;

    this.fadeCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    this.fadeCtx = this.fadeCanvas.getContext('2d');
  }

  update(visitors: readonly Visitor[], isDark: boolean) {
    if (!this.fadeCtx || !this.fadeCanvas) return;

    const ctx = this.fadeCtx;
    const { gaussianRadius, decayRate } = this.config;

    // Fade existing content (dynamic decay)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,0,${1 - decayRate})`;
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw gaussian influence circles for each active visitor
    ctx.globalCompositeOperation = 'lighter';

    for (const v of visitors) {
      if (!v.isActive) continue;

      const gradient = ctx.createRadialGradient(
        v.position.x, v.position.y, 0,
        v.position.x, v.position.y, gaussianRadius,
      );

      if (isDark) {
        // Thermal Neon — bright cyan/green core
        gradient.addColorStop(0, 'rgba(0,255,200,0.35)');
        gradient.addColorStop(0.4, 'rgba(0,200,255,0.15)');
        gradient.addColorStop(1, 'rgba(0,100,255,0)');
      } else {
        // Soft Gaussian — warm pastel
        gradient.addColorStop(0, 'rgba(255,100,50,0.25)');
        gradient.addColorStop(0.4, 'rgba(255,150,50,0.1)');
        gradient.addColorStop(1, 'rgba(255,200,100,0)');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(
        v.position.x - gaussianRadius,
        v.position.y - gaussianRadius,
        gaussianRadius * 2,
        gaussianRadius * 2,
      );
    }
  }

  render(ctx: CanvasRenderingContext2D, isDark: boolean) {
    if (!this.fadeCanvas) return;

    ctx.save();
    ctx.globalAlpha = isDark ? 0.9 : 0.7;
    ctx.globalCompositeOperation = isDark ? 'lighter' : 'source-over';
    ctx.drawImage(this.fadeCanvas, 0, 0);
    ctx.restore();
  }
}
