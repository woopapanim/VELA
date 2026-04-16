/**
 * SimEngine v2 — Complete rewrite
 *
 * Design principles:
 *   1. Agent has ONE target at a time (a position to walk to)
 *   2. Zone transition = walk to exit gate → walk to next zone entrance gate → walk to zone center
 *   3. No teleportation. No detectCurrentZone guessing.
 *   4. Zone collision only when agent is settled inside a zone (not leaving, not in transit)
 *
 * Agent lifecycle:
 *   SPAWN at entrance gate
 *   → assignNextTarget() picks next zone
 *   → walkToGate (exit gate of current zone)
 *   → walkBetweenZones (entrance gate of target zone)
 *   → walkToCenter (zone center)
 *   → engage with media / dwell
 *   → repeat until exit zone
 *   → deactivate
 */

import type {
  Visitor,
  VisitorGroup,
  ZoneConfig,
  MediaPlacement,
  FloorConfig,
  SimulationConfig,
  TimeState,
  SimulationPhase,
  Vector2D,
  Gate,
  GateId,
  WaypointGraph,
  WaypointNode,
  WaypointId,
  PathLogEntry,
} from '@/domain';
import { SIMULATION_PHASE, VISITOR_ACTION, STEERING_BEHAVIOR, MEDIA_SCALE, MEDIA_INTERACTION_OFFSET } from '@/domain';
import { createSeededRandom, type SeededRandom } from '../utils/random';
import { clampMagnitude } from '../utils/math';
import { SpatialHash } from '../collision/detection';
import { resolveAgentOverlap, clampToRect, clampToPolygon, isPointInPolygon } from '../collision/resolution';
import { arrival, separation, wander, obstacleAvoidance, followLeader, groupCohesion } from '../steering/behaviors';
import { getZonePolygon, getZoneWalls } from './transit';
import { combineSteeringPriority, type WeightedSteering } from '../steering/combiner';
import { ZoneGraph } from '../pathfinding/navigation';
import { WaypointNavigator } from '../pathfinding/waypointGraph';
import { selectNextZone, selectNextMedia, shouldSkip, computeEngagementDuration } from '../behavior/EngagementBehavior';
import { syncFollowerToLeader, getGroupDwellDuration, getCategorySkipMod, isFollower } from '../behavior/GroupBehavior';
import { generateSpawnBatch, getActiveTimeSlot, resetSpawnerIds } from '../spawner/VisitorSpawner';
import { distance } from '../utils/math';

/* ─── public types ─── */

export interface SimulationState {
  visitors: Map<string, Visitor>;
  groups: Map<string, VisitorGroup>;
  timeState: TimeState;
  phase: SimulationPhase;
}

export interface SimulationWorld {
  floors: readonly FloorConfig[];
  zones: readonly ZoneConfig[];
  media: readonly MediaPlacement[];
  config: SimulationConfig;
  globalFlowMode?: string;
  guidedUntilIndex?: number;
  waypointGraph?: WaypointGraph;
  totalVisitors?: number;  // 누적 입장 상한 (default: Infinity)
}

/* ─── engine ─── */

export class SimulationEngine {
  private state: SimulationState;
  private world: SimulationWorld;
  private rng: SeededRandom;
  private spatialHash: SpatialHash;
  private zoneGraph: ZoneGraph;
  private waypointNav: WaypointNavigator | null = null;

  // lookups
  private zoneMap = new Map<string, ZoneConfig>();
  private mediaByZone = new Map<string, MediaPlacement[]>();
  private nodeMap = new Map<string, WaypointNode>();
  private nodeCrowd = new Map<string, number>(); // node id → current visitor count

  // spawner
  private spawnAccumulator = 0;

  // cumulative counters
  private _totalSpawned = 0;
  private _totalExited = 0;
  private _spawnByNode = new Map<string, number>();  // entry node id → spawn count
  private _exitByNode = new Map<string, number>();   // exit node id → exit count

  // engagement timers (visitor id → remaining ms)
  private engagementTimers = new Map<string, number>();

  // per-tick media viewer counter (prevents same-tick race condition)
  private _tickMediaViewers = new Map<string, number>();

  // media analytics
  private _mediaStats = new Map<string, {
    watchCount: number;      // total visitors who watched
    skipCount: number;       // total visitors who skipped
    waitCount: number;       // total visitors who entered WAITING
    totalWatchMs: number;    // sum of watch durations
    totalWaitMs: number;     // sum of wait durations
    peakViewers: number;     // max simultaneous viewers
  }>();

  // track per-visitor watch start time for duration calc
  private _watchStartTimes = new Map<string, number>();

  // group caches (rebuilt each tick)
  private groupMemberPositions = new Map<string, Vector2D[]>();
  private tourLeaders: { position: Vector2D; radius: number }[] = [];

  // staged media state: tracks session timing per media
  private _stagedState = new Map<string, {
    phase: 'waiting' | 'running';   // waiting=accepting queue, running=session in progress
    sessionStartMs: number;         // when current session started
    nextSessionMs: number;          // when next session begins
    viewersInSession: number;       // how many entered this session
  }>();

  constructor(world: SimulationWorld) {
    this.world = world;
    this.rng = createSeededRandom(world.config.seed);
    this.spatialHash = new SpatialHash(world.config.physics.avoidanceRadius * 2);
    this.zoneGraph = new ZoneGraph();
    this.zoneGraph.buildFromZones(world.zones);

    for (const z of world.zones) this.zoneMap.set(z.id as string, z);
    for (const m of world.media) {
      const arr = this.mediaByZone.get(m.zoneId as string) ?? [];
      arr.push(m);
      this.mediaByZone.set(m.zoneId as string, arr);
    }

    // Initialize waypoint graph navigator
    if (world.waypointGraph && world.waypointGraph.nodes.length > 0) {
      this.waypointNav = new WaypointNavigator();
      this.waypointNav.buildFromGraph(world.waypointGraph);
      for (const node of world.waypointGraph.nodes) {
        this.nodeMap.set(node.id as string, node);
      }
    }

    // Initialize staged media state
    for (const m of world.media) {
      if ((m as any).interactionType === 'staged') {
        const interval = (m as any).stageIntervalMs ?? 60000;
        this._stagedState.set(m.id as string, {
          phase: 'waiting',
          sessionStartMs: 0,
          nextSessionMs: interval, // first session starts after one interval
          viewersInSession: 0,
        });
      }
    }

    resetSpawnerIds();

    this.state = {
      visitors: new Map(),
      groups: new Map(),
      timeState: {
        elapsed: 0, tickCount: 0,
        fixedDeltaTime: world.config.fixedDeltaTime,
        accumulator: 0, realTimeStart: 0,
      },
      phase: SIMULATION_PHASE.IDLE,
    };
  }

  /* ─── public API ─── */

  getState(): Readonly<SimulationState> { return this.state; }
  getWorld(): Readonly<SimulationWorld> { return this.world; }

  start() {
    this.state.phase = SIMULATION_PHASE.RUNNING;
    this.state.timeState = { ...this.state.timeState, realTimeStart: performance.now() };
  }
  pause() { this.state.phase = SIMULATION_PHASE.PAUSED; }
  resume() { if (this.state.phase === SIMULATION_PHASE.PAUSED) this.state.phase = SIMULATION_PHASE.RUNNING; }

  getVisitors(): Visitor[] { return Array.from(this.state.visitors.values()); }
  getActiveVisitors(): Visitor[] { return Array.from(this.state.visitors.values()).filter(v => v.isActive); }
  getGroups(): VisitorGroup[] { return Array.from(this.state.groups.values()); }
  getZoneGraph(): ZoneGraph { return this.zoneGraph; }
  getTotalSpawned(): number { return this._totalSpawned; }
  getTotalExited(): number { return this._totalExited; }
  getSpawnByNode(): ReadonlyMap<string, number> { return this._spawnByNode; }
  getExitByNode(): ReadonlyMap<string, number> { return this._exitByNode; }
  getMediaStats(): Map<string, { watchCount: number; skipCount: number; waitCount: number; totalWatchMs: number; totalWaitMs: number; peakViewers: number }> { return this._mediaStats; }

  private ensureMediaStats(mediaId: string) {
    if (!this._mediaStats.has(mediaId)) {
      this._mediaStats.set(mediaId, { watchCount: 0, skipCount: 0, waitCount: 0, totalWatchMs: 0, totalWaitMs: 0, peakViewers: 0 });
    }
    return this._mediaStats.get(mediaId)!;
  }

  /** Apply group dwell time multiplier if visitor is in a group */
  private applyGroupDwell(v: Visitor, baseDur: number): number {
    if (!v.groupId) return baseDur;
    const group = this.state.groups.get(v.groupId as string);
    if (!group) return baseDur;
    return getGroupDwellDuration(baseDur, group);
  }

