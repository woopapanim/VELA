import { useState, useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useStore } from '@/stores';
import { INTERNATIONAL_DENSITY_STANDARD } from '@/domain';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { useT } from '@/i18n';

type SortKey = 'name' | 'occupancy' | 'utilization' | 'density';

export function HeatRanking() {
  const zones = useStore((s) => s.zones);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const [sortBy, setSortBy] = useState<SortKey>('utilization');
  const [sortAsc, setSortAsc] = useState(false);
  const t = useT();

  const rows = useMemo(() => {
    if (!latestSnapshot) return [];

    return zones.map((zone) => {
      const util = latestSnapshot.zoneUtilizations.find((u) => u.zoneId === zone.id);
      const occ = util?.currentOccupancy ?? 0;
      const ratio = util?.ratio ?? 0;
      const density = occ > 0 ? zone.area / occ : zone.area;
      return {
        id: zone.id as string,
        name: zone.name,
        color: zone.color,
        type: zone.type,
        occupancy: occ,
        capacity: zone.capacity,
        utilization: ratio,
        density,
        meetsDensity: density >= INTERNATIONAL_DENSITY_STANDARD,
      };
    });
  }, [zones, latestSnapshot]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'occupancy') cmp = a.occupancy - b.occupancy;
      else if (sortBy === 'utilization') cmp = a.utilization - b.utilization;
      else if (sortBy === 'density') cmp = a.density - b.density;
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortBy, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };

  if (rows.length === 0) return null;

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        Zone Ranking
        <InfoTooltip text={t('tooltip.zoneRanking')} />
      </h2>
      <table className="w-full text-[9px]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left pb-1 cursor-pointer" onClick={() => toggleSort('name')}>
              Zone <ArrowUpDown className="w-2.5 h-2.5 inline" />
            </th>
            <th className="text-right pb-1 cursor-pointer" onClick={() => toggleSort('occupancy')}>
              Occ <ArrowUpDown className="w-2.5 h-2.5 inline" />
            </th>
            <th className="text-right pb-1 cursor-pointer" onClick={() => toggleSort('utilization')}>
              Util% <ArrowUpDown className="w-2.5 h-2.5 inline" />
            </th>
            <th className="text-right pb-1 cursor-pointer" onClick={() => toggleSort('density')}>
              m²/p <ArrowUpDown className="w-2.5 h-2.5 inline" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className="hover:bg-secondary/30 cursor-pointer"
              onClick={() => useStore.getState().selectZone(row.id)}>
              <td className="py-0.5">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: row.color }} />
                  <span className="truncate max-w-16">{row.name}</span>
                </div>
              </td>
              <td className="text-right font-data">{row.occupancy}/{row.capacity}</td>
              <td className={`text-right font-data ${row.utilization > 0.9 ? 'text-[var(--status-danger)]' : row.utilization > 0.6 ? 'text-[var(--status-warning)]' : ''}`}>
                {Math.round(row.utilization * 100)}%
              </td>
              <td className={`text-right font-data ${!row.meetsDensity ? 'text-[var(--status-danger)]' : ''}`}>
                {row.density < 100 ? row.density.toFixed(1) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
