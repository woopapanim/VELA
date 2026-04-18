import type {
  Visitor,
  VisitorProfile,
  VisitorGroup,
  VisitorDistribution,
  TimeSlotConfig,
  VisitorProfileType,
  EngagementLevel,
  VisitorCategory,
  FloorId,
  VisitorId,
  GroupId,
  Vector2D,
} from '@/domain';
import {
  VISITOR_SPEEDS,
  VISITOR_MASS,
  VISITOR_MAX_FORCE,
  FATIGUE_RATES,
  PATIENCE_VALUES,
  ENGAGEMENT_PATIENCE_MODIFIER,
  CATEGORY_CONFIGS,
  DEFAULT_CATEGORY_WEIGHTS,
} from '@/domain';
import { VISITOR_ACTION, VISITOR_CATEGORY, STEERING_BEHAVIOR } from '@/domain';
import type { SeededRandom } from '../utils/random';

let _nextVisitorId = 0;
let _nextGroupId = 0;

export function resetSpawnerIds() {
  _nextVisitorId = 0;
  _nextGroupId = 0;
}

function genVisitorId(): VisitorId {
  return `v_${_nextVisitorId++}` as VisitorId;
}

function genGroupId(): GroupId {
  return `g_${_nextGroupId++}` as GroupId;
}

