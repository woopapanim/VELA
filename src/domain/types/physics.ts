import type { Vector2D, VisitorId } from './common';

// ---- Steering Behaviors ----
export const STEERING_BEHAVIOR = {
  SEEK: 'seek',
  ARRIVAL: 'arrival',
  WANDER: 'wander',
  OBSTACLE_AVOIDANCE: 'obstacle_avoidance',
  SEPARATION: 'separation',
  FOLLOW_LEADER: 'follow_leader',
  GROUP_COHESION: 'group_cohesion',
  IDLE: 'idle',
} as const;

export type SteeringBehavior =
  (typeof STEERING_BEHAVIOR)[keyof typeof STEERING_BEHAVIOR];

export interface SteeringOutput {
  readonly linear: Vector2D;
  readonly angular: number;
}

export interface SteeringState {
  readonly activeBehavior: SteeringBehavior;
  readonly wanderAngle: number;
  readonly currentSteering: SteeringOutput;
  readonly isArrived: boolean;
}

// ---- Collision ----
export interface CollisionInfo {
  readonly visitorA: VisitorId;
  readonly visitorB: VisitorId;
  readonly distance: number;
  readonly normal: Vector2D;
  readonly penetrationDepth: number;
}

// ---- Physics Config ----
export interface PhysicsConfig {
  readonly maxSpeed: number;
  readonly maxAcceleration: number;
  readonly arrivalRadius: number;
  readonly arrivalSlowRadius: number;
  readonly avoidanceRadius: number;
  readonly separationStrength: number;
  readonly wanderRadius: number;
  readonly wanderJitter: number;
  readonly obstacleAvoidanceLookahead: number;
  // Group dynamics
  readonly groupCohesionStrength: number;
  readonly groupCohesionRadius: number;
  readonly followerSeekWeight: number;
  readonly followerArrivalRadius: number;
}

// ---- Skip Logic ----
// Formula: waitTime > (patience * attractiveness * skipMultiplier)
export interface SkipThreshold {
  readonly skipMultiplier: number;
  readonly maxWaitTimeMs: number;
  readonly skipCooldownMs: number;
}
