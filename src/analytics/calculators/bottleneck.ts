import type { Visitor, ZoneConfig, BottleneckIndex } from '@/domain';
import { VISITOR_ACTION } from '@/domain';

export function calculateBottleneckIndex(
  zones: readonly ZoneConfig[],
  visitors: readonly Visitor[],
): BottleneckIndex[] {
  return zones.map((zone) => {
    const zoneVisitors = visitors.filter(
      (v) => v.isActive && v.currentZoneId === zone.id,
    );
    const waitingCount = zoneVisitors.filter(
      (v) => v.currentAction === VISITOR_ACTION.WAITING,
    ).length;
    const watchingCount = zoneVisitors.filter(
      (v) => v.currentAction === VISITOR_ACTION.WATCHING,
    ).length;
    const totalInZone = zoneVisitors.length;

    // Bottleneck score: overcrowding + waiting ratio + capacity saturation (watching)
    const overcrowdRatio = zone.capacity > 0 ? totalInZone / zone.capacity : 0;
    const waitRatio = totalInZone > 0 ? waitingCount / totalInZone : 0;
    const capacitySaturation = zone.capacity > 0 ? watchingCount / zone.capacity : 0;
    // Bidirectional penalty added after flow calculation (defined below)
    let score = Math.min(1, overcrowdRatio * 0.4 + waitRatio * 0.3 + capacitySaturation * 0.3);

    // Flow rates
    const entering = visitors.filter(
      (v) => v.isActive && v.targetZoneId === zone.id && v.currentZoneId !== zone.id,
    ).length;
    const leaving = visitors.filter(
      (v) => v.isActive && v.currentZoneId === zone.id && v.targetZoneId !== zone.id && v.targetZoneId !== null,
    ).length;

    // Bidirectional gate penalty: in+out flow overlaps at same gate → higher bottleneck
    const hasBidirectional = zone.gates.some((g: any) => g.type === 'bidirectional');
    const biDirPenalty = hasBidirectional ? Math.min(0.2, (entering + leaving) * 0.01) : 0;

    score = Math.min(1, score + biDirPenalty);

    // Group contribution
    const groupVisitors = zoneVisitors.filter((v) => v.groupId !== undefined);
    const groupContribution = totalInZone > 0 ? groupVisitors.length / totalInZone : 0;
    const isGroupInduced = groupContribution > 0.6 && score > 0.5;

    return {
      zoneId: zone.id,
      score,
      avgQueueTime: waitingCount > 0 ? 5000 : 0, // simplified
      flowInRate: entering,
      flowOutRate: leaving,
      groupContribution,
      isGroupInduced,
    };
  });
}