function pickWeighted<T extends string>(
  weights: Readonly<Record<T, number>>,
  rng: SeededRandom,
): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + (w as number), 0);
  let r = rng.next() * total;
  for (const [key, weight] of entries) {
    r -= weight as number;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function createProfile(
  profileType: VisitorProfileType,
  engagementLevel: EngagementLevel,
  speedOverride?: number,
): VisitorProfile {
  const patienceBase = PATIENCE_VALUES[profileType] ?? 0.5;
  const engagementMod = ENGAGEMENT_PATIENCE_MODIFIER[engagementLevel] ?? 1.0;

  return {
    type: profileType,
    engagementLevel,
    maxSpeed: speedOverride ?? (VISITOR_SPEEDS[profileType] ?? 120),
    mass: VISITOR_MASS[profileType] ?? 70,
    maxForce: VISITOR_MAX_FORCE[profileType] ?? 200,
    fatigueRate: FATIGUE_RATES[profileType] ?? 0.00005,
    patience: Math.min(1, patienceBase * engagementMod),
    interestMap: {},
  };
}

export function spawnVisitor(
  profile: VisitorProfile,
  spawnPosition: Vector2D,
  spawnFloorId: FloorId,
  simTime: number,
  groupId?: GroupId,
  isLeader: boolean = false,
  category: VisitorCategory = VISITOR_CATEGORY.SOLO,
): Visitor {
  return {
    id: genVisitorId(),
    profile,
    position: spawnPosition,
    velocity: { x: 0, y: 0 },
    fatigue: 0,
    currentAction: VISITOR_ACTION.IDLE,
    currentFloorId: spawnFloorId,
    currentZoneId: 'placeholder' as any, // set by SimEngine.spawnTick
    targetZoneId: null,
    targetFloorId: null,
    targetMediaId: null,
    targetPosition: null,
    visitedZoneIds: [],
    visitedMediaIds: [],
    category,
    groupId,
    isGroupLeader: isLeader,
    steering: {
      activeBehavior: STEERING_BEHAVIOR.IDLE,
      wanderAngle: 0,
      currentSteering: { linear: { x: 0, y: 0 }, angular: 0 },
      isArrived: false,
    },
    waitStartedAt: null,
    enteredAt: simTime,
    isActive: true,
    lastGateTransitTime: 0,
    // Graph-Point navigation
    currentNodeId: null,
    targetNodeId: null,
    pathLog: [],
  };
}

export interface SpawnBatch {
  readonly visitors: Visitor[];
  readonly groups: VisitorGroup[];
}

export function generateSpawnBatch(
  count: number,
  distribution: VisitorDistribution,
  spawnPosition: Vector2D,
  spawnFloorId: FloorId,
  simTime: number,
  rng: SeededRandom,
): SpawnBatch {
  const visitors: Visitor[] = [];
  const groups: VisitorGroup[] = [];
  const catWeights = distribution.categoryWeights ?? DEFAULT_CATEGORY_WEIGHTS;

  let remaining = count;

  while (remaining > 0) {
    const cat = pickWeighted(catWeights, rng);
    const catCfg = CATEGORY_CONFIGS[cat];

    if (cat === VISITOR_CATEGORY.SOLO || cat === VISITOR_CATEGORY.VIP_EXPERT) {
      // ── Solo / VIP: single agent ──
      const pType = pickWeighted(distribution.profileWeights, rng);
      const eLevel = cat === VISITOR_CATEGORY.VIP_EXPERT ? 'immersive' as EngagementLevel : pickWeighted(distribution.engagementWeights, rng);
      const profile = createProfile(pType, eLevel, catCfg.baseSpeed);
      const offset: Vector2D = {
        x: spawnPosition.x + rng.nextFloat(-10, 10),
        y: spawnPosition.y + rng.nextFloat(-10, 10),
      };
      visitors.push(spawnVisitor(profile, offset, spawnFloorId, simTime, undefined, false, cat));
      remaining -= 1;

    } else if (cat === VISITOR_CATEGORY.SMALL_GROUP) {
      // ── Small Group: 2-4 members ── (group is a cohesive unit, ignore remaining cap)
      const [minSize, maxSize] = catCfg.groupSizeRange;
      const groupSize = rng.nextInt(minSize, maxSize);
      const gid = genGroupId();
      const members: Visitor[] = [];

      for (let i = 0; i < groupSize; i++) {
        const pType = pickWeighted(distribution.profileWeights, rng);
        const eLevel = pickWeighted(distribution.engagementWeights, rng);
        const profile = createProfile(pType, eLevel, catCfg.baseSpeed);
        const offset: Vector2D = {
          x: spawnPosition.x + rng.nextFloat(-15, 15),
          y: spawnPosition.y + rng.nextFloat(-15, 15),
        };
        members.push(spawnVisitor(profile, offset, spawnFloorId, simTime, gid, i === 0, cat));
      }

      const groupType = groupSize <= 2 ? 'pair' as const : 'small' as const;
      groups.push({
        id: gid,
        type: groupType,
        leaderId: members[0].id,
        memberIds: members.map((m) => m.id),
        cohesionStrength: 0.7,
        maxSpread: 40,
        dwellTimeMultiplier: catCfg.dwellTimeMultiplier,
        effectiveCollisionRadius: catCfg.collisionRadius,
      });

      visitors.push(...members);
      remaining -= groupSize;

    } else if (cat === VISITOR_CATEGORY.GUIDED_TOUR) {
      // ── Guided Tour: 10-20 members ── (cohesive unit, ignore remaining cap)
      const [minSize, maxSize] = catCfg.groupSizeRange;
      const groupSize = rng.nextInt(minSize, maxSize);
      const gid = genGroupId();
      const members: Visitor[] = [];

      for (let i = 0; i < groupSize; i++) {
        const pType = pickWeighted(distribution.profileWeights, rng);
        const eLevel = pickWeighted(distribution.engagementWeights, rng);
        const profile = createProfile(pType, eLevel, catCfg.baseSpeed);
        const offset: Vector2D = {
          x: spawnPosition.x + rng.nextFloat(-20, 20),
          y: spawnPosition.y + rng.nextFloat(-20, 20),
        };
        members.push(spawnVisitor(profile, offset, spawnFloorId, simTime, gid, i === 0, cat));
      }

      groups.push({
        id: gid,
        type: 'guided',
        leaderId: members[0].id,
        memberIds: members.map((m) => m.id),
        cohesionStrength: 0.95,
        maxSpread: 80,
        dwellTimeMultiplier: catCfg.dwellTimeMultiplier,
        effectiveCollisionRadius: catCfg.collisionRadius,
      });

      visitors.push(...members);
      remaining -= groupSize;
    }
  }

  return { visitors, groups };
}

export function getActiveTimeSlot(
  timeSlots: readonly TimeSlotConfig[],
  simTimeMs: number,
): TimeSlotConfig | null {
  for (const slot of timeSlots) {
    if (simTimeMs >= slot.startTimeMs && simTimeMs < slot.endTimeMs) {
      return slot;
    }
  }
  return null;
}
