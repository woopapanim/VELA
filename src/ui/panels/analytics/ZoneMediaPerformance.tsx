import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '@/stores';
import { VISITOR_ACTION } from '@/domain';
import { useT } from '@/i18n';
import { InfoTooltip } from '@/ui/components/InfoTooltip';

type ZoneRow = {
  id: string;
  name: string;
  mediaCount: number;
  watchCount: number;
  skipCount: number;
  approachCount: number;
  totalWatchMs: number;
  peakViewers: number;
  capacitySum: number;
  watchingNow: number;
  waitingNow: number;
  items: MediaRow[];
};

type MediaRow = {
  id: string;
  type: string;
  interactionType: string;
  capacity: number;
  watchCount: number;
  skipCount: number;
  avgWatchSec: number;
  peakViewers: number;
  watchingNow: number;
  waitingNow: number;
  waitCount: number;
  avgWaitSec: number;
};

export function ZoneMediaPerformance() {
  const media = useStore((s) => s.media);
  const mediaStats = useStore((s) => s.mediaStats);
  const zones = useStore((s) => s.zones);
  const visitors = useStore((s) => s.visitors);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const phase = useStore((s) => s.phase);
  const t = useT();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo<ZoneRow[]>(() => {
    const approachByMedia = new Map<string, number>();
    if (latestSnapshot?.skipRate) {
      for (const entry of latestSnapshot.skipRate.perMedia) {
        approachByMedia.set(entry.mediaId as string, entry.totalApproaches);
      }
    }

    // live watching/waiting counts from active visitors
    const watchingNow = new Map<string, number>();
    const waitingNow = new Map<string, number>();
    for (const v of visitors) {
      if (!v.isActive || !v.targetMediaId) continue;
      const key = v.targetMediaId as string;
      if (v.currentAction === VISITOR_ACTION.WATCHING) {
        watchingNow.set(key, (watchingNow.get(key) ?? 0) + 1);
      } else if (v.currentAction === VISITOR_ACTION.WAITING) {
        waitingNow.set(key, (waitingNow.get(key) ?? 0) + 1);
      }
    }

    return zones
      .map((z) => {
        const zoneMedia = media.filter((m) => m.zoneId === z.id);
        if (zoneMedia.length === 0) return null;

        const items: MediaRow[] = zoneMedia.map((m) => {
          const stats = mediaStats.get(m.id as string);
          const watchCount = stats?.watchCount ?? 0;
          const skipCount = stats?.skipCount ?? 0;
          const totalWatchMs = stats?.totalWatchMs ?? 0;
          const waitCount = stats?.waitCount ?? 0;
          const totalWaitMs = stats?.totalWaitMs ?? 0;
          return {
            id: m.id as string,
            type: m.type.replace(/_/g, ' '),
            interactionType: (m as any).interactionType ?? 'passive',
            capacity: m.capacity,
            watchCount,
            skipCount,
            avgWatchSec: watchCount > 0 ? totalWatchMs / watchCount / 1000 : 0,
            peakViewers: stats?.peakViewers ?? 0,
            watchingNow: watchingNow.get(m.id as string) ?? 0,
            waitingNow: waitingNow.get(m.id as string) ?? 0,
            waitCount,
            avgWaitSec: waitCount > 0 ? totalWaitMs / waitCount / 1000 : 0,
          };
        });

        let zWatch = 0, zSkip = 0, zApproach = 0, zMs = 0, zPeak = 0;
        let zCap = 0, zWatchNow = 0, zWaitNow = 0;
        for (const m of zoneMedia) {
          const stats = mediaStats.get(m.id as string);
          zWatch += stats?.watchCount ?? 0;
          zSkip += stats?.skipCount ?? 0;
          zApproach += approachByMedia.get(m.id as string) ?? 0;
          zMs += stats?.totalWatchMs ?? 0;
          zPeak += stats?.peakViewers ?? 0;
          zCap += m.capacity;
          zWatchNow += watchingNow.get(m.id as string) ?? 0;
          zWaitNow += waitingNow.get(m.id as string) ?? 0;
        }

        return {
          id: z.id as string,
          name: z.name,
          mediaCount: zoneMedia.length,
          watchCount: zWatch,
          skipCount: zSkip,
          approachCount: zApproach,
          totalWatchMs: zMs,
          peakViewers: zPeak,
          capacitySum: zCap,
          watchingNow: zWatchNow,
          waitingNow: zWaitNow,
          items,
        };
      })
      .filter((r): r is ZoneRow => r !== null)
      .sort((a, b) => b.watchCount + b.skipCount - (a.watchCount + a.skipCount));
  }, [media, mediaStats, zones, visitors, latestSnapshot]);

  if (phase === 'idle' || rows.length === 0) {
    return (
      <div className="bento-box p-3">
        <div className="flex items-center gap-1 mb-2">
          <h2 className="panel-section">
            Zone Media Performance
          </h2>
          <InfoTooltip text={t('tooltip.experience.zoneMedia')} />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Zone-level media performance will appear once the simulation runs.
        </p>
      </div>
    );
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bento-box p-3">
      <div className="flex items-center gap-1 mb-2">
        <h2 className="panel-section">
          Zone Media Performance
        </h2>
        <InfoTooltip text={t('tooltip.experience.zoneMedia')} />
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const isOpen = expanded.has(r.id);
          const total = r.watchCount + r.skipCount;
          const denom = r.approachCount > 0 ? r.approachCount : total;
          const skipPct = denom > 0 ? Math.round((r.skipCount / denom) * 100) : 0;
          const avgWatchSec = r.watchCount > 0 ? r.totalWatchMs / r.watchCount / 1000 : 0;
          const skipColor =
            skipPct >= 30
              ? 'text-[var(--status-danger)]'
              : skipPct >= 15
                ? 'text-[var(--status-warning)]'
                : 'text-muted-foreground';
          return (
            <div key={r.id} className="rounded-lg border border-border bg-secondary/20">
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-secondary/40 transition-colors rounded-lg"
              >
                {isOpen ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-medium truncate">{r.name}</span>
                    <span className="text-[8px] text-muted-foreground shrink-0">
                      {r.mediaCount} {t('zoneMedia.itemsSuffix')}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[9px] font-data">
                    <span className="text-[var(--status-success)]">{r.watchCount}w</span>
                    <span className={skipColor}>skip {skipPct}%</span>
                    <span className="text-muted-foreground">{avgWatchSec.toFixed(1)}s avg</span>
                    <span className="text-muted-foreground">peak {r.peakViewers}/{r.capacitySum}</span>
                  </div>
                </div>
                {(r.watchingNow > 0 || r.waitingNow > 0) && (
                  <div className="flex items-center gap-1 text-[9px] font-data shrink-0">
                    {r.watchingNow > 0 && (
                      <span className="text-[var(--status-success)]">{r.watchingNow}●</span>
                    )}
                    {r.waitingNow > 0 && (
                      <span className="text-[var(--status-warning)]">{r.waitingNow}↻</span>
                    )}
                  </div>
                )}
              </button>
              {isOpen && (
                <div className="px-2 pb-2 pt-0.5 space-y-1 border-t border-border/50">
                  {r.items.map((m) => {
                    const mTotal = m.watchCount + m.skipCount;
                    const mSkipPct = mTotal > 0 ? Math.round((m.skipCount / mTotal) * 100) : 0;
                    const isActive = m.interactionType === 'active';
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 text-[9px] pt-1"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-data truncate">{m.type}</p>
                          <p className="text-[8px] text-muted-foreground">
                            {m.interactionType} · cap {m.capacity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 font-data">
                          <span className="text-[var(--status-success)]">{m.watchCount}w</span>
                          <span className="text-[var(--status-danger)]">{m.skipCount}s</span>
                          <span
                            className={`${mSkipPct >= 30 ? 'text-[var(--status-danger)]' : 'text-muted-foreground'}`}
                          >
                            {mSkipPct}%
                          </span>
                          <span className="text-muted-foreground">{m.avgWatchSec.toFixed(1)}s</span>
                          {isActive && m.waitCount > 0 && (
                            <span className="text-[var(--status-warning)]">
                              wait {m.waitCount}·{m.avgWaitSec.toFixed(1)}s
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            peak {m.peakViewers}/{m.capacity}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
