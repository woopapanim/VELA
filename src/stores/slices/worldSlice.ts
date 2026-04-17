import type { StateCreator } from 'zustand';
import type { FloorConfig, ZoneConfig, MediaPlacement, Scenario, WaypointGraph, WaypointNode, WaypointEdge } from '@/domain';
import { zonesOverlap } from '@/domain/zoneGeometry';

const MEDIA_SCALE = 20;
const MEDIA_GAP = 8;
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

/** Check if a media rect overlaps any other media in the same zone */
/** Get half-extents of rotated media's AABB */
function rotatedHalfExtents(w: number, h: number, orientationDeg: number): { hx: number; hy: number } {
  const rad = (orientationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  return { hx: (w * cos + h * sin) / 2, hy: (w * sin + h * cos) / 2 };
}

function mediaOverlapsOthers(m: MediaPlacement, allMedia: readonly MediaPlacement[], excludeId?: string): boolean {
  const pw = m.size.width * MEDIA_SCALE, ph = m.size.height * MEDIA_SCALE;
  const ax = m.position.x - pw / 2, ay = m.position.y - ph / 2;
  for (const other of allMedia) {
    if ((other.id as string) === (excludeId ?? m.id as string)) continue;
    if ((other.zoneId as string) !== (m.zoneId as string)) continue;
    const ow = other.size.width * MEDIA_SCALE, oh = other.size.height * MEDIA_SCALE;
    const bx = other.position.x - ow / 2, by = other.position.y - oh / 2;
    if (ax < bx + ow + MEDIA_GAP && ax + pw + MEDIA_GAP > bx &&
        ay < by + oh + MEDIA_GAP && ay + ph + MEDIA_GAP > by) return true;
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
  waypointGraph: WaypointGraph | null;

  // Actions
  setScenario: (scenario: Scenario) => void;
  updateScenarioMeta: (updates: Partial<Scenario['meta']>) => void;
  setActiveFloor: (floorId: string) => void;
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
  reset: () => void;
}

export const createWorldSlice: StateCreator<WorldSlice, [], [], WorldSlice> = (set, get) => ({
  floors: [],
  zones: [],
  media: [],
  activeFloorId: null,
  scenario: null,
  waypointGraph: null,

  setScenario: (scenario) => {
    const activeFloorId = scenario.floors[0]?.id as string ?? null;
    const expandedFloors = expandCanvasForZones([...scenario.floors], scenario.zones, activeFloorId);
    // Auto-correct interactionType for legacy files (category=analog should be interactionType=analog)
    const correctedMedia = scenario.media.map((m: any) => {
      if (m.category === 'analog' && m.interactionType !== 'analog') {
        return { ...m, interactionType: 'analog' };
      }
      return m;
    });
    set({
      scenario: { ...scenario, floors: expandedFloors, media: correctedMedia },
      floors: expandedFloors,
      zones: [...scenario.zones],
      media: correctedMedia,
      activeFloorId,
      waypointGraph: scenario.waypointGraph ?? null,
    });
  },

  updateScenarioMeta: (updates) => set((s) => {
    if (!s.scenario) return {};
    return { scenario: { ...s.scenario, meta: { ...s.scenario.meta, ...updates } } };
  }),

  setActiveFloor: (floorId) => set({ activeFloorId: floorId }),

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
      const rawZones = [...s.zones, zoneToAdd];
      const newZones = autoLinkGates(rawZones);
      let newFloors = s.floors.map((f) =>
        (f.id as string) === s.activeFloorId
          ? { ...f, zoneIds: [...f.zoneIds, zone.id] }
          : f,
      );
      newFloors = expandCanvasForZones(newFloors, newZones, s.activeFloorId);
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
      const expandedFloors = expandCanvasForZones(s.floors, newZones, s.activeFloorId);
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
    set((s) => ({
      media: s.media.filter((m) => (m.id as string) !== mediaId),
    }));
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

  reset: () =>
    set({
      floors: [],
      zones: [],
      media: [],
      activeFloorId: null,
      scenario: null,
      waypointGraph: null,
    }),
});
