import type { ZoneId, FloorId, GateId, MediaId, Vector2D, Rect, Polygon, HexColor } from './common';

// ---- Zone Shape ----
export const ZONE_SHAPE = {
  RECT: 'rect',
  CIRCLE: 'circle',
  L_TOP_LEFT: 'l_top_left',
  L_TOP_RIGHT: 'l_top_right',
  L_BOTTOM_LEFT: 'l_bottom_left',
  L_BOTTOM_RIGHT: 'l_bottom_right',
  O_RING: 'o_ring',
  CUSTOM: 'custom',
} as const;

export type ZoneShape = (typeof ZONE_SHAPE)[keyof typeof ZONE_SHAPE];

// ---- Zone Type ----
export const ZONE_TYPE = {
  LOBBY: 'lobby',
  ENTRANCE: 'entrance',
  EXHIBITION: 'exhibition',
  CORRIDOR: 'corridor',
  REST: 'rest',
  STAGE: 'stage',
  EXIT: 'exit',
  GATEWAY: 'gateway',  // Free mode: combined entrance + exit
} as const;

export type ZoneType = (typeof ZONE_TYPE)[keyof typeof ZONE_TYPE];

// ---- Flow Type ----
export const FLOW_TYPE = {
  FREE: 'free',
  GUIDED: 'guided',
  ONE_WAY: 'one_way',
} as const;

export type FlowType = (typeof FLOW_TYPE)[keyof typeof FLOW_TYPE];

// ---- Gate (zone entrance/exit, same-floor) ----
// Cross-floor transit is handled by ElevatorShaft + elevator waypoint nodes, not gates.
export const GATE_TYPE = {
  ENTRANCE: 'entrance',
  EXIT: 'exit',
  BIDIRECTIONAL: 'bidirectional',
} as const;

export type GateType = (typeof GATE_TYPE)[keyof typeof GATE_TYPE];

export interface Gate {
  readonly id: GateId;
  readonly zoneId: ZoneId;
  readonly floorId: FloorId;
  readonly type: GateType;
  readonly position: Vector2D;
  readonly width: number;
  readonly connectedGateId: GateId | null;
}

// ---- Gateway Mode (spawn/exit direction for gateway zones) ----
export type GatewayMode = 'spawn' | 'exit' | 'both';

// ---- Zone Config ----
export interface ZoneConfig {
  readonly id: ZoneId;
  readonly name: string;
  readonly type: ZoneType;
  readonly shape: ZoneShape;
  readonly bounds: Rect;
  readonly polygon: Polygon | null; // actual hitbox for L/O/custom shapes
  readonly lRatioX?: number; // L-shape bend position X ratio (0-1), default 0.5
  readonly lRatioY?: number; // L-shape bend position Y ratio (0-1), default 0.5
  readonly area: number; // m²
  readonly capacity: number;
  readonly flowType: FlowType;
  readonly gates: readonly Gate[];
  readonly mediaIds: readonly MediaId[];
  readonly color: HexColor;
  readonly attractiveness: number; // 0-1
  readonly mustVisit?: boolean; // true=히어로존, 모든 관람객이 반드시 방문해야 함 (피로 무시)
  readonly gatewayMode?: GatewayMode; // gateway zones only: spawn/exit/both
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ---- Zone Runtime State ----
export interface ZoneRuntimeState {
  readonly zoneId: ZoneId;
  readonly currentOccupancy: number;
  readonly utilizationRatio: number;
  readonly totalVisitsCount: number;
  readonly averageDwellTimeMs: number;
}
