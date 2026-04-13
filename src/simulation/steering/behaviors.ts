import type { Vector2D } from '@/domain';
import type { PhysicsConfig, SteeringOutput } from '@/domain';
import {
  sub,
  normalize,
  scale,
  magnitude,
  distance,
  rotate,
  ZERO,
} from '../utils/math';

const ZERO_STEERING: SteeringOutput = { linear: ZERO, angular: 0 };

// ---- SEEK: Move toward a target ----
export function seek(
  position: Vector2D,
  target: Vector2D,
  maxSpeed: number,
  velocity: Vector2D,
): SteeringOutput {
  const desired = sub(target, position);
  const desiredNorm = normalize(desired);
  const desiredVel = scale(desiredNorm, maxSpeed);
  const steer = sub(desiredVel, velocity);
  return { linear: steer, angular: 0 };
}

// ---- ARRIVAL: Decelerate as approaching target ----
export function arrival(
  position: Vector2D,
  target: Vector2D,
  maxSpeed: number,
  velocity: Vector2D,
  slowRadius: number,
  arrivalRadius: number,
): SteeringOutput {
  const toTarget = sub(target, position);
  const dist = magnitude(toTarget);

  if (dist < arrivalRadius) return ZERO_STEERING;

  let targetSpeed: number;
  if (dist < slowRadius) {
    targetSpeed = maxSpeed * ((dist - arrivalRadius) / (slowRadius - arrivalRadius));
  } else {
    targetSpeed = maxSpeed;
  }

  const desiredVel = scale(normalize(toTarget), targetSpeed);
  const steer = sub(desiredVel, velocity);
  return { linear: steer, angular: 0 };
}

// ---- WANDER: Random-looking movement ----
export function wander(
  velocity: Vector2D,
  wanderAngle: number,
  config: PhysicsConfig,
  jitterDelta: number, // random jitter this tick
): { steering: SteeringOutput; newWanderAngle: number } {
  const newAngle = wanderAngle + jitterDelta;

  const velMag = magnitude(velocity);
  let forward: Vector2D;
  if (velMag > 0.01) {
    forward = normalize(velocity);
  } else {
    forward = { x: 1, y: 0 };
  }

  const circleCenter = scale(forward, config.wanderRadius * 2);
  const displacement = rotate({ x: config.wanderRadius, y: 0 }, newAngle);
  const wanderForce = { x: circleCenter.x + displacement.x, y: circleCenter.y + displacement.y };

  return {
    steering: { linear: wanderForce, angular: 0 },
    newWanderAngle: newAngle,
  };
}

// ---- OBSTACLE AVOIDANCE: Avoid zone walls ----
export function obstacleAvoidance(
  position: Vector2D,
  velocity: Vector2D,
  walls: readonly { a: Vector2D; b: Vector2D }[],
  lookahead: number,
  maxForce: number,
): SteeringOutput {
  const velMag = magnitude(velocity);
  if (velMag < 0.01) return ZERO_STEERING;

  const forward = normalize(velocity);
  const ahead = { x: position.x + forward.x * lookahead, y: position.y + forward.y * lookahead };
  const aheadHalf = { x: position.x + forward.x * lookahead * 0.5, y: position.y + forward.y * lookahead * 0.5 };

  let closestWall: { a: Vector2D; b: Vector2D } | null = null;
  let closestDist = Infinity;

  for (const wall of walls) {
    const d = pointToSegmentDist(ahead, wall.a, wall.b);
    const dHalf = pointToSegmentDist(aheadHalf, wall.a, wall.b);
    const minD = Math.min(d, dHalf);

    if (minD < 20 && minD < closestDist) {
      closestDist = minD;
      closestWall = wall;
    }
  }

  if (!closestWall) return ZERO_STEERING;

  const wallDir = sub(closestWall.b, closestWall.a);
  const wallNormal = normalize({ x: -wallDir.y, y: wallDir.x });

  // Check which side we're on
  const toWall = sub(closestWall.a, position);
  const side = toWall.x * wallNormal.x + toWall.y * wallNormal.y;
  const avoidDir = side > 0 ? { x: -wallNormal.x, y: -wallNormal.y } : wallNormal;

  const strength = maxForce * (1 - closestDist / 20);
  return { linear: scale(avoidDir, strength), angular: 0 };
}

// ---- SEPARATION: Avoid overlapping with nearby agents ----
export function separation(
  position: Vector2D,
  neighbors: readonly Vector2D[],
  avoidanceRadius: number,
  strength: number,
): SteeringOutput {
  if (neighbors.length === 0) return ZERO_STEERING;

  let forceX = 0;
  let forceY = 0;

  for (const neighbor of neighbors) {
    const dx = position.x - neighbor.x;
    const dy = position.y - neighbor.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < 0.001) continue; // skip self / exact overlap

    const dist = Math.sqrt(distSq);
    if (dist >= avoidanceRadius) continue;

    // Stronger when closer
    const factor = strength * (1 - dist / avoidanceRadius);
    forceX += (dx / dist) * factor;
    forceY += (dy / dist) * factor;
  }

  return { linear: { x: forceX, y: forceY }, angular: 0 };
}

// ---- FOLLOW LEADER: Seek the leader's position (for large/guided groups) ----
export function followLeader(
  position: Vector2D,
  leaderPosition: Vector2D,
  velocity: Vector2D,
  maxSpeed: number,
  arrivalRadius: number,
): SteeringOutput {
  const dist = distance(position, leaderPosition);
  if (dist < arrivalRadius) return ZERO_STEERING;

  return arrival(position, leaderPosition, maxSpeed, velocity, arrivalRadius * 2, arrivalRadius);
}

// ---- GROUP COHESION: Move toward group center (for small groups) ----
export function groupCohesion(
  position: Vector2D,
  memberPositions: readonly Vector2D[],
  velocity: Vector2D,
  maxSpeed: number,
  cohesionStrength: number,
): SteeringOutput {
  if (memberPositions.length === 0) return ZERO_STEERING;

  let cx = 0;
  let cy = 0;
  for (const p of memberPositions) {
    cx += p.x;
    cy += p.y;
  }
  cx /= memberPositions.length;
  cy /= memberPositions.length;

  const toCenter = sub({ x: cx, y: cy }, position);
  const dist = magnitude(toCenter);

  if (dist < 5) return ZERO_STEERING;

  const desired = scale(normalize(toCenter), maxSpeed * cohesionStrength);
  const steer = sub(desired, velocity);
  return { linear: steer, angular: 0 };
}

// ---- Utility: Point to line segment distance ----
function pointToSegmentDist(p: Vector2D, a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return distance(p, a);

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return distance(p, proj);
}
