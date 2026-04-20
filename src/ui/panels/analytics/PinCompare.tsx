import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import type { PinId, PinnedTimePoint } from '@/domain';

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function sumActive(pin: PinnedTimePoint): number {
  return pin.zoneAnalysis.reduce((s, z) => s + z.occupancy, 0);
}

function avgComfort(pin: PinnedTimePoint): number {
  const occupied = pin.zoneAnalysis.filter((z) => z.occupancy > 0);
  if (occupied.length === 0) return 0;
  const sum = occupied.reduce((s, z) => s + Math.min(2, z.comfortIndex), 0);
  return sum / occupied.length;
}

function peakZone(pin: PinnedTimePoint): { name: string; ratio: number } | null {
  if (pin.zoneAnalysis.length === 0) return null;
  const peak = pin.zoneAnalysis.reduce(
    (max, z) => (z.utilizationRatio > max.utilizationRatio ? z : max),
    pin.zoneAnalysis[0],
  );
  return { name: peak.zoneId as string, ratio: peak.utilizationRatio };
}

export function PinCompare() {
  const t = useT();
  const pins = useStore((s) => s.pins);
  const comparePinIds = useStore((s) => s.comparePinIds);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const zones = useStore((s) => s.zones);

  const selected = useMemo(
    () =>
      comparePinIds
        .map((id) => pins.find((p) => p.id === id))
        .filter((p): p is PinnedTimePoint => !!p)
        .sort((a, b) => a.simulationTimeMs - b.simulationTimeMs),
    [comparePinIds, pins],
  );

  if (selected.length < 2) return null;

  const zoneNameById = (id: string) => zones.find((z) => (z.id as string) === id)?.name ?? '—';

  return (
    <div className="bento-box p-4">
      <h2 className="panel-section mb-2">
        {t('pinpoint.compare.title')} ({selected.length})
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] min-w-[320px]">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left pb-1 pr-2 font-normal">Pin</th>
              {selected.map((p) => (
                <th key={p.id as string} className="text-right pb-1 pl-2 font-medium">
                  <div className="flex items-center justify-end gap-1">
                    <span className="truncate max-w-[80px]">{p.label}</span>
                    <button
                      onClick={() => toggleCompare(p.id as PinId)}
                      className="p-0.5 text-muted-foreground hover:text-[var(--status-danger)]"
                      title={t('pinpoint.action.compare')}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <div className="font-data text-[9px] text-muted-foreground">
                    {fmtClock(p.simulationTimeMs)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row
              label={t('pinpoint.detail.kpi.active')}
              values={selected.map((p) => String(sumActive(p)))}
            />
            <Row
              label={t('pinpoint.compare.metric.throughput')}
              values={selected.map((p) => p.kpiSnapshot.flowEfficiency.throughputPerMinute.toFixed(1))}
            />
            <Row
              label={t('pinpoint.compare.metric.avgFatigue')}
              values={selected.map(
                (p) => `${Math.round(p.kpiSnapshot.fatigueDistribution.mean * 100)}%`,
              )}
            />
            <Row
              label={t('pinpoint.compare.metric.avgComfort')}
              values={selected.map((p) => avgComfort(p).toFixed(2))}
            />
            <Row
              label={t('pinpoint.compare.metric.peakZone')}
              values={selected.map((p) => {
                const pk = peakZone(p);
                if (!pk) return '—';
                return `${zoneNameById(pk.name)} · ${Math.round(pk.ratio * 100)}%`;
              })}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, values }: { label: string; values: string[] }) {
  return (
    <tr className="border-t border-border/40">
      <td className="py-1 pr-2 text-muted-foreground">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-1 pl-2 text-right font-data truncate max-w-[110px]">
          {v}
        </td>
      ))}
    </tr>
  );
}
