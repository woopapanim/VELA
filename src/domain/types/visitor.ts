import type { VisitorId, GroupId, ZoneId, MediaId, FloorId, GateId, Vector2D, WaypointId } from './common';
import type { SteeringState } from './physics';
import type { PathLogEntry } from './waypoint';

// ---- Visitor Profile Type ----
export const VISITOR_PROFILE_TYPE = {
  GENERAL: 'general',
  VIP: 'vip',
  CHILD: 'child',
  ELDERLY: 'elderly',
  DISABLED: 'disabled',
} as const;

export type VisitorProfileType =
  (typeof VISITOR_PROFILE_TYPE)[keyof typeof VISITOR_PROFILE_TYPE];

// ---- Engagement Level ----
export const ENGAGEMENT_LEVEL = {
  QUICK: 'quick',
  EXPLORER: 'explorer',
  IMMERSIVE: 'immersive',
} as const;

export type EngagementLevel =
  (typeof ENGAGEMENT_LEVEL)[keyof typeof ENGAGEMENT_LEVEL];

// ---- Visitor Action State ----
export const VISITOR_ACTION = {
  IDLE: 'IDLE',
  MOVING: 'MOVING',
  WATCHING: 'WATCHING',
  WAITING: 'WAITING',
  EXITING: 'EXITING',
} as const;

export type VisitorAction =
  (typeof VISITOR_ACTION)[keyof typeof VISITOR_ACTION];

// ---- Group Type ----
export const GROUP_TYPE = {
  PAIR: 'pair',
  SMALL: 'small',
  LARGE: 'large',
  GUIDED_TOUR: 'guided',
} as const;

export type GroupType = (typeof GROUP_TYPE)[keyof typeof GROUP_TYPE];

// ---- Visitor Profile (static archetype) ----
export interface VisitorProfile {
  readonly type: VisitorProfileType;
  readonly engagementLevel: EngagementLevel;
  readonly maxSpeed: number;
  readonly mass: number;
  readonly maxForce: number;
  readonly fatigueRate: number;
  readonly patience: number; // 0-1, skip logic parameter
  readonly interestMap: Readonly<Record<string, number>>; // ZoneId -> 0-1 preference
}

// ---- Visitor Group ----
export interface VisitorGroup {
  readonly id: GroupId;
  readonly type: GroupType;
  readonly leaderId: VisitorId;
  readonly memberIds: readonly VisitorId[];
  readonly cohesionStrength: number; // 0-1
  readonly maxSpread: number; // px
}

// ---- Visitor (full runtime state) ----
export interface Visitor {
  readonly id: VisitorId;
  readonly profile: VisitorProfile;
  readonly position: Vector2D;
  readonly velocity: Vector2D;
  readonly fatigue: number; // 0-1
  readonly currentAction: VisitorAction;
  readonly currentFloorId: FloorId;
  readonly currentZoneId: ZoneId;
  readonly targetZoneId: ZoneId | null;
  readonly targetFloorId: FloorId | null;
  readonly targetMediaId: MediaId | null;
  readonly visitedZoneIds: readonly ZoneId[];
  readonly visitedMediaIds: readonly MediaId[];
  readonly groupId: GroupId | undefined;
  readonly isGroupLeader: boolean;
  readonly steering: SteeringState;
  readonly waitStartedAt: number | null;
  readonly enteredAt: number;
  readonly isActive: boolean;
  // ── Gate crossing ──
  readonly lastGateTransitTime: number;             // elapsed ms at last gate crossing (cooldown)
  // ── Graph-Point navigation ──
  readonly currentNodeId: WaypointId | null;        // 현재 위치한 노드
  readonly targetNodeId: WaypointId | null;         // 다음 목표 노드
  readonly pathLog: readonly PathLogEntry[];         // 방문 기록
}

// ---- Visitor Distribution (spawning config) ----
export interface VisitorDistribution {
  readonly totalCount: number;
  readonly profileWeights: Readonly<Record<VisitorProfileType, number>>;
  readonly engagementWeights: Readonly<Record<EngagementLevel, number>>;
  readonly groupRatio: number; // 0-1
  readonly spawnRatePerSecond: number;
}

// ---- Time Slot Config ----
export interface TimeSlotConfig {
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly spawnRatePerSecond: number;
  readonly profileDistribution: Readonly<Record<VisitorProfileType, number>>;
  readonly engagementDistribution: Readonly<Record<EngagementLevel, number>>;
  readonly groupRatio: number;
}
