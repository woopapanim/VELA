import type { VisitorId, GroupId, ZoneId, MediaId, FloorId, Vector2D, WaypointId } from './common';
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
  RESTING: 'RESTING',
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

// ---- Visitor Category (행동 분류) ----
export const VISITOR_CATEGORY = {
  SOLO: 'solo',
  SMALL_GROUP: 'small_group',
  GUIDED_TOUR: 'guided_tour',
  VIP_EXPERT: 'vip_expert',
} as const;

export type VisitorCategory =
  (typeof VISITOR_CATEGORY)[keyof typeof VISITOR_CATEGORY];

// ---- Category Config (per-category simulation parameters) ----
export interface VisitorCategoryConfig {
  readonly category: VisitorCategory;
  readonly baseSpeed: number;           // px/s
  readonly collisionRadius: number;     // px
  readonly dwellTimeMultiplier: number; // 1.0 = no change
  readonly skipThresholdMod: number;    // multiplier on patience
  readonly groupSizeRange: readonly [number, number]; // [min, max]
  readonly cohesionModel: 'none' | 'cohesion' | 'follow_leader';
}

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
  readonly dwellTimeMultiplier: number; // group dwell time multiplier (default 1.0)
  readonly effectiveCollisionRadius: number; // for guided tour: large body radius (px)
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
  /**
   * 최종 도착 위치 (WATCHING 을 시작할 정확한 좌표).
   * 미디어 선택 시점에 slot/close/view 위치를 계산해 고정.
   * null 이면 targetNodeId / targetMediaId 로부터 기본 위치 추론.
   */
  readonly targetPosition: Vector2D | null;
  readonly visitedZoneIds: readonly ZoneId[];
  readonly visitedMediaIds: readonly MediaId[];
  readonly category: VisitorCategory;
  readonly groupId: GroupId | undefined;
  readonly isGroupLeader: boolean;
  readonly steering: SteeringState;
  readonly waitStartedAt: number | null;
  readonly enteredAt: number;
  // 개인 관람 예산 — (now - enteredAt) >= visitBudgetMs 면 canExit. recommendedDuration × profile/engagement/지터.
  readonly visitBudgetMs: number;
  readonly zoneEnteredAtMs: number;          // elapsed ms when the current zone was entered (for dwell)
  readonly exitedAt: number | null;          // elapsed ms when isActive became false
  readonly isActive: boolean;
  // ── Gate crossing ──
  readonly lastGateTransitTime: number;             // elapsed ms at last gate crossing (cooldown)
  // ── Graph-Point navigation ──
  readonly currentNodeId: WaypointId | null;        // 현재 위치한 노드
  readonly targetNodeId: WaypointId | null;         // 다음 목표 노드
  readonly pathLog: readonly PathLogEntry[];         // 방문 기록
  // 스폰 시 사용한 ENTRY 노드 — "들어온 길로 나간다" 휴리스틱용.
  // 퇴장 라우팅은 기본적으로 이 entry 와 기하학적으로 짝지어진 exit 를 선호한다.
  readonly spawnEntryNodeId: WaypointId | null;
  // ── Phase 1 (2026-04-25): 운영 정책 lifecycle ──
  /**
   * 외부 도착 시각 (elapsed ms). 입장 정책 적용 전 시점.
   * unlimited 모드에선 admittedAt 과 동일 (즉시 입장).
   * 정책이 throttle 하면 admittedAt > arrivedAt 가능.
   * 회귀 호환: 미설정 시 enteredAt 으로 fallback.
   */
  readonly arrivedAt?: number;
  /** 입장 시각 (외부 대기 종료, 시뮬 활성화 시점). undefined = 아직 외부 큐. */
  readonly admittedAt?: number;
  /** 외부 대기 시간 (ms) = admittedAt - arrivedAt. exit 시점에 확정. */
  readonly outsideWaitMs?: number;
  /** 포기 이탈 시각 (ms). undefined = 입장 성공 또는 아직 대기 중. */
  readonly abandonedAt?: number;
  /** 만족도 점수 (0-1). exit 시점에 계산. */
  readonly satisfactionScore?: number;
}

// ---- Visitor Distribution (spawning config) ----
export interface VisitorDistribution {
  readonly totalCount: number;
  readonly profileWeights: Readonly<Record<VisitorProfileType, number>>;
  readonly engagementWeights: Readonly<Record<EngagementLevel, number>>;
  readonly groupRatio: number; // 0-1 (legacy fallback)
  readonly spawnRatePerSecond: number;
  readonly categoryWeights?: Readonly<Record<VisitorCategory, number>>; // new: category-based spawning
  // true = 면적 × 회전(duration / recommendedStay) 으로 자동 산출. false/undefined = 수동.
  readonly totalCountAuto?: boolean;
}

// ---- Time Slot Config ----
export interface TimeSlotConfig {
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly spawnRatePerSecond: number;
  readonly profileDistribution: Readonly<Record<VisitorProfileType, number>>;
  readonly engagementDistribution: Readonly<Record<EngagementLevel, number>>;
  readonly groupRatio: number; // legacy fallback
  readonly categoryDistribution?: Readonly<Record<VisitorCategory, number>>;
}
