import { useStore } from '@/stores';

export function MediaStatsPanel() {
  const media = useStore((s) => s.media);
  const mediaStats = useStore((s) => s.mediaStats);
  const phase = useStore((s) => s.phase);

  if (phase === 'idle' || media.length === 0) return null;

  return (
    <div className="bento-box p-3 space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Media Activity
      </h3>
      <div className="space-y-1.5">
        {media.map((m) => {
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
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  {name}
                </span>
                <span className="text-[8px] text-muted-foreground uppercase">
                  {isActive ? 'active' : 'passive'}
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
}
