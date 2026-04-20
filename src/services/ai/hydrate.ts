import type {
  Scenario, FloorConfig, ZoneConfig, MediaPlacement,
  HexColor, MediaInteractionType,
  WaypointNode, WaypointEdge, WaypointGraph,
} from '@/domain';
import {
  DEFAULT_PHYSICS, DEFAULT_SKIP_THRESHOLD, MEDIA_PRESETS,
  ZoneId, MediaId, FloorId, ScenarioId,
  WaypointId, WaypointEdgeId,
} from '@/domain';
import type { DraftScenario, DraftZone, HydrationWarning } from './types';

export interface HydrationResult {
  readonly scenario: Scenario;
  readonly warnings: readonly HydrationWarning[];
}

/** Default px-per-meter. Matches VELA's canvas.scale = 0.025 (i.e. 1 px = 0.025 m → 40 px/m). */
const PX_PER_METER = 40;
/** Canvas margin around the floor plan so gates/media near edges don't clip. */
const CANVAS_MARGIN_PX = 80;
/** Zone rects whose gap is within this distance (meters) count as spatially adjacent. */
const ADJACENCY_TOL_M = 0.75;

const ZONE_PALETTE: readonly HexColor[] = [
  '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15',
  '#4ade80', '#22d3ee', '#f87171', '#c084fc', '#34d399',
];

/**
 * Hydrate a DraftScenario (from Claude Vision) into a runnable VELA Scenario.
 *
 * Emits a graph-point waypoint graph (ENTRY / EXIT / ZONE / ATTRACTOR nodes,
 * bidirectional edges) — this is what the current SimEngine consumes. Legacy
 * gate-per-zone output is not generated.
 */
