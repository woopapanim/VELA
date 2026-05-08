import type { DensityGrid, Visitor } from '@/domain';
import { ramp, softMax } from '@/analytics/spatial/synthesizeDensity';

/**
 * Floor-wide density heatmap.
 *
 * Renders cumulative visitor-seconds per grid cell as a smooth color gradient
 * across the floor. Uses a tiny offscreen canvas sized to the grid resolution
 * (one pixel per cell) and upscales with bilinear + Gaussian blur to get the
 * "WiFi coverage" look instead of per-agent blob trails.
 */
export class HeatmapRenderer {
  private gridCanvases = new Map<string, OffscreenCanvas>();

  init(_canvasWidth: number, _canvasHeight: number) {
    // Kept for backwards compatibility with CanvasManager.init() — the grid
    // canvases are sized lazily per density grid.
  }

  /**
   * Repaint per-grid offscreen bitmaps. Cheap: does O(cells) per floor, but
   * each cell is one pixel, so even a 200×200 grid is 40k pixels.
   */
  update(grids: readonly DensityGrid[]) {
    // Evict stale grid canvases (floor removed, or resized)
    const liveIds = new Set(grids.map(g => g.floorId as string));
    for (const id of [...this.gridCanvases.keys()]) {
      if (!liveIds.has(id)) this.gridCanvases.delete(id);
    }

    for (const grid of grids) {
      const id = grid.floorId as string;
      let cnv = this.gridCanvases.get(id);
      if (!cnv || cnv.width !== grid.cols || cnv.height !== grid.rows) {
        cnv = new OffscreenCanvas(Math.max(1, grid.cols), Math.max(1, grid.rows));
        this.gridCanvases.set(id, cnv);
      }
      const ctx = cnv.getContext('2d');
      if (!ctx) continue;

      // Normalize to [0,1] using a soft ceiling: the 80th-percentile cell
      // becomes "hot". This stops a single peak outlier from flattening the
      // whole map into blue while keeping enough range to see peak hotspots.
      const max = softMax(grid.data);
      const inv = max > 0 ? 1 / max : 0;

      const img = ctx.createImageData(grid.cols, grid.rows);
      const buf = img.data;
      for (let i = 0; i < grid.data.length; i++) {
        const v = Math.min(1, grid.data[i] * inv);
        const j = i * 4;
        if (v < 0.01) {
          buf[j + 3] = 0; // fully transparent in cold cells — floor shows through
          continue;
        }
        const [r, g, b, a] = ramp(v);
        buf[j] = r;
        buf[j + 1] = g;
        buf[j + 2] = b;
        buf[j + 3] = a;
      }
      ctx.putImageData(img, 0, 0);
    }
  }

  /**
   * Paint the cumulative density grids in world space (caller applies camera
   * transform before calling).
   */
  render(
    ctx: CanvasRenderingContext2D,
    grids: readonly DensityGrid[],
    _visitors: readonly Visitor[],
    isDark: boolean,
    _canvasWidth: number,
    _canvasHeight: number,
  ) {
    if (grids.length === 0) return;

    ctx.save();
    ctx.globalAlpha = isDark ? 0.92 : 0.82;
    // Bilinear upscale + Gaussian blur turns per-cell pixels into the smooth
    // "WiFi coverage" gradient. Blur size is tuned to roughly one cell so the
    // step boundaries between adjacent cells fully dissolve.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const grid of grids) {
      const cnv = this.gridCanvases.get(grid.floorId as string);
      if (!cnv) continue;
      const dstW = grid.cellPx * grid.cols;
      const dstH = grid.cellPx * grid.rows;
      ctx.save();
      ctx.filter = `blur(${Math.round(grid.cellPx * 0.6)}px)`;
      ctx.drawImage(cnv, grid.originX, grid.originY, dstW, dstH);
      ctx.restore();
    }

    ctx.restore();
  }
}

// `softMax` (80th-percentile soft max) and `ramp` (cool→hot color gradient) are
// imported from `@/analytics/spatial/synthesizeDensity` so the live heatmap and
// the synthesized (replay) heatmap share a single source of truth.