  /** Update staged media session state */
  private tickStaged() {
    const elapsed = this.state.timeState.elapsed;
    for (const [mediaId, state] of this._stagedState) {
      const media = this.world.media.find(m => (m.id as string) === mediaId);
      if (!media) continue;
      const engagementMs = media.avgEngagementTimeMs;
      const interval = (media as any).stageIntervalMs ?? 60000;

      if (state.phase === 'waiting') {
        // Check if it's time to start a session
        if (elapsed >= state.nextSessionMs) {
          state.phase = 'running';
          state.sessionStartMs = elapsed;
          state.viewersInSession = 0;
        }
      } else if (state.phase === 'running') {
        // Check if session ended
        if (elapsed >= state.sessionStartMs + engagementMs) {
          state.phase = 'waiting';
          state.nextSessionMs = elapsed + interval;
          state.viewersInSession = 0;
        }
      }
    }
  }

  /** Check if a staged media is currently accepting viewers */
  private isStagedSessionOpen(mediaId: string): boolean {
    const state = this._stagedState.get(mediaId);
    if (!state) return false;
    return state.phase === 'running';
  }

  /** Record that a visitor started watching a media */
  private recordWatchStart(mediaId: string, visitorId: string) {
    const stats = this.ensureMediaStats(mediaId);
    stats.watchCount++;
    const currentViewers = this._tickMediaViewers.get(mediaId) ?? 0;
    if (currentViewers > stats.peakViewers) stats.peakViewers = currentViewers;
    this._watchStartTimes.set(visitorId, this.state.timeState.elapsed);
  }

  /** Record that a visitor finished watching a media */
  private recordWatchEnd(mediaId: string, visitorId: string) {
    const stats = this.ensureMediaStats(mediaId);
    const startTime = this._watchStartTimes.get(visitorId);
    if (startTime !== undefined) {
      stats.totalWatchMs += this.state.timeState.elapsed - startTime;
      this._watchStartTimes.delete(visitorId);
    }
  }

  /** Record that a visitor started waiting at a media */
  private recordWaitStart(mediaId: string) {
    const stats = this.ensureMediaStats(mediaId);
    stats.waitCount++;
  }

  /** Record that a visitor skipped a media */
  private recordSkip(mediaId: string, waitDurationMs: number) {
    const stats = this.ensureMediaStats(mediaId);
    stats.skipCount++;
    stats.totalWaitMs += waitDurationMs;
  }

  /* ─── main loop ─── */

  update(realDeltaMs: number) {
    if (this.state.phase !== SIMULATION_PHASE.RUNNING) return;

    const { fixedDeltaTime } = this.state.timeState;
    const scaledDelta = realDeltaMs * this.world.config.timeScale;
    let { accumulator, tickCount, elapsed } = this.state.timeState;
    accumulator += scaledDelta;

    while (accumulator >= fixedDeltaTime) {
      elapsed += fixedDeltaTime;
      tickCount++;
      this.tick(fixedDeltaTime);
      accumulator -= fixedDeltaTime;
    }

    this.state.timeState = { ...this.state.timeState, elapsed, tickCount, accumulator };
    if (elapsed >= this.world.config.duration) this.state.phase = SIMULATION_PHASE.COMPLETED;
  }

  private tick(dt: number) {
    const dtS = dt / 1000;
    this.spawnTick(dt);
    this.tickStaged();

    // rebuild spatial hash + media viewer counts + node crowd for this tick
    this.spatialHash.clear();
    this._tickMediaViewers.clear();
    this.nodeCrowd.clear();
    for (const [, v] of this.state.visitors) {
      if (!v.isActive) continue;
      this.spatialHash.insert(v.id, v.position);
      if (v.currentAction === VISITOR_ACTION.WATCHING && v.targetMediaId) {
        const mid = v.targetMediaId as string;
        this._tickMediaViewers.set(mid, (this._tickMediaViewers.get(mid) ?? 0) + 1);
      }
      // Track crowd at waypoint nodes
      if (v.currentNodeId) {
        const nid = v.currentNodeId as string;
        this.nodeCrowd.set(nid, (this.nodeCrowd.get(nid) ?? 0) + 1);
      }
    }

    // rebuild group caches
    this.groupMemberPositions.clear();
    this.tourLeaders = [];
    for (const [, g] of this.state.groups) {
      const positions: Vector2D[] = [];
      for (const mid of g.memberIds) {
        const m = this.state.visitors.get(mid as string);
        if (m?.isActive) positions.push(m.position);
      }
      this.groupMemberPositions.set(g.id as string, positions);
      if (g.type === 'guided') {
        const leader = this.state.visitors.get(g.leaderId as string);
        if (leader?.isActive) {
          this.tourLeaders.push({
            position: leader.position,
            radius: g.effectiveCollisionRadius ?? 60,
          });
        }
      }
    }

    const next = new Map<string, Visitor>();
    for (const [k, v] of this.state.visitors) {
      if (!v.isActive) { next.set(k, v); continue; }
      let a = this.stepBehavior(v, dt);
      a = this.stepSteering(a, dtS);
      a = this.stepPhysics(a, dtS);
      a = this.stepFollowerSnap(a);
      a = this.stepCollision(a);
      a = this.stepFatigue(a, dt);
      // Count newly deactivated
      if (!a.isActive) this._totalExited++;
      next.set(k, a);
    }
    this.state.visitors = next;

  }

  /* ═══════════════════════════════════════════════
   *  SPAWN
   * ═══════════════════════════════════════════════ */

  private spawnTick(dt: number) {
    const elapsed = this.state.timeState.elapsed;
    const slot = getActiveTimeSlot(this.world.config.timeSlots, elapsed);
    if (!slot || slot.spawnRatePerSecond <= 0) return;

    const activeCount = Array.from(this.state.visitors.values()).filter(v => v.isActive).length;
    if (activeCount >= this.world.config.maxVisitors) return;
    // 누적 입장 상한 체크
    const totalLimit = this.world.totalVisitors ?? Infinity;
    if (this._totalSpawned >= totalLimit) return;

    this.spawnAccumulator += slot.spawnRatePerSecond * (dt / 1000);

    while (this.spawnAccumulator >= 1) {
      // ═══ Graph-Point mode: spawn at ENTRY nodes ═══
      if (this.waypointNav) {
        const entryNode = this.waypointNav.selectEntryNode(this.rng);
        if (!entryNode) { this.spawnAccumulator -= 1; continue; }

        const dist = {
          totalCount: 1,
          profileWeights: slot.profileDistribution,
          engagementWeights: slot.engagementDistribution,
          groupRatio: slot.groupRatio,
          spawnRatePerSecond: slot.spawnRatePerSecond,
          categoryWeights: (slot as any).categoryDistribution ?? (this.world as any).categoryWeights,
        };
        const batch = generateSpawnBatch(1, dist, entryNode.position, entryNode.floorId, elapsed, this.rng);
        // Deduct actual spawned count from accumulator (groups spawn multiple)
        this.spawnAccumulator -= batch.visitors.length;
        for (const v of batch.visitors) {
          const spawned: Visitor = {
            ...v,
            currentZoneId: entryNode.zoneId ?? ('' as any),
            visitedZoneIds: entryNode.zoneId ? [entryNode.zoneId] : [],
            currentNodeId: entryNode.id,
            targetNodeId: null,
            pathLog: [{ nodeId: entryNode.id, entryTime: elapsed, exitTime: 0, duration: 0 }],
          };
          this.state.visitors.set(spawned.id as string, this.assignNextTarget(spawned));
          this._totalSpawned++;
          const eid = entryNode.id as string;
          this._spawnByNode.set(eid, (this._spawnByNode.get(eid) ?? 0) + 1);
        }
        for (const g of batch.groups) this.state.groups.set(g.id as string, g);
        continue;
      }

      // ═══ Legacy mode: zone-based spawning ═══
      let spawnZone: ZoneConfig | undefined;
      if (this.world.globalFlowMode === 'free') {
        const entranceZones = this.world.zones.filter(z =>
          z.type === 'entrance' || (z.type === 'gateway' && (z.gatewayMode ?? 'both') !== 'exit')
        );
        spawnZone = entranceZones.length > 0
          ? entranceZones[Math.floor(this.rng.next() * entranceZones.length)]
          : this.world.zones[0];
      } else {
        spawnZone = this.world.zones[0];
      }
      if (!spawnZone || spawnZone.gates.length === 0) continue;

      const spawnPos = {
        x: spawnZone.bounds.x + spawnZone.bounds.w / 2,
        y: spawnZone.bounds.y + spawnZone.bounds.h / 2,
      };

      const dist = {
        totalCount: 1,
        profileWeights: slot.profileDistribution,
        engagementWeights: slot.engagementDistribution,
        groupRatio: slot.groupRatio,
        spawnRatePerSecond: slot.spawnRatePerSecond,
        categoryWeights: (slot as any).categoryDistribution ?? (this.world as any).categoryWeights,
      };
      const gate = spawnZone.gates[0];
      const batch = generateSpawnBatch(1, dist, spawnPos, gate.floorId, elapsed, this.rng);
      this.spawnAccumulator -= batch.visitors.length;
      for (const v of batch.visitors) {
        const spawned: Visitor = {
          ...v,
          currentZoneId: spawnZone.id,
          visitedZoneIds: [spawnZone.id],
        };
        this.state.visitors.set(spawned.id as string, spawned);
        this._totalSpawned++;
      }
      for (const g of batch.groups) this.state.groups.set(g.id as string, g);
    }
  }

