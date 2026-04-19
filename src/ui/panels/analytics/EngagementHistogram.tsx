import { useMemo } from 'react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { InfoTooltip } from '@/ui/components/InfoTooltip';

export function EngagementHistogram() {
  const visitors = useStore((s) => s.visitors);
  const timeState = useStore((s) => s.timeState);
  const t = useT();

  const histogram = useMemo(() => {
    const now = timeState.elapsed;
    // total duration in venue (ms) for each visitor — active (ongoing) or exited (final)
    const entries = visitors
      .filter((v) => v.enteredAt > 0)
      .map((v) => {
        const end = v.isActive ? now : (v.exitedAt ?? now);
        return { ms: Math.max(0, end - v.enteredAt), done: !v.isActive };
      })
      .filter((e) => e.ms > 0);

    if (entries.length < 3) return null;

    const minutes = entries.map((e) => e.ms / 60000);
    const maxTime = Math.max(...minutes, 1);
    const bucketCount = 8;
    const bucketSize = Math.max(1, Math.ceil(maxTime / bucketCount));

    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      min: i * bucketSize,
      max: (i + 1) * bucketSize,
      active: 0,
      exited: 0,
    }));

    for (const e of entries) {
      const m = e.ms / 60000;
      const idx = Math.min(bucketCount - 1, Math.floor(m / bucketSize));
      if (e.done) buckets[idx].exited++;
      else buckets[idx].active++;
    }

    const maxCount = Math.max(...buckets.map((b) => b.active + b.exited), 1);
    const total = entries.length;
    const exitedCount = entries.filter((e) => e.done).length;
    const avgMin = entries.reduce((s, e) => s + e.ms, 0) / total / 60000;
    return { buckets, maxCount, total, exitedCount, avgMin, bucketSize };
  }, [visitors, timeState]);

  if (!histogram) return null;

  return (
    <div className="bento-box p-4">
      <div className="flex items-center gap-1 mb-3">
        <h2 className="panel-section">
          {t('experience.timeSpent.title')}
        </h2>
        <InfoTooltip text={t('tooltip.experience.timeSpent')} />
      </div>
      <div className="flex items-stretch gap-0.5 h-16">
        {histogram.buckets.map((b, i) => {
          const totalInBucket = b.active + b.exited;
          const height = (totalInBucket / histogram.maxCount) * 100;
          const exitedPct = totalInBucket > 0 ? (b.exited / totalInBucket) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div
                className="w-full rounded-t overflow-hidden flex flex-col-reverse transition-all duration-300"
                style={{ height: `${height}%`, minHeight: totalInBucket > 0 ? 2 : 0 }}
                title={`${b.min}-${b.max}m: ${b.exited} exited · ${b.active} ongoing`}
              >
                <div className="bg-[var(--status-success)]/80 shrink-0" style={{ height: `${exitedPct}%` }} />
                <div className="bg-primary/50 flex-1" />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-0.5 mt-1">
        {histogram.buckets.map((b, i) => (
          <div key={i} className="flex-1 text-center">
            <p className="text-[7px] font-data text-muted-foreground">{b.active + b.exited}</p>
            <p className="text-[6px] text-muted-foreground">{b.min}m</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-1 text-[8px] text-muted-foreground">
        <span className="flex items-center gap-0.5">
          <span className="inline-block w-2 h-2 rounded-sm bg-[var(--status-success)]/80" />
          {t('experience.timeSpent.exited')} {histogram.exitedCount}
        </span>
        <span className="flex items-center gap-0.5">
          <span className="inline-block w-2 h-2 rounded-sm bg-primary/50" />
          {t('experience.timeSpent.ongoing')} {histogram.total - histogram.exitedCount}
        </span>
        <span>· {t('experience.timeSpent.avg')} {histogram.avgMin.toFixed(1)}m</span>
      </div>
    </div>
  );
}
