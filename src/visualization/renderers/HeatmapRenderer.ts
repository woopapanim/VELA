import type { DensityGrid, Visitor } from '@/domain';

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
    (ctx as any).imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = 'high';

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

function softMax(data: Float32Array): number {
  // Use the 95th-percentile nonzero cell as the "hot" reference. O(n) + O(k log k) with a tiny bucket sort.
  let max = 0;
  let nonzero = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v > 0) {
      nonzero++;
      if (v > max) max = v;
    }
  }
  if (nonzero === 0 || max === 0) return 0;

  // For small grids just return max (percentile collapses to max anyway).
  if (nonzero < 32) return max;

  // Histogram-based 95th percentile — 64 buckets is plenty for heatmap colors.
  const B = 64;
  const hist = new Uint32Array(B);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v <= 0) continue;
    const b = Math.min(B - 1, Math.floor((v / max) * B));
    hist[b]++;
  }
  const target = Math.floor(nonzero * 0.80);
  let acc = 0;
  for (let b = 0; b < B; b++) {
    acc += hist[b];
    if (acc >= target) {
      return ((b + 1) / B) * max;
    }
  }
  return max;
}

/**
 * Classic dwell-heat ramp: transparent → cool blue → teal → green → yellow → red.
 * Alpha ramps up with intensity so cold cells stay readable over the floor plan.
 */
function ramp(t: number): [number, number, number, number] {
  const stops: Array<[number, number, number, number]> = [
    [0.00, 40, 80, 200],   // deep blue
    [0.25, 40, 180, 220],  // cyan
    [0.50, 80, 220, 120],  // green
    [0.75, 250, 210, 60],  // yellow
    [1.00, 230, 60, 60],   // red
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0];
  const k = span > 0 ? (t - lo[0]) / span : 0;
  const r = Math.round(lo[1] + (hi[1] - lo[1]) * k);
  const g = Math.round(lo[2] + (hi[2] - lo[2]) * k);
  const b = Math.round(lo[3] + (hi[3] - lo[3]) * k);
  // Alpha: ease up from 140 to 240 across intensity so cold zones are visible but not dominant.
  const a = Math.round(140 + 100 * t);
  return [r, g, b, a];
}
