import type { KpiSnapshot, KpiTimeSeriesEntry, ZoneConfig } from '@/domain';

// zone 별 핵심 위험 metric 비교. "어느 zone 이 가장 안 좋은가" 를 한 화면에.
// time/persona slice 와 함께 "어디서 무너지는가" 의 공간 차원을 채운다.

export interface ZoneSliceEntry {
  readonly zoneId: string;
  readonly zoneName: string;
  readonly congestionRatio: number;     // 0–1, cumulativeCongestedMs / totalMs (가장 큰 zone 단일 값)
  readonly peakRatio: number;           // 0–1, peakOccupancy / capacity
  readonly bottleneckScore: number;     // 0–1, kpiHistory 중 max
  readonly sampleCount: number;         // bottleneck 관측 횟수 — 0 이면 신뢰도 낮음
}

export interface ZoneSlicePattern {
  readonly entries: readonly ZoneSliceEntry[];   // worst-first
  readonly totalZones: number;                   // 원본 zone 수 — entries 잘렸을 때 표시용
}

const MAX_ENTRIES = 6;

export function computeZoneSlices(
  zones: readonly ZoneConfig[],
  latestSnapshot: KpiSnapshot | null,
  kpiHistory: readonly KpiTimeSeriesEntry[],
): ZoneSlicePattern | null {
  if (!latestSnapshot || zones.length === 0) return null;
  const totalMs = latestSnapshot.simulationTimeMs;
  if (totalMs <= 0) return null;

  // bottleneck peak per zone — 시간 시리즈에서 최댓값.
  const peakBottleneckByZone = new Map<string, { score: number; count: number }>();
  const sources = kpiHistory.length > 0 ? kpiHistory.map((h) => h.snapshot) : [latestSnapshot];
  for (const snap of sources) {
    for (const b of snap.bottlenecks) {
      const cur = peakBottleneckByZone.get(b.zoneId as string) ?? { score: 0, count: 0 };
      peakBottleneckByZone.set(b.zoneId as string, {
        score: Math.max(cur.score, b.score),
        count: cur.count + 1,
      });
    }
  }

  const entries: ZoneSliceEntry[] = [];
  for (const u of latestSnapshot.zoneUtilizations) {
    const zoneId = u.zoneId as string;
    const z = zones.find((zz) => zz.id === zoneId);
    if (!z) continue;
    const peak = peakBottleneckByZone.get(zoneId);
    entries.push({
      zoneId,
      zoneName: z.name ?? zoneId,
      congestionRatio: Math.max(0, Math.min(1, u.cumulativeCongestedMs / totalMs)),
      peakRatio: u.capacity > 0 ? Math.max(0, Math.min(1, u.peakOccupancy / u.capacity)) : 0,
      bottleneckScore: peak?.score ?? 0,
      sampleCount: peak?.count ?? 0,
    });
  }

  if (entries.length === 0) return null;

  // worst-first: 세 metric 중 max 로 정렬.
  entries.sort((a, b) => {
    const aMax = Math.max(a.congestionRatio, a.peakRatio, a.bottleneckScore);
    const bMax = Math.max(b.congestionRatio, b.peakRatio, b.bottleneckScore);
    return bMax - aMax;
  });

  return {
    entries: entries.slice(0, MAX_ENTRIES),
    totalZones: entries.length,
  };
}
