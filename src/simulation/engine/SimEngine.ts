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
} from '@/domain';
import { SIMULATION_PHASE, VISITOR_ACTION, STEERING_BEHAVIOR, MEDIA_SCALE, MEDIA_INTERACTION_OFFSET } from '@/domain';
import { createSeededRandom, type SeededRandom } from '../utils/random';
import { clampMagnitude } from '../utils/math';
import { SpatialHash } from '../collision/detection';
import { resolveAgentOverlap, clampToRect, clampToPolygon, isPointInPolygon } from '../collision/resolution';
import { arrival, separation, wander, obstacleAvoidance } from '../steering/behaviors';
import { getZonePolygon, getZoneWalls } from './transit';
import { combineSteeringPriority, type WeightedSteering } from '../steering/combiner';
import { ZoneGraph } from '../pathfinding/navigation';
import { selectNextZone, selectNextMedia, shouldSkip, computeEngagementDuration } from '../behavior/EngagementBehavior';
import { generateSpawnBatch, getActiveTimeSlot, resetSpawnerIds } from '../spawner/VisitorSpawner';

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
}

/* ─── engine ─── */

export class SimulationEngine {
  private state: SimulationState;
  private world: SimulationWorld;
  private rng: SeededRandom;
  private spatialHash: SpatialHash;
  private zoneGraph: ZoneGraph;

  // lookups
  private zoneMap = new Map<string, ZoneConfig>();
  private mediaByZone = new Map<string, MediaPlacement[]>();

  // spawner
  private spawnAccumulator = 0;

  // cumulative counters
  private _totalSpawned = 0;
  private _totalExited = 0;

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
  getMediaStats(): Map<string, { watchCount: number; skipCount: number; waitCount: number; totalWatchMs: number; totalWaitMs: number; peakViewers: number }> { return this._mediaStats; }

