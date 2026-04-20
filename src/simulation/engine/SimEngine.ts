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
  FloorId,
  SimulationConfig,
  TimeState,
  SimulationPhase,
  Vector2D,
  Gate,
  GateId,
  ZoneId,
  WaypointGraph,
  WaypointNode,
  WaypointId,
  PathLogEntry,
  ElevatorShaft,
  DensityGrid,
} from '@/domain';
import { SIMULATION_PHASE, VISITOR_ACTION, STEERING_BEHAVIOR, MEDIA_SCALE } from '@/domain';
import { createSeededRandom, type SeededRandom } from '../utils/random';
import { clampMagnitude } from '../utils/math';
import { SpatialHash } from '../collision/detection';
import { resolveAgentOverlap, clampToRect, clampToPolygon, isPointInPolygon, pushOutsidePolygon } from '../collision/resolution';
import { separation, wander, obstacleAvoidance, followLeader, groupCohesion } from '../steering/behaviors';
import { getZonePolygon, getZoneWalls } from './transit';
import { combineSteeringPriority, type WeightedSteering } from '../steering/combiner';
import { ZoneGraph } from '../pathfinding/navigation';
import { WaypointNavigator } from '../pathfinding/waypointGraph';
import { selectNextZone, selectNextMedia, shouldSkip, computeEngagementDuration } from '../behavior/EngagementBehavior';
import { syncFollowerToLeader, getGroupDwellDuration, getCategorySkipMod, isFollower } from '../behavior/GroupBehavior';
import { generateSpawnBatch, getActiveTimeSlot, resetSpawnerIds } from '../spawner/VisitorSpawner';
import { distance } from '../utils/math';
import { recordSkipEvent, recordMediaApproach, resetSkipTracking } from '@/analytics/calculators';

/* ═══════════════════════════════════════════════════════════════════
 *  SIM FEATURE FLAGS — 최소 파이프라인 디버깅용
 *  기본: 모두 OFF. "walk → watch → exit" 기본 흐름 확인 후 하나씩 ON.
 *  정리 시: grep "ENABLE_" 로 모든 사용처 찾아 false 블록 제거.
 * ═══════════════════════════════════════════════════════════════════ */
