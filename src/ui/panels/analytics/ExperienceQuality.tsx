import { useMemo } from 'react';
import { useStore } from '@/stores';

export function ExperienceQuality() {
  const visitors = useStore((s) => s.visitors);
  const latestSnapshot = useStore((s) => s.latestSnapshot);

  const metrics = useMemo(() => {
    const active = visitors.filter((v) => v.isActive);
    if (active.length === 0) return null;

    const depths = active.map((v) => v.visitedMediaIds.length);
    const bucket = { zero: 0, low: 0, mid: 0, high: 0 };
    for (const d of depths) {
      if (d === 0) bucket.zero++;
      else if (d <= 2) bucket.low++;
      else if (d <= 5) bucket.mid++;
      else bucket.high++;
    }

    const avgDepth = depths.reduce((s, d) => s + d, 0) / active.length;
    const highFatigueCount = active.filter((v) => v.fatigue > 0.7).length;
    const avgFatigue = latestSnapshot?.fatigueDistribution.mean
      ?? active.reduce((s, v) => s + v.fatigue, 0) / active.length;

    return {
      total: active.length,
      bucket,
      avgDepth,
      avgFatigue,
      highFatigueCount,
      highFatiguePct: (highFatigueCount / active.length) * 100,
    };
  }, [visitors, latestSnapshot]);

  if (!metrics) {
    return (
      <div className="bento-box p-3">
        <h2 className="panel-section mb-2">
          Experience Quality
        </h2>
        <p className="text-[10px] text-muted-foreground">
          No active visitors.
        </p>
      </div>
    );
  }

  const { total, bucket, avgDepth, avgFatigue, highFatigueCount, highFatiguePct } = metrics;
  const barSegments = [
    { label: '0', count: bucket.zero, color: 'bg-[var(--status-danger)]' },
    { label: '1-2', count: bucket.low, color: 'bg-[var(--status-warning)]' },
    { label: '3-5', count: bucket.mid, color: 'bg-primary' },
    { label: '6+', count: bucket.high, color: 'bg-[var(--status-success)]' },
  ];

  return (
    <div className="bento-box p-3">
      <h2 className="panel-section mb-2">
        Experience Quality
      </h2>

      <div className="space-y-2">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Depth (media watched)</span>
            <span className="text-[10px] font-data">avg {avgDepth.toFixed(1)}</span>
          </div>
          <div className="flex gap-0.5 h-3 rounded-md overflow-hidden">
            {barSegments.map((seg) => {
              const pct = (seg.count / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={seg.label}
                  className={`${seg.color} flex items-center justify-center`}
                  style={{ width: `${pct}%` }}
                  title={`${seg.label}: ${seg.count}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-muted-foreground font-data">
            {barSegments.map((seg) => (
              <span key={seg.label}>
                {seg.label}·{seg.count}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <div>
            <p className="text-[10px] text-muted-foreground">Avg Fatigue</p>
            <p
              className={`text-sm font-semibold font-data ${
                avgFatigue > 0.6
                  ? 'text-[var(--status-danger)]'
                  : avgFatigue > 0.4
                    ? 'text-[var(--status-warning)]'
                    : 'text-primary'
              }`}
            >
              {Math.round(avgFatigue * 100)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">High Fatigue (&gt;70%)</p>
            <p
              className={`text-sm font-semibold font-data ${
                highFatiguePct > 20 ? 'text-[var(--status-danger)]' : 'text-primary'
              }`}
            >
              {highFatigueCount} <span className="text-[10px] text-muted-foreground">({highFatiguePct.toFixed(0)}%)</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
