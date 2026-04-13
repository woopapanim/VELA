import type { PinId, ZoneId, MediaId, Vector2D, UnixMs } from './common';
import type { MediaType } from './media';
import type { KpiSnapshot } from './kpi';

// ---- Pinned Time Point ----
export interface PinnedTimePoint {
  readonly id: PinId;
  readonly simulationTimeMs: number;
  readonly label: string;
  readonly createdAt: UnixMs;
  readonly kpiSnapshot: KpiSnapshot;
  readonly zoneAnalysis: readonly ZonePointAnalysis[];
  readonly mediaAnalysis: readonly MediaPointAnalysis[];
}

// ---- Zone Point Analysis ----
export interface ZonePointAnalysis {
  readonly zoneId: ZoneId;
  readonly occupancy: number;
  readonly utilizationRatio: number;
  readonly comfortIndex: number; // m²/person ratio, 1.0 = meets international standard
  readonly activeVisitorCount: number;
  readonly waitingVisitorCount: number;
  readonly flowDirection: Vector2D; // average movement direction
}

// ---- Media Point Analysis ----
export interface MediaPointAnalysis {
  readonly mediaId: MediaId;
  readonly mediaType: MediaType;
  readonly currentViewers: number;
  readonly queueLength: number;
  readonly avgWaitTimeMs: number;
  readonly efficiency: number; // current viewers / capacity
  readonly skipCountSoFar: number;
}