  private ensureMediaStats(mediaId: string) {
    if (!this._mediaStats.has(mediaId)) {
      this._mediaStats.set(mediaId, { watchCount: 0, skipCount: 0, waitCount: 0, totalWatchMs: 0, totalWaitMs: 0, peakViewers: 0 });
    }
    return this._mediaStats.get(mediaId)!;
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

    // rebuild spatial hash + media viewer counts for this tick
    this.spatialHash.clear();
    this._tickMediaViewers.clear();
    for (const [, v] of this.state.visitors) {
      if (!v.isActive) continue;
      this.spatialHash.insert(v.id, v.position);
      if (v.currentAction === VISITOR_ACTION.WATCHING && v.targetMediaId) {
        const mid = v.targetMediaId as string;
        this._tickMediaViewers.set(mid, (this._tickMediaViewers.get(mid) ?? 0) + 1);
      }
    }

    const next = new Map<string, Visitor>();
    for (const [k, v] of this.state.visitors) {
      if (!v.isActive) { next.set(k, v); continue; }
      let a = this.stepBehavior(v, dt);
      a = this.stepSteering(a, dtS);
      a = this.stepPhysics(a, dtS);
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

    this.spawnAccumulator += slot.spawnRatePerSecond * (dt / 1000);

    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;

      // Free mode: spawn at random entrance zone. Sequential: zone[0].
      let spawnZone: ZoneConfig | undefined;
      if (this.world.globalFlowMode === 'free') {
        const entranceZones = this.world.zones.filter(z => z.type === 'entrance' || z.type === 'gateway');
        spawnZone = entranceZones.length > 0
          ? entranceZones[Math.floor(this.rng.next() * entranceZones.length)]
          : this.world.zones[0];
      } else {
        spawnZone = this.world.zones[0];
      }
      if (!spawnZone || spawnZone.gates.length === 0) continue;

      const isFree = this.world.globalFlowMode === 'free';

      // Pick spawn gate: prefer unconnected gate (faces outside), fallback to first gate
      const gate = isFree
        ? (spawnZone.gates.find((g: any) => !g.connectedGateId) ?? spawnZone.gates[0])
        : spawnZone.gates[0];

      // Free mode: spawn OUTSIDE the gate, then walk in via transit waypoints
      const spawnPos = isFree
        ? this.pushOutward(gate.position, spawnZone, 60) // 60px outside gate
        : gate.position;

      const dist = {
        totalCount: 1,
        profileWeights: slot.profileDistribution,
        engagementWeights: slot.engagementDistribution,
        groupRatio: slot.groupRatio,
        spawnRatePerSecond: slot.spawnRatePerSecond,
      };
      const batch = generateSpawnBatch(1, dist, spawnPos, gate.floorId, elapsed, this.rng);
      for (const v of batch.visitors) {
        const center = { x: spawnZone.bounds.x + spawnZone.bounds.w / 2, y: spawnZone.bounds.y + spawnZone.bounds.h / 2 };
        const spawned: Visitor = {
          ...v,
          currentZoneId: isFree ? null : spawnZone.id, // Free: transit into zone
          visitedZoneIds: [spawnZone.id],
          ...(isFree ? {
            targetZoneId: spawnZone.id,
            transitWaypoints: [gate.position, center],
            transitWaypointIdx: 0,
            currentAction: 'MOVING' as any,
            steering: { ...v.steering, isArrived: false, activeBehavior: 'arrival' as any },
          } : {}),
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
            const dur = computeEngagementDuration(media.avgEngagementTimeMs, v.profile.engagementLevel, v.fatigue, this.rng);
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
      if (shouldSkip(waitMs, v.profile.patience, attr, skipThreshold.skipMultiplier, skipThreshold.maxWaitTimeMs)) {
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
      return this.onArrival(v);
    }

    return v;
  }

  /**
   * Called when agent reaches its current target position.
   * Decides what happens next based on transit state.
   */
  private onArrival(v: Visitor): Visitor {
    // ── 1. Transit waypoint in progress → advance ──
    if (v.transitWaypoints.length > 0) {
      const nextIdx = v.transitWaypointIdx + 1;

      if (nextIdx >= v.transitWaypoints.length) {
        const destZoneId = v.targetZoneId;

        // No destination (exited last zone) → deactivate
        if (!destZoneId) {
          return { ...v, isActive: false, transitWaypoints: [], transitWaypointIdx: 0 };
        }

        // Transit complete — enter the destination zone normally
        return this.assignNextTarget({
          ...v,
          currentZoneId: destZoneId,
          transitWaypoints: [],
          transitWaypointIdx: 0,
          visitedZoneIds: !v.visitedZoneIds.includes(destZoneId)
            ? [...v.visitedZoneIds, destZoneId]
            : v.visitedZoneIds,
          currentAction: VISITOR_ACTION.IDLE,
          steering: { ...v.steering, isArrived: false },
        });
      }

      // Next waypoint
      return { ...v, transitWaypointIdx: nextIdx, steering: { ...v.steering, isArrived: false } };
    }

    // ── 2. Media arrival ──
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
          // Soft capacity: if over capacity, skip instead of wait
          const viewerCount = this._tickMediaViewers.get(mid) ?? 0;
          if (viewerCount >= media.capacity) {
            // Over soft cap → skip (mark as visited, move on)
            this.recordSkip(mid, 0);
            return this.assignNextTarget({
              ...v, currentAction: VISITOR_ACTION.IDLE,
              visitedMediaIds: [...v.visitedMediaIds, v.targetMediaId],
              targetMediaId: null,
            });
          }
          // Watch at current position (wherever agent arrived in viewing area)
          this._tickMediaViewers.set(mid, viewerCount + 1);
          this.recordWatchStart(mid, v.id as string);
          const dur = computeEngagementDuration(media.avgEngagementTimeMs, v.profile.engagementLevel, v.fatigue, this.rng);
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
          const dur = computeEngagementDuration(media.avgEngagementTimeMs, v.profile.engagementLevel, v.fatigue, this.rng);
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

    // ── 3. Reached exit gate of current zone → step through gate to next zone ──
    if (v.targetZoneId && v.currentZoneId && v.targetZoneId !== v.currentZoneId) {
      return this.transitThroughGate(v);
    }

    // ── 4. In target zone already → pick next ──
    return this.assignNextTarget({ ...v, currentAction: VISITOR_ACTION.IDLE });
  }

  /**
   * Begin walking from current zone to target zone.
   * Computes waypoints: [exit gate outward] → [entrance gate of target] → [target center]
   */
  private startTransit(v: Visitor): Visitor {
    const fromZone = this.zoneMap.get(v.currentZoneId as string)!;
    const toZone = this.zoneMap.get(v.targetZoneId as string)!;
    if (!fromZone || !toZone) return v;

    // Find the exact gate pair from ZoneGraph edges (handles bidirectional correctly)
    const path = this.zoneGraph.findPath(v.currentZoneId!, v.targetZoneId!);
    const nextHop = path && path.length > 1 ? path[1] : v.targetZoneId!;
    const edges = this.zoneGraph.getEdges(v.currentZoneId!);
    const edge = edges.find(e => (e.toZoneId as string) === (nextHop as string));

    let exitGatePos: Vector2D;
    let entryGatePos: Vector2D;

    if (edge) {
      // Use exact gate positions from edge
      const fromNode = this.zoneGraph.getNode(v.currentZoneId!);
      const toNode = this.zoneGraph.getNode(nextHop);
      const exitGate = fromNode?.gates.find(g => (g.id as string) === (edge.fromGateId as string));
      const entryGate = toNode?.gates.find(g => (g.id as string) === (edge.toGateId as string));
      exitGatePos = exitGate?.position ?? this.gatePosition(fromZone, 'exit');
      entryGatePos = entryGate?.position ?? this.gatePosition(toZone, 'entrance');
    } else {
      // Fallback
      exitGatePos = this.gatePosition(fromZone, 'exit');
      entryGatePos = this.gatePosition(toZone, 'entrance');
    }

    const toCenter = {
      x: toZone.bounds.x + toZone.bounds.w / 2,
      y: toZone.bounds.y + toZone.bounds.h / 2,
    };

    // Build transit path through the gap between zones
    const MARGIN = 20;
    const exitOutward = this.pushOutward(exitGatePos, fromZone, MARGIN);
    const entryApproach = this.pushOutward(entryGatePos, toZone, MARGIN);

    // Find the midpoint Y between fromZone and toZone edges (the gap)
    const fromB = fromZone.bounds;
    const toB = toZone.bounds;
    let gapY: number;
    if (fromB.y + fromB.h < toB.y) {
      // toZone is below fromZone — gap between bottom of from and top of to
      gapY = (fromB.y + fromB.h + toB.y) / 2;
    } else if (toB.y + toB.h < fromB.y) {
      // toZone is above fromZone — gap between bottom of to and top of from
      gapY = (toB.y + toB.h + fromB.y) / 2;
    } else {
      // Zones overlap vertically — use midpoint of both centers
      gapY = ((fromB.y + fromB.h / 2) + (toB.y + toB.h / 2)) / 2;
    }

    const waypoints: Vector2D[] = [exitGatePos, exitOutward];

    // Check if direct path crosses any non-source/target zone
    const pathCrossesZone = (a: Vector2D, b: Vector2D) => {
      for (const zone of this.world.zones) {
        if ((zone.id as string) === (fromZone.id as string)) continue;
        if ((zone.id as string) === (toZone.id as string)) continue;
        if (this.lineIntersectsRect(a, b, zone.bounds)) return true;
      }
      return false;
    };

    if (Math.abs(exitOutward.y - entryApproach.y) < 30 && !pathCrossesZone(exitOutward, entryApproach)) {
      // Nearly horizontal and clear — direct path
    } else {
      // Check if vertical path (same x) would cross zones
      const sameX = Math.abs(exitOutward.x - entryApproach.x) < 30;

      if (sameX && pathCrossesZone(exitOutward, entryApproach)) {
        // Vertical stack: offset X to route AROUND zones
        // Find safe X: go left or right of all zones in between
        let minX = Infinity, maxX = -Infinity;
        for (const zone of this.world.zones) {
          minX = Math.min(minX, zone.bounds.x);
          maxX = Math.max(maxX, zone.bounds.x + zone.bounds.w);
        }
        const goLeft = (exitOutward.x - minX) < (maxX - exitOutward.x);
        const safeX = goLeft ? minX - MARGIN : maxX + MARGIN;
        waypoints.push({ x: safeX, y: exitOutward.y });
        waypoints.push({ x: safeX, y: entryApproach.y });
      } else {
        // Normal gap routing
        waypoints.push({ x: exitOutward.x, y: gapY });
        waypoints.push({ x: entryApproach.x, y: gapY });
      }
    }

    waypoints.push(entryApproach, entryGatePos, toCenter);

    return {
      ...v,
      currentZoneId: null,  // in transit — no zone owns this agent
      transitWaypoints: waypoints,
      transitWaypointIdx: 0,
      steering: { ...v.steering, isArrived: false },
    };
  }

  /**
   * Gate chaining: step through gate to next zone in multi-hop path.
   * Agent snaps to the connected entry gate position and enters the next zone.
   * Falls back to startTransit() if no gate path exists.
   */
  private transitThroughGate(v: Visitor): Visitor {
    // Always use startTransit — agents must physically walk through gates.
    // startTransit computes proper waypoints: exit gate → gap → entry gate → center.
    return this.startTransit(v);
  }

  /**
   * Route a path from A to B, adding waypoints to avoid zones in between.
   * Returns array of waypoints including A and B.
   */
  private routeAroundZones(from: Vector2D, to: Vector2D, excludeFrom: ZoneConfig, excludeTo: ZoneConfig): Vector2D[] {
    const MARGIN = 25; // px clearance around zones

    // Find zones that the direct path intersects (excluding source/target)
    const blockingZones: ZoneConfig[] = [];
    for (const zone of this.world.zones) {
      if ((zone.id as string) === (excludeFrom.id as string)) continue;
      if ((zone.id as string) === (excludeTo.id as string)) continue;
      if (this.lineIntersectsRect(from, to, zone.bounds)) {
        blockingZones.push(zone);
      }
    }

    if (blockingZones.length === 0) {
      return [from, to]; // direct path is clear
    }

    // For each blocking zone, compute corner waypoints to go around it
    // Pick the corner closest to the midpoint of from→to
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    const detourPoints: Vector2D[] = [from];

    for (const zone of blockingZones) {
      const b = zone.bounds;
      // 4 corners with margin
      const corners: Vector2D[] = [
        { x: b.x - MARGIN, y: b.y - MARGIN },           // top-left
        { x: b.x + b.w + MARGIN, y: b.y - MARGIN },     // top-right
        { x: b.x + b.w + MARGIN, y: b.y + b.h + MARGIN }, // bottom-right
        { x: b.x - MARGIN, y: b.y + b.h + MARGIN },     // bottom-left
      ];

      // Pick the 2 corners closest to the line from→to, then pick the one
      // that creates the shortest detour
      let bestCorner = corners[0];
      let bestDist = Infinity;
      for (const c of corners) {
        const d = Math.sqrt((c.x - midX) ** 2 + (c.y - midY) ** 2);
        if (d < bestDist) {
          bestDist = d;
          bestCorner = c;
        }
      }
      detourPoints.push(bestCorner);
    }

    detourPoints.push(to);
    return detourPoints;
  }

  /** Check if a line segment from A to B intersects a rectangle */
  private lineIntersectsRect(a: Vector2D, b: Vector2D, rect: { x: number; y: number; w: number; h: number }): boolean {
    const { x, y, w, h } = rect;
    // Check all 4 edges of the rect
    return (
      this.linesIntersect(a, b, { x, y }, { x: x + w, y }) ||           // top
      this.linesIntersect(a, b, { x: x + w, y }, { x: x + w, y: y + h }) || // right
      this.linesIntersect(a, b, { x: x + w, y: y + h }, { x, y: y + h }) || // bottom
      this.linesIntersect(a, b, { x, y: y + h }, { x, y }) ||           // left
      // Also check if line is entirely inside rect
      (a.x >= x && a.x <= x + w && a.y >= y && a.y <= y + h) ||
      (b.x >= x && b.x <= x + w && b.y >= y && b.y <= y + h)
    );
  }

  /** Check if two line segments intersect */
  private linesIntersect(a1: Vector2D, a2: Vector2D, b1: Vector2D, b2: Vector2D): boolean {
    const d1 = this.cross(b1, b2, a1);
    const d2 = this.cross(b1, b2, a2);
    const d3 = this.cross(a1, a2, b1);
    const d4 = this.cross(a1, a2, b2);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    return false;
  }

  private cross(a: Vector2D, b: Vector2D, c: Vector2D): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  /** Push a point outward from zone center by `dist` pixels */
  private pushOutward(gatePos: Vector2D, zone: ZoneConfig, dist: number): Vector2D {
    const cx = zone.bounds.x + zone.bounds.w / 2;
    const cy = zone.bounds.y + zone.bounds.h / 2;
    const dx = gatePos.x - cx;
    const dy = gatePos.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: gatePos.x + (dx / len) * dist, y: gatePos.y + (dy / len) * dist };
  }

  /** Find a gate position on a zone by type preference */
  private gatePosition(zone: ZoneConfig, prefer: 'entrance' | 'exit'): Vector2D {
    const g = zone.gates.find(g => g.type === prefer)
      ?? zone.gates.find(g => g.type === 'bidirectional')
      ?? zone.gates[0];
    return g?.position ?? { x: zone.bounds.x + zone.bounds.w / 2, y: zone.bounds.y + zone.bounds.h / 2 };
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
    const curZone = v.currentZoneId ? this.zoneMap.get(v.currentZoneId as string) : null;
    const allZones = this.world.zones;
    const globalMode = this.world.globalFlowMode ?? 'free';

    // ═══ FREE MODE ═══
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

    // Check if all reachable non-entrance zones have been visited
    const visitedSet = new Set(v.visitedZoneIds.map(id => id as string));
    const allReachableVisited = curZone
      ? this.zoneGraph.getReachableZones(curZone.id)
          .filter(zid => {
            const z = this.zoneMap.get(zid as string);
            return z && z.type !== 'entrance' && z.type !== 'gateway';
          })
          .every(zid => visitedSet.has(zid as string))
      : false;

    // Gateway/exit: exit only after exploring all reachable zones
    const isInExitZone = curZone?.type === 'exit'
      || (curZone?.type === 'gateway' && v.visitedZoneIds.length > 1 && allReachableVisited);

    // 1. Media in current zone FIRST (skip entrance zones on first visit)
    const skipMedia = isInEntranceZone && v.visitedZoneIds.length <= 1;
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
    const exitZones = this.world.zones.filter(z => z.type === 'exit' || z.type === 'gateway');
    if (v.fatigue > 0.9 && !isInExitZone && exitZones.length > 0) {
      const nearest = this.findNearestZone(v.position, exitZones);
      if (nearest) return this.setExitTarget(v, nearest);
    }

    // 3. Fatigued → rest
    if (v.fatigue > 0.7 && curZone?.type !== 'rest') {
      const rest = this.world.zones.find(z => z.type === 'rest' && !v.visitedZoneIds.includes(z.id));
      if (rest) return this.setZoneTarget(v, rest);
    }

    // 4. Pick next zone: adjacent unvisited zones via ZoneGraph
    if (curZone) {
      const reachable = this.zoneGraph.getReachableZones(curZone.id);
      const visitedSet = new Set(v.visitedZoneIds.map(id => id as string));
      const unvisitedReachable = reachable
        .filter(zid => !visitedSet.has(zid as string))
        .map(zid => this.zoneMap.get(zid as string))
        .filter((z): z is ZoneConfig => !!z && z.type !== 'entrance'); // don't revisit entrance

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

    // 5. All reachable zones visited → head to nearest exit
    if (exitZones.length > 0) {
      const nearest = this.findNearestZone(v.position, exitZones);
      if (nearest) return this.setExitTarget(v, nearest);
    }

    // Fallback: wander
    return {
      ...v, currentAction: VISITOR_ACTION.MOVING,
      steering: { ...v.steering, activeBehavior: STEERING_BEHAVIOR.WANDER },
    };
  }

  /** Begin exit sequence: walk to exit gate then off-canvas */
  private beginExit(v: Visitor, curZone: ZoneConfig): Visitor {
    const exitGatePos = this.gatePosition(curZone, 'exit');
    const outside = this.pushOutward(exitGatePos, curZone, 150);
    return {
      ...v,
      currentZoneId: null,
      transitWaypoints: [exitGatePos, outside],
      transitWaypointIdx: 0,
      targetZoneId: null,
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
    // 1. Transit waypoint (highest priority)
    if (v.transitWaypoints.length > 0 && v.transitWaypointIdx < v.transitWaypoints.length) {
      return v.transitWaypoints[v.transitWaypointIdx];
    }

    // 2. Media
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
      const headingToGate = !!(v.targetZoneId && v.currentZoneId && v.targetZoneId !== v.currentZoneId);

      if (headingToGate) {
        // Gate transit: seek at constant speed, no deceleration
        const dist = Math.sqrt(distSq);
        if (dist < 10) {
          return { ...v, steering: { ...v.steering, isArrived: true } };
        }
        const desired = { x: (dx / dist) * v.profile.maxSpeed, y: (dy / dist) * v.profile.maxSpeed };
        outputs.push({ output: { linear: { x: desired.x - v.velocity.x, y: desired.y - v.velocity.y }, angular: 0 }, weight: 1.0 });
      } else {
        // Normal arrival with deceleration
        outputs.push({ output: arrival(v.position, target, v.profile.maxSpeed, v.velocity, physics.arrivalSlowRadius, physics.arrivalRadius), weight: 1.0 });
        if (distSq < physics.arrivalRadius * physics.arrivalRadius) {
          return { ...v, steering: { ...v.steering, isArrived: true }, velocity: { x: 0, y: 0 } };
        }
      }
    } else {
      const { steering: ws, newWanderAngle } = wander(v.velocity, v.steering.wanderAngle, physics, (this.rng.next() - 0.5) * physics.wanderJitter * dtS);
      outputs.push({ output: ws, weight: 0.5 });
      return { ...v, steering: { ...v.steering, wanderAngle: newWanderAngle } };
    }

    // Wall avoidance
    if (v.currentZoneId && v.transitWaypoints.length === 0) {
      // Inside a zone: avoid zone walls + media obstacles
      const zone = this.zoneMap.get(v.currentZoneId as string);
      if (zone) {
        const walls = getZoneWalls(zone);
        const zoneMedia = this.mediaByZone.get(v.currentZoneId as string);
        if (zoneMedia) {
          for (const m of zoneMedia) {
            if (v.targetMediaId && (m.id as string) === (v.targetMediaId as string)) continue;
            walls.push(...this.getMediaWalls(m));
          }
        }
        outputs.push({
          output: obstacleAvoidance(v.position, v.velocity, walls, physics.obstacleAvoidanceLookahead ?? 30, v.profile.maxForce),
          weight: 0.8,
        });
      }
    }

    // Separation
    const neighbors = this.spatialHash.queryRadius(v.id, physics.avoidanceRadius);
    if (neighbors.length > 0) {
      outputs.push({
        output: separation(v.position, neighbors.map(n => n.position), physics.avoidanceRadius, physics.separationStrength),
        weight: 0.5,
      });
    }

    return { ...v, steering: { ...v.steering, currentSteering: combineSteeringPriority(outputs, v.profile.maxForce) } };
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

    // Zone boundary collision — keep agent inside current zone
    // Gate proximity exemption allows walking through gates
    if (v.currentZoneId) {
      const zone = this.zoneMap.get(v.currentZoneId as string);
      if (zone) {
        const poly = getZonePolygon(zone);
        if (!isPointInPolygon(pos, poly)) {
          let nearGate = false;
          for (const gate of zone.gates) {
            const gdx = pos.x - gate.position.x;
            const gdy = pos.y - gate.position.y;
            if (gdx * gdx + gdy * gdy < 900) { nearGate = true; break; }
          }
          if (!nearGate) {
            const center = { x: zone.bounds.x + zone.bounds.w / 2, y: zone.bounds.y + zone.bounds.h / 2 };
            pos = clampToPolygon(pos, poly, center);
          }
        }
      }
    }
    // Transit (currentZoneId = null): only during EXIT — agent follows waypoints to canvas edge

    // Media obstacle collision — push agent outside media (rect or circle, skip target)
    if (v.currentZoneId) {
      const zoneMedia = this.mediaByZone.get(v.currentZoneId as string);
      if (zoneMedia) {
        for (const m of zoneMedia) {
          if (v.targetMediaId && (m.id as string) === (v.targetMediaId as string)) continue;
          if (this.isInsideMedia(pos, m)) {
            pos = this.pushOutsideMedia(pos, m);
          }
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
