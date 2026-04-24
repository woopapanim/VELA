/**
 * Room detection Web Worker.
 *
 * All OpenCV.js work runs here so the main thread stays responsive even during
 * the initial ~8MB WASM download + compile (≈3-8s) and the synchronous
 * pipeline calls (adaptive threshold, morphology, findContours) that can each
 * block for seconds on noisy input.
 *
 * Message protocol:
 *   main → worker: { type: 'detect', id, imageData, opts }
 *   worker → main: { type: 'progress', id, stage }
 *                | { type: 'result',   id, result }
 *                | { type: 'error',    id, message }
 *
 * Uses `importScripts` with the OpenCV.js CDN — same-origin is not required
 * for classic workers, only CORS (docs.opencv.org sends the right headers).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const cv: any;

const OPENCV_URL = 'https://docs.opencv.org/4.10.0/opencv.js';

interface WorkerOpts {
  readonly adaptiveBlockSize?: number;
  readonly adaptiveC?: number;
  readonly closeIterations?: number;
  readonly minRoomAreaPx?: number;
  readonly minAspect?: number;
  readonly borderMargin?: number;
}

interface DetectRequest {
  readonly type: 'detect';
  readonly id: number;
  readonly imageData: ImageData;
  readonly processedScale: number;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly opts: WorkerOpts;
}

interface WorkerRoom {
  id: number;
  bounds: { x: number; y: number; w: number; h: number };
  areaPx: number;
  fillRatio: number;
}

let cvReady: Promise<void> | null = null;

function ensureCv(): Promise<void> {
  if (cvReady) return cvReady;
  cvReady = new Promise<void>((resolve, reject) => {
    // Pre-install the runtime-init hook before importScripts runs, so the
    // emscripten Module picks it up (same pattern as the main-thread loader).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).Module = {
      onRuntimeInitialized: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((self as any).cv && typeof (self as any).cv.Mat === 'function') {
          resolve();
        }
      },
    };
    try {
      // importScripts is synchronous and will block the worker (not the main
      // thread) until the 8MB of JS has been downloaded and executed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (self as any).importScripts(OPENCV_URL);
      // Some builds complete synchronously; resolve immediately if so.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((self as any).cv && typeof (self as any).cv.Mat === 'function') {
        resolve();
      }
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
  return cvReady;
}

self.onmessage = async (e: MessageEvent<DetectRequest>) => {
  const msg = e.data;
  if (msg.type !== 'detect') return;
  const { id } = msg;

  try {
    post({ type: 'progress', id, stage: 'Loading OpenCV runtime (first run ≈ 5s)...' });
    await ensureCv();

    post({ type: 'progress', id, stage: 'Detecting rooms...' });
    const rooms = detect(msg);

    post({
      type: 'result',
      id,
      result: {
        rooms,
        imageSize: { width: msg.naturalWidth, height: msg.naturalHeight },
        processedScale: msg.processedScale,
      },
    });
  } catch (err) {
    post({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

function post(
  payload:
    | { type: 'progress'; id: number; stage: string }
    | { type: 'result'; id: number; result: unknown }
    | { type: 'error'; id: number; message: string },
): void {
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(payload);
}

function detect(req: DetectRequest): WorkerRoom[] {
  const {
    adaptiveBlockSize = 21,
    adaptiveC = 7,
    closeIterations = 2,
    minRoomAreaPx = 600,
    minAspect = 0.08,
    borderMargin = 2,
  } = req.opts;

  const blockSize = adaptiveBlockSize % 2 === 0 ? adaptiveBlockSize + 1 : adaptiveBlockSize;
  const { imageData, processedScale: scale } = req;
  const w = imageData.width;
  const h = imageData.height;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mats: { delete(): void }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const track = <T extends { delete(): void }>(m: T): T => {
    mats.push(m);
    return m;
  };

  try {
    const src = track(cv.matFromImageData(imageData));
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const denoised = track(new cv.Mat());
    cv.medianBlur(gray, denoised, 3);

    const blurred = track(new cv.Mat());
    cv.GaussianBlur(denoised, blurred, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);

    const walls = track(new cv.Mat());
    cv.adaptiveThreshold(
      blurred, walls, 255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      blockSize, adaptiveC,
    );

    // NOTE: do NOT run MORPH_OPEN on the wall mask. Architectural walls are
    // 1-2 px thin; a 3x3 erosion step deletes them outright, collapsing the
    // interior into a single giant component that the area filter discards.
    // Median blur on the source image (above) is the right place to kill noise.
    const kernel3 = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)));
    const closed = track(new cv.Mat());
    cv.morphologyEx(walls, closed, cv.MORPH_CLOSE, kernel3, new cv.Point(-1, -1), closeIterations);

    const interior = track(new cv.Mat());
    cv.bitwise_not(closed, interior);

    const contours = track(new cv.MatVector());
    const hierarchy = track(new cv.Mat());
    cv.findContours(interior, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const MAX_CONTOURS = 5000;
    const contourCount = contours.size();
    if (contourCount > MAX_CONTOURS) {
      throw new Error(
        `CV produced ${contourCount} candidate regions (cap ${MAX_CONTOURS}). ` +
        `Image is too noisy — try a cleaner plan or increase adaptiveBlockSize.`,
      );
    }

    const invScale = 1 / scale;
    const filtered: Omit<WorkerRoom, 'id'>[] = [];

    for (let i = 0; i < contourCount; i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour, false);
      const rect = cv.boundingRect(contour);
      contour.delete();

      if (area < minRoomAreaPx * scale * scale) continue;

      // Reject any region that touches the image border — that's outdoor /
      // page margin / unsealed main hall leaking to the outside, not a room.
      // This replaces the old maxRoomAreaRatio heuristic which incorrectly
      // discarded legitimately-large rooms (main halls in small buildings).
      if (rect.x <= borderMargin) continue;
      if (rect.y <= borderMargin) continue;
      if (rect.x + rect.width >= w - borderMargin) continue;
      if (rect.y + rect.height >= h - borderMargin) continue;

      const bw = rect.width;
      const bh = rect.height;
      if (bw < 2 || bh < 2) continue;
      const aspect = Math.min(bw, bh) / Math.max(bw, bh);
      if (aspect < minAspect) continue;

      filtered.push({
        bounds: {
          x: Math.round(rect.x * invScale),
          y: Math.round(rect.y * invScale),
          w: Math.round(bw * invScale),
          h: Math.round(bh * invScale),
        },
        areaPx: Math.round(area * invScale * invScale),
        fillRatio: +(area / (bw * bh)).toFixed(3),
      });
    }

    filtered.sort((a, b) => b.areaPx - a.areaPx);
    return filtered.map((r, i) => ({ id: i + 1, ...r }));
  } finally {
    for (let i = mats.length - 1; i >= 0; i--) {
      try { mats[i].delete(); } catch { /* already deleted */ }
    }
  }
}
