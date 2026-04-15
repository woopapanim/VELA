import type {
  Visitor,
  VisitorProfile,
  VisitorGroup,
  VisitorDistribution,
  TimeSlotConfig,
  VisitorProfileType,
  EngagementLevel,
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
} from '@/domain';
import { VISITOR_ACTION, STEERING_BEHAVIOR } from '@/domain';
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
): VisitorProfile {
  const patienceBase = PATIENCE_VALUES[profileType] ?? 0.5;
  const engagementMod = ENGAGEMENT_PATIENCE_MODIFIER[engagementLevel] ?? 1.0;

  return {
    type: profileType,
    engagementLevel,
    maxSpeed: VISITOR_SPEEDS[profileType] ?? 120,
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
    visitedZoneIds: [],
    visitedMediaIds: [],
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

  let remaining = count;

  while (remaining > 0) {
    const isGroup = rng.next() < distribution.groupRatio && remaining >= 2;

    if (isGroup) {
      const groupSize = rng.nextInt(2, Math.min(8, remaining));
      const gid = genGroupId();
      const members: Visitor[] = [];

      for (let i = 0; i < groupSize; i++) {
        const pType = pickWeighted(distribution.profileWeights, rng);
        const eLevel = pickWeighted(distribution.engagementWeights, rng);
        const profile = createProfile(pType, eLevel);
        const offset: Vector2D = {
          x: spawnPosition.x + rng.nextFloat(-15, 15),
          y: spawnPosition.y + rng.nextFloat(-15, 15),
        };
        const v = spawnVisitor(profile, offset, spawnFloorId, simTime, gid, i === 0);
        members.push(v);
      }

      const groupType = groupSize <= 2 ? 'pair' : groupSize <= 5 ? 'small' : 'large';

      groups.push({
        id: gid,
        type: groupType as 'pair' | 'small' | 'large' | 'guided',
        leaderId: members[0].id,
        memberIds: members.map((m) => m.id),
        cohesionStrength: groupType === 'pair' ? 0.8 : groupType === 'small' ? 0.6 : 0.4,
        maxSpread: groupType === 'pair' ? 30 : groupType === 'small' ? 50 : 80,
      });

      visitors.push(...members);
      remaining -= groupSize;
    } else {
      const pType = pickWeighted(distribution.profileWeights, rng);
      const eLevel = pickWeighted(distribution.engagementWeights, rng);
      const profile = createProfile(pType, eLevel);
      const offset: Vector2D = {
        x: spawnPosition.x + rng.nextFloat(-10, 10),
        y: spawnPosition.y + rng.nextFloat(-10, 10),
      };
      visitors.push(spawnVisitor(profile, offset, spawnFloorId, simTime));
      remaining -= 1;
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
