import { useMemo } from 'react';
import { useStore } from '@/stores';

const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  analog: { label: '아날로그', color: '#a78bfa' },
  passive_media: { label: '패시브', color: '#3b82f6' },
  active: { label: '액티브', color: '#f59e0b' },
  immersive: { label: '이머시브', color: '#ec4899' },
};

export function MediaStatsPanel() {
  const media = useStore((s) => s.media);
  const mediaStats = useStore((s) => s.mediaStats);
  const phase = useStore((s) => s.phase);

  // Group media by category
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof media>();
    for (const m of media) {
      const cat = (m as any).category as string ?? 'unknown';
      const list = groups.get(cat) ?? [];
      list.push(m);
      groups.set(cat, list);
    }
    return groups;
  }, [media]);

  if (phase === 'idle' || media.length === 0) return null;

  return (
    <div className="bento-box p-3 space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Media Activity
      </h3>
      {Array.from(grouped.entries()).map(([cat, items]) => {
        const info = CATEGORY_INFO[cat];
        // Aggregate category stats
        let catWatch = 0, catSkip = 0, catWatchMs = 0;
        for (const m of items) {
          const s = mediaStats.get(m.id as string);
          if (!s) continue;
          catWatch += s.watchCount;
          catSkip += s.skipCount;
          catWatchMs += s.totalWatchMs;
        }
        const catTotal = catWatch + catSkip;
        const catSkipRate = catTotal > 0 ? Math.round(catSkip / catTotal * 100) : 0;
        const catAvgWatch = catWatch > 0 ? Math.round(catWatchMs / catWatch / 1000) : 0;

        return (
          <div key={cat}>
            {/* Category header with aggregate */}
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: info?.color ?? '#666' }} />
              <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: info?.color }}>
                {info?.label ?? cat}
              </span>
              {catTotal > 0 && (
                <span className="text-[8px] text-muted-foreground ml-auto">
                  관람 {catWatch} | skip {catSkipRate}% | avg {catAvgWatch}s
                </span>
              )}
            </div>
            {/* Individual media items */}
            <div className="space-y-1">
              {items.map((m) => {
                const stats = mediaStats.get(m.id as string);
                const name = (m as any).name || m.type.replace(/_/g, ' ');
                const isActive = (m as any).interactionType === 'active';
                const avgWatch = stats && stats.watchCount > 0
                  ? Math.round(stats.totalWatchMs / stats.watchCount / 1000)
                  : 0;
                const avgWait = stats && stats.waitCount > 0
                  ? Math.round(stats.totalWaitMs / stats.waitCount / 1000)
                  : 0;
                const skipRate = stats && (stats.watchCount + stats.skipCount) > 0
                  ? Math.round(stats.skipCount / (stats.watchCount + stats.skipCount) * 100)
                  : 0;

                return (
                  <div key={m.id as string} className="px-2 py-1.5 rounded-lg bg-secondary/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: info?.color ?? '#888' }} />
                        {name}
                      </span>
                      <span className="text-[8px] text-muted-foreground uppercase">
                        {(m as any).interactionType ?? 'passive'}
                      </span>
                    </div>
                    {stats ? (
                      <div className="grid grid-cols-3 gap-1 text-[9px]">
                        <div>
                          <span className="text-muted-foreground">Watched</span>
                          <span className="ml-1 font-data text-green-400">{stats.watchCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Skipped</span>
                          <span className="ml-1 font-data text-amber-400">{stats.skipCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Skip%</span>
                          <span className={`ml-1 font-data ${skipRate > 30 ? 'text-red-400' : 'text-muted-foreground'}`}>
                            {skipRate}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Watch</span>
                          <span className="ml-1 font-data">{avgWatch}s</span>
                        </div>
                        {isActive && (
                          <>
                            <div>
                              <span className="text-muted-foreground">Waited</span>
                              <span className="ml-1 font-data">{stats.waitCount}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Avg Wait</span>
                              <span className="ml-1 font-data">{avgWait}s</span>
                            </div>
                          </>
                        )}
                        <div>
                          <span className="text-muted-foreground">Peak</span>
                          <span className="ml-1 font-data">{stats.peakViewers}/{m.capacity}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[8px] text-muted-foreground">No data yet</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
