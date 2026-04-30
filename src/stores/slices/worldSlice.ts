import type { StateCreator } from 'zustand';
import type { FloorConfig, ZoneConfig, MediaPlacement, Scenario, WaypointGraph, WaypointNode, WaypointEdge, ElevatorShaft } from '@/domain';
import { zonesOverlap } from '@/domain/zoneGeometry';
import {
  floorsNeedRelayout,
  layoutFloorsHorizontally,
  computeNewFloorOrigin,
  computeFloorContentBbox,
  shiftFloorChildren,
  findFloorAtPoint,
  clampFloorShift,
  clampFloorResize,
} from '@/domain/floorLayout';

const MEDIA_SCALE = 20;
const MEDIA_GAP = 0;
const CANVAS_PADDING = 100; // extra padding beyond zone edges
const GATE_LINK_DIST = 80; // max distance for auto-linking gates (px)

/**
 * Auto-link gates between zones based on physical proximity.
 * For each unconnected gate, find the nearest unconnected gate in another zone within GATE_LINK_DIST.
 * Creates mutual connections (A→B, B→A).
 */
function autoLinkGates(zones: readonly ZoneConfig[]): ZoneConfig[] {
  // Collect all gates with zone reference
  type GateRef = { zoneIdx: number; gateIdx: number; pos: { x: number; y: number }; id: string; connected: string | null };
  const allGates: GateRef[] = [];
  for (let zi = 0; zi < zones.length; zi++) {
    for (let gi = 0; gi < zones[zi].gates.length; gi++) {
      const g = zones[zi].gates[gi];
      allGates.push({
        zoneIdx: zi, gateIdx: gi,
        pos: g.position as { x: number; y: number },
        id: g.id as string,
        connected: g.connectedGateId as string | null,
      });
    }
  }

  // Find pairs of unconnected gates that are close enough
  const newConnections = new Map<string, string>(); // gateId → connectedGateId
  const used = new Set<string>();

  for (const a of allGates) {
    if (a.connected || used.has(a.id)) continue;
    let bestDist = GATE_LINK_DIST * GATE_LINK_DIST;
    let bestGate: GateRef | null = null;

    for (const b of allGates) {
      if (b.zoneIdx === a.zoneIdx) continue; // same zone
      if (b.connected || used.has(b.id)) continue;
      const dx = a.pos.x - b.pos.x;
      const dy = a.pos.y - b.pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDist) {
        bestDist = distSq;
        bestGate = b;
      }
    }

    if (bestGate) {
      newConnections.set(a.id, bestGate.id);
      newConnections.set(bestGate.id, a.id);
      used.add(a.id);
      used.add(bestGate.id);
    }
  }

  if (newConnections.size === 0) return zones as ZoneConfig[];

  // Apply connections
  return zones.map(z => ({
    ...z,
    gates: z.gates.map((g: any) => {
      const newConn = newConnections.get(g.id as string);
      if (newConn && !g.connectedGateId) {
        return { ...g, connectedGateId: newConn };
      }
      return g;
    }),
  }));
}

