import type { Visitor, FlowEfficiency } from '@/domain';
import { COMPLETION_ZONE_RATIO } from '@/domain/constants';

export function calculateFlowEfficiency(
  visitors: readonly Visitor[],
  simTimeMs: number,
  totalExited?: number,
  zoneCount?: number,
): FlowEfficiency {
  const exitedFromList = visitors.filter((v) => !v.isActive);
  const totalProcessed = totalExited ?? exitedFromList.length;

  // Average total time: prefer exited visitors' actual journey length (exitedAt - enteredAt).
  // Fall back to active visitors' running age when none have exited yet.
  let timeSum = 0;
  let timeCount = 0;
  for (const v of exitedFromList) {
    if (v.exitedAt != null && v.enteredAt > 0) {
      timeSum += v.exitedAt - v.enteredAt;
      timeCount++;
    }
  }
  if (timeCount === 0) {
    for (const v of visitors) {
      if (v.isActive && v.enteredAt > 0) {
        timeSum += simTimeMs - v.enteredAt;
        timeCount++;
      }
    }
  }
  const avgTime = timeCount > 0 ? timeSum / timeCount : 0;

  const minutesElapsed = simTimeMs / 60000;
  const throughput = minutesElapsed > 0 ? totalProcessed / minutesElapsed : 0;

  // Completion rate = visitors who reached >= COMPLETION_ZONE_RATIO of zones / all visitors ever.
  // Ratio-based threshold scales with scenario size; fallback to legacy 3-zone bar when zoneCount
  // is unknown (pre-existing callers). Matches toReportData bucket logic.
  const completionThreshold = zoneCount && zoneCount > 0
    ? Math.max(1, Math.ceil(zoneCount * COMPLETION_ZONE_RATIO))
    : 3;
  const wellVisited = visitors.filter((v) => v.visitedZoneIds.length >= completionThreshold).length;
  const totalEver = visitors.length;
  const completionRate = totalEver > 0 ? wellVisited / totalEver : 0;

  return {
    totalVisitorsProcessed: totalProcessed,
    averageTotalTimeMs: avgTime,
    throughputPerMinute: throughput,
    completionRate,
  };
}
