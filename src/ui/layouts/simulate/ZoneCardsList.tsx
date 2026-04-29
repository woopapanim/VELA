import { useStore } from '@/stores';
import { AlertTriangle } from 'lucide-react';
import { useZoneSummaries, type ZoneSummary } from './useLiveInsights';

// Per-zone live cards — color 매칭으로 canvas 와 시각 일관성.
// 접근성: 모든 수치 aria-label, 상태 색을 텍스트 보조로 보강.
export function ZoneCardsList() {
  const phase = useStore((s) => s.phase);
  const summaries = useZoneSummaries();

  const sorted = [...summaries].sort((a, b) => {
    if (a.bottleneckScore !== b.bottleneckScore) return b.bottleneckScore - a.bottleneckScore;
    return b.ratio - a.ratio;
  });

  if (phase === 'idle') {
    return (
      <section
        className="rounded-xl bg-[var(--surface)] border border-border p-3"
        aria-labelledby="zones-heading"
      >
        <h3
          id="zones-heading"
          className="text-[11px] uppercase tracking-wider font-semibold text-foreground/80 mb-2"
        >
          Zones
        </h3>
        <p className="text-[11px] text-muted-foreground">시작 후 zone 별 점유/대기 표시.</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl bg-[var(--surface)] border border-border p-3"
      aria-labelledby="zones-heading"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h3
          id="zones-heading"
          className="text-[11px] uppercase tracking-wider font-semibold text-foreground/80"
        >
          Zones
        </h3>
        <span className="text-[10px] text-muted-foreground font-data" aria-label={`${sorted.length}개 zone`}>
          {sorted.length}
        </span>
      </div>
      <ul className="space-y-1.5" role="list">
        {sorted.map((s) => (
          <ZoneRow key={s.zoneId as string} s={s} />
        ))}
      </ul>
    </section>
  );
}

function ZoneRow({ s }: { s: ZoneSummary }) {
  const isBn = s.bottleneckScore > 0.6;
  const ratioPct = Math.round(s.ratio * 100);
  const dwellSec = Math.round(s.meanDwellMs / 1000);

  const ariaLabel = [
    `${s.name}`,
    `점유 ${ratioPct}% (${s.currentOccupancy}/${s.capacity})`,
    isBn ? `병목 score ${Math.round(s.bottleneckScore * 100)}` : null,
    dwellSec > 0 ? `평균 체류 ${dwellSec}초` : null,
    s.watchingCount > 0 ? `관람중 ${s.watchingCount}명` : null,
  ].filter(Boolean).join(', ');

  return (
    <li className="rounded-lg bg-secondary/40 px-2 py-2" aria-label={ariaLabel}>
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
          style={{ backgroundColor: s.color }}
          aria-hidden="true"
        />
        <span className="text-[11px] font-medium truncate flex-1 text-foreground" aria-hidden="true">
          {s.name}
        </span>
        {isBn && (
          <AlertTriangle
            className="w-3.5 h-3.5 text-[var(--status-warning)] flex-shrink-0"
            aria-label="병목 발생"
          />
        )}
        <span
          className="text-[10px] text-foreground/80 font-data tabular-nums"
          aria-hidden="true"
        >
          {s.currentOccupancy}/{s.capacity}
        </span>
      </div>
      {/* capacity fill bar */}
      <div
        className="h-1 rounded-full bg-secondary overflow-hidden mb-1"
        role="progressbar"
        aria-valuenow={ratioPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${s.name} 점유율`}
      >
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
      <div className="flex items-center justify-between text-[10px] text-foreground/70 font-data tabular-nums" aria-hidden="true">
        <span className="font-semibold">{ratioPct}%</span>
        <div className="flex items-center gap-2">
          {dwellSec > 0 && <span>{dwellSec}s avg</span>}
          {s.watchingCount > 0 && <span>{s.watchingCount} 관람</span>}
        </div>
      </div>
    </li>
  );
}