  /* ═══════════════════════════════════════════════
   *  BEHAVIOR — decision making
   * ═══════════════════════════════════════════════ */

  private stepBehavior(v: Visitor, dt: number): Visitor {
    const action = v.currentAction;

    // --- GROUP FOLLOWER: sync to leader ---
    if (isFollower(v)) {
      const group = this.state.groups.get(v.groupId as string);
      if (group) {
        const leader = this.state.visitors.get(group.leaderId as string);
        if (leader?.isActive) {
          return syncFollowerToLeader(v, leader, group);
        }
      }
    }

    // --- WATCHING: tick engagement timer ---
    if (action === VISITOR_ACTION.WATCHING) {
      const rem = (this.engagementTimers.get(v.id as string) ?? 0) - dt;
      if (rem > 0) {
        this.engagementTimers.set(v.id as string, rem);
        return v;
      }
      this.engagementTimers.delete(v.id as string);
      // Record watch end
      if (v.targetMediaId) this.recordWatchEnd(v.targetMediaId as string, v.id as string);
      // Move agent OUT of media rect to wait point before assigning next target
      const finishedMedia = v.targetMediaId ? this.world.media.find(m => m.id === v.targetMediaId) : null;
      const exitPos = finishedMedia ? this.getMediaWaitPoint(finishedMedia) : v.position;
      return this.assignNextTarget({
        ...v,
        currentAction: VISITOR_ACTION.IDLE,
        position: exitPos,
        visitedMediaIds: v.targetMediaId ? [...v.visitedMediaIds, v.targetMediaId] : v.visitedMediaIds,
        targetMediaId: null,
      });
    }

    // --- WAITING: check if spot opened OR skip ---
    if (action === VISITOR_ACTION.WAITING && v.waitStartedAt !== null) {
      // Check if capacity freed up → start watching
      if (v.targetMediaId) {
        const media = this.world.media.find(m => m.id === v.targetMediaId);
        if (media) {
          const mid = v.targetMediaId as string;
          const intType = (media as any).interactionType ?? 'passive';
          const viewerCount = this._tickMediaViewers.get(mid) ?? 0;
          const stagedOpen = intType !== 'staged' || this.isStagedSessionOpen(mid);
          if (viewerCount < media.capacity && stagedOpen) {
            this._tickMediaViewers.set(mid, viewerCount + 1);
            // Record: wait ended, watch started
            if (v.waitStartedAt) {
              const waitMs = this.state.timeState.elapsed - v.waitStartedAt;
              this.ensureMediaStats(mid).totalWaitMs += waitMs;
            }
            this.recordWatchStart(mid, v.id as string);
            let dur = computeEngagementDuration(media.avgEngagementTimeMs, v.profile.engagementLevel, v.fatigue, this.rng);
            dur = this.applyGroupDwell(v, dur);
            this.engagementTimers.set(v.id as string, dur);
            const usedSlots2 = this.getUsedMediaSlots(v.targetMediaId!);
            const slotIdx2 = this.findNextFreeSlot(media.capacity, usedSlots2);
            return {
              ...v,
              currentAction: VISITOR_ACTION.WATCHING,
              position: this.getMediaSlotPosition(media, slotIdx2),
              velocity: { x: 0, y: 0 },
              waitStartedAt: null,
            };
          }
        }
      }
      // Skip check
      const waitMs = this.state.timeState.elapsed - v.waitStartedAt;
      const { skipThreshold } = this.world.config;
      const attr = v.targetMediaId
        ? (this.world.media.find(m => m.id === v.targetMediaId)?.attractiveness ?? 0.5)
        : 0.5;
      const catSkipMod = getCategorySkipMod(v.category);
      if (shouldSkip(waitMs, v.profile.patience * catSkipMod, attr, skipThreshold.skipMultiplier, skipThreshold.maxWaitTimeMs)) {
        // Record skip
        if (v.targetMediaId) this.recordSkip(v.targetMediaId as string, waitMs);
        // Mark skipped media as visited so it won't be picked again
        const skippedMediaIds = v.targetMediaId
          ? [...v.visitedMediaIds, v.targetMediaId]
          : v.visitedMediaIds;
        return this.assignNextTarget({
          ...v,
          currentAction: VISITOR_ACTION.IDLE,
          targetMediaId: null,
          waitStartedAt: null,
          visitedMediaIds: skippedMediaIds,
        });
      }
      return v;
    }

    // --- IDLE: need a target ---
    if (action === VISITOR_ACTION.IDLE) {
      return this.assignNextTarget(v);
    }

    // --- MOVING / EXITING: check arrival ---
    if ((action === VISITOR_ACTION.MOVING || action === VISITOR_ACTION.EXITING) && v.steering.isArrived) {
      // Graph-Point mode: node arrival
      if (v.targetNodeId && this.waypointNav) {
        return this.onNodeArrival(v);
      }
      return this.onArrival(v);
    }

    // --- Graph-Point: node proximity check (snap to node when close) ---
    if (action === VISITOR_ACTION.MOVING && v.targetNodeId) {
      const node = this.nodeMap.get(v.targetNodeId as string);
      if (node) {
        const dx = v.position.x - node.position.x;
        const dy = v.position.y - node.position.y;
        const distSq = dx * dx + dy * dy;
        // HUB/ENTRY/BEND: 넓은 도착 판정 (통과점)
        const snapDist = (node.type === 'hub' || node.type === 'entry' || node.type === 'bend') ? 2500 : 625;
        if (distSq < snapDist) {
          return this.onNodeArrival({
            ...v,
            velocity: { x: 0, y: 0 },
            steering: { ...v.steering, isArrived: true },
          });
        }
      }
    }

    // --- Gate proximity check: cross gate if close enough (backup for arrival detection) ---
    if (action === VISITOR_ACTION.MOVING && v.targetZoneId && v.targetZoneId !== v.currentZoneId) {
      const target = this.getTargetPosition(v);
      if (target) {
        const dx = v.position.x - target.x;
        const dy = v.position.y - target.y;
        if (dx * dx + dy * dy < 900) { // 30px — force crossing
          return this.onArrival({ ...v, steering: { ...v.steering, isArrived: true } });
        }
      }
    }

    return v;
  }

  /**
   * Called when agent reaches its current target position.
   * Decides what happens next based on transit state.
   */
  private onArrival(v: Visitor): Visitor {
    // ── 1. Gate crossing: at gate → cross to connected zone ──
    if (v.targetZoneId && v.targetZoneId !== v.currentZoneId) {
      return this.crossGate(v);
    }

    // ── 2. Exiting: reached exit gate → deactivate ──
    if (v.currentAction === VISITOR_ACTION.EXITING && !v.targetZoneId) {
      return { ...v, isActive: false };
    }

    // ── 3. Media arrival ──
    if (v.targetMediaId) {
      const media = this.world.media.find(m => m.id === v.targetMediaId);
      if (media) {
        const mid = v.targetMediaId as string;
        const intType = (media as any).interactionType ?? 'passive';

        if (intType === 'staged') {
          // ── STAGED: session-based entry ──
          const viewerCount = this._tickMediaViewers.get(mid) ?? 0;
          if (this.isStagedSessionOpen(mid) && viewerCount < media.capacity) {
            // Session running + capacity available → enter
            this._tickMediaViewers.set(mid, viewerCount + 1);
            this.recordWatchStart(mid, v.id as string);
            const state = this._stagedState.get(mid)!;
            state.viewersInSession++;
            // Engagement = remaining session time
            const remaining = Math.max(1000, (state.sessionStartMs + media.avgEngagementTimeMs) - this.state.timeState.elapsed);
            this.engagementTimers.set(v.id as string, remaining);
            const slotPos = this.getMediaSlotPosition(media, viewerCount);
            return { ...v, currentAction: VISITOR_ACTION.WATCHING, position: slotPos, velocity: { x: 0, y: 0 } };
          }
          // Session not open or full → wait
          if (!v.waitStartedAt) {
            this.recordWaitStart(mid);
            return { ...v, currentAction: VISITOR_ACTION.WAITING, waitStartedAt: this.state.timeState.elapsed };
          }
          // Already waiting — check skip
          const waitMs = this.state.timeState.elapsed - v.waitStartedAt;
          const { skipThreshold } = this.world.config;
          if (shouldSkip(waitMs, v.profile.patience, media.attractiveness, skipThreshold.skipMultiplier, skipThreshold.maxWaitTimeMs)) {
            this.recordSkip(mid, waitMs);
            return this.assignNextTarget({ ...v, currentAction: VISITOR_ACTION.IDLE,
              visitedMediaIds: [...v.visitedMediaIds, v.targetMediaId], targetMediaId: null, waitStartedAt: null });
          }
          return v; // keep waiting
        }

        if (intType === 'passive') {
          // ── PASSIVE: arrive at viewing area → watch immediately ──
          // Soft capacity: if over capacity, try again next tick (don't mark visited)
          const viewerCount = this._tickMediaViewers.get(mid) ?? 0;
          if (viewerCount >= media.capacity) {
            // Over soft cap → wait briefly, try again (don't permanently skip)
            return { ...v, currentAction: VISITOR_ACTION.IDLE, targetMediaId: null };
          }
          // Watch at current position (wherever agent arrived in viewing area)
          this._tickMediaViewers.set(mid, viewerCount + 1);
          this.recordWatchStart(mid, v.id as string);
          let dur = computeEngagementDuration(media.avgEngagementTimeMs, v.profile.engagementLevel, v.fatigue, this.rng);
          dur = this.applyGroupDwell(v, dur);
          this.engagementTimers.set(v.id as string, dur);
          return {
            ...v,
            currentAction: VISITOR_ACTION.WATCHING,
            velocity: { x: 0, y: 0 },
            // Stay at current position — no teleport
          };
        } else if (intType === 'active') {
          // ── ACTIVE: slot-based, queue if full ──
          const viewerCount = this._tickMediaViewers.get(mid) ?? 0;
          if (viewerCount >= media.capacity) {
            this.recordWaitStart(mid);
            return { ...v, currentAction: VISITOR_ACTION.WAITING, waitStartedAt: this.state.timeState.elapsed };
          }
          this._tickMediaViewers.set(mid, viewerCount + 1);
          this.recordWatchStart(mid, v.id as string);
          let dur = computeEngagementDuration(media.avgEngagementTimeMs, v.profile.engagementLevel, v.fatigue, this.rng);
          dur = this.applyGroupDwell(v, dur);
          this.engagementTimers.set(v.id as string, dur);
          const slotPos = this.getMediaSlotPosition(media, viewerCount);
          return {
            ...v,
            currentAction: VISITOR_ACTION.WATCHING,
            position: slotPos,
            velocity: { x: 0, y: 0 },
          };
        }
      }
    }

    // ── 4. In target zone already → pick next ──
    return this.assignNextTarget({ ...v, currentAction: VISITOR_ACTION.IDLE });
  }

