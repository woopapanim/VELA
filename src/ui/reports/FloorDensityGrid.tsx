import type { FloorConfig, ZoneConfig, KpiSnapshot } from '@/domain';

interface Props {
  floors: readonly FloorConfig[];
  zones: readonly ZoneConfig[];
  snapshot: KpiSnapshot;
}

/**
 * Per-floor zone density panel. Renders each floor as an SVG with its zones
 * filled by occupancy ratio at the given snapshot moment. No live canvas
 * capture — purely data-driven from KpiSnapshot + zone bounds.
 */
export function FloorDensityGrid({ floors, zones, snapshot }: Props) {
  const ratioByZone = new Map<string, number>();
  const occByZone = new Map<string, number>();
  const capByZone = new Map<string, number>();
  for (const u of snapshot.zoneUtilizations) {
    ratioByZone.set(u.zoneId as string, u.ratio);
    occByZone.set(u.zoneId as string, u.currentOccupancy);
    capByZone.set(u.zoneId as string, u.capacity);
  }

  const visibleFloors = floors
    .filter((f) => !f.hidden)
    .slice()
    .sort((a, b) => b.level - a.level); // top floor first

  if (visibleFloors.length === 0) return null;

  const zonesById = new Map(zones.map((z) => [z.id as string, z]));

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(visibleFloors.length, 3)}, 1fr)` }}>
      {visibleFloors.map((floor) => {
        // Source of truth = floor.zoneIds. Some scenarios don't populate zone.floorId.
        const fromIds = floor.zoneIds
          .map((zid) => zonesById.get(zid as string))
          .filter((z): z is ZoneConfig => !!z);
        const fromField = zones.filter((z) => z.floorId === floor.id);
        // Prefer the larger of the two (covers both data shapes), de-duped by id.
        const candidate = fromIds.length >= fromField.length ? fromIds : fromField;
        const seen = new Set<string>();
        const floorZones = candidate.filter((z) => {
          const k = z.id as string;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return (
          <FloorPanel
            key={floor.id as string}
            floor={floor}
            zones={floorZones}
            ratioByZone={ratioByZone}
            occByZone={occByZone}
            capByZone={capByZone}
          />
        );
      })}
    </div>
  );
}

function FloorPanel({
  floor, zones, ratioByZone, occByZone, capByZone,
}: {
  floor: FloorConfig;
  zones: readonly ZoneConfig[];
  ratioByZone: Map<string, number>;
  occByZone: Map<string, number>;
  capByZone: Map<string, number>;
}) {
  if (zones.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1">{floor.name}</p>
        <p className="text-xs text-slate-400">존 없음</p>
      </div>
    );
  }

  // Bounds: prefer floor.bounds, fallback to zone-bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  if (floor.bounds) {
    minX = floor.bounds.x;
    minY = floor.bounds.y;
    maxX = floor.bounds.x + floor.bounds.w;
    maxY = floor.bounds.y + floor.bounds.h;
  } else {
    for (const z of zones) {
      minX = Math.min(minX, z.bounds.x);
      minY = Math.min(minY, z.bounds.y);
      maxX = Math.max(maxX, z.bounds.x + z.bounds.w);
      maxY = Math.max(maxY, z.bounds.y + z.bounds.h);
    }
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);

  const totalActive = zones.reduce((s, z) => s + (occByZone.get(z.id as string) ?? 0), 0);
  const totalCap = zones.reduce((s, z) => s + (capByZone.get(z.id as string) ?? z.capacity), 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest text-slate-700 font-semibold">{floor.name}</p>
        <p className="text-[10px] text-slate-500 tabular-nums">{totalActive}/{totalCap}명</p>
      </div>
      <svg viewBox={`${minX} ${minY} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="w-full h-auto block bg-slate-50" style={{ maxHeight: 220 }}>
        {zones.map((z) => {
          const ratio = ratioByZone.get(z.id as string) ?? 0;
          const fill = densityColor(ratio);
          const stroke = densityStroke(ratio);
          return (
            <g key={z.id as string}>
              <rect
                x={z.bounds.x} y={z.bounds.y} width={z.bounds.w} height={z.bounds.h}
                fill={fill} stroke={stroke} strokeWidth={Math.max(1, w / 200)}
              />
              <text
                x={z.bounds.x + z.bounds.w / 2}
                y={z.bounds.y + z.bounds.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontSize: Math.min(z.bounds.w, z.bounds.h) * 0.16, fill: '#0f172a', fontWeight: 600 }}
              >
                {Math.round(ratio * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function densityColor(ratio: number): string {
  if (ratio <= 0) return '#f1f5f9';                // slate-100
  if (ratio < 0.3) return 'rgba(96,165,250,0.30)'; // blue-400
  if (ratio < 0.6) return 'rgba(250,204,21,0.45)'; // yellow-400
  if (ratio < 0.85) return 'rgba(251,146,60,0.55)';// orange-400
  if (ratio < 1.0) return 'rgba(248,113,113,0.65)';// red-400
  return 'rgba(220,38,38,0.80)';                   // red-600
}
function densityStroke(ratio: number): string {
  if (ratio < 0.6) return '#cbd5e1';
  if (ratio < 0.85) return '#fb923c';
  return '#dc2626';
}
