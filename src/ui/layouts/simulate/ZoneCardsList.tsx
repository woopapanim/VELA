import { useStore } from '@/stores';
import { AlertTriangle } from 'lucide-react';
import { useZoneSummaries, type ZoneSummary } from './useLiveInsights';

// Per-zone live cards — color 매칭으로 canvas 와 시각 일관성.
// 병목 zone 을 위로 정렬 (severity sort), 정상은 ratio 높은 순.
export function ZoneCardsList() {
  const phase = useStore((s) => s.phase);
  const summaries = useZoneSummaries();

  // 병목 score 우선 → ratio 우선
  const sorted = [...summaries].sort((a, b) => {
    if (a.bottleneckScore !== b.bottleneckScore) return b.bottleneckScore - a.bottleneckScore;
    return b.ratio - a.ratio;
  });

  if (phase === 'idle') {
    return (
      <div className="rounded-xl bg-[var(--surface)] border border-border p-3">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
          Zones
        </h3>
        <p className="text-[10px] text-muted-foreground">시작 후 zone 별 점유/대기 표시.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-border p-3">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Zones
        </h3>
        <span className="text-[9px] text-muted-foreground font-data">{sorted.length}</span>
      </div>
      <ul className="space-y-1.5">
        {sorted.map((s) => (
          <ZoneRow key={s.zoneId as string} s={s} />
        ))}
      </ul>
    </div>
  );
}

function ZoneRow({ s }: { s: ZoneSummary }) {
  const isBn = s.bottleneckScore > 0.6;
  const ratioPct = Math.round(s.ratio * 100);
  const dwellSec = Math.round(s.meanDwellMs / 1000);

  return (
    <li className="rounded-lg bg-secondary/40 px-2 py-1.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-2 h-2 rounded-sm flex-shrink-0"
          style={{ backgroundColor: s.color }}
        />
        <span className="text-[10px] font-medium truncate flex-1">{s.name}</span>
        {isBn && (
          <AlertTriangle className="w-3 h-3 text-[var(--status-warning)] flex-shrink-0" />
        )}
        <span className="text-[9px] text-muted-foreground font-data tabular-nums">
          {s.currentOccupancy}/{s.capacity}
        </span>
      </div>
      {/* capacity fill bar */}
      <div className="h-0.5 rounded-full bg-secondary overflow-hidden mb-1">
        <div
          className={`h-full transition-[width] duration-300 ${
            ratioPct > 90
              ? 'bg-[var(--status-danger)]'
              : ratioPct > 70
              ? 'bg-[var(--status-warning)]'
              : 'bg-primary'
          }`}
          style={{ width: `${Math.min(100, ratioPct)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground font-data tabular-nums">
        <span>{ratioPct}%</span>
        {dwellSec > 0 && <span>{dwellSec}s avg</span>}
        {s.watchingCount > 0 && <span>{s.watchingCount} 관람</span>}
      </div>
    </li>
  );
}