  /**
   * Cross a gate: teleport agent to connected gate position and enter new zone.
   * The agent walked to the gate in their current zone; now they appear on the other side.
   */
  private crossGate(v: Visitor): Visitor {
    // Find next hop via ZoneGraph path
    const path = this.zoneGraph.findPath(v.currentZoneId, v.targetZoneId!);
    const nextHop = path && path.length > 1 ? path[1] : v.targetZoneId!;

    // Find the connected gate in the next zone
    const edge = this.zoneGraph.getEdges(v.currentZoneId).find(
      e => (e.toZoneId as string) === (nextHop as string)
    );


    // Position agent slightly inside the new zone (30% from gate toward center)
    // to avoid collision pushing them back out at the boundary
    const center = this.zoneCenter(nextHop);
    let entryPos: Vector2D;
    if (edge) {
      const toNode = this.zoneGraph.getNode(nextHop);
      const entryGate = toNode?.gates.find(g => (g.id as string) === (edge.toGateId as string));
      const gatePos = entryGate?.position ?? center;
      entryPos = {
        x: gatePos.x + (center.x - gatePos.x) * 0.3,
        y: gatePos.y + (center.y - gatePos.y) * 0.3,
      };
    } else {
      entryPos = center;
    }

    const newVisitedZoneIds = v.visitedZoneIds.includes(nextHop)
      ? v.visitedZoneIds
      : [...v.visitedZoneIds, nextHop];

    // Enter new zone at connected gate position
    return this.assignNextTarget({
      ...v,
      currentZoneId: nextHop,
      position: entryPos,
      visitedZoneIds: newVisitedZoneIds,
      currentAction: VISITOR_ACTION.IDLE,
      lastGateTransitTime: this.state.timeState.elapsed,
      steering: { ...v.steering, isArrived: false },
    });
  }

  /** Find a gate by ID across all zones */
  private findGateById(gateId: GateId): Gate | null {
    for (const zone of this.world.zones) {
      const g = zone.gates.find(g => (g.id as string) === (gateId as string));
      if (g) return g;
    }
    return null;
  }

  /** Get zone center position */
  private zoneCenter(zoneId: ZoneId): Vector2D {
    const z = this.zoneMap.get(zoneId as string);
    if (!z) return { x: 0, y: 0 };
    return { x: z.bounds.x + z.bounds.w / 2, y: z.bounds.y + z.bounds.h / 2 };
  }

  /* ─── Media physics helpers ─── */

  private isMediaCircle(m: MediaPlacement): boolean {
    return (m as any).shape === 'circle';
  }

  /** Get media radius for circle shape (pixels) */
  private getMediaRadius(m: MediaPlacement): number {
    return Math.max(m.size.width, m.size.height) * MEDIA_SCALE / 2;
  }

  /** Get media bounding rect in canvas pixels */
  private getMediaRect(m: MediaPlacement): { x: number; y: number; w: number; h: number } {
    if (this.isMediaCircle(m)) {
      const r = this.getMediaRadius(m);
      return { x: m.position.x - r, y: m.position.y - r, w: r * 2, h: r * 2 };
    }
    const pw = m.size.width * MEDIA_SCALE;
    const ph = m.size.height * MEDIA_SCALE;
    return { x: m.position.x - pw / 2, y: m.position.y - ph / 2, w: pw, h: ph };
  }

  /** Get wall segments for obstacle avoidance (rect=4 walls, circle=8 segment polygon) */
  private getMediaWalls(m: MediaPlacement): { a: Vector2D; b: Vector2D }[] {
    if (this.isMediaCircle(m)) {
      const r = this.getMediaRadius(m);
      const cx = m.position.x, cy = m.position.y;
      const segs = 8;
      const walls: { a: Vector2D; b: Vector2D }[] = [];
      for (let i = 0; i < segs; i++) {
        const a1 = (i / segs) * Math.PI * 2;
        const a2 = ((i + 1) / segs) * Math.PI * 2;
        walls.push({
          a: { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r },
          b: { x: cx + Math.cos(a2) * r, y: cy + Math.sin(a2) * r },
        });
      }
      return walls;
    }
    const rect = this.getMediaRect(m);
    return [
      { a: { x: rect.x, y: rect.y }, b: { x: rect.x + rect.w, y: rect.y } },
      { a: { x: rect.x + rect.w, y: rect.y }, b: { x: rect.x + rect.w, y: rect.y + rect.h } },
      { a: { x: rect.x + rect.w, y: rect.y + rect.h }, b: { x: rect.x, y: rect.y + rect.h } },
      { a: { x: rect.x, y: rect.y + rect.h }, b: { x: rect.x, y: rect.y } },
    ];
  }

  /** Check if point is inside media (rect or circle) */
  private isInsideMedia(pos: Vector2D, m: MediaPlacement): boolean {
    if (this.isMediaCircle(m)) {
      const r = this.getMediaRadius(m);
      const dx = pos.x - m.position.x, dy = pos.y - m.position.y;
      return dx * dx + dy * dy < r * r;
    }
    const rect = this.getMediaRect(m);
    return pos.x > rect.x && pos.x < rect.x + rect.w && pos.y > rect.y && pos.y < rect.y + rect.h;
  }

  /** Push point outside media (rect or circle) */
  private pushOutsideMedia(pos: Vector2D, m: MediaPlacement): Vector2D {
    if (this.isMediaCircle(m)) {
      const r = this.getMediaRadius(m);
      const dx = pos.x - m.position.x, dy = pos.y - m.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      return { x: m.position.x + (dx / dist) * (r + 1), y: m.position.y + (dy / dist) * (r + 1) };
    }
    // Rect push — find nearest edge
    const rect = this.getMediaRect(m);
    const distL = pos.x - rect.x, distR = rect.x + rect.w - pos.x;
    const distT = pos.y - rect.y, distB = rect.y + rect.h - pos.y;
    const minDist = Math.min(distL, distR, distT, distB);
    if (minDist === distL) return { x: rect.x - 1, y: pos.y };
    if (minDist === distR) return { x: rect.x + rect.w + 1, y: pos.y };
    if (minDist === distT) return { x: pos.x, y: rect.y - 1 };
    return { x: pos.x, y: rect.y + rect.h + 1 };
  }

