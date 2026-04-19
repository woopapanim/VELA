import type { ScenarioId, UnixMs } from './common';
import type { FloorConfig } from './floor';
import type { ZoneConfig } from './zone';
import type { MediaPlacement } from './media';
import type { VisitorDistribution } from './visitor';
import type { SimulationConfig } from './simulation';
import type { WaypointGraph } from './waypoint';
import type { ElevatorShaft } from './shaft';

// ---- Scenario Meta ----
export interface ScenarioMeta {
  readonly id: ScenarioId;
  readonly name: string;
  readonly description: string;
  readonly version: number; // auto-incrementing v1, v2...
  readonly parentId: ScenarioId | null; // branching parent
  readonly tags: readonly string[];
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
}

// ---- Global Flow Mode ----
export const GLOBAL_FLOW_MODE = {
  FREE: 'free',           // visitors choose any zone freely
  SEQUENTIAL: 'sequential', // visitors follow zone list order
  HYBRID: 'hybrid',       // sequential up to guidedUntilIndex, then free
} as const;

export type GlobalFlowMode = (typeof GLOBAL_FLOW_MODE)[keyof typeof GLOBAL_FLOW_MODE];

// ---- Scenario (full bundle) ----
export interface Scenario {
  readonly meta: ScenarioMeta;
  readonly floors: readonly FloorConfig[];
  readonly zones: readonly ZoneConfig[];
  readonly media: readonly MediaPlacement[];
  readonly visitorDistribution: VisitorDistribution;
  readonly simulationConfig: SimulationConfig;
  readonly globalFlowMode?: GlobalFlowMode;   // default 'free'
  readonly guidedUntilIndex?: number;          // for hybrid: sequential up to this zone index
  readonly waypointGraph?: WaypointGraph;       // Graph-Point 동선 그래프
  readonly shafts?: readonly ElevatorShaft[];   // 엘리베이터 샤프트 (층 간 이동)
}

// ---- Scenario Summary (lightweight for lists) ----
export interface ScenarioSummary {
  readonly meta: ScenarioMeta;
  readonly floorCount: number;
  readonly zoneCount: number;
  readonly totalVisitors: number;
}
