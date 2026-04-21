import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { diffPins } from '@/analytics/pinpoint';
import type { PinDeltaEntry } from '@/analytics/pinpoint';
import type { PinnedTimePoint, ZoneConfig, MediaPlacement } from '@/domain';

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function DeltaBadge({ entry, digits = 1, suffix = '' }: { entry: PinDeltaEntry<unknown> | null; digits?: number; suffix?: string }) {
  if (!entry) return <span className="text-[9px] text-muted-foreground">—</span>;
  const { delta } = entry;
  if (Math.abs(delta) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground font-data">
        <Minus className="w-2 h-2" />
        0
      </span>
    );
  }
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const color = up ? 'text-[var(--status-danger)]' : 'text-[var(--status-success)]';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-data ${color}`}>
      <Icon className="w-2.5 h-2.5" />
      {delta > 0 ? '+' : ''}{delta.toFixed(digits)}{suffix}
    </span>
  );
}

export function PinDetail() {
  const t = useT();
  const pins = useStore((s) => s.pins);
  const selectedPinId = useStore((s) => s.selectedPinId);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);

  const pinIdx = useMemo(() => pins.findIndex((p) => p.id === selectedPinId), [pins, selectedPinId]);
  const pin = pinIdx >= 0 ? pins[pinIdx] : null;
  const prev = pinIdx > 0 ? pins[pinIdx - 1] : null;

  const diff = useMemo(() => (pin && prev ? diffPins(prev, pin) : null), [pin, prev]);

  if (!pin) return null;

  const activeCount = pin.zoneAnalysis.reduce((s, z) => s + z.occupancy, 0);
  const throughput = pin.kpiSnapshot.flowEfficiency.throughputPerMinute;
  const avgFatigue = pin.kpiSnapshot.fatigueDistribution.mean;

  return (
    <div className="bento-box p-4 space-y-3">
      {/* Header */}
      <div>
        <h2 className="panel-section">{pin.label}</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {t('pinpoint.detail.meta', {
            time: fmtClock(pin.simulationTimeMs),
            zones: pin.zoneAnalysis.length,
            media: pin.mediaAnalysis.length,
          })}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-1.5">
        <KpiTile
          label={t('pinpoint.detail.kpi.active')}
          value={activeCount}
          delta={diff ? <DeltaBadge entry={diff.activeCount} digits={0} /> : null}
        />
        <KpiTile
          label={t('pinpoint.detail.kpi.throughput')}
          value={throughput.toFixed(1)}
          delta={diff ? <DeltaBadge entry={diff.throughput} /> : null}
        />
        <KpiTile
          label={t('pinpoint.detail.kpi.fatigue')}
          value={`${Math.round(avgFatigue * 100)}%`}
          delta={diff ? <DeltaBadge entry={{ ...diff.avgFatigue, delta: diff.avgFatigue.delta * 100 }} suffix="%" digits={0} /> : null}
        />
      </div>

      {/* Zone table */}
      <div>
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
          <span className="w-1 h-3 rounded-sm bg-primary" />
          {t('pinpoint.detail.zones')}
        </h3>
        <div className="-mx-4 px-4 overflow-x-auto">
        <table className="min-w-full text-[10px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              <th className="text-left pb-1.5 pr-2 font-medium">{t('pinpoint.detail.th.zone')}</th>
              <th className="text-right pb-1.5 px-1.5 font-medium">{t('pinpoint.detail.th.occCap')}</th>
              <th className="text-right pb-1.5 px-1.5 font-medium">{t('pinpoint.detail.th.ratio')}</th>
              <th className="text-right pb-1.5 px-1.5 font-medium">{t('pinpoint.detail.th.comfort')}</th>
              <th className="text-right pb-1.5 px-1.5 font-medium">{t('pinpoint.detail.th.watching')}</th>
              <th className="text-right pb-1.5 pl-1.5 font-medium">{t('pinpoint.detail.th.waiting')}</th>
            </tr>
          </thead>
          <tbody>
            {pin.zoneAnalysis
              .filter((z) => z.occupancy > 0 || z.utilizationRatio > 0)
              .sort((a, b) => b.utilizationRatio - a.utilizationRatio)
              .map((z) => {
                const zone = zones.find((zc: ZoneConfig) => zc.id === z.zoneId);
                const ratio = z.utilizationRatio;
                const ratioCls =
                  ratio > 1 ? 'text-[var(--status-danger)]' :
                  ratio > 0.85 ? 'text-[var(--status-warning)]' : '';
                const comfortCls = z.comfortIndex < 1 ? 'text-[var(--status-danger)]' : '';
                const watchingVisitorCount = (z as any).watchingVisitorCount ?? 0;
                return (
                  <tr key={z.zoneId as string} className="border-t border-border/40 hover:bg-secondary/30">
                    <td className="py-1.5 pr-2 truncate">{zone?.name ?? '—'}</td>
                    <td className="py-1.5 px-1.5 text-right font-data">{z.occupancy}/{zone?.capacity ?? 0}</td>
                    <td className={`py-1.5 px-1.5 text-right font-data ${ratioCls}`}>{Math.round(ratio * 100)}%</td>
                    <td className={`py-1.5 px-1.5 text-right font-data ${comfortCls}`}>{z.comfortIndex.toFixed(2)}</td>
                    <td className="py-1.5 px-1.5 text-right font-data">{watchingVisitorCount || '—'}</td>
                    <td className="py-1.5 pl-1.5 text-right font-data">{z.waitingVisitorCount || '—'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        </div>
        {prev ? null : (
          <p className="text-[9px] text-muted-foreground mt-1 italic">{t('pinpoint.detail.noPrev')}</p>
        )}
      </div>

      {/* Media table */}
      <div>
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border">
          <span className="w-1 h-3 rounded-sm bg-primary" />
          {t('pinpoint.detail.media')}
        </h3>
        <div className="-mx-4 px-4 overflow-x-auto">
        <table className="min-w-full text-[10px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              <th className="text-left pb-1.5 pr-2 font-medium">{t('pinpoint.detail.th.media')}</th>
              <th className="text-right pb-1.5 px-1.5 font-medium">{t('pinpoint.detail.th.viewers')}</th>
              <th className="text-right pb-1.5 px-1.5 font-medium">{t('pinpoint.detail.th.queue')}</th>
              <th className="text-right pb-1.5 pl-1.5 font-medium">{t('pinpoint.detail.th.skips')}</th>
            </tr>
          </thead>
          <tbody>
            {pin.mediaAnalysis
              .filter((m) => m.currentViewers + m.queueLength + m.skipCountSoFar > 0)
              .sort((a, b) => b.currentViewers + b.queueLength - (a.currentViewers + a.queueLength))
              .slice(0, 10)
              .map((m) => {
                const mp = media.find((mm: MediaPlacement) => mm.id === m.mediaId);
                return (
                  <tr key={m.mediaId as string} className="border-t border-border/40 hover:bg-secondary/30">
                    <td className="py-1.5 pr-2 truncate">{mp?.name ?? '—'}</td>
                    <td className="py-1.5 px-1.5 text-right font-data">{m.currentViewers}</td>
                    <td className={`py-1.5 px-1.5 text-right font-data ${m.queueLength > 0 ? 'text-[var(--status-warning)]' : ''}`}>{m.queueLength || '—'}</td>
                    <td className="py-1.5 pl-1.5 text-right font-data">{m.skipCountSoFar || '—'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, delta }: { label: string; value: string | number; delta: React.ReactNode }) {
  return (
    <div className="bento-box-elevated p-2">
      <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
      <div className="flex items-baseline justify-between mt-0.5">
        <span className="text-sm font-semibold font-data text-primary">{value}</span>
        {delta}
      </div>
    </div>
  );
}
