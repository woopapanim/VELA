import type { DetectionResult } from '@/services/cv/roomDetector';

const PALETTE = [
  '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15',
  '#4ade80', '#22d3ee', '#f87171', '#c084fc', '#34d399',
];

interface Props {
  readonly imageUrl: string;
  readonly result: DetectionResult;
  readonly onBack: () => void;
}

export function CvRoomPreview({ imageUrl, result, onBack }: Props) {
  const { rooms, imageSize, processedScale } = result;
  const aspect = imageSize.width > 0 && imageSize.height > 0
    ? `${imageSize.width} / ${imageSize.height}`
    : '4 / 3';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">CV-only detection (Phase 1)</p>
          <p className="text-[10px] text-muted-foreground">
            {rooms.length} region{rooms.length === 1 ? '' : 's'} · processed at {(processedScale * 100).toFixed(0)}% scale
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-accent"
        >
          Back
        </button>
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
        Phase 1 preview: classical CV on the uploaded image (no AI). Phase 2 will send these rects to Claude for name/type labelling.
      </p>
    </div>
  );
}