const ENABLE_OBSTACLE_AVOIDANCE = false; // zone 벽 / 미디어 벽 회피력
const ENABLE_SEPARATION         = false; // 에이전트 간 분리력 (steering)
const ENABLE_GROUP_STEERING     = false; // followLeader / groupCohesion
const ENABLE_TOUR_AVOIDANCE     = false; // guided_tour 회피력
const ENABLE_FOLLOWER_SNAP      = false; // stepFollowerSnap (velocity redirect)
const ENABLE_AGENT_OVERLAP      = true;  // stepCollision agent-agent push (겹침 방지)
const ENABLE_MEDIA_HITBOX       = true;  // stepCollision 미디어 박스 push-out (관통 방지)
const ENABLE_ZONE_CLAMP         = true;  // stepCollision zone polygon clamp (필수 — zone 이탈 방지)
const ENABLE_FLOOR_CLAMP        = true;  // stepCollision floor bounds clamp

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
  shafts?: readonly ElevatorShaft[];
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
  private zoneOccupancy = new Map<string, number>(); // zone id → current visitor count

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

  // per-tick media targeter counter (viewers + en-route + waiting)
  // used to hard-cap media selection so capacity is enforced at assignment time
  private _tickMediaTargeters = new Map<string, number>();

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

  // Shaft boarding state: shaftId → { visitorId → { startMs, endMs } }.
  // Agents past the portal capacity queue up (WATCHING without a boarding slot);
  // a slot opens when a boarding agent teleports out.
  private shaftBoarding = new Map<string, Map<string, { startMs: number; endMs: number }>>();

  // Cumulative visitor-seconds grid per floor. Feeds the report heatmap.
  // Monotonically grows over the run; never decays.
  private _densityGrids = new Map<string, {
    floorId: FloorId;
    originX: number; originY: number;
    cellPx: number; cols: number; rows: number;
    data: Float32Array;
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

    // Initialize per-floor density grids using each floor's bounds
    // (or bounding box of its zones as fallback).
    const CELL_PX = 24;
    for (const floor of world.floors) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      if (floor.bounds) {
        minX = floor.bounds.x; minY = floor.bounds.y;
        maxX = floor.bounds.x + floor.bounds.w;
        maxY = floor.bounds.y + floor.bounds.h;
      } else {
        for (const z of world.zones) {
          if (z.floorId !== floor.id) continue;
          minX = Math.min(minX, z.bounds.x);
          minY = Math.min(minY, z.bounds.y);
          maxX = Math.max(maxX, z.bounds.x + z.bounds.w);
          maxY = Math.max(maxY, z.bounds.y + z.bounds.h);
        }
      }
      if (!isFinite(minX)) continue;
      const pad = CELL_PX;
      const originX = minX - pad;
      const originY = minY - pad;
      const cols = Math.max(1, Math.ceil((maxX - minX + pad * 2) / CELL_PX));
      const rows = Math.max(1, Math.ceil((maxY - minY + pad * 2) / CELL_PX));
      this._densityGrids.set(floor.id as string, {
        floorId: floor.id,
        originX, originY,
        cellPx: CELL_PX, cols, rows,
        data: new Float32Array(cols * rows),
      });
    }

    resetSpawnerIds();
    resetSkipTracking();

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

  /**
   * Snapshot per-floor cumulative density grids (visitor-seconds per cell).
   * The returned Float32Arrays are references into engine state — callers
   * that need to persist across ticks should copy them.
   */
  getDensityGrids(): ReadonlyMap<string, DensityGrid> {
    return this._densityGrids;
  }

  /**
   * Per-shaft snapshot of boarding agents + queued agents at any of the shaft's portals.
   * Boarding = inside the elevator, counting down to teleport (has progress).
   * Queued = waiting for a boarding slot (no progress yet).
   */
  getShaftQueueState(): Map<string, {
    boarding: { visitorId: string; nodeId: string; progress: number }[];
    queued: { visitorId: string; nodeId: string }[];
  }> {
    const result = new Map<string, {
      boarding: { visitorId: string; nodeId: string; progress: number }[];
      queued: { visitorId: string; nodeId: string }[];
    }>();
    const now = this.state.timeState.elapsed;

    for (const shaft of this.world.shafts ?? []) {
      result.set(shaft.id as string, { boarding: [], queued: [] });
    }

    for (const v of this.state.visitors.values()) {
      if (!v.isActive) continue;
      if (v.currentAction !== VISITOR_ACTION.WATCHING) continue;
      if (!v.currentNodeId) continue;
      const node = this.nodeMap.get(v.currentNodeId as string);
      if (!node || node.type !== 'portal' || !node.shaftId) continue;

      const shaftId = node.shaftId as string;
      const bucket = result.get(shaftId);
      if (!bucket) continue;

      const slot = this.shaftBoarding.get(shaftId)?.get(v.id as string);
      if (slot) {
        const span = Math.max(1, slot.endMs - slot.startMs);
        const progress = Math.max(0, Math.min(1, (now - slot.startMs) / span));
        bucket.boarding.push({ visitorId: v.id as string, nodeId: v.currentNodeId as string, progress });
      } else {
        bucket.queued.push({ visitorId: v.id as string, nodeId: v.currentNodeId as string });
      }
    }

    return result;
  }

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

  /**
   * Drop boarding-pool entries for visitors no longer sitting at a shaft portal.
   * Keeps capacity accounting honest even if an agent gets rerouted out of a portal
   * without hitting the normal teleport-and-delete path.
   */
  private tickShaftBoardingJanitor() {
    for (const [shaftId, pool] of this.shaftBoarding) {
      for (const vid of Array.from(pool.keys())) {
        const v = this.state.visitors.get(vid);
        if (!v || !v.isActive) { pool.delete(vid); continue; }
        const node = v.currentNodeId ? this.nodeMap.get(v.currentNodeId as string) : null;
        if (!node || node.type !== 'portal' || (node.shaftId as string | undefined) !== shaftId) {
          pool.delete(vid);
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
  private recordSkip(mediaId: string, waitDurationMs: number, zoneId: string | null = null) {
    const stats = this.ensureMediaStats(mediaId);
    stats.skipCount++;
    stats.totalWaitMs += waitDurationMs;
    recordSkipEvent(mediaId, zoneId);
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
    this.tickShaftBoardingJanitor();

    // rebuild spatial hash + media viewer counts + node crowd for this tick
    this.spatialHash.clear();
    this._tickMediaViewers.clear();
    this._tickMediaTargeters.clear();
    this.nodeCrowd.clear();
    this.zoneOccupancy.clear();
    for (const [, v] of this.state.visitors) {
      if (!v.isActive) continue;
      this.spatialHash.insert(v.id, v.position);
      if (v.targetMediaId) {
        const mid = v.targetMediaId as string;
        this._tickMediaTargeters.set(mid, (this._tickMediaTargeters.get(mid) ?? 0) + 1);
      }
      if (v.currentAction === VISITOR_ACTION.WATCHING && v.targetMediaId) {
        const mid = v.targetMediaId as string;
        this._tickMediaViewers.set(mid, (this._tickMediaViewers.get(mid) ?? 0) + 1);
      }
      // Track crowd at waypoint nodes — only count agents actually staying
      // (RESTING/WATCHING/WAITING), not those in transit to next node.
      // Including in-transit agents would inflate crowd density and repel new arrivals
      // even when the node is functionally empty.
      if (v.currentNodeId && (
        v.currentAction === VISITOR_ACTION.RESTING ||
        v.currentAction === VISITOR_ACTION.WATCHING ||
        v.currentAction === VISITOR_ACTION.WAITING
      )) {
        const nid = v.currentNodeId as string;
        this.nodeCrowd.set(nid, (this.nodeCrowd.get(nid) ?? 0) + 1);
      }
      // Track zone occupancy
      if (v.currentZoneId) {
        const zid = v.currentZoneId as string;
        this.zoneOccupancy.set(zid, (this.zoneOccupancy.get(zid) ?? 0) + 1);
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
      a = this.stepFollowerTether(a);
      a = this.stepCollision(a);
      a = this.stepFatigue(a, dt);
      // Count newly deactivated
      if (!a.isActive) this._totalExited++;
      next.set(k, a);
    }
    this.state.visitors = next;

    // Accumulate visitor-seconds into the per-floor density grid.
    // Weight = dtS so a visitor standing still for 1 second adds 1.0 to its cell.
    for (const [, a] of next) {
      if (!a.isActive) continue;
      const grid = this._densityGrids.get(a.currentFloorId as string);
      if (!grid) continue;
      const cx = Math.floor((a.position.x - grid.originX) / grid.cellPx);
      const cy = Math.floor((a.position.y - grid.originY) / grid.cellPx);
      if (cx >= 0 && cx < grid.cols && cy >= 0 && cy < grid.rows) {
        grid.data[cy * grid.cols + cx] += dtS;
      }
    }
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
          // If leader is WATCHING media, follower walks toward it then watches
          if (leader.currentAction === VISITOR_ACTION.WATCHING && leader.targetMediaId) {
            const media = this.world.media.find(m => m.id === leader.targetMediaId);
            if (media) {
              // Already watching same media → keep
              if (v.currentAction === VISITOR_ACTION.WATCHING && v.targetMediaId === leader.targetMediaId) {
                return v;
              }
              // Follower walks toward media (MOVING), not teleport
              if (v.currentAction !== VISITOR_ACTION.MOVING || v.targetMediaId !== leader.targetMediaId) {
                return {
                  ...v,
                  currentAction: VISITOR_ACTION.MOVING,
                  targetMediaId: leader.targetMediaId,
                  targetPosition: this.computeMediaTargetPos(media),
                  targetZoneId: leader.currentZoneId,
                  steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
                };
              }
              // Already moving toward the media → let steering handle it
              return v;
            }
          }
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
        targetPosition: null,
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
            const watchPos = (intType === 'analog')
              ? this.getAnalogClosePosition(media, v.position)
              : (() => { const usedSlots2 = this.getUsedMediaSlots(v.targetMediaId!); const slotIdx2 = this.findNextFreeSlot(media.capacity, usedSlots2); return this.getMediaSlotPosition(media, slotIdx2); })();
            return {
              ...v,
              currentAction: VISITOR_ACTION.WATCHING,
              position: watchPos,
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
        if (v.targetMediaId) this.recordSkip(v.targetMediaId as string, waitMs, v.currentZoneId as string | null);
        // Mark skipped media as visited so it won't be picked again
        const skippedMediaIds = v.targetMediaId
          ? [...v.visitedMediaIds, v.targetMediaId]
          : v.visitedMediaIds;
        return this.assignNextTarget({
          ...v,
          currentAction: VISITOR_ACTION.IDLE,
          targetMediaId: null,
          targetPosition: null,
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

    // --- Graph-Point: node proximity check (trigger arrival but DON'T stop velocity) ---
    // 노드는 물리 장애물이 아니므로 도착 처리만 하고 속도는 유지 (자석처럼 멈추는 현상 방지)
    if (action === VISITOR_ACTION.MOVING && v.targetNodeId) {
      const node = this.nodeMap.get(v.targetNodeId as string);
      if (node) {
        const dx = v.position.x - node.position.x;
        const dy = v.position.y - node.position.y;
        const distSq = dx * dx + dy * dy;
        // EXIT: 20px (실제 도달 후 사라짐) / HUB/ENTRY/BEND: 50px (통과점) / ZONE/REST/ATTRACTOR: 25px
        const snapDist = node.type === 'exit' ? 400
          : (node.type === 'hub' || node.type === 'entry' || node.type === 'bend') ? 2500
          : 625;
        if (distSq < snapDist) {
          // velocity 유지 — 다음 노드로 자연스럽게 이어지도록 (isArrived 만 세팅)
          return this.onNodeArrival({
            ...v,
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
      return { ...v, isActive: false, exitedAt: this.state.timeState.elapsed };
    }

    // ── 3. Media arrival ──
    if (v.targetMediaId) {
      const media = this.world.media.find(m => m.id === v.targetMediaId);
      if (media) {
        const mid = v.targetMediaId as string;
        const intType = (media as any).interactionType ?? 'passive';

        // ── GROUP FOLLOWER arriving at leader's media: sync to leader's remaining time ──
        if (isFollower(v) && v.groupId) {
          const group = this.state.groups.get(v.groupId as string);
          if (group) {
            const leader = this.state.visitors.get(group.leaderId as string);
            if (leader?.isActive && leader.currentAction === VISITOR_ACTION.WATCHING && leader.targetMediaId === v.targetMediaId) {
              const leaderRem = this.engagementTimers.get(leader.id as string) ?? 0;
              if (leaderRem <= 0) {
                // Leader already done → skip watching, follow leader
                return { ...v, currentAction: VISITOR_ACTION.IDLE, targetMediaId: null, targetPosition: null };
              }
              this._tickMediaViewers.set(mid, (this._tickMediaViewers.get(mid) ?? 0) + 1);
              this.recordWatchStart(mid, v.id as string);
              this.engagementTimers.set(v.id as string, leaderRem); // sync to leader's remaining time
              // Active/staged: slot 위치로 snap (Phase C 에서 예약 시스템 개선 예정)
              // Passive/analog: 이미 targetPosition 에 도착 — position 유지
              const watchPos = intType === 'active' || intType === 'staged'
                ? this.getMediaSlotPosition(media, (this._tickMediaViewers.get(mid) ?? 1) - 1)
                : v.position;
              return {
                ...v,
                currentAction: VISITOR_ACTION.WATCHING,
                position: watchPos,
                velocity: { x: 0, y: 0 },
              };
            }
          }
        }

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
            // 이미 targetPosition (예약된 slot) 에 도착 — position 유지
            return { ...v, currentAction: VISITOR_ACTION.WATCHING, velocity: { x: 0, y: 0 } };
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
            this.recordSkip(mid, waitMs, v.currentZoneId as string | null);
            return this.assignNextTarget({ ...v, currentAction: VISITOR_ACTION.IDLE,
              visitedMediaIds: [...v.visitedMediaIds, v.targetMediaId], targetMediaId: null, targetPosition: null, waitStartedAt: null });
          }
          return v; // keep waiting
        }

        if (intType === 'analog') {
          // ── ANALOG: close-up viewing with soft capacity ──
          // Soft cap: auto-derived from physical viewing area (perimeter-based)
          // 4 sides × media size / 0.8 m² per person (or explicit capacity if set)
          const pwM = media.size.width, phM = media.size.height;
          const autoCap = Math.max(2, Math.floor((2 * (pwM + phM)) / 0.8));
          const softCap = Math.max(media.capacity || 0, autoCap);
          const viewerCount = this._tickMediaViewers.get(mid) ?? 0;
          if (viewerCount >= softCap) {
            // Over soft cap — skip this media, pick next target
            this.recordSkip(mid, 0, v.currentZoneId as string | null);
            return this.assignNextTarget({
              ...v,
              currentAction: VISITOR_ACTION.IDLE,
              visitedMediaIds: [...v.visitedMediaIds, v.targetMediaId],
              targetMediaId: null,
              targetPosition: null,
            });
          }
          this._tickMediaViewers.set(mid, viewerCount + 1);
          this.recordWatchStart(mid, v.id as string);
          let dur = computeEngagementDuration(media.avgEngagementTimeMs, v.profile.engagementLevel, v.fatigue, this.rng);
          dur = this.applyGroupDwell(v, dur);
          this.engagementTimers.set(v.id as string, dur);
          // Position: 이미 targetPosition (예약된 slot) 에 도착한 상태 — 덮어쓰지 않음
          return {
            ...v,
            currentAction: VISITOR_ACTION.WATCHING,
            velocity: { x: 0, y: 0 },
          };
        } else if (intType === 'passive') {
          // ── PASSIVE: arrive at targetPosition (= viewpoint) → watch at current position ──
          // targetPosition 불변 조건: 에이전트는 이미 정확한 viewpoint 에 도착해 있음.
          const viewerCount = this._tickMediaViewers.get(mid) ?? 0;
          if (viewerCount >= media.capacity) {
            this.recordSkip(mid, 0, v.currentZoneId as string | null);
            return this.assignNextTarget({
              ...v,
              currentAction: VISITOR_ACTION.IDLE,
              visitedMediaIds: [...v.visitedMediaIds, v.targetMediaId],
              targetMediaId: null,
              targetPosition: null,
            });
          }
          this._tickMediaViewers.set(mid, viewerCount + 1);
          this.recordWatchStart(mid, v.id as string);
          let dur = computeEngagementDuration(media.avgEngagementTimeMs, v.profile.engagementLevel, v.fatigue, this.rng);
          dur = this.applyGroupDwell(v, dur);
          this.engagementTimers.set(v.id as string, dur);
          return {
            ...v,
            currentAction: VISITOR_ACTION.WATCHING,
            velocity: { x: 0, y: 0 },
          };
        } else if (intType === 'active') {
          // ── ACTIVE: group reserves slots together, or queue as group ──
          const viewerCount = this._tickMediaViewers.get(mid) ?? 0;

          // Calculate how many slots this agent needs (self + group members)
          let groupSize = 1;
          if (v.groupId && v.isGroupLeader) {
            const group = this.state.groups.get(v.groupId as string);
            if (group) groupSize = group.memberIds.length;
          }

          if (viewerCount + groupSize > media.capacity) {
            // Not enough slots — enter queue. Patience check runs next tick via WAITING handler (lines ~575-617).
            if (!v.waitStartedAt) {
              this.recordWaitStart(mid);
              return { ...v, currentAction: VISITOR_ACTION.WAITING, waitStartedAt: this.state.timeState.elapsed };
            }
            const waitMs = this.state.timeState.elapsed - v.waitStartedAt;
            const { skipThreshold } = this.world.config;
            const catSkipMod = getCategorySkipMod(v.category);
            if (shouldSkip(waitMs, v.profile.patience * catSkipMod, media.attractiveness, skipThreshold.skipMultiplier, skipThreshold.maxWaitTimeMs)) {
              this.recordSkip(mid, waitMs, v.currentZoneId as string | null);
              return this.assignNextTarget({
                ...v,
                currentAction: VISITOR_ACTION.IDLE,
                visitedMediaIds: [...v.visitedMediaIds, v.targetMediaId],
                targetMediaId: null,
                targetPosition: null,
                waitStartedAt: null,
              });
            }
            return v; // keep waiting
          }

          // Reserve slot for leader
          this._tickMediaViewers.set(mid, viewerCount + 1);
          if (v.waitStartedAt) {
            const waitMs = this.state.timeState.elapsed - v.waitStartedAt;
            this.ensureMediaStats(mid).totalWaitMs += waitMs;
          }
          this.recordWatchStart(mid, v.id as string);
          let dur = computeEngagementDuration(media.avgEngagementTimeMs, v.profile.engagementLevel, v.fatigue, this.rng);
          dur = this.applyGroupDwell(v, dur);
          this.engagementTimers.set(v.id as string, dur);

          // Pre-reserve slots for followers (they'll sync via syncFollowerToLeader)
          if (v.groupId && v.isGroupLeader) {
            const group = this.state.groups.get(v.groupId as string);
            if (group) {
              let slotIdx = viewerCount + 1;
              for (const memberId of group.memberIds) {
                if ((memberId as string) === (v.id as string)) continue; // skip leader
                const follower = this.state.visitors.get(memberId as string);
                if (!follower?.isActive) continue;
                this._tickMediaViewers.set(mid, slotIdx + 1);
                this.recordWatchStart(mid, memberId as string);
                this.engagementTimers.set(memberId as string, dur);
                slotIdx++;
              }
            }
          }

          return {
            ...v,
            currentAction: VISITOR_ACTION.WATCHING,
            velocity: { x: 0, y: 0 },
            waitStartedAt: null,
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

  private isMediaEllipse(m: MediaPlacement): boolean {
    return (m as any).shape === 'ellipse';
  }

  private isMediaPolygon(m: MediaPlacement): boolean {
    return (m as any).shape === 'custom' && m.polygon != null && m.polygon.length > 2;
  }

  /** Generate polygon vertices (world coords) for ellipse media — for walls/rasterization */
  private getMediaEllipseWorldPolygon(m: MediaPlacement, segments = 16): Vector2D[] {
    const a = m.size.width * MEDIA_SCALE / 2;
    const b = m.size.height * MEDIA_SCALE / 2;
    const rad = (m.orientation * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const pts: Vector2D[] = [];
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const lx = Math.cos(t) * a, ly = Math.sin(t) * b;
      pts.push({
        x: m.position.x + lx * cos - ly * sin,
        y: m.position.y + lx * sin + ly * cos,
      });
    }
    return pts;
  }

  /** Transform polygon from center-relative local coords to world coords */
  private getMediaWorldPolygon(m: MediaPlacement): Vector2D[] {
    const poly = m.polygon!;
    const rad = (m.orientation * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return poly.map(p => ({
      x: m.position.x + p.x * cos - p.y * sin,
      y: m.position.y + p.x * sin + p.y * cos,
    }));
  }

  /** Get media radius for circle shape (pixels) */
  private getMediaRadius(m: MediaPlacement): number {
    return Math.max(m.size.width, m.size.height) * MEDIA_SCALE / 2;
  }

  /** Get media bounding rect in canvas pixels */
  private getMediaRect(m: MediaPlacement): { x: number; y: number; w: number; h: number } {
    if (this.isMediaPolygon(m)) {
      const wp = this.getMediaWorldPolygon(m);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of wp) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    if (this.isMediaCircle(m)) {
      const r = this.getMediaRadius(m);
      return { x: m.position.x - r, y: m.position.y - r, w: r * 2, h: r * 2 };
    }
    if (this.isMediaEllipse(m)) {
      const wp = this.getMediaEllipseWorldPolygon(m);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of wp) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    const pw = m.size.width * MEDIA_SCALE;
    const ph = m.size.height * MEDIA_SCALE;
    return { x: m.position.x - pw / 2, y: m.position.y - ph / 2, w: pw, h: ph };
  }

  /** Get 4 world-space corners of rect media, respecting orientation */
  private getMediaRectCorners(m: MediaPlacement): Vector2D[] {
    const pw = m.size.width * MEDIA_SCALE;
    const ph = m.size.height * MEDIA_SCALE;
    const hw = pw / 2, hh = ph / 2;
    const rad = (m.orientation * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const local = [
      { x: -hw, y: -hh },
      { x:  hw, y: -hh },
      { x:  hw, y:  hh },
      { x: -hw, y:  hh },
    ];
    return local.map(p => ({
      x: m.position.x + p.x * cos - p.y * sin,
      y: m.position.y + p.x * sin + p.y * cos,
    }));
  }

  /** True if rect media has a non-axis-aligned orientation */
  private isRectRotated(m: MediaPlacement): boolean {
    const o = ((m.orientation % 360) + 360) % 360;
    return o !== 0 && o !== 180;
  }

  /** Effective capacity for hard-cap selection filtering.
   *  Matches the cap used at WATCHING entry in stepBehavior:
   *  - analog: soft cap derived from perimeter (fallback to declared capacity)
   *  - passive/active/staged: declared capacity
   */
  private effectiveMediaCapacity(m: MediaPlacement): number {
    const intType = (m as any).interactionType ?? 'passive';
    if (intType === 'analog') {
      const pwM = m.size.width, phM = m.size.height;
      const autoCap = Math.max(2, Math.floor((2 * (pwM + phM)) / 0.8));
      return Math.max(m.capacity || 0, autoCap);
    }
    return Math.max(1, m.capacity || 1);
  }

  /** Filter media candidates to those with free capacity (viewers + en-route targeters). */
  private filterAvailableMedia(zMedia: readonly MediaPlacement[]): MediaPlacement[] {
    return zMedia.filter(m => {
      const mid = m.id as string;
      const occ = this._tickMediaTargeters.get(mid) ?? 0;
      return occ < this.effectiveMediaCapacity(m);
    });
  }

  /** Get wall segments for obstacle avoidance (rect=4 walls, circle=8 segment polygon, custom=polygon edges) */
  private getMediaWalls(m: MediaPlacement): { a: Vector2D; b: Vector2D }[] {
    if (this.isMediaPolygon(m)) {
      const wp = this.getMediaWorldPolygon(m);
      const walls: { a: Vector2D; b: Vector2D }[] = [];
      for (let i = 0; i < wp.length; i++) {
        walls.push({ a: wp[i], b: wp[(i + 1) % wp.length] });
      }
      return walls;
    }
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
    if (this.isMediaEllipse(m)) {
      const wp = this.getMediaEllipseWorldPolygon(m);
      const walls: { a: Vector2D; b: Vector2D }[] = [];
      for (let i = 0; i < wp.length; i++) {
        walls.push({ a: wp[i], b: wp[(i + 1) % wp.length] });
      }
      return walls;
    }
    if (this.isRectRotated(m)) {
      const c = this.getMediaRectCorners(m);
      return [
        { a: c[0], b: c[1] },
        { a: c[1], b: c[2] },
        { a: c[2], b: c[3] },
        { a: c[3], b: c[0] },
      ];
    }
    const rect = this.getMediaRect(m);
    return [
      { a: { x: rect.x, y: rect.y }, b: { x: rect.x + rect.w, y: rect.y } },
      { a: { x: rect.x + rect.w, y: rect.y }, b: { x: rect.x + rect.w, y: rect.y + rect.h } },
      { a: { x: rect.x + rect.w, y: rect.y + rect.h }, b: { x: rect.x, y: rect.y + rect.h } },
      { a: { x: rect.x, y: rect.y + rect.h }, b: { x: rect.x, y: rect.y } },
    ];
  }

  /** Check if point is inside media (rect, circle, or polygon) */
  private isInsideMedia(pos: Vector2D, m: MediaPlacement): boolean {
    if (this.isMediaPolygon(m)) {
      const wp = this.getMediaWorldPolygon(m);
      return isPointInPolygon(pos, wp);
    }
    if (this.isMediaCircle(m)) {
      const r = this.getMediaRadius(m);
      const dx = pos.x - m.position.x, dy = pos.y - m.position.y;
      return dx * dx + dy * dy < r * r;
    }
    if (this.isMediaEllipse(m)) {
      const a = m.size.width * MEDIA_SCALE / 2;
      const b = m.size.height * MEDIA_SCALE / 2;
      const rad = (m.orientation * Math.PI) / 180;
      const dx = pos.x - m.position.x, dy = pos.y - m.position.y;
      const lx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
      const ly = dx * Math.sin(-rad) + dy * Math.cos(-rad);
      return (lx * lx) / (a * a) + (ly * ly) / (b * b) < 1;
    }
    if (this.isRectRotated(m)) {
      return isPointInPolygon(pos, this.getMediaRectCorners(m));
    }
    const rect = this.getMediaRect(m);
    return pos.x > rect.x && pos.x < rect.x + rect.w && pos.y > rect.y && pos.y < rect.y + rect.h;
  }

  /** Push point outside media (rect, circle, or polygon) */
  private pushOutsideMedia(pos: Vector2D, m: MediaPlacement): Vector2D {
    if (this.isMediaPolygon(m)) {
      const wp = this.getMediaWorldPolygon(m);
      return pushOutsidePolygon(pos, wp, m.position);
    }
    if (this.isMediaCircle(m)) {
      const r = this.getMediaRadius(m);
      const dx = pos.x - m.position.x, dy = pos.y - m.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      return { x: m.position.x + (dx / dist) * (r + 1), y: m.position.y + (dy / dist) * (r + 1) };
    }
    if (this.isMediaEllipse(m)) {
      const a = m.size.width * MEDIA_SCALE / 2;
      const b = m.size.height * MEDIA_SCALE / 2;
      const rad = (m.orientation * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const dx = pos.x - m.position.x, dy = pos.y - m.position.y;
      const lx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
      const ly = dx * Math.sin(-rad) + dy * Math.cos(-rad);
      const k = Math.sqrt((lx * lx) / (a * a) + (ly * ly) / (b * b)) || 1;
      const r = Math.sqrt(lx * lx + ly * ly) || 1;
      const scale = (r / k + 1) / r;
      const outLx = lx * scale, outLy = ly * scale;
      return {
        x: m.position.x + outLx * cos - outLy * sin,
        y: m.position.y + outLx * sin + outLy * cos,
      };
    }
    if (this.isRectRotated(m)) {
      return pushOutsidePolygon(pos, this.getMediaRectCorners(m), m.position);
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
    const rad = (m.orientation * Math.PI) / 180;
    const cap = Math.max(1, m.capacity);

    // For polygon shapes, use AABB of local polygon for slot distribution
    let pw: number, ph: number;
    if (this.isMediaPolygon(m)) {
      const poly = m.polygon!;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of poly) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      pw = maxX - minX;
      ph = maxY - minY;
    } else {
      pw = m.size.width * MEDIA_SCALE;
      ph = m.size.height * MEDIA_SCALE;
    }

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

  /** Get the passive viewing position — viewDistance meters in front of media front edge */
  private getMediaViewPoint(m: MediaPlacement): Vector2D {
    let halfDepth: number;
    if (this.isMediaPolygon(m)) {
      const poly = m.polygon!;
      let maxY = -Infinity;
      for (const p of poly) if (Math.abs(p.y) > maxY) maxY = Math.abs(p.y);
      halfDepth = maxY;
    } else {
      halfDepth = (m.size.height * MEDIA_SCALE) / 2;
    }
    // viewDistance (meters) = 미디어 "앞면"으로부터 관람자까지 거리 (중심 아님)
    const viewDistPx = (m as any).viewDistance != null
      ? halfDepth + (m as any).viewDistance * MEDIA_SCALE
      : halfDepth + 5;
    const rad = (m.orientation * Math.PI) / 180;
    const pt = {
      x: m.position.x + Math.sin(rad) * viewDistPx,
      y: m.position.y - Math.cos(rad) * viewDistPx,
    };
    return this.clampToMediaZone(m, pt);
  }

  /**
   * 미디어 선택 시점에 최종 WATCHING 위치를 계산 및 예약.
   * - PASSIVE: getMediaViewPoint (viewDistance 앞)
   * - ANALOG: 현재 다른 에이전트가 점유하지 않은 perimeter slot 반환 (softCap 기준)
   * - ACTIVE/STAGED: null (Phase C 에서 slot 예약 시스템 확장 예정)
   */
  private computeMediaTargetPos(m: MediaPlacement): Vector2D | null {
    const intType = (m as any).interactionType ?? 'passive';
    if (intType === 'passive') return this.pickPassiveSlot(m);
    if (intType === 'analog') return this.pickAnalogSlot(m);
    if (intType === 'active' || intType === 'staged') return this.pickMediaSlot(m);
    return null;
  }

  /**
   * Passive 미디어 관람 slot 을 분산 배치하여 반환.
   * 미디어 앞쪽에 viewDistance 만큼 떨어진 지점을 기준으로
   * width 를 따라 여러 slot 을 만들고, 과밀 시 뒤쪽으로도 행 확장.
   * 다른 MOVING/WATCHING 에이전트가 예약한 slot 과 겹치지 않는 첫 free slot 반환.
   */
  private pickPassiveSlot(m: MediaPlacement): Vector2D {
    const mid = m.id as string;
    const cap = Math.max(1, this.effectiveMediaCapacity(m));

    // Collect occupied positions
    const occupied: Vector2D[] = [];
    for (const [, other] of this.state.visitors) {
      if (!other.isActive) continue;
      if ((other.targetMediaId as string) !== mid) continue;
      if (other.currentAction === VISITOR_ACTION.WATCHING) {
        occupied.push(other.position);
      } else if (other.targetPosition) {
        occupied.push(other.targetPosition);
      }
    }

    const MIN_DIST_SQ = 14 * 14;
    for (let i = 0; i < cap; i++) {
      const slotPos = this.getPassiveSlotPosition(m, i, cap);
      let free = true;
      for (const op of occupied) {
        const dx = slotPos.x - op.x, dy = slotPos.y - op.y;
        if (dx * dx + dy * dy < MIN_DIST_SQ) { free = false; break; }
      }
      if (free) return slotPos;
    }
    return this.getPassiveSlotPosition(m, 0, cap);
  }

  /** Passive slot 위치 — 미디어 앞 width 방향으로 분산, 과밀 시 뒤쪽으로 행 추가. */
  private getPassiveSlotPosition(m: MediaPlacement, slotIndex: number, cap: number): Vector2D {
    const pw = m.size.width * MEDIA_SCALE;
    const ph = m.size.height * MEDIA_SCALE;
    const halfDepth = ph / 2;
    const viewDistPx = (m as any).viewDistance != null
      ? (m as any).viewDistance * MEDIA_SCALE
      : 5;

    // 1m = 20px 기준, slot 간 최소 간격 14px(=0.7m)
    const SPACING = 14;
    const usableWidth = Math.max(SPACING, pw - SPACING);
    const cols = Math.max(1, Math.min(cap, Math.floor(usableWidth / SPACING) + 1));
    const rows = Math.ceil(cap / cols);
    const col = slotIndex % cols;
    const row = Math.floor(slotIndex / cols);

    // Local offset: X spread across width, Y = front depth + row offset behind
    const localX = cols === 1 ? 0 : (col / (cols - 1) - 0.5) * usableWidth;
    const localY = -(halfDepth + viewDistPx + row * SPACING);

    const rad = (m.orientation * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const pt = {
      x: m.position.x + localX * cos - localY * sin,
      y: m.position.y + localX * sin + localY * cos,
    };
    return this.clampToMediaZone(m, pt);
  }

  /**
   * Active/Staged 미디어의 빈 slot 을 예약. 다른 에이전트가 현재 점유(WATCHING) 하거나
   * 이동 중(targetPosition) 인 slot 은 제외하고, 가장 낮은 free idx 의 위치 반환.
   * 모든 slot 이 점유된 경우 slot 0 반환 (onArrival capacity 체크에서 skip 됨).
   */
  private pickMediaSlot(m: MediaPlacement): Vector2D {
    const mid = m.id as string;
    const cap = Math.max(1, m.capacity);
    // Collect reserved slot indices by comparing targetPosition/position to each slot
    const reserved = new Set<number>();
    for (const [, other] of this.state.visitors) {
      if (!other.isActive) continue;
      if ((other.targetMediaId as string) !== mid) continue;
      const ref = other.currentAction === VISITOR_ACTION.WATCHING
        ? other.position
        : other.targetPosition;
      if (!ref) continue;
      for (let i = 0; i < cap; i++) {
        const sp = this.getMediaSlotPosition(m, i);
        const dx = sp.x - ref.x, dy = sp.y - ref.y;
        if (dx * dx + dy * dy < 36) { reserved.add(i); break; } // within 6px = same slot
      }
    }
    for (let i = 0; i < cap; i++) {
      if (!reserved.has(i)) return this.getMediaSlotPosition(m, i);
    }
    return this.getMediaSlotPosition(m, 0);
  }

  /**
   * Analog 미디어의 빈 perimeter slot 을 찾아 반환.
   * 다른 MOVING/WATCHING 에이전트의 targetPosition/position 과 충돌하지 않는 slot 선택.
   */
  private pickAnalogSlot(m: MediaPlacement): Vector2D {
    const pwM = m.size.width, phM = m.size.height;
    const autoCap = Math.max(2, Math.floor((2 * (pwM + phM)) / 0.8));
    const softCap = Math.max(m.capacity || 0, autoCap);
    const mid = m.id as string;

    // Collect occupied positions from other visitors targeting/watching this media
    const occupied: Vector2D[] = [];
    for (const [, other] of this.state.visitors) {
      if (!other.isActive) continue;
      if ((other.targetMediaId as string) !== mid) continue;
      if (other.currentAction === VISITOR_ACTION.WATCHING) {
        occupied.push(other.position);
      } else if (other.targetPosition) {
        occupied.push(other.targetPosition);
      }
    }

    // Find a free slot (min distance > 12px from any occupied point)
    const MIN_DIST_SQ = 12 * 12;
    for (let i = 0; i < softCap; i++) {
      const slotPos = this.getAnalogSlotWithCap(m, i, softCap);
      let free = true;
      for (const op of occupied) {
        const dx = slotPos.x - op.x, dy = slotPos.y - op.y;
        if (dx * dx + dy * dy < MIN_DIST_SQ) { free = false; break; }
      }
      if (free) return slotPos;
    }
    // All full — fall back to slot 0 (onArrival softCap check 에서 reject 됨)
    return this.getAnalogSlotWithCap(m, 0, softCap);
  }

  /** getAnalogSlotPosition 의 cap 파라미터화 버전 (softCap 기반 분산). */
  private getAnalogSlotWithCap(m: MediaPlacement, slotIndex: number, cap: number): Vector2D {
    const pw = m.size.width * MEDIA_SCALE;
    const ph = m.size.height * MEDIA_SCALE;
    const margin = 3; // 미디어 테두리 바로 앞 (0.15m) — analog 는 근접 관람
    const effCap = Math.max(1, cap);
    if ((m as any).omnidirectional) {
      const perimeter = 2 * (pw + ph);
      const spacing = perimeter / effCap;
      const halfW = pw / 2 + margin;
      const halfH = ph / 2 + margin;
      let d = spacing * slotIndex;
      if (d < pw) return this.clampToMediaZone(m, { x: m.position.x - pw / 2 + d, y: m.position.y - halfH });
      d -= pw;
      if (d < ph) return this.clampToMediaZone(m, { x: m.position.x + halfW, y: m.position.y - ph / 2 + d });
      d -= ph;
      if (d < pw) return this.clampToMediaZone(m, { x: m.position.x + pw / 2 - d, y: m.position.y + halfH });
      d -= pw;
      return this.clampToMediaZone(m, { x: m.position.x - halfW, y: m.position.y + ph / 2 - d });
    }
    // Directional: slots along the front face (orientation-aware)
    const rad = (m.orientation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const frontDist = ph / 2 + margin;
    const spacing = pw / Math.max(1, effCap);
    const lateralOffset = (slotIndex + 0.5) * spacing - pw / 2;
    const pt = {
      x: m.position.x + cos * lateralOffset + sin * frontDist,
      y: m.position.y + sin * lateralOffset - cos * frontDist,
    };
    return this.clampToMediaZone(m, pt);
  }

  /** Clamp a point to the parent zone bounds of a media */
  private clampToMediaZone(m: MediaPlacement, pt: Vector2D): Vector2D {
    const zone = this.zoneMap.get((m as any).zoneId as string);
    if (!zone) return pt;
    const pad = 4;
    return {
      x: Math.max(zone.bounds.x + pad, Math.min(zone.bounds.x + zone.bounds.w - pad, pt.x)),
      y: Math.max(zone.bounds.y + pad, Math.min(zone.bounds.y + zone.bounds.h - pad, pt.y)),
    };
  }

  /** Get analog close-up position — nearby the media edge with random jitter (no fixed grid) */
  private getAnalogClosePosition(m: MediaPlacement, agentPos: Vector2D): Vector2D {
    const pw = m.size.width * MEDIA_SCALE;
    const ph = m.size.height * MEDIA_SCALE;
    const margin = 6 + this.rng.next() * 8; // 6–14px outside

    let pt: Vector2D;
    if ((m as any).omnidirectional) {
      const angle = this.rng.next() * Math.PI * 2;
      const halfW = pw / 2 + margin;
      const halfH = ph / 2 + margin;
      pt = {
        x: m.position.x + Math.cos(angle) * halfW,
        y: m.position.y + Math.sin(angle) * halfH,
      };
    } else {
      const rad = (m.orientation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const frontDist = ph / 2 + margin;
      const lateralOffset = (this.rng.next() - 0.5) * pw * 0.9;
      // Local (lateralOffset, -frontDist) rotated by orientation to world coords
      pt = {
        x: m.position.x + cos * lateralOffset + sin * frontDist,
        y: m.position.y + sin * lateralOffset - cos * frontDist,
      };
    }
    return this.clampToMediaZone(m, pt);
  }

  /** Get analog viewing slot — just outside the media box (legacy) */
  private getAnalogSlotPosition(m: MediaPlacement, slotIndex: number): Vector2D {
    const pw = m.size.width * MEDIA_SCALE;
    const ph = m.size.height * MEDIA_SCALE;
    const cap = Math.max(1, m.capacity);
    const margin = 8; // px outside the box edge

    if ((m as any).omnidirectional) {
      // 360° distribution around the box perimeter
      const perimeter = 2 * (pw + ph);
      const spacing = perimeter / cap;
      const dist = spacing * slotIndex;

      // Walk around the perimeter: top → right → bottom → left
      const halfW = pw / 2 + margin;
      const halfH = ph / 2 + margin;
      let d = dist;
      if (d < pw) {
        // Top edge
        return { x: m.position.x - pw / 2 + d, y: m.position.y - halfH };
      }
      d -= pw;
      if (d < ph) {
        // Right edge
        return { x: m.position.x + halfW, y: m.position.y - ph / 2 + d };
      }
      d -= ph;
      if (d < pw) {
        // Bottom edge
        return { x: m.position.x + pw / 2 - d, y: m.position.y + halfH };
      }
      d -= pw;
      // Left edge
      return { x: m.position.x - halfW, y: m.position.y + ph / 2 - d };
    }

    // Directional: slots along the front face, just outside
    const rad = (m.orientation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const frontDist = ph / 2 + margin;

    const cols = Math.min(cap, Math.max(1, Math.floor(pw / 12)));
    const rows = Math.ceil(cap / cols);
    const col = slotIndex % cols;
    const row = Math.floor(slotIndex / cols);

    // Spread along media width (tangent), rows go further from media
    const localX = (col - (cols - 1) / 2) * (pw / Math.max(cols, 1));
    const rowDist = frontDist + row * 10;

    return {
      x: m.position.x + localX * cos + sin * rowDist,
      y: m.position.y + localX * sin - cos * rowDist,
    };
  }

  /** Get the waiting position (in front of media, outside media rect) */
  private getMediaWaitPoint(m: MediaPlacement): Vector2D {
    let halfDepth: number;
    if (this.isMediaPolygon(m)) {
      const poly = m.polygon!;
      let maxY = -Infinity;
      for (const p of poly) if (Math.abs(p.y) > maxY) maxY = Math.abs(p.y);
      halfDepth = maxY;
    } else {
      halfDepth = (m.size.height * MEDIA_SCALE) / 2;
    }
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
        // Hard-cap: exclude media already at capacity (viewers + en-route targeters)
        const available = this.filterAvailableMedia(unvisited);
        const pickPool = available.length > 0 ? available : unvisited;
        const pick = curZone.flowType === 'guided'
          ? [...pickPool].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)[0]
          : this.world.media.find(m => m.id === selectNextMedia(v, pickPool, this.rng));
        if (pick && available.length > 0) {
          recordMediaApproach(pick.id as string);
          return {
            ...v, targetMediaId: pick.id, targetPosition: this.computeMediaTargetPos(pick),
            currentAction: VISITOR_ACTION.MOVING,
            steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
          };
        }
        // All zone media over capacity → fall through to zone/exit transition below
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
        const available = this.filterAvailableMedia(unvisited);
        if (available.length > 0) {
          const pick = curZone.flowType === 'guided'
            ? [...available].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)[0]
            : this.world.media.find(m => m.id === selectNextMedia(v, available, this.rng));
          if (pick) {
            recordMediaApproach(pick.id as string);
            return {
              ...v, targetMediaId: pick.id, targetPosition: this.computeMediaTargetPos(pick),
              currentAction: VISITOR_ACTION.MOVING,
              steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
            };
          }
        }
        // All zone media over capacity → fall through to zone/exit transition
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

  private assignNextTargetGraph(input: Visitor): Visitor {
    if (!this.waypointNav || !input.currentNodeId) return input;

    const curNode = this.waypointNav.getNode(input.currentNodeId);
    if (!curNode) return input;

    let v = input;

    // 1. EXIT 노드 도착 → 퇴장 시퀀스
    if (curNode.type === 'exit') {
      return this.beginExitGraph(v, curNode);
    }

    // 1b. ELEVATOR 노드 도착 → wait + travel 후 같은 shaft의 다른 층 노드로 텔레포트
    if (curNode.type === 'portal' && curNode.shaftId) {
      const shaft = this.world.shafts?.find(sh => (sh.id as string) === (curNode.shaftId as string));
      if (shaft) {
        // 같은 shaft에 속한 다른 floor의 엘리베이터 노드 후보
        const members = this.waypointNav.getNodesByShaft(curNode.shaftId);
        const candidates = members.filter(m =>
          (m.id as string) !== (curNode.id as string) &&
          (m.floorId as string) !== (curNode.floorId as string),
        );
        if (candidates.length > 0) {
          // Just-teleported guard: 직전 로그가 같은 shaft의 다른 노드면 이미 도착 → 다음 노드 선택으로 진행
          const prevLog = v.pathLog[v.pathLog.length - 2];
          const prevNode = prevLog ? this.waypointNav.getNode(prevLog.nodeId as any) : null;
          const justTeleported = prevNode
            && prevNode.type === 'portal'
            && (prevNode.shaftId as string | undefined) === (curNode.shaftId as string);
          if (!justTeleported) {
            // 목적지 선택: 방문 안한 포털 우선 → 여러 층 순환 이동 (3F+ 도달 가능)
            const visitedNodeIds = new Set(v.pathLog.map(e => e.nodeId as string));
            let dest = candidates.find(c => !visitedNodeIds.has(c.id as string)) ?? candidates[0];
            const targetFloor = v.targetFloorId as string | null;
            if (targetFloor) {
              const onTarget = candidates.find(c => (c.floorId as string) === targetFloor);
              if (onTarget) dest = onTarget;
            }
            const floorSpan = Math.abs(
              (this.world.floors.find(f => (f.id as string) === (dest.floorId as string))?.level ?? 0)
              - (this.world.floors.find(f => (f.id as string) === (curNode.floorId as string))?.level ?? 0)
            );
            const totalWaitMs = shaft.waitTimeMs + floorSpan * shaft.travelTimePerFloorMs;
            const vid = v.id as string;
            const shaftId = curNode.shaftId as string;
            const pool = this.shaftBoarding.get(shaftId) ?? new Map<string, { startMs: number; endMs: number }>();
            // Promote from queue to boarding if a slot is open
            if (!pool.has(vid) && pool.size < shaft.capacity) {
              const start = this.state.timeState.elapsed;
              pool.set(vid, { startMs: start, endMs: start + totalWaitMs });
              this.shaftBoarding.set(shaftId, pool);
            }
            const slot = pool.get(vid);
            if (!slot || this.state.timeState.elapsed < slot.endMs) {
              // Queued (no slot) or boarding in progress → WATCHING
              return {
                ...v,
                currentAction: VISITOR_ACTION.WATCHING,
                velocity: { x: 0, y: 0 },
                steering: { ...v.steering, currentSteering: { linear: { x: 0, y: 0 }, angular: 0 } },
              };
            }
            // Slot complete → teleport and free the boarding slot for the next queued agent
            pool.delete(vid);
            const closedLog = this.closePathLogEntry(v.pathLog, curNode.id, this.state.timeState.elapsed);
            const newPathLog: PathLogEntry[] = [...closedLog, {
              nodeId: dest.id,
              entryTime: this.state.timeState.elapsed,
              exitTime: 0,
              duration: 0,
            }];
            return {
              ...v,
              position: { x: dest.position.x, y: dest.position.y },
              currentFloorId: dest.floorId,
              // Reset to destination portal's zone (or null if portal is outside any zone).
              // Keeping the old floor's zoneId here causes stepCollision to clamp the
              // agent back into the previous floor's polygon on the next tick.
              currentZoneId: (dest.zoneId as any) ?? null,
              currentNodeId: dest.id,
              pathLog: newPathLog,
              velocity: { x: 0, y: 0 },
              currentAction: VISITOR_ACTION.IDLE,
              steering: { ...v.steering, currentSteering: { linear: { x: 0, y: 0 }, angular: 0 } },
            };
          }
          // justTeleported: fall through to next-node selection
        }
      }
    }

    // 2. HUB/BEND 노드 → 체류/미디어 없이 바로 다음 노드 선택
    if (curNode.type === 'hub' || curNode.type === 'bend') {
      // 바로 step 4 (다음 노드 선택)으로
    }

    // 3. 현재 노드에 zone이 있으면 미디어 체크 (HUB/BEND는 위에서 처리됨)
    else if (curNode.zoneId && curNode.type !== 'entry') {
      // ATTRACTOR: 직접 바인딩된 미디어 우선
      if (curNode.type === 'attractor' && curNode.mediaId) {
        const visited = new Set(v.visitedMediaIds.map(m => m as string));
        if (!visited.has(curNode.mediaId as string)) {
          const media = this.world.media.find(m => m.id === curNode.mediaId);
          if (media) {
            recordMediaApproach(media.id as string);
            return {
              ...v,
              targetMediaId: media.id,
              targetPosition: this.computeMediaTargetPos(media),
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
        const available = this.filterAvailableMedia(unvisited);
        if (available.length > 0) {
          const pick = this.world.media.find(m => m.id === selectNextMedia(v, available, this.rng));
          if (pick) {
            recordMediaApproach(pick.id as string);
            return {
              ...v,
              targetMediaId: pick.id,
              targetPosition: this.computeMediaTargetPos(pick),
              targetNodeId: null,
              currentAction: VISITOR_ACTION.MOVING,
              steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
            };
          }
        }
        // No media picked (all over capacity or selection failed) → skip unvisited + fall through
        for (const m of unvisited) {
          recordMediaApproach(m.id as string);
          this.recordSkip(m.id as string, 0, curNode.zoneId as string | null);
        }
        v = { ...v, visitedMediaIds: [...v.visitedMediaIds, ...unvisited.map(m => m.id)] };
      }
    }

    // 3. dwellTime 체류 — 첫 방문 시에만 (rest/attractor)
    //    ZONE 노드는 거점이므로 체류 없이 즉시 다음 타겟 선택
    //    재방문 시는 이미 관람한 노드이므로 대기 없이 통과
    if (curNode.dwellTimeMs > 0 && (curNode.type === 'rest' || curNode.type === 'attractor')) {
      const lastLog = v.pathLog[v.pathLog.length - 1];
      const isFirstVisit = v.pathLog.filter(e => (e.nodeId as string) === (curNode.id as string)).length <= 1;
      if (isFirstVisit && lastLog && (lastLog.nodeId as string) === (curNode.id as string) && lastLog.exitTime === 0) {
        const elapsed = this.state.timeState.elapsed - lastLog.entryTime;
        if (elapsed < curNode.dwellTimeMs) {
          return {
            ...v,
            currentAction: curNode.type === 'rest' ? VISITOR_ACTION.RESTING : VISITOR_ACTION.WATCHING,
            velocity: { x: 0, y: 0 },
            steering: { ...v.steering, currentSteering: { linear: { x: 0, y: 0 }, angular: 0 } },
          };
        }
      }
    }

    // 4. 다음 노드 선택 (Score 기반) — stuck 감지를 위해 now 전달
    // Build zone capacity map for zone overcrowding penalty
    const zoneCapacity = new Map<string, number>();
    for (const z of this.world.zones) zoneCapacity.set(z.id as string, z.capacity);
    const nextNode = this.waypointNav.selectNextNode(v, curNode.id, this.nodeCrowd, this.rng, this.state.timeState.elapsed, this.zoneOccupancy, zoneCapacity);
    if (!nextNode) {
      // 막다른 길: wander
      return {
        ...v, currentAction: VISITOR_ACTION.MOVING,
        steering: { ...v.steering, activeBehavior: STEERING_BEHAVIOR.WANDER },
      };
    }

    // pathLog 현재 노드 종료 기록
    const updatedPathLog = this.closePathLogEntry(v.pathLog, curNode.id, this.state.timeState.elapsed);

    return {
      ...v,
      targetNodeId: nextNode.id,
      targetMediaId: null,
      targetPosition: null,
      targetZoneId: null,
      pathLog: updatedPathLog,
      currentAction: nextNode.type === 'exit' ? VISITOR_ACTION.EXITING : VISITOR_ACTION.MOVING,
      steering: { ...v.steering, isArrived: false, activeBehavior: STEERING_BEHAVIOR.ARRIVAL },
    };
  }

  /** Graph mode: EXIT 노드 도착 → exit 위치로 이동 후 비활성화 (시각적으로 exit에 도달해서 사라짐) */
  private beginExitGraph(v: Visitor, exitNode: WaypointNode): Visitor {
    const xid = exitNode.id as string;
    this._exitByNode.set(xid, (this._exitByNode.get(xid) ?? 0) + 1);
    return {
      ...v,
      currentAction: VISITOR_ACTION.EXITING,
      velocity: { x: 0, y: 0 },
      isActive: false,
      exitedAt: this.state.timeState.elapsed,
    };
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
      targetPosition: null,
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
    // ── 0. targetPosition (선택 시점에 고정된 최종 좌표) 가 있으면 최우선 ──
    // 미디어 시청 목표 위치는 선택 시점에 계산해서 저장 (점프 방지 불변 조건).
    // WATCHING 중에는 watchPoint 가 별도로 적용 (아래).
    if (v.targetPosition
        && v.currentAction !== VISITOR_ACTION.WATCHING
        && v.currentAction !== VISITOR_ACTION.WAITING) {
      return v.targetPosition;
    }

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

    // 1. Media (fallback — targetPosition 이 없을 때)
    if (v.targetMediaId) {
      const m = this.world.media.find(m => m.id === v.targetMediaId);
      if (m) {
        if (v.currentAction === VISITOR_ACTION.WATCHING) return this.getMediaWatchPoint(m);
        const intType = (m as any).interactionType ?? 'passive';
        if (intType === 'passive' || intType === 'analog') {
          return this.getMediaViewPoint(m);
        }
        if (v.currentAction === VISITOR_ACTION.WAITING) {
          return this.getMediaWaitPoint(m);
        }
        // Active/staged: pick next free slot (not one already occupied)
        const usedSlots = this.getUsedMediaSlots(v.targetMediaId);
        const slotIdx = this.findNextFreeSlot(m.capacity, usedSlots);
        const viewerCount = this._tickMediaViewers.get(v.targetMediaId as string) ?? 0;
        return viewerCount < m.capacity
          ? this.getMediaSlotPosition(m, slotIdx)
          : this.getMediaWaitPoint(m);
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
        // Kinematic seek: velocity 를 desired 로 직접 설정 (관성 없음, 즉시 방향 전환).
        // 미디어 도착 판정은 유지 (정확한 정지).
        const isMediaTarget = !!v.targetMediaId && !v.targetNodeId && !!v.targetPosition;
        const effectiveArrival = isMediaTarget ? 12 : physics.arrivalRadius;
        if (distSq < effectiveArrival * effectiveArrival) {
          if (isMediaTarget) {
            return { ...v, steering: { ...v.steering, isArrived: true, currentSteering: { linear: { x: 0, y: 0 }, angular: 0 } }, velocity: { x: 0, y: 0 } };
          }
          // node/gate: arrival 만 마크, velocity 유지 (proximity snap 이 처리)
          return { ...v, steering: { ...v.steering, isArrived: true } };
        }
        const dist = Math.sqrt(distSq);
        let dirX = dx / dist;
        let dirY = dy / dist;

        // 비타겟 미디어 회피: 앞쪽 lookahead 가 non-target 미디어 hitbox 에 부딪히면
        // velocity 를 tangent 방향으로 회전 (벽을 따라 미끄러짐) — 덜덜거림 방지
        if (v.currentZoneId) {
          const lookahead = 15;
          const lookX = v.position.x + dirX * lookahead;
          const lookY = v.position.y + dirY * lookahead;
          const zoneMedia = this.mediaByZone.get(v.currentZoneId as string);
          if (zoneMedia) {
            for (const m of zoneMedia) {
              const mt = (m as any).interactionType;
              if (mt === 'passive') continue;
              if (
                v.targetMediaId &&
                (m.id as string) === (v.targetMediaId as string) &&
                (mt === 'active' || mt === 'staged')
              ) continue;
              if (this.isInsideMedia({ x: lookX, y: lookY }, m)) {
                // 미디어 중심으로부터 에이전트까지의 법선 추정
                const nx = v.position.x - m.position.x;
                const ny = v.position.y - m.position.y;
                const nLen = Math.sqrt(nx * nx + ny * ny);
                if (nLen > 0.01) {
                  const nnx = nx / nLen, nny = ny / nLen;
                  // 두 가지 tangent (시계/반시계) 중 타겟 방향에 더 가까운 쪽 선택
                  const tA = { x: -nny, y: nnx };
                  const tB = { x: nny, y: -nnx };
                  const dotA = tA.x * dirX + tA.y * dirY;
                  const dotB = tB.x * dirX + tB.y * dirY;
                  const tan = dotA > dotB ? tA : tB;
                  dirX = tan.x;
                  dirY = tan.y;
                }
                break;
              }
            }
          }
        }

        const desiredVel = { x: dirX * v.profile.maxSpeed, y: dirY * v.profile.maxSpeed };
        // velocity 직접 설정 + currentSteering 0 (관성 차단)
        return {
          ...v,
          velocity: desiredVel,
          steering: { ...v.steering, currentSteering: { linear: { x: 0, y: 0 }, angular: 0 } },
        };
      }
    } else {
      const { steering: ws, newWanderAngle } = wander(v.velocity, v.steering.wanderAngle, physics, (this.rng.next() - 0.5) * physics.wanderJitter * dtS);
      outputs.push({ output: ws, weight: 0.5 });
      return { ...v, steering: { ...v.steering, wanderAngle: newWanderAngle } };
    }

    // Wall avoidance — 그래프 이동 중에는 스킵 (크로스존 이동 시 잘못된 벽 회피 방지)
    if (ENABLE_OBSTACLE_AVOIDANCE && v.currentZoneId && !v.targetNodeId) {
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
    // WATCHING/WAITING 에이전트는 정적이므로 분리력에서 제외 — 인접 slot 접근 허용
    const neighbors = ENABLE_SEPARATION
      ? this.spatialHash.queryRadius(v.id, physics.avoidanceRadius)
      : [];
    if (neighbors.length > 0) {
      const targetType = v.targetNodeId ? this.nodeMap.get(v.targetNodeId as string)?.type : null;
      const isPassThrough = targetType === 'exit' || targetType === 'hub' || targetType === 'entry' || targetType === 'bend';

      // Split neighbors: same-group vs others (skip stationary)
      // Same-media targets: 별도 약한 분리 (겹침 방지) 적용
      const sameGroupPositions: Vector2D[] = [];
      const sameMediaPositions: Vector2D[] = [];
      const otherPositions: Vector2D[] = [];
      for (const n of neighbors) {
        const nv = this.state.visitors.get(n.id as string);
        if (!nv) continue;
        if (nv.currentAction === VISITOR_ACTION.WATCHING || nv.currentAction === VISITOR_ACTION.WAITING) continue;
        if (v.targetMediaId && (nv.targetMediaId as string) === (v.targetMediaId as string)) {
          sameMediaPositions.push(n.position);
          continue;
        }
        if (v.groupId && nv.groupId === v.groupId) {
          sameGroupPositions.push(n.position);
        } else {
          otherPositions.push(n.position);
        }
      }
      // 같은 미디어 목표 에이전트끼리: 매우 가까울 때만 약하게 밀어냄
      if (sameMediaPositions.length > 0) {
        outputs.push({
          output: separation(v.position, sameMediaPositions, physics.avoidanceRadius * 0.3, physics.separationStrength * 0.2),
          weight: 0.2,
        });
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
    if (ENABLE_GROUP_STEERING && v.groupId) {
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
    if (ENABLE_TOUR_AVOIDANCE && v.category !== 'guided_tour') {
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
    if (!ENABLE_FOLLOWER_SNAP) return v;
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
   *  FOLLOWER TETHER — warp follower near leader
   *  when distance exceeds tether threshold (pushed out of crowd etc.)
   * ═══════════════════════════════════════════════ */

  private stepFollowerTether(v: Visitor): Visitor {
    if (!v.groupId || v.isGroupLeader) return v;
    if (v.currentAction === VISITOR_ACTION.WATCHING || v.currentAction === VISITOR_ACTION.WAITING) return v;

    const group = this.state.groups.get(v.groupId as string);
    if (!group) return v;
    const leader = this.state.visitors.get(group.leaderId as string);
    if (!leader?.isActive) return v;

    const dx = leader.position.x - v.position.x;
    const dy = leader.position.y - v.position.y;
    const distSq = dx * dx + dy * dy;

    // Bounding radius per group type:
    //  - guided: effectiveCollisionRadius (visible outline)
    //  - pair/small: maxSpread (invisible bubble)
    const boundR = group.type === 'guided'
      ? (group.effectiveCollisionRadius ?? 60) * 0.9
      : Math.max(30, group.maxSpread ?? 40);

    if (distSq <= boundR * boundR) return v;

    const dist = Math.sqrt(distSq);
    const nx = dx / dist, ny = dy / dist; // v → leader unit vector
    const newPos = {
      x: leader.position.x - nx * boundR,
      y: leader.position.y - ny * boundR,
    };
    // Remove outward velocity component so follower doesn't keep escaping
    const outX = -nx, outY = -ny;
    const vOut = v.velocity.x * outX + v.velocity.y * outY;
    const newVel = vOut > 0
      ? { x: v.velocity.x - vOut * outX, y: v.velocity.y - vOut * outY }
      : v.velocity;
    return { ...v, position: newPos, velocity: newVel };
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

    // Check if this agent is heading to an EXIT node — "exit express" mode
    // skips agent-agent overlap so they can push through crowds to reach exit.
    const isExitingToNode = !!v.targetNodeId && this.waypointNav
      && this.waypointNav.getNode(v.targetNodeId)?.type === 'exit';

    // Agent-agent overlap: 모든 에이전트 간 겹침 방지.
    // 같은 그룹은 겹침 허용, exit 가는 에이전트는 군중 뚫고 지나가도록 skip.
    if (ENABLE_AGENT_OVERLAP && !isExitingToNode) {
      const avoidR = this.world.config.physics.avoidanceRadius;
      const neighbors = this.spatialHash.queryRadius(v.id, avoidR);
      for (const n of neighbors) {
        const nv = this.state.visitors.get(n.id as string);
        if (!nv) continue;
        if (v.groupId && nv.groupId === v.groupId) continue;
        pos = resolveAgentOverlap(pos, n.position, avoidR * 0.5);
      }
    }

    // Zone boundary collision
    // Graph agents in transit (moving between nodes): skip ALL zone wall collision
    // Graph agents at node: clamp to that node's zone
    // Legacy agents: full zone boundary + gate crossing logic
    const isGraphAgent = !!v.currentNodeId;
    const isGraphTransit = isGraphAgent && !!v.targetNodeId;
    if (!ENABLE_ZONE_CLAMP) {
      // Zone 경계 체크 완전 생략 (최소 파이프라인 디버깅)
    } else if (isGraphTransit) {
      // Transit: agent traverses gap corridors between graph nodes.
      // Previously skipped ALL zone walls → tunnel bug (waypoint straight-line
      // cut through unrelated zones). Now push out of any zone on this floor
      // that is NOT the source or destination zone, so corridors stay valid
      // but walls of unrelated zones block passage.
      const srcNode = v.currentNodeId ? this.waypointNav?.getNode(v.currentNodeId) : null;
      const dstNode = v.targetNodeId ? this.waypointNav?.getNode(v.targetNodeId) : null;
      const srcZoneId = (srcNode?.zoneId as string | null) ?? null;
      const dstZoneId = (dstNode?.zoneId as string | null) ?? null;
      for (const zone of this.world.zones) {
        if (zone.floorId !== v.currentFloorId) continue;
        const zid = zone.id as string;
        if (zid === srcZoneId || zid === dstZoneId) continue;
        const poly = getZonePolygon(zone);
        if (isPointInPolygon(pos, poly)) {
          const center = { x: zone.bounds.x + zone.bounds.w / 2, y: zone.bounds.y + zone.bounds.h / 2 };
          pos = pushOutsidePolygon(pos, poly, center);
        }
      }
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
    // Media obstacle collision — push agent outside media
    if (ENABLE_MEDIA_HITBOX && v.currentZoneId) {
      const zoneMedia = this.mediaByZone.get(v.currentZoneId as string);
      if (zoneMedia) {
        for (const m of zoneMedia) {
          const mt = (m as any).interactionType;
          if (mt === 'passive') continue; // passive media = no physical barrier
          // Target media 의 hitbox skip 은 slot 이 rect 내부인 경우(active/staged)만.
          // analog 는 slot 이 rect 외부라 skip 하면 관통 발생 → 유지.
          if (
            v.targetMediaId &&
            (m.id as string) === (v.targetMediaId as string) &&
            (mt === 'active' || mt === 'staged')
          ) continue;
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

    // Floor bounds — skip for EXITING agents and exit-node seekers so they reach exit.
    // Shared-canvas model: clamp to floor.bounds (world-space frame) rather than
    // floor.canvas (intrinsic size starting at 0,0), otherwise agents on non-first
    // floors get dragged back to the origin on every tick after teleporting.
    const targetingExit = !!v.targetNodeId && this.waypointNav
      && this.waypointNav.getNode(v.targetNodeId)?.type === 'exit';
    if (ENABLE_FLOOR_CLAMP && v.currentAction !== VISITOR_ACTION.EXITING && !targetingExit) {
      const floor = this.world.floors.find(f => f.id === v.currentFloorId);
      if (floor) {
        const frame = floor.bounds ?? { x: 0, y: 0, w: floor.canvas.width, h: floor.canvas.height };
        pos = clampToRect(pos, frame);
      }
    }

    if (pos === v.position) return v;

    // Kinematic 모드에서는 velocity 가 매 tick target 방향으로 재설정됨.
    // 벽/미디어 clamp 로 position 이 뒤로 밀리면 velocity 도 같은 방향 성분만큼 줄이면
    // stepPhysics 가 다시 벽을 뚫지 않고 접선 방향으로만 움직여 덜덜거림 없음.
    const pdx = pos.x - v.position.x;
    const pdy = pos.y - v.position.y;
    const pLenSq = pdx * pdx + pdy * pdy;
    if (pLenSq < 0.0001) return { ...v, position: pos };
    const pLen = Math.sqrt(pLenSq);
    const pushNx = pdx / pLen;  // push direction (벽에서 밀려나는 방향)
    const pushNy = pdy / pLen;
    const vDotPush = v.velocity.x * pushNx + v.velocity.y * pushNy;
    // velocity 중 push 반대 방향 (= 벽 향하는) 성분 제거
    if (vDotPush < 0) {
      const newVel = {
        x: v.velocity.x - vDotPush * pushNx,
        y: v.velocity.y - vDotPush * pushNy,
      };
      return { ...v, position: pos, velocity: newVel };
    }
    return { ...v, position: pos };
  }

  /* ═══════════════════════════════════════════════
   *  FATIGUE
   * ═══════════════════════════════════════════════ */

  private stepFatigue(v: Visitor, dt: number): Visitor {
    const f = Math.min(1, v.fatigue + v.profile.fatigueRate * dt);
    return f === v.fatigue ? v : { ...v, fatigue: f };
  }
}
