import type {
  KpiSnapshot,
  DeltaMetric,
  DeltaKpiResult,
  ZoneDeltaMetric,
  ScenarioComparison,
  ScenarioMeta,
  ComparisonId,
  ZoneConfig,
} from '@/domain';

function delta(a: number, b: number, lowerIsBetter: boolean = false): DeltaMetric {
  const absoluteDelta = b - a;
  const percentDelta = a !== 0 ? (absoluteDelta / Math.abs(a)) * 100 : b !== 0 ? 100 : 0;
  const improvement = lowerIsBetter ? b < a : b > a;
  return { valueA: a, valueB: b, absoluteDelta, percentDelta, improvement };
}

export function compareSnapshots(
  snapshotA: KpiSnapshot,
  snapshotB: KpiSnapshot,
  zonesA: readonly ZoneConfig[],
  zonesB: readonly ZoneConfig[],
): DeltaKpiResult {
  const a = snapshotA;
  const b = snapshotB;

  // Global metrics
  const peakCongestionA = Math.max(...a.zoneUtilizations.map((u) => u.ratio), 0);
  const peakCongestionB = Math.max(...b.zoneUtilizations.map((u) => u.ratio), 0);

  const avgDwellA = a.flowEfficiency.averageTotalTimeMs;
  const avgDwellB = b.flowEfficiency.averageTotalTimeMs;

  const result: DeltaKpiResult = {
    peakCongestion: delta(peakCongestionA, peakCongestionB, true),
    avgDwellTime: delta(avgDwellA, avgDwellB),
    globalSkipRate: delta(a.skipRate.globalSkipRate, b.skipRate.globalSkipRate, true),
    flowEfficiency: delta(a.flowEfficiency.throughputPerMinute, b.flowEfficiency.throughputPerMinute),
    bottleneckCount: delta(
      a.bottlenecks.filter((bn) => bn.score > 0.5).length,
      b.bottlenecks.filter((bn) => bn.score > 0.5).length,
      true,
    ),
    avgFatigue: delta(a.fatigueDistribution.mean, b.fatigueDistribution.mean, true),

    perZoneDelta: buildZoneDelta(a, b, zonesA, zonesB),
    perMediaDelta: [], // TODO: implement per-media comparison

    recommendation: 'neutral',
    summary: '',
  };

  // Determine recommendation
  let scoreA = 0;
  let scoreB = 0;
  if (result.peakCongestion.improvement) scoreB++; else scoreA++;
  if (result.globalSkipRate.improvement) scoreB++; else scoreA++;
  if (result.flowEfficiency.improvement) scoreB++; else scoreA++;
  if (result.bottleneckCount.improvement) scoreB++; else scoreA++;
  if (result.avgFatigue.improvement) scoreB++; else scoreA++;

  const rec = scoreB > scoreA ? 'B' : scoreA > scoreB ? 'A' : 'neutral';
  const summary = rec === 'neutral'
    ? '두 시나리오의 성능이 유사합니다.'
    : rec === 'B'
      ? `시나리오 B가 ${scoreB}개 지표에서 우수합니다. (혼잡도, 스킵률, 처리량 등)`
      : `시나리오 A가 ${scoreA}개 지표에서 우수합니다.`;

  return { ...result, recommendation: rec, summary };
}

function buildZoneDelta(
  a: KpiSnapshot,
  b: KpiSnapshot,
  zonesA: readonly ZoneConfig[],
  _zonesB: readonly ZoneConfig[],
): ZoneDeltaMetric[] {
  const aMap = new Map(a.zoneUtilizations.map((u) => [u.zoneId as string, u]));
  const bMap = new Map(b.zoneUtilizations.map((u) => [u.zoneId as string, u]));
  const aBnMap = new Map(a.bottlenecks.map((bn) => [bn.zoneId as string, bn]));
  const bBnMap = new Map(b.bottlenecks.map((bn) => [bn.zoneId as string, bn]));

  const allZoneIds = new Set([
    ...a.zoneUtilizations.map((u) => u.zoneId as string),
    ...b.zoneUtilizations.map((u) => u.zoneId as string),
  ]);

  return Array.from(allZoneIds).map((zid) => {
    const uA = aMap.get(zid);
    const uB = bMap.get(zid);
    const bnA = aBnMap.get(zid);
    const bnB = bBnMap.get(zid);
    const zone = zonesA.find((z) => (z.id as string) === zid);

    return {
      zoneId: zid as any,
      zoneName: zone?.name ?? zid,
      utilization: delta(uA?.ratio ?? 0, uB?.ratio ?? 0, true),
      avgDwellTime: delta(0, 0), // would need visit duration data
      bottleneckScore: delta(bnA?.score ?? 0, bnB?.score ?? 0, true),
    };
  });
}

export function createComparison(
  metaA: ScenarioMeta,
  metaB: ScenarioMeta,
  snapshotA: KpiSnapshot,
  snapshotB: KpiSnapshot,
  zonesA: readonly ZoneConfig[],
  zonesB: readonly ZoneConfig[],
): ScenarioComparison {
  return {
    id: `cmp_${Date.now()}` as ComparisonId,
    scenarioA: metaA,
    scenarioB: metaB,
    deltaKpis: compareSnapshots(snapshotA, snapshotB, zonesA, zonesB),
    createdAt: Date.now(),
  };
}
