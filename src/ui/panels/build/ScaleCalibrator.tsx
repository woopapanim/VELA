import { useCallback, useState } from 'react';
import { Ruler, RotateCcw, AlertTriangle } from 'lucide-react';
import type { DraftScale } from '@/services/ai/types';

type Point = { readonly x: number; readonly y: number };
type Unit = 'm' | 'ft';

const FT_TO_M = 0.3048;

interface Props {
  readonly imageUrl: string;
  readonly imageSize: { readonly width: number; readonly height: number };
  readonly current: DraftScale;
  readonly onApply: (scale: DraftScale) => void;
  readonly onCancel: () => void;
}

export function ScaleCalibrator({ imageUrl, imageSize, current, onApply, onCancel }: Props) {
  const [points, setPoints] = useState<readonly Point[]>([]);
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<Unit>('m');
  const [error, setError] = useState('');

  const addPoint = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    setError('');
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * img.naturalWidth;
    const y = ((e.clientY - rect.top) / rect.height) * img.naturalHeight;
    setPoints((prev) => (prev.length >= 2 ? [{ x, y }] : [...prev, { x, y }]));
  }, []);

  const reset = useCallback(() => {
    setPoints([]);
    setDistance('');
    setError('');
  }, []);

  const apply = useCallback(() => {
    if (points.length !== 2) {
      setError('Click 2 points on the floor plan first.');
      return;
    }
    const d = Number.parseFloat(distance);
    if (!(d > 0)) {
      setError('Enter a positive real-world distance.');
      return;
    }
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const pxDist = Math.sqrt(dx * dx + dy * dy);
    if (pxDist < 4) {
      setError('Points are too close — pick a longer, clearly-known segment.');
      return;
    }
    const realMeters = unit === 'ft' ? d * FT_TO_M : d;
    const metersPerPx = realMeters / pxDist;
    onApply({
      label: `${d}${unit} calibration`,
      widthMeters: imageSize.width * metersPerPx,
      heightMeters: imageSize.height * metersPerPx,
      confidence: 'measured',
      evidence: `User-calibrated from 2 points (${Math.round(pxDist)} px = ${d}${unit}).`,
    });
  }, [points, distance, unit, imageSize, onApply]);

  const aspect = imageSize.width > 0 && imageSize.height > 0
    ? `${imageSize.width} / ${imageSize.height}`
    : '4 / 3';

  // When we got here because the AI couldn't read any dimension off the
  // plan (confidence === 'assumed'), surface a banner explaining the jump.
  // Otherwise the user — who clicked "Recalibrate" or just opened the
  // calibrator — doesn't need the explanation.
  const autoOpened = current.confidence === 'assumed';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
          <Ruler className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Calibrate scale</p>
          <p className="text-[10px] text-muted-foreground">
            Click 2 points on a known dimension, then enter the real distance.
          </p>
        </div>
      </div>

      {autoOpened && (
        <div className="flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-yellow-100/90 leading-relaxed">
            No dimensions were readable on this plan — the scale is a guess. Pick any known distance (a door ≈ 0.9 m, a parking stall ≈ 5 m) to set it.
          </p>
        </div>
      )}

      <div
        className="relative w-full rounded-xl overflow-hidden border border-border bg-black/20 select-none"
        style={{ aspectRatio: aspect, maxHeight: '50vh' }}
      >
        <img
          src={imageUrl}
          alt="Floor plan"
          className="absolute inset-0 w-full h-full object-contain cursor-crosshair"
          onClick={addPoint}
          draggable={false}
        />
        {points.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
            preserveAspectRatio="none"
          >
            {points.length === 2 && (
              <line
                x1={points[0].x}
                y1={points[0].y}
                x2={points[1].x}
                y2={points[1].y}
                stroke="#60a5fa"
                strokeWidth={Math.max(2, imageSize.width / 400)}
                strokeDasharray={`${imageSize.width / 80},${imageSize.width / 160}`}
              />
            )}
            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={Math.max(4, imageSize.width / 140)}
                  fill="#60a5fa"
                  stroke="#fff"
                  strokeWidth={Math.max(1, imageSize.width / 500)}
                />
                <text
                  x={p.x}
                  y={p.y - Math.max(10, imageSize.width / 80)}
                  fontSize={Math.max(12, imageSize.width / 50)}
                  fontWeight={700}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={Math.max(1, imageSize.width / 500)}
                  paintOrder="stroke"
                  textAnchor="middle"
                >
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="number"
          min={0}
          step="0.01"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          placeholder="Real distance"
          className="flex-1 px-3 py-2 text-sm font-data rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none"
        />
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setUnit('m')}
            className={`px-3 py-2 text-xs ${unit === 'm' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-accent'}`}
          >
            m
          </button>
          <button
            type="button"
            onClick={() => setUnit('ft')}
            className={`px-3 py-2 text-xs ${unit === 'ft' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-accent'}`}
          >
            ft
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Points: {points.length}/2</span>
        <span>
          Current: {current.widthMeters.toFixed(1)} × {current.heightMeters.toFixed(1)} m
          {current.label ? ` · ${current.label}` : ''}
        </span>
      </div>

      {error && (
        <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={points.length !== 2 || !distance.trim()}
          className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-3 py-2.5 text-sm rounded-xl bg-secondary hover:bg-accent flex items-center gap-1.5"
          title="Clear points"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm rounded-xl bg-secondary hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