export function hydrateDraft(draft: DraftScenario, backgroundImage: string): HydrationResult {
  const warnings: HydrationWarning[] = [];

  // ── Canvas dimensions ──────────────────────────────────────────────────
  const imageWidthM = Number.isFinite(draft.scale?.widthMeters) && draft.scale.widthMeters > 0
    ? draft.scale.widthMeters : 20;
  const imageHeightM = Number.isFinite(draft.scale?.heightMeters) && draft.scale.heightMeters > 0
    ? draft.scale.heightMeters : 15;
  if (!draft.scale || !Number.isFinite(draft.scale.widthMeters)) {
    warnings.push({ severity: 'warning', message: 'Scale not detected — assumed 20m × 15m. Rescale via background tools if wrong.' });
  }

  const canvasWidthPx = Math.round(imageWidthM * PX_PER_METER + CANVAS_MARGIN_PX * 2);
  const canvasHeightPx = Math.round(imageHeightM * PX_PER_METER + CANVAS_MARGIN_PX * 2);

  const floorId = FloorId('floor_1f');
  const m2px = (m: number) => Math.round(m * PX_PER_METER + CANVAS_MARGIN_PX);
  const sz2px = (m: number) => Math.round(m * PX_PER_METER);

  // ── Zones ──────────────────────────────────────────────────────────────
  const zoneKeyToId = new Map<string, string>();
  const validDrafts: DraftZone[] = [];
  const zones: ZoneConfig[] = [];
  let colorIdx = 0;

  for (const dz of draft.zones ?? []) {
    if (!dz.key || !dz.rect) {
      warnings.push({ severity: 'warning', message: `Zone "${dz.name || '?'}" dropped: missing key or rect.` });
      continue;
    }
    const zoneIdStr = `zone_${dz.key}`;
    zoneKeyToId.set(dz.key, zoneIdStr);
    validDrafts.push(dz);

    const rectPx = {
      x: m2px(dz.rect.x),
      y: m2px(dz.rect.y),
      w: sz2px(Math.max(0.5, dz.rect.w)),
      h: sz2px(Math.max(0.5, dz.rect.h)),
    };
    const areaM2 = dz.rect.w * dz.rect.h;
    const capacity = Math.max(2, Math.floor(areaM2 / 1.2));

    const zone: ZoneConfig = {
      id: ZoneId(zoneIdStr),
      name: dz.name || dz.key,
      type: dz.type,
      shape: 'rect',
      bounds: rectPx,
      polygon: null,
      area: Math.round(areaM2),
      capacity,
      flowType: dz.flowType ?? 'free',
      gates: [],
      mediaIds: [],
      color: ZONE_PALETTE[colorIdx++ % ZONE_PALETTE.length],
      attractiveness: clamp01(dz.attractiveness ?? 0.5),
      metadata: {},
    };
    zones.push(zone);
  }

  if (zones.length === 0) {
    warnings.push({ severity: 'error', message: 'No valid zones produced — scenario cannot be loaded.' });
  }

  // ── Media placements ───────────────────────────────────────────────────
  const mediaList: MediaPlacement[] = [];
  const zoneMediaMap = new Map<string, string[]>();

  for (const dm of draft.media ?? []) {
    const zoneIdStr = zoneKeyToId.get(dm.zoneKey);
    if (!zoneIdStr) {
      warnings.push({ severity: 'warning', message: `Media "${dm.name}" dropped: unknown zoneKey "${dm.zoneKey}".` });
      continue;
    }
    const preset = MEDIA_PRESETS[dm.type];
    if (!preset) {
      warnings.push({ severity: 'warning', message: `Media "${dm.name}" dropped: unknown type "${dm.type}".` });
      continue;
    }
    const mediaIdStr = `media_${mediaList.length + 1}`;
    const size = dm.size
      ? { width: sz2px(dm.size.width), height: sz2px(dm.size.height) }
      : { width: sz2px(preset.defaultSize.width), height: sz2px(preset.defaultSize.height) };

    const interactionType: MediaInteractionType =
      preset.category === 'analog' ? 'analog'
      : preset.category === 'passive_media' ? 'passive'
      : preset.category === 'immersive' ? 'staged'
      : 'active';

    const placement: MediaPlacement = {
      id: MediaId(mediaIdStr),
      name: dm.name || dm.type,
      type: dm.type,
      category: preset.category,
      zoneId: ZoneId(zoneIdStr),
      position: { x: m2px(dm.position.x), y: m2px(dm.position.y) },
      size,
      orientation: dm.orientation ?? 0,
      capacity: preset.defaultCapacity,
      avgEngagementTimeMs: preset.avgEngagementTimeMs,
      attractiveness: preset.attractionPower,
      attractionRadius: preset.attractionRadius,
      interactionType,
      omnidirectional: preset.omnidirectional,
      queueBehavior: preset.queueBehavior,
      groupFriendly: preset.groupFriendly,
      shape: 'rect',
    };
    mediaList.push(placement);

    const arr = zoneMediaMap.get(zoneIdStr) ?? [];
    arr.push(mediaIdStr);
    zoneMediaMap.set(zoneIdStr, arr);
  }

  // Attach mediaIds to zones
  const finalZones: ZoneConfig[] = zones.map((z) => ({
    ...z,
    mediaIds: (zoneMediaMap.get(z.id as string) ?? []).map((s) => MediaId(s)),
  }));

  // ── Waypoint graph ─────────────────────────────────────────────────────
  const nodes: WaypointNode[] = [];
  const edges: WaypointEdge[] = [];
  const zoneKeyToNodeId = new Map<string, string>();

  let spawnCount = 0;
  let exitCount = 0;

  for (const dz of validDrafts) {
    const zoneIdStr = zoneKeyToId.get(dz.key)!;
    const centerM = {
      x: dz.rect.x + dz.rect.w / 2,
      y: dz.rect.y + dz.rect.h / 2,
    };
    const role = dz.role ?? 'exhibit';
    const nodeType =
      role === 'spawn' ? 'entry'
      : role === 'exit' ? 'exit'
      : role === 'rest' ? 'rest'
      : 'zone';
    if (role === 'spawn') spawnCount++;
    if (role === 'exit') exitCount++;

    const nodeIdStr = `wp_${dz.key}`;
    zoneKeyToNodeId.set(dz.key, nodeIdStr);

    const zoneCapacity = Math.max(2, Math.floor((dz.rect.w * dz.rect.h) / 1.2));
    const attractiveness = clamp01(dz.attractiveness ?? (role === 'exhibit' ? 0.6 : 0.3));

    nodes.push({
      id: WaypointId(nodeIdStr),
      type: nodeType,
      position: { x: m2px(centerM.x), y: m2px(centerM.y) },
      floorId,
      label: dz.name || dz.key,
      attraction: attractiveness,
      dwellTimeMs: role === 'exhibit' ? 30_000 : role === 'rest' ? 45_000 : 0,
      capacity: zoneCapacity,
      spawnWeight: role === 'spawn' ? 1 : 0,
      lookAt: 0,
      zoneId: ZoneId(zoneIdStr),
      mediaId: null,
    });
  }

  // Fallback: if AI forgot to mark spawn/exit, promote sensible defaults so the
  // graph is at least runnable.
  if (spawnCount === 0 && validDrafts.length > 0) {
    const first = validDrafts[0];
    const nodeIdStr = zoneKeyToNodeId.get(first.key)!;
    const idx = nodes.findIndex((n) => (n.id as string) === nodeIdStr);
    if (idx >= 0) {
      nodes[idx] = { ...nodes[idx], type: 'entry', spawnWeight: 1, dwellTimeMs: 0 };
      warnings.push({ severity: 'warning', message: `No spawn zone marked — promoted "${first.name}" to ENTRY.` });
    }
  }
  if (exitCount === 0 && validDrafts.length > 0) {
    const last = validDrafts[validDrafts.length - 1];
    const nodeIdStr = zoneKeyToNodeId.get(last.key)!;
    const idx = nodes.findIndex((n) => (n.id as string) === nodeIdStr);
    if (idx >= 0 && nodes[idx].type !== 'entry') {
      nodes[idx] = { ...nodes[idx], type: 'exit', dwellTimeMs: 0 };
      warnings.push({ severity: 'warning', message: `No exit zone marked — promoted "${last.name}" to EXIT.` });
    }
  }

  // ATTRACTOR nodes for media
  for (const placement of mediaList) {
    const nodeIdStr = `wp_${placement.id as string}`;
    nodes.push({
      id: WaypointId(nodeIdStr),
      type: 'attractor',
      position: placement.position,
      floorId,
      label: placement.name,
      attraction: placement.attractiveness,
      dwellTimeMs: placement.avgEngagementTimeMs,
      capacity: placement.capacity,
      spawnWeight: 0,
      lookAt: placement.orientation,
      zoneId: placement.zoneId,
      mediaId: placement.id,
    });
  }

  // ── Edges ──────────────────────────────────────────────────────────────
  // Bidirectional zone ↔ zone edges from explicit connections, plus spatial
  // adjacency fallback when the AI didn't declare any for a zone.
  const edgeKeys = new Set<string>();
  const addEdge = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const pair = [fromKey, toKey].sort().join('|');
    if (edgeKeys.has(pair)) return;
    edgeKeys.add(pair);
    const fromId = zoneKeyToNodeId.get(fromKey);
    const toId = zoneKeyToNodeId.get(toKey);
    if (!fromId || !toId) return;
    const fromNode = nodes.find((n) => (n.id as string) === fromId)!;
    const toNode = nodes.find((n) => (n.id as string) === toId)!;
    const cost = Math.round(distance(fromNode.position, toNode.position));
    edges.push({
      id: WaypointEdgeId(`edge_${fromKey}_${toKey}`),
      fromId: WaypointId(fromId),
      toId: WaypointId(toId),
      direction: 'bidirectional',
      passWeight: 0.5,
      cost,
    });
  };

  for (const dz of validDrafts) {
    const conns = dz.connections ?? [];
    if (conns.length > 0) {
      for (const other of conns) {
        if (!zoneKeyToId.has(other)) {
          warnings.push({ severity: 'warning', message: `Zone "${dz.name}" connects to unknown key "${other}".` });
          continue;
        }
        addEdge(dz.key, other);
      }
    }
  }

  // Spatial adjacency fallback for zones that ended up with no connections
  const nodeDegree = new Map<string, number>();
  for (const e of edges) {
    const f = (e.fromId as string), t = (e.toId as string);
    nodeDegree.set(f, (nodeDegree.get(f) ?? 0) + 1);
    nodeDegree.set(t, (nodeDegree.get(t) ?? 0) + 1);
  }
  for (const dz of validDrafts) {
    const nodeId = zoneKeyToNodeId.get(dz.key)!;
    if ((nodeDegree.get(nodeId) ?? 0) > 0) continue;
    for (const other of validDrafts) {
      if (other.key === dz.key) continue;
      if (rectsAdjacent(dz.rect, other.rect, ADJACENCY_TOL_M)) {
        addEdge(dz.key, other.key);
      }
    }
  }

  // Zone → ATTRACTOR edges (each media is reachable via its parent zone)
  for (const placement of mediaList) {
    // Find zone key from zoneId
    const zoneIdStr = placement.zoneId as string;
    const dz = validDrafts.find((d) => zoneKeyToId.get(d.key) === zoneIdStr);
    if (!dz) continue;
    const zoneNodeId = zoneKeyToNodeId.get(dz.key)!;
    const attractorNodeId = `wp_${placement.id as string}`;
    const zoneNode = nodes.find((n) => (n.id as string) === zoneNodeId)!;
    const attractorNode = nodes.find((n) => (n.id as string) === attractorNodeId)!;
    edges.push({
      id: WaypointEdgeId(`edge_${dz.key}_${placement.id as string}`),
      fromId: WaypointId(zoneNodeId),
      toId: WaypointId(attractorNodeId),
      direction: 'bidirectional',
      passWeight: 0.5,
      cost: Math.round(distance(zoneNode.position, attractorNode.position)),
    });
  }

  // Reachability sanity check
  if (nodes.some((n) => n.type === 'entry') && nodes.some((n) => n.type === 'exit')) {
    const reachable = reachableFromEntries(nodes, edges);
    const unreachable = nodes.filter(
      (n) => (n.type === 'zone' || n.type === 'exit' || n.type === 'attractor' || n.type === 'rest') && !reachable.has(n.id as string),
    );
    for (const n of unreachable) {
      warnings.push({ severity: 'warning', message: `Node "${n.label}" is unreachable from any spawn. Check zone connections.` });
    }
  }

  const waypointGraph: WaypointGraph = { nodes, edges };

  // ── Floor ──────────────────────────────────────────────────────────────
  const floor: FloorConfig = {
    id: floorId,
    name: '1F',
    level: 0,
    canvas: {
      width: canvasWidthPx,
      height: canvasHeightPx,
      gridSize: PX_PER_METER,
      backgroundImage,
      scale: 1 / PX_PER_METER,
      bgOffsetX: CANVAS_MARGIN_PX,
      bgOffsetY: CANVAS_MARGIN_PX,
      bgScale: 1,
      bgLocked: false,
    },
    zoneIds: finalZones.map((z) => z.id),
    metadata: {},
  };

  // ── Scenario ───────────────────────────────────────────────────────────
  const now = Date.now();
  const scenario: Scenario = {
    meta: {
      id: ScenarioId(`project_${now}`),
      name: draft.name || 'AI-generated layout',
      description: draft.notes ?? '',
      version: 1,
      parentId: null,
      tags: ['ai-generated'],
      createdAt: now,
      updatedAt: now,
    },
    floors: [floor],
    zones: finalZones,
    media: mediaList,
    waypointGraph,
    visitorDistribution: {
      totalCount: 200,
      profileWeights: { general: 60, vip: 15, child: 10, elderly: 10, disabled: 5 },
      engagementWeights: { quick: 30, explorer: 40, immersive: 30 },
      groupRatio: 0.3,
      spawnRatePerSecond: 0.2,
    },
    simulationConfig: {
      fixedDeltaTime: 1000 / 60,
      duration: 3_600_000,
      timeScale: 3,
      maxVisitors: 500,
      seed: Math.floor(Math.random() * 99999),
      physics: DEFAULT_PHYSICS,
      skipThreshold: DEFAULT_SKIP_THRESHOLD,
      timeSlots: [{
        startTimeMs: 0, endTimeMs: 3_600_000, spawnRatePerSecond: 0.2,
        profileDistribution: { general: 60, vip: 15, child: 10, elderly: 10, disabled: 5 },
        engagementDistribution: { quick: 30, explorer: 40, immersive: 30 },
        groupRatio: 0.3,
      }],
    },
  };

  return { scenario, warnings };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x; const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** True if two axis-aligned rects are within `tol` meters (touching or barely separated). */
function rectsAdjacent(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  tol: number,
): boolean {
  const gapX = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const gapY = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  // Adjacent means they touch on one axis and overlap on the other.
  const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
  const overlapY = a.y < b.y + b.h && b.y < a.y + a.h;
  if (overlapX && gapY <= tol) return true;
  if (overlapY && gapX <= tol) return true;
  return false;
}

function reachableFromEntries(
  nodes: readonly WaypointNode[],
  edges: readonly WaypointEdge[],
): Set<string> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const f = e.fromId as string, t = e.toId as string;
    adj.set(f, [...(adj.get(f) ?? []), t]);
    if (e.direction === 'bidirectional') {
      adj.set(t, [...(adj.get(t) ?? []), f]);
    }
  }
  const seen = new Set<string>();
  const queue: string[] = nodes.filter((n) => n.type === 'entry').map((n) => n.id as string);
  for (const s of queue) seen.add(s);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}
