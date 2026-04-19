import type { Visitor, ZoneConfig, ZoneUtilization } from '@/domain';

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

  // Position-based occupancy — matches ZoneRenderer canvas display.
  // currentZoneId only updates on node arrival, so it misses in-transit agents
  // physically inside a zone. We count by bounds instead for UI consistency.
  for (const zone of zones) {
    const b = zone.bounds;
    const zid = zone.id as string;
    for (const v of visitors) {
      if (!v.isActive) continue;
      if (
        v.position.x >= b.x && v.position.x <= b.x + b.w &&
        v.position.y >= b.y && v.position.y <= b.y + b.h
      ) {
        occupancyMap.set(zid, (occupancyMap.get(zid) ?? 0) + 1);
        if (v.currentAction === 'WATCHING') watchingMap.set(zid, (watchingMap.get(zid) ?? 0) + 1);
        if (v.currentAction === 'WAITING') waitingMap.set(zid, (waitingMap.get(zid) ?? 0) + 1);
      }
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
