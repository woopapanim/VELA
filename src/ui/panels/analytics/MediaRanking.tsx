import { useMemo } from 'react';
import { useStore } from '@/stores';
import { VISITOR_ACTION } from '@/domain';

export function MediaRanking() {
  const visitors = useStore((s) => s.visitors);
  const media = useStore((s) => s.media);
  const zones = useStore((s) => s.zones);

  const rankings = useMemo(() => {
    const active = visitors.filter((v) => v.isActive);
    const watchCounts = new Map<string, number>();
    const waitCounts = new Map<string, number>();

    for (const v of active) {
      if (!v.targetMediaId) continue;
      const key = v.targetMediaId as string;
      if (v.currentAction === VISITOR_ACTION.WATCHING) {
        watchCounts.set(key, (watchCounts.get(key) ?? 0) + 1);
      } else if (v.currentAction === VISITOR_ACTION.WAITING) {
        waitCounts.set(key, (waitCounts.get(key) ?? 0) + 1);
      }
    }

    return media
      .map((m) => ({
        id: m.id as string,
        type: m.type.replace(/_/g, ' '),
        zoneName: zones.find((z) => z.id === m.zoneId)?.name ?? '?',
        capacity: m.capacity,
        watching: watchCounts.get(m.id as string) ?? 0,
        waiting: waitCounts.get(m.id as string) ?? 0,
      }))
      .filter((m) => m.watching > 0 || m.waiting > 0)
      .sort((a, b) => (b.watching + b.waiting) - (a.watching + a.waiting));
  }, [visitors, media, zones]);

  if (rankings.length === 0) return null;

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Media Activity
      </h2>
      <div className="space-y-1.5">
        {rankings.slice(0, 6).map((m) => {
          const utilPct = m.capacity > 0 ? Math.round((m.watching / m.capacity) * 100) : 0;
          return (
            <div key={m.id} className="flex items-center gap-2 text-[9px]">
              <div className="flex-1 min-w-0">
                <p className="font-data truncate">{m.type}</p>
                <p className="text-[8px] text-muted-foreground truncate">{m.zoneName}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[var(--status-success)] font-data">{m.watching}</span>
                <span className="text-muted-foreground">/</span>
                <span className="font-data">{m.capacity}</span>
                {m.waiting > 0 && (
                  <span className="text-[var(--status-warning)] font-data">+{m.waiting}↻</span>
                )}
              </div>
              <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden shrink-0">
                <div
                  className={`h-full rounded-full ${utilPct >= 100 ? 'bg-[var(--status-danger)]' : 'bg-[var(--status-success)]'}`}
                  style={{ width: `${Math.min(100, utilPct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
