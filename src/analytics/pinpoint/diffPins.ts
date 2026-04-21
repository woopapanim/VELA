import type { PinnedTimePoint, ZoneId, MediaId } from '@/domain';

export interface PinDeltaEntry<K> {
  readonly key: K;
  readonly prev: number;
  readonly curr: number;
  readonly delta: number;
  readonly pctChange: number; // (curr-prev)/prev, 0 if prev==0
}

export interface PinDiff {
  readonly fromTimeMs: number;
  readonly toTimeMs: number;
  readonly durationMs: number;
  readonly throughput: PinDeltaEntry<'throughput'>;
  readonly avgFatigue: PinDeltaEntry<'avgFatigue'>;
  readonly activeCount: PinDeltaEntry<'active'>;
  readonly zoneOccupancy: readonly PinDeltaEntry<ZoneId>[];
  readonly mediaViewers: readonly PinDeltaEntry<MediaId>[];
}

function entry<K>(key: K, prev: number, curr: number): PinDeltaEntry<K> {
  const delta = curr - prev;
  const pctChange = prev === 0 ? (curr === 0 ? 0 : 1) : delta / prev;
  return { key, prev, curr, delta, pctChange };
}

export function diffPins(prev: PinnedTimePoint, curr: PinnedTimePoint): PinDiff {
  const prevThroughput = prev.kpiSnapshot.flowEfficiency.throughputPerMinute;
  const currThroughput = curr.kpiSnapshot.flowEfficiency.throughputPerMinute;

  const prevFatigue = prev.kpiSnapshot.fatigueDistribution.mean;
  const currFatigue = curr.kpiSnapshot.fatigueDistribution.mean;

  const prevActive = sumOccupancy(prev);
  const currActive = sumOccupancy(curr);

  const prevByZone = new Map(prev.zoneAnalysis.map((z) => [z.zoneId as string, z.occupancy]));
  const zoneOccupancy = curr.zoneAnalysis.map((z) =>
    entry<ZoneId>(z.zoneId, prevByZone.get(z.zoneId as string) ?? 0, z.occupancy),
  );

  const prevByMedia = new Map(prev.mediaAnalysis.map((m) => [m.mediaId as string, m.currentViewers]));
  const mediaViewers = curr.mediaAnalysis.map((m) =>
    entry<MediaId>(m.mediaId, prevByMedia.get(m.mediaId as string) ?? 0, m.currentViewers),
  );

  return {
    fromTimeMs: prev.simulationTimeMs,
    toTimeMs: curr.simulationTimeMs,
    durationMs: curr.simulationTimeMs - prev.simulationTimeMs,
    throughput: entry('throughput', prevThroughput, currThroughput),
    avgFatigue: entry('avgFatigue', prevFatigue, currFatigue),
    activeCount: entry('active', prevActive, currActive),
    zoneOccupancy,
    mediaViewers,
  };
}

function sumOccupancy(pin: PinnedTimePoint): number {
  return pin.zoneAnalysis.reduce((s, z) => s + z.occupancy, 0);
}
