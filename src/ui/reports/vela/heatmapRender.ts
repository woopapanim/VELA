import type { DensityGrid } from '@/domain';

// 5-stop ramp: transparent → blue → yellow → orange → red
const STOPS: ReadonlyArray<readonly [number, readonly [number, number, number, number]]> = [
  [0.00, [59, 130, 246, 0]],
  [0.15, [59, 130, 246, 90]],
  [0.45, [250, 204, 21, 160]],
  [0.75, [249, 115, 22, 200]],
  [1.00, [220, 38, 38, 230]],
];

function ramp(t: number): [number, number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (t <= t1) {
      const [t0, c0] = STOPS[i - 1];
      const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
        Math.round(c0[3] + (c1[3] - c0[3]) * f),
      ];
    }
  }
  return [...STOPS[STOPS.length - 1][1]] as [number, number, number, number];
}

export interface HeatmapOptions {
  readonly boundsWorld: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  readonly outWidth?: number;   // default 480
}

/**
 * Render a DensityGrid to a PNG data URL, cropped/aligned to the given world bounds.
 * Returns null if the grid is empty (all zeroes) or bounds are invalid.
 */
export function renderDensityGridToDataUrl(
  grid: DensityGrid,
  opts: HeatmapOptions,
): string | null {
  const { minX, minY, maxX, maxY } = opts.boundsWorld;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX <= 0 || spanY <= 0) return null;

  // Find max value for log normalization
  let maxVal = 0;
  for (let i = 0; i < grid.data.length; i++) {
    if (grid.data[i] > maxVal) maxVal = grid.data[i];
  }
  if (maxVal <= 0) return null;

  const outW = Math.max(64, Math.min(opts.outWidth ?? 480, 1200));
  const outH = Math.max(64, Math.round(outW * (spanY / spanX)));

  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(outW, outH)
    : (() => {
        const c = document.createElement('canvas');
        c.width = outW;
        c.height = outH;
        return c;
      })();
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return null;

  const img = ctx.createImageData(outW, outH);
  const data = img.data;
  const logMax = Math.log1p(maxVal);

  for (let py = 0; py < outH; py++) {
    const worldY = minY + (py / outH) * spanY;
    const cy = Math.floor((worldY - grid.originY) / grid.cellPx);
    for (let px = 0; px < outW; px++) {
      const worldX = minX + (px / outW) * spanX;
      const cx = Math.floor((worldX - grid.originX) / grid.cellPx);
      let v = 0;
      if (cx >= 0 && cx < grid.cols && cy >= 0 && cy < grid.rows) {
        v = grid.data[cy * grid.cols + cx];
      }
      const t = v > 0 ? Math.log1p(v) / logMax : 0;
      const [r, g, b, a] = ramp(t);
      const i = (py * outW + px) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);

  if ('convertToBlob' in canvas) {
    // OffscreenCanvas path — we can't await here, so fall through to HTMLCanvas path via transferToImageBitmap.
    // Instead, render via HTMLCanvas for toDataURL synchronous support.
    const fallback = document.createElement('canvas');
    fallback.width = outW;
    fallback.height = outH;
    const fctx = fallback.getContext('2d');
    if (!fctx) return null;
    fctx.putImageData(img, 0, 0);
    return fallback.toDataURL('image/png');
  }
  return (canvas as HTMLCanvasElement).toDataURL('image/png');
}
