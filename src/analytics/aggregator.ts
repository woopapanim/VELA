import type { Visitor, ZoneConfig, MediaPlacement, KpiSnapshot } from '@/domain';
import { calculateZoneUtilization } from './calculators/utilization';
import { calculateBottleneckIndex } from './calculators/bottleneck';
import { calculateFlowEfficiency } from './calculators/flow';
import { calculateFatigueDistribution } from './calculators/fatigue';
import { calculateSkipRate } from './calculators/skipRate';
import { calculateVisitDurations } from './calculators/visitDuration';

export function assembleKpiSnapshot(
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  visitors: readonly Visitor[],
  simTimeMs: number,
  totalExited?: number,
): KpiSnapshot {
  return {
    simulationTimeMs: simTimeMs,
    floorId: null, // aggregated across all floors
    zoneUtilizations: calculateZoneUtilization(zones, visitors, simTimeMs),
    bottlenecks: calculateBottleneckIndex(zones, visitors),
    visitDurations: calculateVisitDurations(zones),
    flowEfficiency: calculateFlowEfficiency(visitors, simTimeMs, totalExited),
    fatigueDistribution: calculateFatigueDistribution(visitors),
    skipRate: calculateSkipRate(media, zones, visitors.length),
    groupBottlenecks: [], // populated by event tracking
  };
}
