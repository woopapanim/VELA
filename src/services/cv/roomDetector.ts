/**
 * Browser-side room detector for architectural floor plans.
 *
 * Public API lives on the main thread; the heavy OpenCV pipeline runs in a
 * Web Worker (`roomDetector.worker.ts`). This keeps the UI responsive during
 * the initial ~8MB WASM download + compile and during the synchronous CV
 * passes (adaptive threshold, morphology, findContours) that can each block
 * for seconds on noisy input.
 *
 * Main-thread responsibilities (required because Worker has no DOM):
 *   1. Load the image (`Image` element).
 *   2. Downscale and draw it to a canvas.
 *   3. Extract ImageData and transfer its buffer to the worker.
 */

// The worker must be a CLASSIC worker because it uses `importScripts()` to
// pull in OpenCV.js at runtime — module workers forbid that API. Vite bundles
// the worker file separately when it sees the `new URL('...', import.meta.url)`
// pattern with the `{ type: 'classic' }` option.
const workerUrl = new URL('./roomDetector.worker.ts', import.meta.url);

export interface DetectedRoom {
  readonly id: number;
  /** Axis-aligned bounding box in ORIGINAL image pixel coordinates. */
  readonly bounds: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** Interior pixel count in original image coordinates (approximate). */
  readonly areaPx: number;
  /** contourArea / (w*h). ~1 for rectangles, lower for L-shapes/organic rooms. */
  readonly fillRatio: number;
}

export interface DetectionResult {
  readonly rooms: readonly DetectedRoom[];
  readonly imageSize: { readonly width: number; readonly height: number };
  /** Downscale factor used during detection (1.0 = no downscaling). */
  readonly processedScale: number;
}

export interface DetectorOptions {
  /** Adaptive threshold block size (odd, ≥3). Larger smooths over hatching. Default 21. */
  readonly adaptiveBlockSize?: number;
  /** Constant subtracted from local mean. Higher = fewer "wall" pixels. Default 7. */
  readonly adaptiveC?: number;
  /** Iterations of 3×3 morphological closing to seal wall gaps. Default 2. */
  readonly closeIterations?: number;
  /** Components smaller than this (processed-scale pixels) are discarded. Default 2500.
   *  Was 600 — raised because it let dimension-line tick marks through (~1000-2000 px²)
   *  which then poisoned the AI hint list on plans where no actual rooms got detected.
   *  Real rooms at 2m×2m on a 1500px-wide plan of a 30m building are ~10000 px². */
  readonly minRoomAreaPx?: number;
  /** min(w,h)/max(w,h) below this is discarded. Default 0.08. */
  readonly minAspect?: number;
  /** Regions whose bbox touches within this many px of the image edge are discarded as outdoor/margin. Default 2. */
  readonly borderMargin?: number;
  /** Downsample any image larger than this many pixels. Default 2_250_000 (≈1500×1500).
   *  Was 1M — raised because thin 1-2 px walls on moderate-res plans were getting
   *  blurred into the hatched exterior at 66% downsample, breaking room contours. */
  readonly maxImagePixels?: number;
  /** Per-stage progress hook. */
  readonly onProgress?: (stage: string) => void;
}

// Singleton worker — avoids re-downloading + re-compiling OpenCV's ~8MB WASM
// on every call. Vite's HMR disposes workers automatically on module replace.
let workerInstance: Worker | null = null;
let requestSeq = 0;

function getWorker(): Worker {
  if (!workerInstance) workerInstance = new Worker(workerUrl, { type: 'classic' });
  return workerInstance;
}

type WorkerMessage =
  | { type: 'progress'; id: number; stage: string }
  | { type: 'result'; id: number; result: DetectionResult }
  | { type: 'error'; id: number; message: string };

export async function detectRooms(
  imageUrl: string,
  opts: DetectorOptions = {},
): Promise<DetectionResult> {
  const { maxImagePixels = 2_250_000, onProgress, ...workerOpts } = opts;

  onProgress?.('Reading image...');
  const img = await loadImage(imageUrl);
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  const pixelCount = naturalW * naturalH;
  const scale = pixelCount > maxImagePixels ? Math.sqrt(maxImagePixels / pixelCount) : 1;
  const w = Math.max(1, Math.round(naturalW * scale));
  const h = Math.max(1, Math.round(naturalH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  const id = ++requestSeq;
  const worker = getWorker();

  return new Promise<DetectionResult>((resolve, reject) => {
    const onMessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.id !== id) return;
      if (msg.type === 'progress') {
        onProgress?.(msg.stage);
      } else if (msg.type === 'result') {
        cleanup();
        resolve(msg.result);
      } else if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.message));
      }
    };
    const onError = (err: ErrorEvent) => {
      cleanup();
      reject(new Error(err.message || 'Worker error during CV detection.'));
    };
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    worker.postMessage(
      {
        type: 'detect',
        id,
        imageData,
        processedScale: scale,
        naturalWidth: naturalW,
        naturalHeight: naturalH,
        opts: workerOpts,
      },
      [imageData.data.buffer],
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}
