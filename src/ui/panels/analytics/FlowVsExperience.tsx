import { useMemo } from 'react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { InfoTooltip } from '@/ui/components/InfoTooltip';

export function FlowVsExperience() {
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const t = useT();

  const rows = useMemo(() => {
    const active = visitors.filter((v) => v.isActive);
    if (active.length === 0) return [];

    return zones
      .map((z) => {
        const zoneVisitors = active.filter((v) => v.currentZoneId === z.id);
        if (zoneVisitors.length === 0) return null;

        const zoneMediaIds = new Set(
          media.filter((m) => m.zoneId === z.id).map((m) => m.id as string),
        );
        const depthSum = zoneVisitors.reduce((acc, v) => {
          const watched = v.visitedMediaIds.filter((mid) => zoneMediaIds.has(mid as string)).length;
          return acc + watched;
        }, 0);
        const fatigueSum = zoneVisitors.reduce((acc, v) => acc + v.fatigue, 0);

        return {
          id: z.id as string,
          name: z.name,
          occupancy: zoneVisitors.length,
          avgDepth: depthSum / zoneVisitors.length,
          avgFatigue: fatigueSum / zoneVisitors.length,
          mediaCount: zoneMediaIds.size,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.occupancy - a.occupancy);
  }, [visitors, zones, media]);

  if (rows.length === 0) {
    return (
      <div className="bento-box p-3">
        <h2 className="panel-section mb-2">
          Flow vs Experience
        </h2>
        <p className="text-[10px] text-muted-foreground">
          Run simulation to see zone-level flow/experience balance.
        </p>
      </div>
    );
  }

  return (
    <div className="bento-box p-3">
      <div className="flex items-center gap-1 mb-2">
        <h2 className="panel-section">
          Flow vs Experience
        </h2>
        <InfoTooltip text={t('tooltip.experience.flowVsExperience')} />
      </div>
      <div className="flex items-center gap-2 pb-1.5 mb-1.5 border-b border-border panel-label">
        <span className="flex-1">Zone</span>
        <span className="w-8 text-right">Pop</span>
        <span className="w-10 text-right">Depth</span>
        <span className="w-12 text-right">Fatigue</span>
      </div>
      <div className="space-y-1">
        {rows.map((r) => {
          const isRushThrough = r.mediaCount > 0 && r.avgDepth < r.mediaCount * 0.25;
          const fatiguePct = Math.round(r.avgFatigue * 100);
          return (
            <div key={r.id} className="flex items-center gap-2 text-[10px]">
              <span className="flex-1 truncate">
                {r.name}
                {isRushThrough && (
                  <span className="ml-1 text-[8px] text-[var(--status-warning)]">⟿</span>
                )}
              </span>
              <span className="w-8 text-right font-data">{r.occupancy}</span>
              <span
                className={`w-10 text-right font-data ${
                  r.avgDepth < 0.5 ? 'text-[var(--status-danger)]' : ''
                }`}
              >
                {r.avgDepth.toFixed(1)}/{r.mediaCount}
              </span>
              <span
                className={`w-12 text-right font-data ${
                  fatiguePct > 60
                    ? 'text-[var(--status-danger)]'
                    : fatiguePct > 40
                      ? 'text-[var(--status-warning)]'
                      : 'text-muted-foreground'
                }`}
              >
                {fatiguePct}%
              </span>
            </div>
          );
        })}
      </div>
      {rows.some((r) => r.mediaCount > 0 && r.avgDepth < r.mediaCount * 0.25) && (
        <p className="text-[9px] text-muted-foreground mt-2 pt-2 border-t border-border">
          <span className="text-[var(--status-warning)]">⟿</span> {t('flowVsExperience.rushThrough')}
        </p>
      )}
    </div>
  );
}
