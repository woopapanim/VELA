import type {
  Visitor, ZoneConfig, MediaPlacement, KpiSnapshot,
  PinnedTimePoint, ZonePointAnalysis, MediaPointAnalysis,
  Vector2D,
} from '@/domain';
import { PinId, VISITOR_ACTION, INTERNATIONAL_DENSITY_STANDARD } from '@/domain';
import { getZonePolygon } from '@/simulation/engine';
import { isPointInPolygon } from '@/simulation/collision';
import { assembleKpiSnapshot } from '@/analytics/aggregator';

export interface CapturePinArgs {
  readonly zones: readonly ZoneConfig[];
  readonly media: readonly MediaPlacement[];
  readonly visitors: readonly Visitor[];
  readonly mediaStats: ReadonlyMap<string, {
    watchCount: number; skipCount: number; waitCount: number;
    totalWatchMs: number; totalWaitMs: number; peakViewers: number;
  }>;
  readonly simTimeMs: number;
  readonly label: string;
  readonly latestSnapshot: KpiSnapshot | null;
  readonly totalExited: number;
}

function newPinId(): ReturnType<typeof PinId> {
  const raw = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `pin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return PinId(raw);
}

export function capturePin(args: CapturePinArgs): PinnedTimePoint {
  const { zones, media, visitors, mediaStats, simTimeMs, label, latestSnapshot, totalExited } = args;

  // KPI snapshot — reuse live if fresh (within 500ms), else recompute.
  const kpiSnapshot: KpiSnapshot =
    latestSnapshot && Math.abs(latestSnapshot.simulationTimeMs - simTimeMs) <= 500
      ? latestSnapshot
      : assembleKpiSnapshot(zones, media, visitors, simTimeMs, totalExited);

  const zoneAnalysis = buildZoneAnalysis(zones, visitors);
  const mediaAnalysis = buildMediaAnalysis(media, visitors, mediaStats);

  return {
    id: newPinId(),
    simulationTimeMs: simTimeMs,
    label,
    createdAt: Date.now(),
    kpiSnapshot,
    zoneAnalysis,
    mediaAnalysis,
  };
}

function buildZoneAnalysis(
  zones: readonly ZoneConfig[],
  visitors: readonly Visitor[],
): readonly ZonePointAnalysis[] {
  return zones.map((zone) => {
    const poly = getZonePolygon(zone);
    const b = zone.bounds;

    let occupancy = 0;
    let watching = 0;
    let waiting = 0;
    let vx = 0;
    let vy = 0;
    let movingCount = 0;

    for (const v of visitors) {
      if (!v.isActive) continue;
      const p = v.position;
      if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) continue;
      if (!isPointInPolygon(p, poly)) continue;
      occupancy++;
      if (v.currentAction === VISITOR_ACTION.WATCHING) watching++;
      if (v.currentAction === VISITOR_ACTION.WAITING) waiting++;
      if (v.currentAction === VISITOR_ACTION.MOVING || v.currentAction === VISITOR_ACTION.EXITING) {
        vx += v.velocity.x;
        vy += v.velocity.y;
        movingCount++;
      }
    }

    const utilizationRatio = zone.capacity > 0 ? occupancy / zone.capacity : 0;
    const areaPerPerson = occupancy > 0 ? zone.area / occupancy : zone.area;
    const comfortIndex = areaPerPerson / INTERNATIONAL_DENSITY_STANDARD;
    const flowDirection: Vector2D = movingCount > 0
      ? normalize({ x: vx / movingCount, y: vy / movingCount })
      : { x: 0, y: 0 };

    return {
      zoneId: zone.id,
      occupancy,
      utilizationRatio,
      comfortIndex,
      activeVisitorCount: occupancy,
      waitingVisitorCount: waiting,
      flowDirection,
      // Expose watching too — useful downstream even if not in the original type.
    } as ZonePointAnalysis & { watchingVisitorCount?: number };
  });
}

function buildMediaAnalysis(
  media: readonly MediaPlacement[],
  visitors: readonly Visitor[],
  mediaStats: CapturePinArgs['mediaStats'],
): readonly MediaPointAnalysis[] {
  const capByMedia = new Map<string, number>();
  for (const m of media) {
    const cap = (m as any).viewingCapacity ?? (m as any).capacity ?? 1;
    capByMedia.set(m.id as string, cap);
  }

  const watchingCount = new Map<string, number>();
  const waitingCount = new Map<string, number>();
  for (const v of visitors) {
    if (!v.isActive || !v.targetMediaId) continue;
    const id = v.targetMediaId as string;
    if (v.currentAction === VISITOR_ACTION.WATCHING) {
      watchingCount.set(id, (watchingCount.get(id) ?? 0) + 1);
    } else if (v.currentAction === VISITOR_ACTION.WAITING) {
      waitingCount.set(id, (waitingCount.get(id) ?? 0) + 1);
    }
  }

  return media.map((m) => {
    const id = m.id as string;
    const stats = mediaStats.get(id);
    const currentViewers = watchingCount.get(id) ?? 0;
    const queueLength = waitingCount.get(id) ?? 0;
    const cap = capByMedia.get(id) ?? 1;
    const avgWaitTimeMs = stats && stats.waitCount > 0 ? stats.totalWaitMs / stats.waitCount : 0;

    return {
      mediaId: m.id,
      mediaType: m.interactionType,
      currentViewers,
      queueLength,
      avgWaitTimeMs,
      efficiency: cap > 0 ? currentViewers / cap : 0,
      skipCountSoFar: stats?.skipCount ?? 0,
    };
  });
}

function normalize(v: Vector2D): Vector2D {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}
