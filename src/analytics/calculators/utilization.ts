import type { Visitor, ZoneConfig, ZoneUtilization } from '@/domain';
import { getZonePolygon } from '@/simulation/engine';
import { isPointInPolygon } from '@/simulation/collision';

// Persistent peak tracking across the entire simulation run.
// Call resetPeakOccupancy() when starting a new simulation.
const peakMap = new Map<string, number>();

export function resetPeakOccupancy() {
  peakMap.clear();
}

export function calculateZoneUtilization(
  zones: readonly ZoneConfig[],
  visitors: readonly Visitor[],
  simTimeMs: number,
): ZoneUtilization[] {
  const occupancyMap = new Map<string, number>();
  const watchingMap = new Map<string, number>();
  const waitingMap = new Map<string, number>();

  // Position-based occupancy using zone polygon (not AABB bounds).
  // bounds-based counting over-counts non-rect zones (circle, L, polygon) and
  // double-counts agents in overlapping bounding boxes — observed 154/18 on a
  // rest zone because transit agents physically crossed its AABB halo.
  const polyByZone = new Map<string, ReturnType<typeof getZonePolygon>>();
  for (const zone of zones) polyByZone.set(zone.id as string, getZonePolygon(zone));

  for (const zone of zones) {
    const zid = zone.id as string;
    const poly = polyByZone.get(zid)!;
    const b = zone.bounds;
    for (const v of visitors) {
      if (!v.isActive) continue;
      const p = v.position;
      // Fast AABB reject first, then precise polygon test.
      if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) continue;
      if (!isPointInPolygon(p, poly)) continue;
      occupancyMap.set(zid, (occupancyMap.get(zid) ?? 0) + 1);
      if (v.currentAction === 'WATCHING') watchingMap.set(zid, (watchingMap.get(zid) ?? 0) + 1);
      if (v.currentAction === 'WAITING') waitingMap.set(zid, (waitingMap.get(zid) ?? 0) + 1);
    }
  }

  return zones.map((zone) => {
    const zid = zone.id as string;
    const occ = occupancyMap.get(zid) ?? 0;
    const prevPeak = peakMap.get(zid) ?? 0;
    const peak = Math.max(prevPeak, occ);
    peakMap.set(zid, peak);

    return {
      zoneId: zone.id,
      currentOccupancy: occ,
      capacity: zone.capacity,
      ratio: zone.capacity > 0 ? occ / zone.capacity : 0,
      peakOccupancy: peak,
      watchingCount: watchingMap.get(zid) ?? 0,
      waitingCount: waitingMap.get(zid) ?? 0,
      timestamp: simTimeMs,
    };
  });
}
