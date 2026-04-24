import { Sparkles } from 'lucide-react';
import type { DetectionResult } from '@/services/cv/roomDetector';

const PALETTE = [
  '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15',
  '#4ade80', '#22d3ee', '#f87171', '#c084fc', '#34d399',
];

interface Props {
  readonly imageUrl: string;
  readonly result: DetectionResult;
  readonly onBack: () => void;
  /** When provided, the "Boost with AI" button is shown. Omit to hide. */
  readonly onBoostWithAi?: () => void;
  /** True while an AI boost request is in flight. */
  readonly isBoostingWithAi?: boolean;
}

/**
 * Decide whether CV result is poor enough that we should visibly recommend
 * the AI boost (rather than just offering it). Triggers, derived from the
 * three failure modes we've seen on real plans:
 *   - 0 regions — open-plan / broken walls, CV is structurally stuck.
 *   - ≤2 regions AND coverage < 10% — CV found a handful of tiny regions,
 *     clearly missed the bulk of the building.
 *   - 3+ regions AND coverage < 5% — CV latched on to noise (columns,
 *     furniture, dimension ticks) instead of rooms. Coverage is the
 *     giveaway: real rooms cover 20-60% of the plan, noise covers ~1%.
 *
 * Coverage is measured against the full image, not the building footprint,
 * because we don't have a reliable way to extract the footprint in the CV
 * path. That's fine — if the image is mostly margin, we'll over-promote,
 * which is the safer error direction (user still has the subtle "Try AI"
 * as the alternative).
 */
function shouldRecommendBoost(result: DetectionResult): boolean {
  if (result.rooms.length === 0) return true;
  const imageArea = result.imageSize.width * result.imageSize.height;
  if (imageArea <= 0) return false;
  const rectsArea = result.rooms.reduce((sum, r) => sum + r.bounds.w * r.bounds.h, 0);
  const coverage = rectsArea / imageArea;
  if (result.rooms.length <= 2) return coverage < 0.1;
  return coverage < 0.05;
}

export function CvRoomPreview({ imageUrl, result, onBack, onBoostWithAi, isBoostingWithAi = false }: Props) {
  const { rooms, imageSize, processedScale } = result;
  const aspect = imageSize.width > 0 && imageSize.height > 0
    ? `${imageSize.width} / ${imageSize.height}`
    : '4 / 3';
  const recommendBoost = shouldRecommendBoost(result);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">CV detection</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {rooms.length} region{rooms.length === 1 ? '' : 's'} · processed at {(processedScale * 100).toFixed(0)}% scale
            {recommendBoost && rooms.length > 0 && ' · likely missed most rooms'}
            {recommendBoost && rooms.length === 0 && ' · no walls detected (open plan?)'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onBoostWithAi && (
            <button
              onClick={onBoostWithAi}
              disabled={isBoostingWithAi}
              className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 disabled:opacity-50 ${
                recommendBoost
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'bg-secondary hover:bg-accent text-foreground'
              }`}
              title={
                recommendBoost
                  ? 'CV result looks weak — send the image to Claude Vision for a full layout.'
                  : 'Send the image to Claude Vision for a full layout (uses your API credit).'
              }
            >
              <Sparkles className="w-3 h-3" />
              {isBoostingWithAi ? 'Analyzing…' : recommendBoost ? 'Boost with AI' : 'Try AI'}
            </button>
          )}
          <button
            onClick={onBack}
            disabled={isBoostingWithAi}
            className="px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-accent disabled:opacity-50"
          >
            Back
          </button>
        </div>
      </div>

      <div
        className="relative w-full rounded-xl overflow-hidden border border-border bg-black/20"
        style={{ aspectRatio: aspect, maxHeight: '55vh' }}
      >
        <img
          src={imageUrl}
          alt="Floor plan"
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {rooms.map((r, i) => {
            const color = PALETTE[i % PALETTE.length];
            return (
              <g key={r.id}>
                <rect
                  x={r.bounds.x}
                  y={r.bounds.y}
                  width={r.bounds.w}
                  height={r.bounds.h}
                  fill={color}
                  fillOpacity={0.2}
                  stroke={color}
                  strokeWidth={Math.max(2, imageSize.width / 500)}
                />
                <text
                  x={r.bounds.x + r.bounds.w / 2}
                  y={r.bounds.y + r.bounds.h / 2}
                  fontSize={Math.max(12, imageSize.width / 60)}
                  fontWeight={700}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={Math.max(1, imageSize.width / 600)}
                  paintOrder="stroke"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {r.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="max-h-40 overflow-y-auto border border-border rounded-xl bg-secondary/40">
        <table className="w-full text-[10px] font-data">
          <thead className="sticky top-0 bg-secondary">
            <tr className="text-muted-foreground">
              <th className="px-2 py-1 text-left">#</th>
              <th className="px-2 py-1 text-right">x</th>
              <th className="px-2 py-1 text-right">y</th>
              <th className="px-2 py-1 text-right">w</th>
              <th className="px-2 py-1 text-right">h</th>
              <th className="px-2 py-1 text-right">area</th>
              <th className="px-2 py-1 text-right">fill</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r, i) => (
              <tr key={r.id} className="border-t border-border/50">
                <td className="px-2 py-1">
                  <span
                    className="inline-block w-2 h-2 rounded-sm mr-1 align-middle"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  {r.id}
                </td>
                <td className="px-2 py-1 text-right">{r.bounds.x}</td>
                <td className="px-2 py-1 text-right">{r.bounds.y}</td>
                <td className="px-2 py-1 text-right">{r.bounds.w}</td>
                <td className="px-2 py-1 text-right">{r.bounds.h}</td>
                <td className="px-2 py-1 text-right">{r.areaPx}</td>
                <td className="px-2 py-1 text-right">{r.fillRatio.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Rects above were detected locally by OpenCV.js — no AI involved. If the result looks weak, press {onBoostWithAi ? '“Boost with AI”' : '“Try AI”'} to send the image to Claude Vision for a full layout with room names and scale.
      </p>
    </div>
  );
}
