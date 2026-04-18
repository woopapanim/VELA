import { useStore } from '@/stores';
import { INTERNATIONAL_DENSITY_STANDARD } from '@/domain';

export function ZoneDetail() {
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const zones = useStore((s) => s.zones);
  const visitors = useStore((s) => s.visitors);
  const media = useStore((s) => s.media);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const selectZone = useStore((s) => s.selectZone);

  if (!selectedZoneId) return null;

  const zone = zones.find((z) => (z.id as string) === selectedZoneId);
  if (!zone) return null;

  const zoneVisitors = visitors.filter(
    (v) => v.isActive && (v.currentZoneId as string | null) === selectedZoneId,
  );
  const zoneMedia = media.filter((m) => (m.zoneId as string) === selectedZoneId);

  const util = latestSnapshot?.zoneUtilizations.find(
    (u) => (u.zoneId as string) === selectedZoneId,
  );
  const bn = latestSnapshot?.bottlenecks.find(
    (b) => (b.zoneId as string) === selectedZoneId,
  );

  const areaPerPerson =
    zoneVisitors.length > 0 ? zone.area / zoneVisitors.length : zone.area;
  const meetsDensity = areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD;

  const actionCounts = {
    MOVING: zoneVisitors.filter((v) => v.currentAction === 'MOVING').length,
    WATCHING: zoneVisitors.filter((v) => v.currentAction === 'WATCHING').length,
    WAITING: zoneVisitors.filter((v) => v.currentAction === 'WAITING').length,
    RESTING: zoneVisitors.filter((v) => v.currentAction === 'RESTING').length,
    EXITING: zoneVisitors.filter((v) => v.currentAction === 'EXITING').length,
  };

  return (
    <div className="bento-box p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: zone.color }} />
          <h2 className="text-xs font-semibold">{zone.name}</h2>
        </div>
        <button
          onClick={() => selectZone(null)}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Occupancy" value={`${zoneVisitors.length}/${zone.capacity}`} />
        <Stat label="Area" value={`${zone.area}m²`} />
        <Stat label="Flow" value={zone.flowType} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat
          label="m²/person"
          value={areaPerPerson.toFixed(1)}
          color={meetsDensity ? undefined : 'text-[var(--status-danger)]'}
        />
        <Stat
          label="Utilization"
          value={`${Math.round((util?.ratio ?? 0) * 100)}%`}
          color={(util?.ratio ?? 0) > 0.8 ? 'text-[var(--status-danger)]' : undefined}
        />
        <Stat label="Bottleneck" value={`${Math.round((bn?.score ?? 0) * 100)}`} />
        <Stat label="Gates" value={`${zone.gates.length}`} />
      </div>

      {zoneVisitors.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Agents in Zone</p>
          <div className="flex gap-2 text-[10px] font-data">
            {Object.entries(actionCounts).map(([action, count]) =>
              count > 0 ? (
                <span key={action} className="px-1.5 py-0.5 rounded bg-secondary">
                  {action}: {count}
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}

      {zoneMedia.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Media ({zoneMedia.length})</p>
          <div className="space-y-1">
            {zoneMedia.map((m) => (
              <div key={m.id as string} className="flex items-center justify-between text-[10px]">
                <span className="font-data">{m.type.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">cap {m.capacity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-sm font-semibold font-data ${color ?? 'text-foreground'}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}
