import { useMemo } from 'react';
import { useStore } from '@/stores';

export function EngagementHistogram() {
  const visitors = useStore((s) => s.visitors);
  const timeState = useStore((s) => s.timeState);

  const histogram = useMemo(() => {
    const active = visitors.filter((v) => v.isActive);
    if (active.length < 5) return null;

    // Compute time spent (elapsed - enteredAt) in minutes
    const times = active.map((v) => (timeState.elapsed - v.enteredAt) / 60000);
    const maxTime = Math.max(...times, 1);
    const bucketCount = 8;
    const bucketSize = Math.ceil(maxTime / bucketCount) || 1;

    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      min: i * bucketSize,
      max: (i + 1) * bucketSize,
      count: 0,
    }));

    for (const t of times) {
      const idx = Math.min(bucketCount - 1, Math.floor(t / bucketSize));
      buckets[idx].count++;
    }

    const maxCount = Math.max(...buckets.map((b) => b.count), 1);
    return { buckets, maxCount, total: active.length };
  }, [visitors, timeState]);

  if (!histogram) return null;

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Time Spent Distribution
      </h2>
      <div className="flex items-end gap-0.5 h-16">
        {histogram.buckets.map((b, i) => {
          const height = (b.count / histogram.maxCount) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full rounded-t bg-primary/60 transition-all duration-300"
                style={{ height: `${height}%`, minHeight: b.count > 0 ? 2 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-0.5 mt-1">
        {histogram.buckets.map((b, i) => (
          <div key={i} className="flex-1 text-center">
            <p className="text-[7px] font-data text-muted-foreground">{b.count}</p>
            <p className="text-[6px] text-muted-foreground">{b.min}m</p>
          </div>
        ))}
      </div>
      <p className="text-[8px] text-muted-foreground mt-1 text-center">
        {histogram.total} visitors · avg {(visitors.filter((v) => v.isActive).reduce((s, v) => s + (timeState.elapsed - v.enteredAt), 0) / histogram.total / 60000).toFixed(1)}m
      </p>
    </div>
  );
}