/** Auto-expand floor canvas to fit all zones with padding */
function expandCanvasForZones(floors: FloorConfig[], zones: readonly ZoneConfig[], activeFloorId: string | null): FloorConfig[] {
  if (!activeFloorId) return floors;
  const floor = floors.find(f => (f.id as string) === activeFloorId);
  if (!floor) return floors;

  let maxX = floor.canvas.width;
  let maxY = floor.canvas.height;
  for (const z of zones) {
    const right = z.bounds.x + z.bounds.w + CANVAS_PADDING;
    const bottom = z.bounds.y + z.bounds.h + CANVAS_PADDING;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  if (maxX === floor.canvas.width && maxY === floor.canvas.height) return floors;
  return floors.map(f =>
    (f.id as string) === activeFloorId
      ? { ...f, canvas: { ...f.canvas, width: maxX, height: maxY } }
      : f,
  );
}

/** Get half-extents of rotated media's AABB */
function rotatedHalfExtents(w: number, h: number, orientationDeg: number): { hx: number; hy: number } {
  const rad = (orientationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  return { hx: (w * cos + h * sin) / 2, hy: (w * sin + h * cos) / 2 };
}

/** Get world-space boundary polygon vertices for a media (shape-aware). */
function getMediaWorldVertices(m: MediaPlacement): { x: number; y: number }[] {
  const shape = (m as any).shape;
  const rad = (m.orientation * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const toWorld = (lx: number, ly: number) => ({
    x: m.position.x + lx * cos - ly * sin,
    y: m.position.y + lx * sin + ly * cos,
  });
  if (shape === 'custom' && m.polygon && m.polygon.length > 2) {
    return m.polygon.map(p => toWorld(p.x, p.y));
  }
  if (shape === 'circle') {
    const r = Math.max(m.size.width, m.size.height) * MEDIA_SCALE / 2;
    const pts: { x: number; y: number }[] = [];
    const segs = 16;
    for (let i = 0; i < segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      pts.push(toWorld(Math.cos(t) * r, Math.sin(t) * r));
    }
    return pts;
  }
  if (shape === 'ellipse') {
    const a = m.size.width * MEDIA_SCALE / 2;
    const b = m.size.height * MEDIA_SCALE / 2;
    const pts: { x: number; y: number }[] = [];
    const segs = 16;
    for (let i = 0; i < segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      pts.push(toWorld(Math.cos(t) * a, Math.sin(t) * b));
    }
    return pts;
  }
  // rect
  const hw = m.size.width * MEDIA_SCALE / 2, hh = m.size.height * MEDIA_SCALE / 2;
  return [toWorld(-hw, -hh), toWorld(hw, -hh), toWorld(hw, hh), toWorld(-hw, hh)];
}

/** SAT-based convex polygon overlap with gap buffer. Returns true if polys overlap (or within `gap`). */
function polygonsOverlapWithGap(a: { x: number; y: number }[], b: { x: number; y: number }[], gap: number): boolean {
  const tryAxes = (poly: { x: number; y: number }[]) => {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
      // Outward normal of edge
      const ex = p2.x - p1.x, ey = p2.y - p1.y;
      const len = Math.hypot(ex, ey) || 1;
      const nx = ey / len, ny = -ex / len;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const p of a) {
        const d = p.x * nx + p.y * ny;
        if (d < minA) minA = d;
        if (d > maxA) maxA = d;
      }
      for (const p of b) {
        const d = p.x * nx + p.y * ny;
        if (d < minB) minB = d;
        if (d > maxB) maxB = d;
      }
      // Separated if there is a gap between projections
      if (minA - maxB > gap || minB - maxA > gap) return true; // separating axis found
    }
    return false;
  };
  if (tryAxes(a)) return false;
  if (tryAxes(b)) return false;
  return true;
}

function mediaOverlapsOthers(m: MediaPlacement, allMedia: readonly MediaPlacement[], excludeId?: string): boolean {
  const vertsA = getMediaWorldVertices(m);
  for (const other of allMedia) {
    if ((other.id as string) === (excludeId ?? m.id as string)) continue;
    if ((other.zoneId as string) !== (m.zoneId as string)) continue;
    const vertsB = getMediaWorldVertices(other);
    if (polygonsOverlapWithGap(vertsA, vertsB, MEDIA_GAP)) return true;
  }
  return false;
}

export interface WorldSlice {
  // State
  floors: FloorConfig[];
  zones: ZoneConfig[];
  media: MediaPlacement[];
  activeFloorId: string | null;
  scenario: Scenario | null;
  /**
   * 마지막으로 저장(또는 로드) 된 시나리오 ref. setScenario 시에만 갱신.
   * dirty 여부는 selector 로 derive: `state.scenario !== state.lastSavedScenarioRef`.
   * 다른 mutation 들은 scenario ref 만 바꾸므로 자동으로 dirty 가 됨.
   */
  lastSavedScenarioRef: Scenario | null;
  waypointGraph: WaypointGraph | null;
  shafts: ElevatorShaft[];

  // Actions
  setScenario: (scenario: Scenario) => void;
  updateScenarioMeta: (updates: Partial<Scenario['meta']>) => void;
  setActiveFloor: (floorId: string | null) => void;
  addFloor: () => void;
  removeFloor: (floorId: string) => void;
  renameFloor: (floorId: string, name: string) => void;
  updateFloorCanvas: (floorId: string, patch: Partial<import('@/domain/types/floor').CanvasData>) => void;
  shiftFloor: (floorId: string, dx: number, dy: number) => void;
  resizeFloor: (floorId: string, bounds: { x: number; y: number; w: number; h: number }) => void;
  setFloorHidden: (floorId: string, hidden: boolean) => void;
  moveFloorLevel: (floorId: string, direction: 'up' | 'down') => void;
  relayoutFloors: () => void;
  addZone: (zone: ZoneConfig) => void;
  updateZone: (zoneId: string, updates: Partial<ZoneConfig>) => void;
  removeZone: (zoneId: string) => void;
  addMedia: (media: MediaPlacement) => void;
  updateMedia: (mediaId: string, updates: Partial<MediaPlacement>) => void;
  removeMedia: (mediaId: string) => void;
  // Waypoint graph CRUD
  addWaypoint: (node: WaypointNode) => void;
  updateWaypoint: (id: string, updates: Partial<WaypointNode>) => void;
  removeWaypoint: (id: string) => void;
  addEdge: (edge: WaypointEdge) => void;
  updateEdge: (id: string, updates: Partial<WaypointEdge>) => void;
  removeEdge: (id: string) => void;
  setWaypointGraph: (graph: WaypointGraph | null) => void;
  // Elevator shaft CRUD
  addShaft: (shaft: ElevatorShaft) => void;
  updateShaft: (id: string, updates: Partial<ElevatorShaft>) => void;
  removeShaft: (id: string) => void;
  reset: () => void;
}

export const createWorldSlice: StateCreator<WorldSlice, [], [], WorldSlice> = (set, get) => ({
  floors: [],
  zones: [],
  media: [],
  activeFloorId: null,
  scenario: null,
  lastSavedScenarioRef: null,
  waypointGraph: null,
  shafts: [],

  setScenario: (scenario) => {
    // Auto-correct interactionType for legacy files (category=analog should be interactionType=analog)
    const correctedMedia = scenario.media.map((m: any) => {
      if (m.category === 'analog' && m.interactionType !== 'analog') {
        return { ...m, interactionType: 'analog' };
      }
      return m;
    });

    // Legacy migration: if the scenario has zones but no floors, or zone floorIds
    // don't match any floor, synthesize a default floor so per-floor systems
    // (density grids, heatmap, floor-based routing) have something to key on.
    let floorsArr: FloorConfig[] = scenario.floors ? [...scenario.floors] : [];
    let zonesArr: ZoneConfig[] = [...scenario.zones];
    const floorIdSet = new Set(floorsArr.map(f => f.id as string));
    const orphanZones = zonesArr.filter(z => !floorIdSet.has(z.floorId as string));
    if (floorsArr.length === 0 || orphanZones.length > 0) {
      const fallbackId = (floorsArr[0]?.id as string) ?? 'floor_1f';
      if (floorsArr.length === 0) {
        floorsArr = [{
          id: fallbackId as any,
          name: '1F',
          level: 0,
          canvas: { width: 1200, height: 800, gridSize: 40, backgroundImage: null, scale: 0.025, bgOffsetX: 0, bgOffsetY: 0, bgScale: 1, bgLocked: false } as any,
          zoneIds: zonesArr.map(z => z.id),
          metadata: {},
        }];
      }
      // Reparent any orphans onto the fallback floor so densityGrids keys match.
      zonesArr = zonesArr.map(z => floorIdSet.has(z.floorId as string) ? z : { ...z, floorId: fallbackId as any });
    }
    // Preserve user's current activeFloorId if still valid; only fall back to
    // the first floor when nothing was selected or the previous selection no
    // longer exists (e.g. loading a different scenario). Without this, every
    // setScenario (incl. autosaves from useEffects in SpawnConfig) would yank
    // selection back to floor[0] mid-edit. (2026-04-26 Duration→Region bug)
    const prevActiveFloorId = get().activeFloorId;
    const validIds = new Set(floorsArr.map((f) => f.id as string));
    const activeFloorId = prevActiveFloorId && validIds.has(prevActiveFloorId)
      ? prevActiveFloorId
      : (floorsArr[0]?.id as string ?? null);
    let mediaArr: MediaPlacement[] = correctedMedia;
    let graphArr: WaypointGraph | null = scenario.waypointGraph ?? null;

    if (floorsNeedRelayout(floorsArr, zonesArr, mediaArr, graphArr)) {
      const laid = layoutFloorsHorizontally(floorsArr, zonesArr, mediaArr, graphArr);
      floorsArr = laid.floors;
      zonesArr = laid.zones;
      mediaArr = laid.media;
      graphArr = laid.waypointGraph;
    }

    // Legacy migration: rewrite node.type 'elevator' → 'portal'.
    if (graphArr) {
      let migrated = false;
      const nodes = graphArr.nodes.map(n => {
        if ((n.type as string) === 'elevator') {
          migrated = true;
          return { ...n, type: 'portal' as const };
        }
        return n;
      });
      if (migrated) graphArr = { ...graphArr, nodes };
    }

    // Legacy migration: waypoint nodes with empty/missing floorId get assigned
    // to the floor whose bounds contain the node, or the first floor as fallback.
    // Without this, Entry/Exit nodes with empty floorId skew routing because
    // floor-aware pathfinding (shaft matching etc.) treats them as "other floor".
    if (graphArr) {
      const orphans = graphArr.nodes.filter(n => !(n.floorId as string));
      if (orphans.length > 0) {
        const fallbackFloorId = (floorsArr[0]?.id as string) ?? 'floor_1f';
        const nodes = graphArr.nodes.map(n => {
          if (n.floorId as string) return n;
          const { x, y } = n.position;
          const hit = floorsArr.find(f => {
            const b = f.bounds;
            if (!b) return false;
            return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
          });
          return { ...n, floorId: (hit?.id ?? fallbackFloorId) as any };
        });
        graphArr = { ...graphArr, nodes };
      }
    }

    const expandedFloors = expandCanvasForZones(floorsArr, zonesArr, activeFloorId);
    const shaftsArr: ElevatorShaft[] = [...(scenario.shafts ?? [])];
    const finalScenario = { ...scenario, floors: expandedFloors, zones: zonesArr, media: mediaArr, waypointGraph: graphArr ?? undefined, shafts: shaftsArr };
    set({
      scenario: finalScenario,
      lastSavedScenarioRef: finalScenario,
      floors: expandedFloors,
      zones: zonesArr,
      media: mediaArr,
      activeFloorId,
      waypointGraph: graphArr,
      shafts: shaftsArr,
    });
  },

  updateScenarioMeta: (updates) => set((s) => {
    if (!s.scenario) return {};
    return { scenario: { ...s.scenario, meta: { ...s.scenario.meta, ...updates } } };
  }),

  setActiveFloor: (floorId) => set({ activeFloorId: floorId }),

  addFloor: () => set((s) => {
    // Next level = max existing + 1 (first floor gets level 1 if 1F exists at 0)
    const maxLevel = s.floors.reduce((m, f) => Math.max(m, f.level), -1);
    const nextLevel = maxLevel + 1;
    const name = nextLevel === 0 ? '1F' : nextLevel > 0 ? `${nextLevel + 1}F` : `B${-nextLevel}`;
    const baseCanvas = s.floors[0]?.canvas ?? {
      width: 1200, height: 800, gridSize: 40, backgroundImage: null, scale: 0.025,
      bgOffsetX: 0, bgOffsetY: 0, bgScale: 1, bgLocked: false,
    };
    const regionW = Math.max(400, baseCanvas.width);
    const regionH = Math.max(300, baseCanvas.height);

    // Assign explicit bounds to any existing floor that lacks them, so the shared
    // canvas has a visible region outline matching the new-floor default size.
    let normalizedFloors: FloorConfig[] = s.floors.map((f) => {
      if (f.bounds) return f;
      const bbox = computeFloorContentBbox(f, s.zones, s.media, s.waypointGraph);
      if (bbox) {
        // Center the full-size region on the existing content so the zone stays in place.
        const cx = bbox.x + bbox.w / 2;
        const cy = bbox.y + bbox.h / 2;
        return { ...f, bounds: { x: cx - regionW / 2, y: cy - regionH / 2, w: regionW, h: regionH } };
      }
      // Empty floor: default region at origin.
      return { ...f, bounds: { x: 0, y: 0, w: regionW, h: regionH } };
    });

    const id = `floor_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` as any;
    // Place the new region to the right of the existing rightmost region on the shared canvas.
    const origin = computeNewFloorOrigin(normalizedFloors, s.zones, s.media, s.waypointGraph);
    const newFloor: FloorConfig = {
      id,
      name,
      level: nextLevel,
      canvas: { ...baseCanvas, backgroundImage: null, bgOffsetX: 0, bgOffsetY: 0, bgScale: 1, bgLocked: false },
      zoneIds: [],
      metadata: {},
      bounds: { x: origin.x, y: origin.y, w: regionW, h: regionH },
    };
    const newFloors = [...normalizedFloors, newFloor];
    return {
      floors: newFloors,
      activeFloorId: id as string,
      scenario: s.scenario ? { ...s.scenario, floors: newFloors } : s.scenario,
    };
  }),

  removeFloor: (floorId) => set((s) => {
    if (s.floors.length <= 1) return {}; // keep at least one floor
    const newFloors = s.floors.filter(f => (f.id as string) !== floorId);
    // Zone membership comes from FloorConfig.zoneIds (not ZoneConfig.floorId which doesn't exist)
    const removedFloor = s.floors.find(f => (f.id as string) === floorId);
    const removedZoneIds = new Set((removedFloor?.zoneIds ?? []).map(id => id as string));
    const newZones = s.zones.filter(z => !removedZoneIds.has(z.id as string));
    const newMedia = s.media.filter(m => !removedZoneIds.has(m.zoneId as string));
    const newGraph = s.waypointGraph
      ? {
          nodes: s.waypointGraph.nodes.filter(n => (n.floorId as string) !== floorId),
          edges: s.waypointGraph.edges.filter(e => {
            const from = s.waypointGraph!.nodes.find(n => n.id === e.fromId);
            const to = s.waypointGraph!.nodes.find(n => n.id === e.toId);
            return from && to && (from.floorId as string) !== floorId && (to.floorId as string) !== floorId;
          }),
        }
      : null;
    // Portals on the removed floor were already dropped above (newGraph filter).
    // A shaft now serves fewer floors; drop any shaft whose remaining portal set
    // spans fewer than two floors — no teleport is possible from a single-floor shaft.
    const remainingPortalsByShaft = new Map<string, Set<string>>();
    for (const n of newGraph?.nodes ?? []) {
      if (n.type !== 'portal' || !n.shaftId) continue;
      const key = n.shaftId as string;
      let set = remainingPortalsByShaft.get(key);
      if (!set) { set = new Set(); remainingPortalsByShaft.set(key, set); }
      set.add(n.floorId as string);
    }
    const newShafts = s.shafts.filter(sh => (remainingPortalsByShaft.get(sh.id as string)?.size ?? 0) >= 2);
    const nextActive = (s.activeFloorId === floorId)
      ? (newFloors[0]?.id as string ?? null)
      : s.activeFloorId;
    return {
      floors: newFloors,
      zones: newZones,
      media: newMedia,
      waypointGraph: newGraph,
      shafts: newShafts,
      activeFloorId: nextActive,
      scenario: s.scenario
        ? { ...s.scenario, floors: newFloors, zones: newZones, media: newMedia, waypointGraph: newGraph ?? undefined, shafts: newShafts }
        : s.scenario,
    };
  }),

  renameFloor: (floorId, name) => set((s) => {
    const newFloors = s.floors.map(f =>
      (f.id as string) === floorId ? { ...f, name } : f
    );
    return {
      floors: newFloors,
      scenario: s.scenario ? { ...s.scenario, floors: newFloors } : s.scenario,
    };
  }),

  updateFloorCanvas: (floorId, patch) => set((s) => {
    const newFloors = s.floors.map(f =>
      (f.id as string) === floorId ? { ...f, canvas: { ...f.canvas, ...patch } } : f
    );
    return {
      floors: newFloors,
      scenario: s.scenario ? { ...s.scenario, floors: newFloors } : s.scenario,
    };
  }),

  setFloorHidden: (floorId, hidden) => set((s) => {
    const newFloors = s.floors.map(f =>
      (f.id as string) === floorId ? { ...f, hidden } : f
    );
    return {
      floors: newFloors,
      scenario: s.scenario ? { ...s.scenario, floors: newFloors } : s.scenario,
    };
  }),

  moveFloorLevel: (floorId, direction) => set((s) => {
    const ordered = [...s.floors].sort((a, b) => a.level - b.level);
    const idx = ordered.findIndex(f => (f.id as string) === floorId);
    if (idx < 0) return {};
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return {};
    const a = ordered[idx], b = ordered[swapIdx];
    const newFloors = s.floors.map(f => {
      if ((f.id as string) === (a.id as string)) return { ...f, level: b.level };
      if ((f.id as string) === (b.id as string)) return { ...f, level: a.level };
      return f;
    });
    return {
      floors: newFloors,
      scenario: s.scenario ? { ...s.scenario, floors: newFloors } : s.scenario,
    };
  }),

  shiftFloor: (floorId, dx, dy) => set((s) => {
    if (dx === 0 && dy === 0) return {};
    const floor = s.floors.find(f => (f.id as string) === floorId);
    if (!floor) return {};
    const baseBounds = floor.bounds ?? { x: 0, y: 0, w: floor.canvas.width, h: floor.canvas.height };
    const floorWithBounds = floor.bounds ? floor : { ...floor, bounds: baseBounds };
    const clamped = clampFloorShift(floorWithBounds, dx, dy, s.floors, s.zones);
    if (clamped.dx === 0 && clamped.dy === 0) return {};
    const shifted = shiftFloorChildren(floorWithBounds, clamped.dx, clamped.dy, s.zones, s.media, s.waypointGraph);
    const newFloors = s.floors.map(f =>
      (f.id as string) === floorId
        ? { ...shifted.floor, bounds: { ...baseBounds, x: baseBounds.x + clamped.dx, y: baseBounds.y + clamped.dy } }
        : f,
    );
    return {
      floors: newFloors,
      zones: shifted.zones,
      media: shifted.media,
      waypointGraph: shifted.waypointGraph,
      scenario: s.scenario
        ? { ...s.scenario, floors: newFloors, zones: shifted.zones, media: shifted.media, waypointGraph: shifted.waypointGraph ?? undefined }
        : s.scenario,
    };
  }),

  resizeFloor: (floorId, bounds) => set((s) => {
    const MIN_W = 200, MIN_H = 150;
    const floor = s.floors.find(f => (f.id as string) === floorId);
    if (!floor) return {};
    const clamped = clampFloorResize(floor, bounds, s.floors, s.zones, MIN_W, MIN_H);
    const newFloors = s.floors.map(f =>
      (f.id as string) === floorId ? { ...f, bounds: clamped } : f,
    );
    return {
      floors: newFloors,
      scenario: s.scenario ? { ...s.scenario, floors: newFloors } : s.scenario,
    };
  }),

  relayoutFloors: () => set((s) => {
    if (s.floors.length <= 1) return {};
    const laid = layoutFloorsHorizontally(s.floors, s.zones, s.media, s.waypointGraph);
    return {
      floors: laid.floors,
      zones: laid.zones,
      media: laid.media,
      waypointGraph: laid.waypointGraph,
      scenario: s.scenario
        ? { ...s.scenario, floors: laid.floors, zones: laid.zones, media: laid.media, waypointGraph: laid.waypointGraph ?? undefined }
        : s.scenario,
    };
  }),

  addZone: (zone) => {
    // Save undo snapshot BEFORE mutation
    const s = get();
    (s as any).pushUndo?.(s.zones, s.media, s.waypointGraph);
    // Free mode: default gates to bidirectional (except entrance/exit zone types)
    const flowMode = s.scenario?.globalFlowMode;
    const zoneToAdd = flowMode === 'free' && zone.type !== 'entrance' && zone.type !== 'exit'
      ? { ...zone, gates: zone.gates.map((g: any) => ({ ...g, type: 'bidirectional' })) }
      : zone;
    set((s) => {
      // Prevent duplicate zone (React StrictMode can double-invoke)
      if (s.zones.some(z => (z.id as string) === (zone.id as string))) return {};
      // Fallback to first floor when no active floor (user may have deselected)
      const targetFloorId = s.activeFloorId ?? (s.floors[0]?.id as string | undefined) ?? null;
      // Stamp floorId so per-floor systems (density grid, heatmap, routing)
      // can key on it. Callers often omit the field — without this, zones
      // end up orphaned and SimEngine silently skips them.
      const stamped = (zoneToAdd.floorId as any) ? zoneToAdd : { ...zoneToAdd, floorId: targetFloorId as any };
      const rawZones = [...s.zones, stamped];
      const newZones = autoLinkGates(rawZones);
      let newFloors = s.floors.map((f) =>
        (f.id as string) === targetFloorId
          ? { ...f, zoneIds: [...f.zoneIds, zone.id] }
          : f,
      );
      newFloors = expandCanvasForZones(newFloors, newZones, targetFloorId);
      return {
        zones: newZones,
        floors: newFloors,
        scenario: s.scenario ? { ...s.scenario, zones: newZones, floors: newFloors } : s.scenario,
      };
    });
  },

  updateZone: (zoneId, updates) =>
    set((s) => {
      // If bounds changed, check overlap with other zones
      if (updates.bounds) {
        const gap = 0;
        const nb = updates.bounds;
        const draggedZone = s.zones.find((z) => (z.id as string) === zoneId);
        const overlaps = s.zones.some((z) => {
          if ((z.id as string) === zoneId) return false;
          const updatedA = { bounds: nb, shape: (draggedZone?.shape ?? 'rect') as string, lRatioX: (draggedZone as any)?.lRatioX ?? 0.5, lRatioY: (draggedZone as any)?.lRatioY ?? 0.5, polygon: draggedZone?.polygon };
          const zB = { bounds: z.bounds, shape: (z.shape ?? 'rect') as string, lRatioX: (z as any).lRatioX ?? 0.5, lRatioY: (z as any).lRatioY ?? 0.5, polygon: z.polygon };
          return zonesOverlap(updatedA, zB);
        });
        if (overlaps) return {}; // block update

        // Block if zone would be too small for its media
        const SCALE = 20;
        const gm = 25, wm = 10;
        const zoneMedia = s.media.filter((m) => (m.zoneId as string) === zoneId);
        for (const m of zoneMedia) {
          const pw = m.size.width * SCALE, ph = m.size.height * SCALE;
          const minW = pw + gm * 2;
          const minH = ph + wm * 2;
          if (nb.w < minW || nb.h < minH) return {}; // block resize
        }
      }
      const rawZones = s.zones.map((z) =>
        (z.id as string) === zoneId ? { ...z, ...updates } : z,
      );
      const newZones = updates.bounds || updates.gates ? autoLinkGates(rawZones) : rawZones;
      // Move/clamp media inside updated zone bounds
      const SCALE = 20;
      const newBounds = updates.bounds;
      const newMedia = newBounds ? s.media.map((m) => {
        if ((m.zoneId as string) !== zoneId) return m;
        const oldZone = s.zones.find((z) => (z.id as string) === zoneId);
        const oldBounds = oldZone?.bounds;
        if (!oldBounds) return m;
        const dx = newBounds.x - oldBounds.x;
        const dy = newBounds.y - oldBounds.y;
        const isMove = newBounds.w === oldBounds.w && newBounds.h === oldBounds.h;
        if (isMove) {
          // Pure move: shift media by exact same delta (no clamp)
          return { ...m, position: { x: m.position.x + dx, y: m.position.y + dy } };
        }
        // Resize: clamp media inside new bounds (no margin)
        const pw = m.size.width * SCALE, ph = m.size.height * SCALE;
        const b = newBounds;
        return {
          ...m,
          position: {
            x: Math.max(b.x + pw/2, Math.min(b.x + b.w - pw/2, m.position.x)),
            y: Math.max(b.y + ph/2, Math.min(b.y + b.h - ph/2, m.position.y)),
          },
        };
      }) : s.media;
      // Reassign floor membership when a zone's center crosses into another floor's frame.
      let reassignedFloors = s.floors;
      if (newBounds) {
        const center = { x: newBounds.x + newBounds.w / 2, y: newBounds.y + newBounds.h / 2 };
        const hitFloor = findFloorAtPoint(center, s.floors, newZones);
        if (hitFloor) {
          const currentHolder = s.floors.find(f => f.zoneIds.some(id => (id as string) === zoneId));
          if (currentHolder && (currentHolder.id as string) !== (hitFloor.id as string)) {
            reassignedFloors = s.floors.map(f => {
              if ((f.id as string) === (currentHolder.id as string)) {
                return { ...f, zoneIds: f.zoneIds.filter(id => (id as string) !== zoneId) };
              }
              if ((f.id as string) === (hitFloor.id as string)) {
                return { ...f, zoneIds: [...f.zoneIds, zoneId as any] };
              }
              return f;
            });
          }
        }
      }
      const expandedFloors = expandCanvasForZones(reassignedFloors, newZones, s.activeFloorId);
      return {
        zones: newZones,
        media: newMedia,
        floors: expandedFloors,
        scenario: s.scenario ? { ...s.scenario, zones: newZones, media: newMedia, floors: expandedFloors } : s.scenario,
      };
    }),

  removeZone: (zoneId) => {
    // Save undo snapshot BEFORE mutation
    const s = get();
    (s as any).pushUndo?.(s.zones, s.media, s.waypointGraph);
    set((s) => {
      const newZones = s.zones.filter((z) => (z.id as string) !== zoneId);
      // Cascade: remove media belonging to this zone
      const newMedia = s.media.filter((m) => (m.zoneId as string) !== zoneId);
      const newFloors = s.floors.map((f) => ({
        ...f,
        zoneIds: f.zoneIds.filter((id) => (id as string) !== zoneId),
      }));
      return {
        zones: newZones,
        media: newMedia,
        floors: newFloors,
        scenario: s.scenario
          ? { ...s.scenario, zones: newZones, media: newMedia, floors: newFloors }
          : s.scenario,
      };
    });
  },

  addMedia: (media) => {
    // Save undo snapshot BEFORE mutation
    const s = get();
    (s as any).pushUndo?.(s.zones, s.media, s.waypointGraph);
    // Clamp position inside parent zone (rotation-aware)
    const SCALE = 20;
    const zone = s.zones.find((z) => (z.id as string) === (media.zoneId as string));
    let clamped = media;
    if (zone) {
      const pw = media.size.width * SCALE, ph = media.size.height * SCALE;
      const { hx, hy } = rotatedHalfExtents(pw, ph, media.orientation);
      const b = zone.bounds;
      clamped = {
        ...media,
        position: {
          x: Math.max(b.x + hx, Math.min(b.x + b.w - hx, media.position.x)),
          y: Math.max(b.y + hy, Math.min(b.y + b.h - hy, media.position.y)),
        },
      };
    }
    // Block if overlapping another media
    if (mediaOverlapsOthers(clamped, s.media)) return;
    set((s) => ({
      media: [...s.media, clamped],
      scenario: s.scenario ? { ...s.scenario, media: [...s.media, clamped] } : s.scenario,
    }));
  },

  updateMedia: (mediaId, updates) =>
    set((s) => {
      const newMedia = s.media.map((m) => {
        if ((m.id as string) !== mediaId) return m;
        const updated = { ...m, ...updates };
        // Clamp position inside parent zone
        const zone = s.zones.find((z) => (z.id as string) === (updated.zoneId as string));
        if (zone && updated.position && updated.size) {
          const SCALE = 20;
          const pw = updated.size.width * SCALE, ph = updated.size.height * SCALE;
          const { hx, hy } = rotatedHalfExtents(pw, ph, updated.orientation);
          const b = zone.bounds;
          updated.position = {
            x: Math.max(b.x + hx, Math.min(b.x + b.w - hx, updated.position.x)),
            y: Math.max(b.y + hy, Math.min(b.y + b.h - hy, updated.position.y)),
          };
        }
        // Block if overlapping another media
        if (mediaOverlapsOthers(updated, s.media, mediaId)) return m; // revert to original
        return updated;
      });
      return {
        media: newMedia,
        scenario: s.scenario ? { ...s.scenario, media: newMedia } : s.scenario,
      };
    }),

  removeMedia: (mediaId) => {
    // Save undo snapshot BEFORE mutation
    const s = get();
    (s as any).pushUndo?.(s.zones, s.media, s.waypointGraph);
    set((s) => {
      const newMedia = s.media.filter((m) => (m.id as string) !== mediaId);
      return {
        media: newMedia,
        scenario: s.scenario ? { ...s.scenario, media: newMedia } : s.scenario,
      };
    });
  },

  // ── Waypoint Graph CRUD ──

  addWaypoint: (node) => {
    const cur = get();
    (cur as any).pushUndo?.(cur.zones, cur.media, cur.waypointGraph);
    set((s) => {
      const graph = s.waypointGraph ?? { nodes: [], edges: [] };
      if (graph.nodes.some(n => (n.id as string) === (node.id as string))) return {};
      const newGraph: WaypointGraph = { ...graph, nodes: [...graph.nodes, node] };
      return {
        waypointGraph: newGraph,
        scenario: s.scenario ? { ...s.scenario, waypointGraph: newGraph } : s.scenario,
      };
    });
  },

  updateWaypoint: (id, updates) =>
    set((s) => {
      if (!s.waypointGraph) return {};
      const newNodes = s.waypointGraph.nodes.map(n =>
        (n.id as string) === id ? { ...n, ...updates } : n,
      );
      const newGraph: WaypointGraph = { ...s.waypointGraph, nodes: newNodes };
      return {
        waypointGraph: newGraph,
        scenario: s.scenario ? { ...s.scenario, waypointGraph: newGraph } : s.scenario,
      };
    }),

  removeWaypoint: (id) => {
    const cur = get();
    (cur as any).pushUndo?.(cur.zones, cur.media, cur.waypointGraph);
    set((s) => {
      if (!s.waypointGraph) return {};
      const newNodes = s.waypointGraph.nodes.filter(n => (n.id as string) !== id);
      const newEdges = s.waypointGraph.edges.filter(e =>
        (e.fromId as string) !== id && (e.toId as string) !== id,
      );
      const newGraph: WaypointGraph = { nodes: newNodes, edges: newEdges };
      return {
        waypointGraph: newGraph,
        scenario: s.scenario ? { ...s.scenario, waypointGraph: newGraph } : s.scenario,
      };
    });
  },

  addEdge: (edge) => {
    const cur = get();
    (cur as any).pushUndo?.(cur.zones, cur.media, cur.waypointGraph);
    set((s) => {
      const graph = s.waypointGraph ?? { nodes: [], edges: [] };
      if (graph.edges.some(e => (e.id as string) === (edge.id as string))) return {};
      const newGraph: WaypointGraph = { ...graph, edges: [...graph.edges, edge] };
      return {
        waypointGraph: newGraph,
        scenario: s.scenario ? { ...s.scenario, waypointGraph: newGraph } : s.scenario,
      };
    });
  },

  updateEdge: (id, updates) =>
    set((s) => {
      if (!s.waypointGraph) return {};
      const newEdges = s.waypointGraph.edges.map(e =>
        (e.id as string) === id ? { ...e, ...updates } : e,
      );
      const newGraph: WaypointGraph = { ...s.waypointGraph, edges: newEdges };
      return {
        waypointGraph: newGraph,
        scenario: s.scenario ? { ...s.scenario, waypointGraph: newGraph } : s.scenario,
      };
    }),

  removeEdge: (id) => {
    const cur = get();
    (cur as any).pushUndo?.(cur.zones, cur.media, cur.waypointGraph);
    set((s) => {
      if (!s.waypointGraph) return {};
      const newEdges = s.waypointGraph.edges.filter(e => (e.id as string) !== id);
      const newGraph: WaypointGraph = { ...s.waypointGraph, edges: newEdges };
      return {
        waypointGraph: newGraph,
        scenario: s.scenario ? { ...s.scenario, waypointGraph: newGraph } : s.scenario,
      };
    });
  },

  setWaypointGraph: (graph) =>
    set((s) => ({
      waypointGraph: graph,
      scenario: s.scenario ? { ...s.scenario, waypointGraph: graph ?? undefined } : s.scenario,
    })),

  // ── Elevator Shaft CRUD ──

  addShaft: (shaft) => {
    const cur = get();
    (cur as any).pushUndo?.(cur.zones, cur.media, cur.waypointGraph);
    set((s) => {
      if (s.shafts.some(sh => (sh.id as string) === (shaft.id as string))) return {};
      const newShafts = [...s.shafts, shaft];
      return {
        shafts: newShafts,
        scenario: s.scenario ? { ...s.scenario, shafts: newShafts } : s.scenario,
      };
    });
  },

  updateShaft: (id, updates) =>
    set((s) => {
      const newShafts = s.shafts.map(sh =>
        (sh.id as string) === id ? { ...sh, ...updates } : sh,
      );
      return {
        shafts: newShafts,
        scenario: s.scenario ? { ...s.scenario, shafts: newShafts } : s.scenario,
      };
    }),

  removeShaft: (id) => {
    const cur = get();
    (cur as any).pushUndo?.(cur.zones, cur.media, cur.waypointGraph);
    set((s) => {
      const newShafts = s.shafts.filter(sh => (sh.id as string) !== id);
      // Also strip shaftId from any elevator nodes that referenced it
      const newGraph: WaypointGraph | null = s.waypointGraph
        ? {
            ...s.waypointGraph,
            nodes: s.waypointGraph.nodes.map(n =>
              (n.shaftId as string | undefined) === id ? { ...n, shaftId: null } : n,
            ),
          }
        : null;
      return {
        shafts: newShafts,
        waypointGraph: newGraph,
        scenario: s.scenario
          ? { ...s.scenario, shafts: newShafts, waypointGraph: newGraph ?? undefined }
          : s.scenario,
      };
    });
  },

  reset: () =>
    set({
      floors: [],
      zones: [],
      media: [],
      activeFloorId: null,
      scenario: null,
      lastSavedScenarioRef: null,
      waypointGraph: null,
      shafts: [],
    }),
});
