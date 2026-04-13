import type { ZoneConfig, AverageVisitDuration } from '@/domain';

// Accumulate dwell time data per zone
const zoneDwellData = new Map<string, number[]>();

export function resetDwellTracking() {
  zoneDwellData.clear();
}

export function recordZoneExit(zoneId: string, dwellTimeMs: number) {
  const arr = zoneDwellData.get(zoneId) ?? [];
  arr.push(dwellTimeMs);
  zoneDwellData.set(zoneId, arr);
}

export function calculateVisitDurations(
  zones: readonly ZoneConfig[],
): AverageVisitDuration[] {
  return zones.map((zone) => {
    const data = zoneDwellData.get(zone.id as string) ?? [];
    if (data.length === 0) {
      return {
        zoneId: zone.id,
        meanDurationMs: 0,
        medianDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        sampleCount: 0,
      };
    }

    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sorted.reduce((s, d) => s + d, 0) / n;

    return {
      zoneId: zone.id,
      meanDurationMs: mean,
      medianDurationMs: sorted[Math.floor(n / 2)],
      minDurationMs: sorted[0],
      maxDurationMs: sorted[n - 1],
      sampleCount: n,
    };
  });
}
