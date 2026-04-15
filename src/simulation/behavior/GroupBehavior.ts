import type {
  Visitor,
  VisitorGroup,
  VisitorCategory,
} from '@/domain';
import { VISITOR_ACTION, VISITOR_CATEGORY } from '@/domain';
import { CATEGORY_CONFIGS } from '@/domain';

/**
 * Sync a follower's behavior to their group leader.
 * Followers mirror the leader's action state:
 *   - Leader WATCHING → follower WATCHING (same media)
 *   - Leader MOVING/EXITING → follower MOVING (followLeader steering handles position)
 *   - Leader IDLE → follower IDLE
 */
export function syncFollowerToLeader(
  follower: Visitor,
  leader: Visitor,
  _group: VisitorGroup,
): Visitor {
  const leaderAction = leader.currentAction;

  // Leader is watching → follower also watches same media (position handled by steering)
  if (leaderAction === VISITOR_ACTION.WATCHING) {
    if (follower.currentAction === VISITOR_ACTION.WATCHING && follower.targetMediaId === leader.targetMediaId) {
      return follower; // already watching same media
    }
    return {
      ...follower,
      currentAction: VISITOR_ACTION.WATCHING,
      targetMediaId: leader.targetMediaId,
      targetZoneId: leader.currentZoneId,
      targetNodeId: leader.currentNodeId,
      velocity: { x: 0, y: 0 },
      waitStartedAt: null,
    };
  }

  // Leader is waiting → follower also waits
  if (leaderAction === VISITOR_ACTION.WAITING) {
    if (follower.currentAction === VISITOR_ACTION.WAITING) return follower;
    return {
      ...follower,
      currentAction: VISITOR_ACTION.WAITING,
      targetMediaId: leader.targetMediaId,
      targetZoneId: leader.targetZoneId,
      targetNodeId: leader.targetNodeId,
      velocity: { x: 0, y: 0 },
    };
  }

  // Leader is moving/exiting → follower follows (steering forces handle actual position)
  if (leaderAction === VISITOR_ACTION.MOVING || leaderAction === VISITOR_ACTION.EXITING) {
    return {
      ...follower,
      currentAction: leaderAction,
      targetZoneId: leader.targetZoneId,
      targetNodeId: leader.targetNodeId,
      currentZoneId: leader.currentZoneId,
      currentNodeId: leader.currentNodeId,
      // Don't copy targetMediaId — followers just follow leader's position
      targetMediaId: null,
      waitStartedAt: null,
    };
  }

  // Leader is idle → follower is idle too
  if (leaderAction === VISITOR_ACTION.IDLE) {
    if (follower.currentAction === VISITOR_ACTION.IDLE) return follower;
    return {
      ...follower,
      currentAction: VISITOR_ACTION.IDLE,
      targetMediaId: null,
      targetZoneId: null,
      targetNodeId: null,
      waitStartedAt: null,
    };
  }

  return follower;
}

/**
 * Apply group dwell time multiplier to base engagement duration.
 */
export function getGroupDwellDuration(
  baseDuration: number,
  group: VisitorGroup,
): number {
  return baseDuration * group.dwellTimeMultiplier;
}

/**
 * Get the skip threshold modifier for a given category.
 * Higher modifier = more patient = less likely to skip.
 */
export function getCategorySkipMod(category: VisitorCategory): number {
  return CATEGORY_CONFIGS[category]?.skipThresholdMod ?? 1.0;
}

/**
 * Check if a visitor is a follower (in a group, not the leader).
 */
export function isFollower(v: Visitor): boolean {
  return !!v.groupId && !v.isGroupLeader;
}