  /** Get slot indices currently occupied by WATCHING visitors at a media */
  private getUsedMediaSlots(mediaId: any): Set<number> {
    const media = this.world.media.find(m => m.id === mediaId);
    if (!media) return new Set();
    const watchers = Array.from(this.state.visitors.values()).filter(
      o => o.isActive && o.targetMediaId === mediaId && o.currentAction === VISITOR_ACTION.WATCHING,
    );
    const used = new Set<number>();
    for (const w of watchers) {
      // Find which slot this watcher is closest to
      let bestSlot = 0, bestDist = Infinity;
      for (let s = 0; s < media.capacity; s++) {
        const sp = this.getMediaSlotPosition(media, s);
        const dx = w.position.x - sp.x, dy = w.position.y - sp.y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; bestSlot = s; }
      }
      used.add(bestSlot);
    }
    return used;
  }

  /** Find the next free slot index */
  private findNextFreeSlot(capacity: number, usedSlots: Set<number>): number {
    for (let i = 0; i < capacity; i++) {
      if (!usedSlots.has(i)) return i;
    }
    return 0; // fallback
  }

  /** Get the watching position (on the media itself) — viewer stands ON the media */
  private getMediaWatchPoint(m: MediaPlacement): Vector2D {
    return m.position;
  }

  /** Get a specific slot position within the media rect for the nth viewer */
  private getMediaSlotPosition(m: MediaPlacement, slotIndex: number): Vector2D {
    const pw = m.size.width * MEDIA_SCALE;
    const ph = m.size.height * MEDIA_SCALE;
    const rad = (m.orientation * Math.PI) / 180;
    const cap = Math.max(1, m.capacity);

    // Distribute slots evenly across the media width
    const cols = Math.min(cap, Math.max(1, Math.floor(pw / 12)));
    const rows = Math.ceil(cap / cols);
    const col = slotIndex % cols;
    const row = Math.floor(slotIndex / cols);

    // Local offset from media center (before rotation)
    const localX = (col - (cols - 1) / 2) * (pw / Math.max(cols, 1));
    const localY = (row - (rows - 1) / 2) * (ph / Math.max(rows, 1));

    // Rotate by orientation
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      x: m.position.x + localX * cos - localY * sin,
      y: m.position.y + localX * sin + localY * cos,
    };
  }

  /** Get the passive viewing position — just in front of media (close) */
  private getMediaViewPoint(m: MediaPlacement): Vector2D {
    const halfDepth = (m.size.height * MEDIA_SCALE) / 2;
    const dist = halfDepth + 5; // just 5px outside the rect
    const rad = (m.orientation * Math.PI) / 180;
    return {
      x: m.position.x + Math.sin(rad) * dist,
      y: m.position.y - Math.cos(rad) * dist,
    };
  }

  /** Get the waiting position (in front of media, outside media rect) */
  private getMediaWaitPoint(m: MediaPlacement): Vector2D {
    // Distance = half of media depth + margin (ensure outside rect)
    const halfDepth = (m.size.height * MEDIA_SCALE) / 2;
    const margin = 15;
    const dist = halfDepth + margin;
    const rad = (m.orientation * Math.PI) / 180;
    return {
      x: m.position.x + Math.sin(rad) * dist,
      y: m.position.y - Math.cos(rad) * dist,
    };
  }

  /* ═══════════════════════════════════════════════
   *  TARGET ASSIGNMENT
   * ═══════════════════════════════════════════════ */

  private assignNextTarget(v: Visitor): Visitor {
    const curZone = this.zoneMap.get(v.currentZoneId as string) ?? null;
    const allZones = this.world.zones;
    const globalMode = this.world.globalFlowMode ?? 'free';

    // ═══ GRAPH-POINT MODE (primary) ═══
    if (this.waypointNav && v.currentNodeId) {
      return this.assignNextTargetGraph(v);
    }

    // ═══ LEGACY FREE MODE (fallback when no graph) ═══
    if (globalMode === 'free') {
      return this.assignNextTargetFree(v, curZone);
    }

    // ═══ SEQUENTIAL / HYBRID MODE (existing logic) ═══
    const spawnZone = allZones[0];
    const exitZone = allZones[allZones.length - 1];
    const middleZones = allZones.length > 2 ? allZones.slice(1, -1) : [];

    const visitedMiddleSet = new Set(
      v.visitedZoneIds.map(id => id as string).filter(id => middleZones.some(mz => (mz.id as string) === id)),
    );

    const guidedIdx = this.world.guidedUntilIndex ?? 0;
    const isSeq = globalMode === 'sequential' || (globalMode === 'hybrid' && visitedMiddleSet.size <= guidedIdx);

    const isInSpawnZone = curZone && spawnZone && (curZone.id as string) === (spawnZone.id as string);
    const isInLastZone = curZone && exitZone && (curZone.id as string) === (exitZone.id as string);

    // 1. Media in current zone FIRST (ALL zones except spawn zone)
    if (curZone && !isInSpawnZone) {
      const zMedia = this.mediaByZone.get(curZone.id as string) ?? [];
      const visited = new Set(v.visitedMediaIds.map(m => m as string));
      const unvisited = zMedia.filter(m => !visited.has(m.id as string));

      if (unvisited.length > 0) {
        const pick = curZone.flowType === 'guided'
          ? [...unvisited].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)[0]
          : this.world.media.find(m => m.id === selectNextMedia(v, zMedia, this.rng));
        if (pick) {
          return {
            ...v, targetMediaId: pick.id, currentAction: VISITOR_ACTION.MOVING,
            steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
          };
        }
      }

      // In last zone + media all done → exit
      if (isInLastZone) {
        return this.beginExit(v, curZone);
      }
    }

    // 2. Exhausted → head to last zone
    const allMiddleDone = middleZones.length === 0 || middleZones.every(z => visitedMiddleSet.has(z.id as string));
    if (!isSeq && v.fatigue > 0.9 && !isInLastZone && allMiddleDone) {
      return this.setExitTarget(v, exitZone);
    }

    // 3. Fatigued → rest
    if (!isSeq && v.fatigue > 0.7 && curZone?.type !== 'rest' && !isInLastZone) {
      const rest = middleZones.find(z => z.type === 'rest' && !v.visitedZoneIds.includes(z.id));
      if (rest) return this.setZoneTarget(v, rest);
    }

    // 4. Pick next zone
    let nextZoneId: any = null;

    if (middleZones.length === 0) {
      return this.setExitTarget(v, exitZone);
    }

    if (isSeq) {
      const nextInOrder = middleZones.find(z => !visitedMiddleSet.has(z.id as string));
      if (nextInOrder) {
        nextZoneId = nextInOrder.id;
      } else {
        return this.setExitTarget(v, exitZone);
      }
    } else {
      const allDone = middleZones.every(z => visitedMiddleSet.has(z.id as string));
      nextZoneId = selectNextZone(v, curZone ?? null, allZones, this.rng);

      if (nextZoneId && !allDone) {
        const isTargetLast = exitZone && (nextZoneId as string) === (exitZone.id as string);
        if (isTargetLast) {
          const rem = middleZones.filter(z => !visitedMiddleSet.has(z.id as string));
          nextZoneId = rem.length > 0 ? rem[Math.floor(this.rng.next() * rem.length)]!.id : null;
        }
      }

      if (!nextZoneId && allDone) {
        return this.setExitTarget(v, exitZone);
      }
    }

    if (nextZoneId) {
      return this.setZoneTarget(v, this.zoneMap.get(nextZoneId as string));
    }

    // Nothing to do → wander
    return {
      ...v, currentAction: VISITOR_ACTION.MOVING,
      steering: { ...v.steering, activeBehavior: STEERING_BEHAVIOR.WANDER },
    };
  }

  /** Helper: set a zone as the agent's movement target */
  private setZoneTarget(v: Visitor, zone: ZoneConfig | undefined): Visitor {
    if (!zone) return v;
    return {
      ...v,
      targetZoneId: zone.id,
      currentAction: VISITOR_ACTION.MOVING,
      steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
    };
  }

  /** Helper: set exit zone as target (EXITING action) */
  private setExitTarget(v: Visitor, zone: ZoneConfig | undefined): Visitor {
    if (!zone) return v;
    return {
      ...v,
      targetZoneId: zone.id,
      currentAction: VISITOR_ACTION.EXITING,
      steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
    };
  }

  /* ═══════════════════════════════════════════════
   *  FREE MODE — zone type based navigation
   * ═══════════════════════════════════════════════ */

  private assignNextTargetFree(v: Visitor, curZone: ZoneConfig | null): Visitor {
    const isInEntranceZone = curZone?.type === 'entrance' || curZone?.type === 'gateway';

    // 0. Corridor: pass through without stopping — find next gate toward destination
    if (curZone?.type === 'corridor') {
      // If we have a target zone, keep heading there. Otherwise pick an adjacent non-corridor zone.
      if (v.targetZoneId && v.targetZoneId !== v.currentZoneId) {
        return { ...v, currentAction: VISITOR_ACTION.MOVING,
          steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL } };
      }
      // No target: pick an adjacent non-corridor zone to visit
      const reachable = this.zoneGraph.getReachableZones(curZone.id)
        .map(zid => this.zoneMap.get(zid as string))
        .filter((z): z is ZoneConfig => !!z && z.type !== 'corridor');
      if (reachable.length > 0) {
        const pick = reachable[Math.floor(this.rng.next() * reachable.length)];
        return this.setZoneTarget(v, pick);
      }
    }

    // Check if all reachable non-entrance/corridor zones have been visited (BFS)
    const visitedSet = new Set(v.visitedZoneIds.map(id => id as string));
    const allReachableVisited = curZone
      ? this.zoneGraph.getAllReachableZones(curZone.id)
          .filter(zid => {
            const z = this.zoneMap.get(zid as string);
            return z && z.type !== 'entrance' && z.type !== 'gateway' && z.type !== 'corridor';
          })
          .every(zid => visitedSet.has(zid as string))
      : false;

    // Gateway(exit/both): exit only after exploring all reachable zones
    const gwMode = curZone?.gatewayMode ?? 'both';
    const isInExitZone = curZone?.type === 'exit'
      || (curZone?.type === 'gateway' && gwMode !== 'spawn' && v.visitedZoneIds.length > 1 && allReachableVisited);

    // 1. Media in current zone FIRST (skip entrance/corridor zones on first visit)
    const skipMedia = (isInEntranceZone && v.visitedZoneIds.length <= 1) || curZone?.type === 'corridor';
    if (curZone && !skipMedia) {
      const zMedia = this.mediaByZone.get(curZone.id as string) ?? [];
      const visited = new Set(v.visitedMediaIds.map(m => m as string));
      const unvisited = zMedia.filter(m => !visited.has(m.id as string));

      if (unvisited.length > 0) {
        const pick = curZone.flowType === 'guided'
          ? [...unvisited].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)[0]
          : this.world.media.find(m => m.id === selectNextMedia(v, this.mediaByZone.get(curZone.id as string) ?? [], this.rng));
        if (pick) {
          return {
            ...v, targetMediaId: pick.id, currentAction: VISITOR_ACTION.MOVING,
            steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
          };
        }
      }

      // In exit zone + media done → walk off-canvas
      if (isInExitZone) {
        return this.beginExit(v, curZone);
      }
    }

    // 2. Exhausted → head to nearest exit zone
    const exitZones = this.world.zones.filter(z =>
      z.type === 'exit' || (z.type === 'gateway' && (z.gatewayMode ?? 'both') !== 'spawn')
    );
    if (v.fatigue > 0.9 && !isInExitZone && exitZones.length > 0) {
      const nearest = this.findNearestZone(v.position, exitZones);
      if (nearest) return this.setExitTarget(v, nearest);
    }

    // 3. Fatigued → rest
    if (v.fatigue > 0.7 && curZone?.type !== 'rest') {
      const rest = this.world.zones.find(z => z.type === 'rest' && !v.visitedZoneIds.includes(z.id));
      if (rest) return this.setZoneTarget(v, rest);
    }

    // 4. Pick next zone: BFS reachable unvisited zones (skips corridors as destinations)
    if (curZone) {
      const allReachable = this.zoneGraph.getAllReachableZones(curZone.id);
      const unvisitedReachable = allReachable
        .filter(zid => !visitedSet.has(zid as string))
        .map(zid => this.zoneMap.get(zid as string))
        .filter((z): z is ZoneConfig => !!z && z.type !== 'entrance' && z.type !== 'gateway' && z.type !== 'corridor');

      if (unvisitedReachable.length > 0) {
        // Weighted random by attractiveness
        const totalAttr = unvisitedReachable.reduce((s, z) => s + (z.attractiveness ?? 0.5), 0);
        let roll = this.rng.next() * totalAttr;
        for (const z of unvisitedReachable) {
          roll -= z.attractiveness ?? 0.5;
          if (roll <= 0) return this.setZoneTarget(v, z);
        }
        return this.setZoneTarget(v, unvisitedReachable[0]);
      }
    }

    // 5. All reachable zones visited → head to exit
    if (exitZones.length > 0) {
      // Already in an exit-capable zone → begin exit immediately
      if (curZone && (curZone.type === 'exit' || (curZone.type === 'gateway' && gwMode !== 'spawn'))) {
        return this.beginExit(v, curZone);
      }
      const nearest = this.findNearestZone(v.position, exitZones);
      if (nearest) return this.setExitTarget(v, nearest);
    }

    // Fallback: wander
    return {
      ...v, currentAction: VISITOR_ACTION.MOVING,
      steering: { ...v.steering, activeBehavior: STEERING_BEHAVIOR.WANDER },
    };
  }

  /* ═══════════════════════════════════════════════
   *  GRAPH-POINT MODE — score-based node navigation
   * ═══════════════════════════════════════════════ */

  private assignNextTargetGraph(v: Visitor): Visitor {
    if (!this.waypointNav || !v.currentNodeId) return v;

    const curNode = this.waypointNav.getNode(v.currentNodeId);
    if (!curNode) return v;

    // 1. EXIT 노드 도착 → 퇴장 시퀀스
    if (curNode.type === 'exit') {
      return this.beginExitGraph(v, curNode);
    }

    // 2. HUB/BEND 노드 → 체류/미디어 없이 바로 다음 노드 선택
    if (curNode.type === 'hub' || curNode.type === 'bend') {
      // 바로 step 4 (다음 노드 선택)으로
    }

    // 3. 현재 노드에 zone이 있으면 미디어 체크 (HUB 제외)
    else if (curNode.zoneId && curNode.type !== 'entry' && curNode.type !== 'hub') {
      // ATTRACTOR: 직접 바인딩된 미디어 우선
      if (curNode.type === 'attractor' && curNode.mediaId) {
        const visited = new Set(v.visitedMediaIds.map(m => m as string));
        if (!visited.has(curNode.mediaId as string)) {
          const media = this.world.media.find(m => m.id === curNode.mediaId);
          if (media) {
            return {
              ...v,
              targetMediaId: media.id,
              targetNodeId: null,
              currentAction: VISITOR_ACTION.MOVING,
              steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
            };
          }
        }
      }

      // ZONE/REST: zone 내 미방문 미디어 탐색
      const zMedia = this.mediaByZone.get(curNode.zoneId as string) ?? [];
      const visited = new Set(v.visitedMediaIds.map(m => m as string));
      const unvisited = zMedia.filter(m => !visited.has(m.id as string));
      if (unvisited.length > 0) {
        const pick = this.world.media.find(m => m.id === selectNextMedia(v, zMedia, this.rng));
        if (pick) {
          return {
            ...v,
            targetMediaId: pick.id,
            targetNodeId: null,
            currentAction: VISITOR_ACTION.MOVING,
            steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
          };
        }
      }
    }

    // 3. dwellTime 체류 (미디어 없는 노드: rest, zone, attractor)
    if (curNode.dwellTimeMs > 0 && (curNode.type === 'rest' || curNode.type === 'zone' || curNode.type === 'attractor')) {
      // pathLog의 마지막 항목이 이 노드이고 exitTime=0이면 아직 체류 중
      const lastLog = v.pathLog[v.pathLog.length - 1];
      if (lastLog && (lastLog.nodeId as string) === (curNode.id as string) && lastLog.exitTime === 0) {
        const elapsed = this.state.timeState.elapsed - lastLog.entryTime;
        if (elapsed < curNode.dwellTimeMs) {
          // 체류 중 — WATCHING 상태로 대기
          return {
            ...v,
            currentAction: VISITOR_ACTION.WATCHING,
            velocity: { x: 0, y: 0 },
          };
        }
      }
    }

    // 4. 다음 노드 선택 (Score 기반)
    const nextNode = this.waypointNav.selectNextNode(v, v.currentNodeId, this.nodeCrowd, this.rng);
    if (!nextNode) {
      // 막다른 길: wander
      return {
        ...v, currentAction: VISITOR_ACTION.MOVING,
        steering: { ...v.steering, activeBehavior: STEERING_BEHAVIOR.WANDER },
      };
    }

    // pathLog 현재 노드 종료 기록
    const updatedPathLog = this.closePathLogEntry(v.pathLog, v.currentNodeId, this.state.timeState.elapsed);

    return {
      ...v,
      targetNodeId: nextNode.id,
      targetMediaId: null,
      targetZoneId: null,
      pathLog: updatedPathLog,
      currentAction: VISITOR_ACTION.MOVING,
      steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
    };
  }

  /** Graph mode: EXIT 노드 도착 → 즉시 비활성화 */
  private beginExitGraph(v: Visitor, exitNode: WaypointNode): Visitor {
    const xid = exitNode.id as string;
    this._exitByNode.set(xid, (this._exitByNode.get(xid) ?? 0) + 1);
    return { ...v, isActive: false };
  }

  /** Graph mode: visitor arrived at target node */
  private onNodeArrival(v: Visitor): Visitor {
    if (!v.targetNodeId || !this.waypointNav) return this.assignNextTarget(v);

    const targetNode = this.waypointNav.getNode(v.targetNodeId);
    if (!targetNode) return this.assignNextTarget(v);

    // Update zone if node is in a different zone
    const newZoneId = targetNode.zoneId ?? v.currentZoneId;
    const newVisitedZones = targetNode.zoneId && !v.visitedZoneIds.includes(targetNode.zoneId)
      ? [...v.visitedZoneIds, targetNode.zoneId]
      : v.visitedZoneIds;

    // Add pathLog entry for new node
    const newPathLog: PathLogEntry[] = [...v.pathLog, {
      nodeId: targetNode.id,
      entryTime: this.state.timeState.elapsed,
      exitTime: 0,
      duration: 0,
    }];

    return this.assignNextTarget({
      ...v,
      currentNodeId: targetNode.id,
      targetNodeId: null,
      currentZoneId: newZoneId,
      visitedZoneIds: newVisitedZones,
      currentAction: VISITOR_ACTION.IDLE,
      pathLog: newPathLog,
      steering: { ...v.steering, isArrived: false },
    });
  }

  /** Close the most recent pathLog entry for a node */
  private closePathLogEntry(pathLog: readonly PathLogEntry[], nodeId: WaypointId, now: number): PathLogEntry[] {
    const result = [...pathLog];
    for (let i = result.length - 1; i >= 0; i--) {
      if ((result[i].nodeId as string) === (nodeId as string) && result[i].exitTime === 0) {
        result[i] = { ...result[i], exitTime: now, duration: now - result[i].entryTime };
        break;
      }
    }
    return result;
  }

  /** Begin exit sequence: walk to exit gate then off-canvas */
  private beginExit(v: Visitor, curZone: ZoneConfig): Visitor {
    // Walk to exit gate, then deactivate on arrival
    return {
      ...v,
      targetZoneId: null,
      targetMediaId: null,
      currentAction: VISITOR_ACTION.EXITING,
      steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
    };
  }

  /** Find the nearest zone from a list by distance to agent position */
  private findNearestZone(pos: Vector2D, zones: ZoneConfig[]): ZoneConfig | null {
    let best: ZoneConfig | null = null;
    let bestDist = Infinity;
    for (const z of zones) {
      const cx = z.bounds.x + z.bounds.w / 2;
      const cy = z.bounds.y + z.bounds.h / 2;
      const d = (pos.x - cx) ** 2 + (pos.y - cy) ** 2;
      if (d < bestDist) { bestDist = d; best = z; }
    }
    return best;
  }

  /* ═══════════════════════════════════════════════
   *  TARGET POSITION — where should the agent walk?
   * ═══════════════════════════════════════════════ */

  private getTargetPosition(v: Visitor): Vector2D | null {
    // Graph-Point: target node position
    if (v.targetNodeId) {
      const node = this.nodeMap.get(v.targetNodeId as string);
      if (node) return node.position;
    }

    // 0. EXITING with no target → find exit gate of current zone
    if (v.currentAction === VISITOR_ACTION.EXITING && !v.targetZoneId) {
      const zone = this.zoneMap.get(v.currentZoneId as string);
      if (zone) {
        const exitGate = zone.gates.find(g => g.type === 'exit' || g.type === 'bidirectional') ?? zone.gates[0];
        if (exitGate) return exitGate.position;
      }
    }

    // 1. Media
    if (v.targetMediaId) {
      const m = this.world.media.find(m => m.id === v.targetMediaId);
      if (m) {
        if (v.currentAction === VISITOR_ACTION.WATCHING) return this.getMediaWatchPoint(m);
        const isPassive = (m as any).interactionType !== 'active';
        // PASSIVE → close to media front. ACTIVE → wait point (queue area).
        return isPassive ? this.getMediaViewPoint(m) : this.getMediaWaitPoint(m);
      }
    }

    // 3. Zone — need to find the exit gate of current zone
    if (v.targetZoneId) {
      if (v.currentZoneId && v.currentZoneId !== v.targetZoneId) {
        // Use ZoneGraph to find the right gate
        const gate = this.zoneGraph.findGate(v.currentZoneId, v.targetZoneId);
        if (gate) return gate.position;

        // Multi-hop
        const path = this.zoneGraph.findPath(v.currentZoneId, v.targetZoneId);
        if (path && path.length > 1) {
          const hop = this.zoneGraph.findGate(v.currentZoneId, path[1]);
          if (hop) return hop.position;
        }

        // Fallback: any exit/bidirectional gate
        const cz = this.zoneMap.get(v.currentZoneId as string);
        if (cz) {
          const fg = cz.gates.find(g => g.type === 'exit' || g.type === 'bidirectional');
          if (fg) return fg.position;
        }
      }

      // Already in target zone → zone center
      const tz = this.zoneMap.get(v.targetZoneId as string);
      if (tz) return { x: tz.bounds.x + tz.bounds.w / 2, y: tz.bounds.y + tz.bounds.h / 2 };
    }

    return null;
  }

  /* ═══════════════════════════════════════════════
   *  STEERING — compute forces
   * ═══════════════════════════════════════════════ */

  private stepSteering(v: Visitor, dtS: number): Visitor {
    if (v.currentAction === VISITOR_ACTION.WATCHING || v.currentAction === VISITOR_ACTION.WAITING) return v;

    const { physics } = this.world.config;
    const outputs: WeightedSteering[] = [];
    const target = this.getTargetPosition(v);

    if (target && v.steering.activeBehavior !== STEERING_BEHAVIOR.WANDER) {
      const dx = target.x - v.position.x, dy = target.y - v.position.y;
      const distSq = dx * dx + dy * dy;
      const headingToGate = !!(v.targetZoneId && v.targetZoneId !== v.currentZoneId);
      const isExiting = v.currentAction === VISITOR_ACTION.EXITING && !v.targetZoneId && !v.currentNodeId;
      const isGraphMoving = !!v.targetNodeId;

      if (!isGraphMoving && (headingToGate || isExiting)) {
        // Gate transit: seek at constant speed, no deceleration
        const dist = Math.sqrt(distSq);
        if (dist < 25) {
          return { ...v, steering: { ...v.steering, isArrived: true } };
        }
        const desired = { x: (dx / dist) * v.profile.maxSpeed, y: (dy / dist) * v.profile.maxSpeed };
        outputs.push({ output: { linear: { x: desired.x - v.velocity.x, y: desired.y - v.velocity.y }, angular: 0 }, weight: 1.0 });
      } else {
        // Media targets get larger arrival radius based on media size
        let effectiveArrival = physics.arrivalRadius;
        if (v.targetMediaId && !v.targetNodeId) {
          const tm = this.world.media.find(mm => mm.id === v.targetMediaId);
          if (tm) effectiveArrival = Math.max(physics.arrivalRadius, Math.max(tm.size.width, tm.size.height) * 10);
        }
        // Normal arrival with deceleration
        outputs.push({ output: arrival(v.position, target, v.profile.maxSpeed, v.velocity, physics.arrivalSlowRadius, effectiveArrival), weight: 1.0 });
        if (distSq < effectiveArrival * effectiveArrival) {
          return { ...v, steering: { ...v.steering, isArrived: true }, velocity: { x: 0, y: 0 } };
        }
      }
    } else {
      const { steering: ws, newWanderAngle } = wander(v.velocity, v.steering.wanderAngle, physics, (this.rng.next() - 0.5) * physics.wanderJitter * dtS);
      outputs.push({ output: ws, weight: 0.5 });
      return { ...v, steering: { ...v.steering, wanderAngle: newWanderAngle } };
    }

    // Wall avoidance — 그래프 이동 중에는 스킵 (크로스존 이동 시 잘못된 벽 회피 방지)
    if (v.currentZoneId && !v.targetNodeId) {
      const zone = this.zoneMap.get(v.currentZoneId as string);
      if (zone) {
        const walls = getZoneWalls(zone);
        const zoneMedia = this.mediaByZone.get(v.currentZoneId as string);
        if (zoneMedia) {
          for (const m of zoneMedia) {
            if (v.targetMediaId && (m.id as string) === (v.targetMediaId as string)) continue;
            if ((m as any).interactionType === 'passive') continue; // passive = no wall
            walls.push(...this.getMediaWalls(m));
          }
        }
        outputs.push({
          output: obstacleAvoidance(v.position, v.velocity, walls, physics.obstacleAvoidanceLookahead ?? 30, v.profile.maxForce),
          weight: 0.8,
        });
      }
    }

    // Separation (reduce force against same-group members)
    const neighbors = this.spatialHash.queryRadius(v.id, physics.avoidanceRadius);
    if (neighbors.length > 0) {
      const targetType = v.targetNodeId ? this.nodeMap.get(v.targetNodeId as string)?.type : null;
      const isPassThrough = targetType === 'exit' || targetType === 'hub' || targetType === 'entry' || targetType === 'bend';

      // Split neighbors: same-group vs others
      const sameGroupPositions: Vector2D[] = [];
      const otherPositions: Vector2D[] = [];
      for (const n of neighbors) {
        const nv = this.state.visitors.get(n.id as string);
        if (v.groupId && nv?.groupId === v.groupId) {
          sameGroupPositions.push(n.position);
        } else {
          otherPositions.push(n.position);
        }
      }
      // Full separation against non-group members
      if (otherPositions.length > 0) {
        outputs.push({
          output: separation(v.position, otherPositions, physics.avoidanceRadius, physics.separationStrength),
          weight: isPassThrough ? 0.1 : 0.5,
        });
      }
      // Reduced separation against same-group members (don't clip into each other, but stay close)
      if (sameGroupPositions.length > 0) {
        outputs.push({
          output: separation(v.position, sameGroupPositions, physics.avoidanceRadius * 0.5, physics.separationStrength * 0.3),
          weight: 0.15,
        });
      }
    }

    // Group steering: followLeader + groupCohesion
    if (v.groupId) {
      const group = this.state.groups.get(v.groupId as string);
      if (group) {
        if (v.category === 'guided_tour' && !v.isGroupLeader) {
          const leader = this.state.visitors.get(group.leaderId as string);
          if (leader?.isActive) {
            outputs.push({
              output: followLeader(v.position, leader.position, v.velocity, v.profile.maxSpeed, physics.followerArrivalRadius),
              weight: 2.0,
            });
          }
        } else if (v.category === 'small_group') {
          const memberPos = this.groupMemberPositions.get(v.groupId as string) ?? [];
          if (!v.isGroupLeader) {
            const leader = this.state.visitors.get(group.leaderId as string);
            if (leader?.isActive) {
              outputs.push({
                output: followLeader(v.position, leader.position, v.velocity, v.profile.maxSpeed, physics.followerArrivalRadius),
                weight: 1.5,
              });
            }
          }
          if (memberPos.length > 0) {
            outputs.push({
              output: groupCohesion(v.position, memberPos, v.velocity, v.profile.maxSpeed, group.cohesionStrength),
              weight: 0.5,
            });
          }
        }
      }
    }

    // Tour avoidance: non-tour visitors avoid guided tour groups
    if (v.category !== 'guided_tour') {
      for (const tour of this.tourLeaders) {
        const dist = distance(v.position, tour.position);
        if (dist < tour.radius + 20) {
          outputs.push({
            output: separation(v.position, [tour.position], tour.radius + 20, physics.separationStrength * 1.5),
            weight: 1.5,
          });
        }
      }
    }

    return { ...v, steering: { ...v.steering, currentSteering: combineSteeringPriority(outputs, v.profile.maxForce) } };
  }

  /* ═══════════════════════════════════════════════
   *  DIRECTION SNAP — redirect velocity toward target
   *  when heading away (angle > 90°)
   *  - Followers → snap toward leader position
   *  - Leaders/Solo → snap toward target node position
   * ═══════════════════════════════════════════════ */

  private stepFollowerSnap(v: Visitor): Visitor {
    if (v.currentAction === VISITOR_ACTION.WATCHING || v.currentAction === VISITOR_ACTION.WAITING) return v;

    const speed = Math.sqrt(v.velocity.x * v.velocity.x + v.velocity.y * v.velocity.y);
    if (speed < 0.1) return v;

    // Determine snap target position
    let targetX: number | null = null;
    let targetY: number | null = null;

    if (v.groupId && !v.isGroupLeader) {
      // Follower → snap toward leader
      const group = this.state.groups.get(v.groupId as string);
      if (group) {
        const leader = this.state.visitors.get(group.leaderId as string);
        if (leader?.isActive) {
          targetX = leader.position.x;
          targetY = leader.position.y;
        }
      }
    } else if (v.targetNodeId) {
      // Leader or solo → snap toward target node
      const node = this.nodeMap.get(v.targetNodeId as string);
      if (node) {
        targetX = node.position.x;
        targetY = node.position.y;
      }
    }

    if (targetX === null || targetY === null) return v;

    // Direction from me to target
    const toTargetX = targetX - v.position.x;
    const toTargetY = targetY - v.position.y;
    const dist = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

    if (dist < 5) return v; // already there

    // Normalize
    const tnx = toTargetX / dist;
    const tny = toTargetY / dist;

    // Dot product: velocity direction vs target direction
    const vnx = v.velocity.x / speed;
    const vny = v.velocity.y / speed;
    const dot = vnx * tnx + vny * tny;

    // dot < 0 means angle > 90° — heading away from target
    if (dot >= 0) return v;

    // Snap velocity direction toward target, keep speed
    return {
      ...v,
      velocity: { x: tnx * speed, y: tny * speed },
    };
  }

  /* ═══════════════════════════════════════════════
   *  PHYSICS — apply velocity
   * ═══════════════════════════════════════════════ */

  private stepPhysics(v: Visitor, dtS: number): Visitor {
    if (v.currentAction === VISITOR_ACTION.WATCHING || v.currentAction === VISITOR_ACTION.WAITING) return v;
    const { currentSteering } = v.steering;
    const ax = currentSteering.linear.x / v.profile.mass;
    const ay = currentSteering.linear.y / v.profile.mass;
    const vel = clampMagnitude(
      { x: v.velocity.x + ax * dtS, y: v.velocity.y + ay * dtS },
      v.profile.maxSpeed,
    );
    return {
      ...v,
      position: { x: v.position.x + vel.x * dtS, y: v.position.y + vel.y * dtS },
      velocity: vel,
    };
  }

  /* ═══════════════════════════════════════════════
   *  COLLISION — keep agents inside zones / floor
   * ═══════════════════════════════════════════════ */

  private stepCollision(v: Visitor): Visitor {
    // WATCHING/WAITING agents are stationary — skip all collision
    if (v.currentAction === VISITOR_ACTION.WATCHING || v.currentAction === VISITOR_ACTION.WAITING) return v;

    let pos = v.position;

    // Agent-agent overlap
    const neighbors = this.spatialHash.queryRadius(v.id, this.world.config.physics.avoidanceRadius);
    for (const n of neighbors) {
      pos = resolveAgentOverlap(pos, n.position, this.world.config.physics.avoidanceRadius * 0.5);
    }

    // Zone boundary collision
    // Graph agents in transit (moving between nodes): skip ALL zone wall collision
    // Graph agents at node: clamp to that node's zone
    // Legacy agents: full zone boundary + gate crossing logic
    const isGraphAgent = !!v.currentNodeId;
    const isGraphTransit = isGraphAgent && !!v.targetNodeId;
    if (isGraphTransit) {
      // Skip zone wall collision entirely — agent follows edge freely between nodes
    } else if (isGraphAgent && v.currentZoneId) {
      // Graph agent at rest — clamp to current zone
      const zone = this.zoneMap.get(v.currentZoneId as string);
      if (zone) {
        const poly = getZonePolygon(zone);
        if (!isPointInPolygon(pos, poly)) {
          const center = { x: zone.bounds.x + zone.bounds.w / 2, y: zone.bounds.y + zone.bounds.h / 2 };
          pos = clampToPolygon(pos, poly, center);
        }
      }
    } else if (v.currentZoneId) {
      const zone = this.zoneMap.get(v.currentZoneId as string);
      if (zone) {
        const poly = getZonePolygon(zone);
        if (!isPointInPolygon(pos, poly)) {
          // Legacy agents: check if near a connected gate
          let crossedGate: typeof zone.gates[number] | null = null;
          for (const gate of zone.gates) {
            const gdx = pos.x - gate.position.x;
            const gdy = pos.y - gate.position.y;
            if (gdx * gdx + gdy * gdy < 2500 && gate.connectedGateId) { // 50px near a connected gate
              crossedGate = gate;
              break;
            }
          }

          if (crossedGate && crossedGate.connectedGateId
              && (this.state.timeState.elapsed - v.lastGateTransitTime > 500)) {
            // Agent crossed through a connected gate → enter the connected zone (500ms cooldown)
            const newZoneId = this.zoneGraph.getZoneForGate(crossedGate.connectedGateId);
            if (newZoneId) {
              const connGate = this.findGateById(crossedGate.connectedGateId);
              const center = this.zoneCenter(newZoneId);
              const gatePos = connGate?.position ?? center;
              // Position 30% inside the new zone
              const entryPos = {
                x: gatePos.x + (center.x - gatePos.x) * 0.3,
                y: gatePos.y + (center.y - gatePos.y) * 0.3,
              };
              const newVisited = v.visitedZoneIds.includes(newZoneId)
                ? v.visitedZoneIds : [...v.visitedZoneIds, newZoneId];
              return this.assignNextTarget({
                ...v,
                currentZoneId: newZoneId,
                position: entryPos,
                visitedZoneIds: newVisited,
                currentAction: VISITOR_ACTION.IDLE,
                lastGateTransitTime: this.state.timeState.elapsed,
                steering: { ...v.steering, isArrived: false },
              });
            }
          }

          // Not near a connected gate — clamp back inside
          const center = { x: zone.bounds.x + zone.bounds.w / 2, y: zone.bounds.y + zone.bounds.h / 2 };
          pos = clampToPolygon(pos, poly, center);
        }
      }
    }
    // Media obstacle collision — push agent outside media (skip passive + skip target)
    if (v.currentZoneId) {
      const zoneMedia = this.mediaByZone.get(v.currentZoneId as string);
      if (zoneMedia) {
        for (const m of zoneMedia) {
          if (v.targetMediaId && (m.id as string) === (v.targetMediaId as string)) continue;
          if ((m as any).interactionType === 'passive') continue; // passive media = no physical barrier
          if (this.isInsideMedia(pos, m)) {
            pos = this.pushOutsideMedia(pos, m);
          }
        }
      }
    }

    // Tour group collision: push non-tour agents outside tour radius
    if (v.category !== 'guided_tour') {
      for (const tour of this.tourLeaders) {
        const dx = pos.x - tour.position.x;
        const dy = pos.y - tour.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < tour.radius && dist > 0.1) {
          const overlap = tour.radius - dist;
          pos = { x: pos.x + (dx / dist) * overlap, y: pos.y + (dy / dist) * overlap };
        }
      }
    }

    // Floor bounds — skip for EXITING agents so they walk off-canvas and deactivate
    if (v.currentAction !== VISITOR_ACTION.EXITING) {
      const floor = this.world.floors.find(f => f.id === v.currentFloorId);
      if (floor) pos = clampToRect(pos, { x: 0, y: 0, w: floor.canvas.width, h: floor.canvas.height });
    }

    return pos === v.position ? v : { ...v, position: pos };
  }

  /* ═══════════════════════════════════════════════
   *  FATIGUE
   * ═══════════════════════════════════════════════ */

  private stepFatigue(v: Visitor, dt: number): Visitor {
    const f = Math.min(1, v.fatigue + v.profile.fatigueRate * dt);
    return f === v.fatigue ? v : { ...v, fatigue: f };
  }
}
