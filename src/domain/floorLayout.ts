import type { FloorConfig } from './types/floor';
import type { ZoneConfig } from './types/zone';
import type { MediaPlacement } from './types/media';
import type { WaypointGraph } from './types/waypoint';

export const REGION_PADDING = 40;
export const REGION_GAP = 200;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutResult {
  floors: FloorConfig[];
  zones: ZoneConfig[];
  media: MediaPlacement[];
  waypointGraph: WaypointGraph | null;
}

/** Resolve which zones belong to a floor via FloorConfig.zoneIds (authoritative). */
function zoneIdsFor(floor: FloorConfig): Set<string> {
  return new Set(floor.zoneIds.map(id => id as string));
}

/** Compute content bounding box for a floor from its zones/media/waypoints. */
export function computeFloorContentBbox(
  floor: FloorConfig,
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  waypointGraph: WaypointGraph | null,
): Rect | null {
  const floorId = floor.id as string;
  const zoneIdsOnFloor = zoneIdsFor(floor);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;

  for (const z of zones) {
    if (!zoneIdsOnFloor.has(z.id as string)) continue;
    const b = z.bounds;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
    found = true;
  }

  for (const m of media) {
    if (!zoneIdsOnFloor.has(m.zoneId as string)) continue;
    const r = Math.max(m.size.width, m.size.height) * 20 * 0.6;
    if (m.position.x - r < minX) minX = m.position.x - r;
    if (m.position.y - r < minY) minY = m.position.y - r;
    if (m.position.x + r > maxX) maxX = m.position.x + r;
    if (m.position.y + r > maxY) maxY = m.position.y + r;
    found = true;
  }

  if (waypointGraph) {
    for (const n of waypointGraph.nodes) {
      if ((n.floorId as string) !== floorId) continue;
      const r = 20;
      if (n.position.x - r < minX) minX = n.position.x - r;
      if (n.position.y - r < minY) minY = n.position.y - r;
      if (n.position.x + r > maxX) maxX = n.position.x + r;
      if (n.position.y + r > maxY) maxY = n.position.y + r;
      found = true;
    }
  }

  return found ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

/**
 * Visual frame bounds for a floor on the shared canvas.
 * Uses explicit `floor.bounds` when set, else derives from member zones' bbox + padding.
 * Mirrors the frame drawn by FloorFrameRenderer so hit-testing matches what users see.
 */
export function getFloorFrameBounds(
  floor: FloorConfig,
  zones: readonly ZoneConfig[],
): Rect | null {
  if (floor.bounds) return floor.bounds;
  const memberSet = zoneIdsFor(floor);
  const floorZones = zones.filter(z => memberSet.has(z.id as string));
  if (floorZones.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const z of floorZones) {
    const b = z.bounds;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }
  return {
    x: minX - REGION_PADDING,
    y: minY - REGION_PADDING,
    w: maxX - minX + REGION_PADDING * 2,
    h: maxY - minY + REGION_PADDING * 2,
  };
}

/**
 * Find which floor a world-space point falls inside, using floor frame bounds.
 * Returns null when no floor frame contains the point (e.g. single-floor scenarios
 * without explicit bounds, or gaps between frames).
 */
export function findFloorAtPoint(
  point: { x: number; y: number },
  floors: readonly FloorConfig[],
  zones: readonly ZoneConfig[],
): FloorConfig | null {
  for (const f of floors) {
    const b = getFloorFrameBounds(f, zones);
    if (!b) continue;
    if (point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h) {
      return f;
    }
  }
  return null;
}

/**
 * Decide whether to apply horizontal auto-layout.
 * Triggers when either:
 *   - Any floor is missing explicit `bounds` (legacy tab-based scenario where layout was implicit), OR
 *   - Any two floors' content bboxes overlap in world coords (tab-era scenarios reused local coords).
 * Once a floor has explicit `bounds`, the user is considered to have positioned it intentionally.
 */
export function floorsNeedRelayout(
  floors: readonly FloorConfig[],
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  waypointGraph: WaypointGraph | null,
): boolean {
  if (floors.length <= 1) return false;

  const hasMissingBounds = floors.some(f => !f.bounds);
  if (hasMissingBounds) return true;

  const bboxes: (Rect | null)[] = floors.map(f =>
    computeFloorContentBbox(f, zones, media, waypointGraph),
  );
  for (let i = 0; i < bboxes.length; i++) {
    const a = bboxes[i];
    if (!a) continue;
    for (let j = i + 1; j < bboxes.length; j++) {
      const b = bboxes[j];
      if (!b) continue;
      if (rectsOverlap(a, b)) return true;
    }
  }
  return false;
}

/** Shift all children of a floor by (dx, dy) in world coordinates. */
export function shiftFloorChildren(
  floor: FloorConfig,
  dx: number,
  dy: number,
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  waypointGraph: WaypointGraph | null,
): { zones: ZoneConfig[]; media: MediaPlacement[]; waypointGraph: WaypointGraph | null } {
  if (dx === 0 && dy === 0) {
    return { zones: zones as ZoneConfig[], media: media as MediaPlacement[], waypointGraph };
  }

  const floorId = floor.id as string;
  const zoneIdsOnFloor = zoneIdsFor(floor);

  const newZones: ZoneConfig[] = zones.map(z => {
    if (!zoneIdsOnFloor.has(z.id as string)) return z;
    const next: ZoneConfig = {
      ...z,
      bounds: { ...z.bounds, x: z.bounds.x + dx, y: z.bounds.y + dy },
      gates: z.gates.map(g => ({
        ...g,
        position: { x: g.position.x + dx, y: g.position.y + dy },
      })),
    };
    if (z.polygon && z.polygon.length > 0) {
      (next as any).polygon = z.polygon.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }
    return next;
  });

  const newMedia: MediaPlacement[] = media.map(m => {
    if (!zoneIdsOnFloor.has(m.zoneId as string)) return m;
    return {
      ...m,
      position: { x: m.position.x + dx, y: m.position.y + dy },
    };
  });

  const newGraph: WaypointGraph | null = waypointGraph
    ? {
        ...waypointGraph,
        nodes: waypointGraph.nodes.map(n =>
          (n.floorId as string) === floorId
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n,
        ),
      }
    : null;

  return { zones: newZones, media: newMedia, waypointGraph: newGraph };
}

/**
 * Lay out floors horizontally on a shared world canvas with a gap between regions.
 * Order: sorted by level ascending (B1=-1, 1F=0, 2F=1, ...).
 * Each floor's children are shifted so its content bbox sits at the target x,
 * with y normalized to 0 (top-aligned).
 */
export function layoutFloorsHorizontally(
  floors: readonly FloorConfig[],
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  waypointGraph: WaypointGraph | null,
): LayoutResult {
  const ordered = [...floors].sort((a, b) => a.level - b.level);

  let workingZones: ZoneConfig[] = [...zones];
  let workingMedia: MediaPlacement[] = [...media];
  let workingGraph: WaypointGraph | null = waypointGraph;

  const newFloorsById = new Map<string, FloorConfig>();
  let cursorX = 0;

  for (const floor of ordered) {
    const bbox = computeFloorContentBbox(floor, workingZones, workingMedia, workingGraph);

    if (!bbox) {
      // Empty floor — create a placeholder region using canvas size
      const w = Math.max(400, floor.canvas.width);
      const h = Math.max(300, floor.canvas.height);
      newFloorsById.set(floor.id as string, {
        ...floor,
        bounds: { x: cursorX, y: 0, w, h },
      });
      cursorX += w + REGION_GAP;
      continue;
    }

    const targetX = cursorX + REGION_PADDING;
    const targetY = REGION_PADDING;
    const dx = targetX - bbox.x;
    const dy = targetY - bbox.y;

    const shifted = shiftFloorChildren(floor, dx, dy, workingZones, workingMedia, workingGraph);
    workingZones = shifted.zones;
    workingMedia = shifted.media;
    workingGraph = shifted.waypointGraph;

    const regionW = bbox.w + REGION_PADDING * 2;
    const regionH = bbox.h + REGION_PADDING * 2;
    newFloorsById.set(floor.id as string, {
      ...floor,
      bounds: { x: cursorX, y: 0, w: regionW, h: regionH },
    });
    cursorX += regionW + REGION_GAP;
  }

  const newFloors: FloorConfig[] = floors.map(f => newFloorsById.get(f.id as string) ?? f);

  return {
    floors: newFloors,
    zones: workingZones,
    media: workingMedia,
    waypointGraph: workingGraph,
  };
}

/** Compute the origin (top-left) for a newly added floor — placed to the right of existing regions, top-aligned with the rightmost one. */
export function computeNewFloorOrigin(
  floors: readonly FloorConfig[],
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  waypointGraph: WaypointGraph | null,
): { x: number; y: number } {
  let rightmost = 0;
  let rightmostTop = 0;
  let found = false;
  for (const f of floors) {
    const b = f.bounds ?? computeFloorContentBbox(f, zones, media, waypointGraph);
    if (!b) continue;
    const right = b.x + b.w;
    if (!found || right > rightmost) {
      rightmost = right;
      rightmostTop = b.y;
      found = true;
    }
  }
  return { x: found ? rightmost + REGION_GAP : 0, y: found ? rightmostTop : 0 };
}
