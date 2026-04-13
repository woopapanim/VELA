import type { Visitor, FlowEfficiency } from '@/domain';

export function calculateFlowEfficiency(
  visitors: readonly Visitor[],
  simTimeMs: number,
  totalExited?: number,
): FlowEfficiency {
  // Use totalExited counter (from engine) instead of counting inactive visitors
  // because store only receives active visitors
  const totalProcessed = totalExited ?? visitors.filter((v) => !v.isActive).length;

  // Average time: estimate from active visitors' age
  let totalTimeSum = 0;
  let timeCount = 0;
  for (const v of visitors) {
    if (v.isActive && v.enteredAt > 0) {
      totalTimeSum += simTimeMs - v.enteredAt;
      timeCount++;
    }
  }
  const avgTime = timeCount > 0 ? totalTimeSum / timeCount : 0;

  const minutesElapsed = simTimeMs / 60000;
  const throughput = minutesElapsed > 0 ? totalProcessed / minutesElapsed : 0;

  // Completion rate: use visitedZoneIds count as proxy
  // Visitors with more zones visited = more "complete" experience
  const wellVisited = visitors.filter((v) => v.visitedZoneIds.length >= 3).length;
  const totalActive = visitors.filter((v) => v.isActive).length;
  const completionRate = (totalActive + totalProcessed) > 0
    ? (wellVisited + totalProcessed) / (totalActive + totalProcessed)
    : 0;

  return {
    totalVisitorsProcessed: totalProcessed,
    averageTotalTimeMs: avgTime,
    throughputPerMinute: throughput,
    completionRate,
  };
}
