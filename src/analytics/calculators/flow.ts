import type { Visitor, FlowEfficiency } from '@/domain';

export function calculateFlowEfficiency(
  visitors: readonly Visitor[],
  simTimeMs: number,
  totalExited?: number,
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

  // Completion rate = visitors who reached >=3 zones / all visitors ever (active + exited).
  // Pre-fix the store only held active visitors so the formula added totalProcessed as a proxy
  // for completed; that double-counts now that exited visitors are present in the list.
  const wellVisited = visitors.filter((v) => v.visitedZoneIds.length >= 3).length;
  const totalEver = visitors.length;
  const completionRate = totalEver > 0 ? wellVisited / totalEver : 0;

  return {
    totalVisitorsProcessed: totalProcessed,
    averageTotalTimeMs: avgTime,
    throughputPerMinute: throughput,
    completionRate,
  };
}
