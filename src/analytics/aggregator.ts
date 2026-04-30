import type { Visitor, ZoneConfig, MediaPlacement, KpiSnapshot } from '@/domain';
import { calculateZoneUtilization } from './calculators/utilization';
import { calculateBottleneckIndex } from './calculators/bottleneck';
import { calculateFlowEfficiency } from './calculators/flow';
import { calculateFatigueDistribution } from './calculators/fatigue';
import { calculateSkipRate } from './calculators/skipRate';
import { calculateVisitDurations } from './calculators/visitDuration';
import { accumulateCongestionTime } from './calculators/congestion';

export function assembleKpiSnapshot(
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  visitors: readonly Visitor[],
  simTimeMs: number,
  totalExited?: number,
): KpiSnapshot {
  const utilizations = calculateZoneUtilization(zones, visitors, simTimeMs);
  const bottlenecks = calculateBottleneckIndex(zones, visitors);
  const congestedMap = accumulateCongestionTime(bottlenecks, simTimeMs);

  const zoneUtilizations = utilizations.map((u) => ({
    ...u,
    cumulativeCongestedMs: congestedMap.get(u.zoneId as string) ?? 0,
  }));

  return {
    simulationTimeMs: simTimeMs,
    floorId: null, // aggregated across all floors
    zoneUtilizations,
    bottlenecks,
    visitDurations: calculateVisitDurations(zones),
    flowEfficiency: calculateFlowEfficiency(visitors, simTimeMs, totalExited, zones.length),
    fatigueDistribution: calculateFatigueDistribution(visitors),
    skipRate: calculateSkipRate(media, zones, visitors.length),
    groupBottlenecks: [], // populated by event tracking
  };
}
