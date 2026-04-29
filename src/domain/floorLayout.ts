import type { FloorConfig } from './types/floor';
import type { ZoneConfig } from './types/zone';
import type { MediaPlacement } from './types/media';
import type { WaypointGraph } from './types/waypoint';

export const REGION_PADDING = 40;
export const REGION_GAP = 200;

interface Rect {
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
 * Clamp a proposed (dx, dy) shift so the floor's visual frame (bounds ∪ zone bbox)
 * won't overlap any other floor's frame. Tries full move first, then axis-separated
 * (x-only, y-only), so dragging against another floor slides along its edge.
 * If the floor already overlaps another (pre-existing tangled state), only block
 * shifts that would *increase* the overlap — otherwise the user can't untangle it.
 */
export function clampFloorShift(
  floor: FloorConfig,
  dx: number,
  dy: number,
  others: readonly FloorConfig[],
  zones: readonly ZoneConfig[],
): { dx: number; dy: number } {
  const selfFrame = getFloorFrameBounds(floor, zones);
  if (!selfFrame) return { dx, dy };

  const otherFrames: Rect[] = [];
  for (const o of others) {
    if ((o.id as string) === (floor.id as string)) continue;
    const f = getFloorFrameBounds(o, zones);
    if (f) otherFrames.push(f);
  }
  if (otherFrames.length === 0) return { dx, dy };

  // Pre-existing overlaps: allow moves that don't worsen them (measured by
  // intersection area). This lets users drag tangled floors apart.
  const intersectArea = (a: Rect, b: Rect) => {
    const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return ix * iy;
  };
  const baseAreas = otherFrames.map(o => intersectArea(selfFrame, o));

  const shiftRect = (r: Rect, sx: number, sy: number): Rect => ({ x: r.x + sx, y: r.y + sy, w: r.w, h: r.h });
  const worsens = (sx: number, sy: number) => {
    const moved = shiftRect(selfFrame, sx, sy);
    for (let i = 0; i < otherFrames.length; i++) {
      const newArea = intersectArea(moved, otherFrames[i]);
      if (newArea > baseAreas[i]) return true;
    }
    return false;
  };

  if (!worsens(dx, dy)) return { dx, dy };
  if (dx !== 0 && !worsens(dx, 0)) return { dx, dy: 0 };
  if (dy !== 0 && !worsens(0, dy)) return { dx: 0, dy };
  return { dx: 0, dy: 0 };
}

/**
 * Clamp a proposed new rect for `floor` so it won't overlap other floors' frames.
 * Used by resize: keeps the anchored edge in place and trims the dragged edge
 * so the resulting rect stops at the nearest other-floor frame boundary.
 */
export function clampFloorResize(
  floor: FloorConfig,
  proposed: Rect,
  others: readonly FloorConfig[],
  zones: readonly ZoneConfig[],
  minW = 200,
  minH = 150,
): Rect {
  const base = floor.bounds ?? proposed;
  const otherRects: Rect[] = [];
  for (const o of others) {
    if ((o.id as string) === (floor.id as string)) continue;
    const f = getFloorFrameBounds(o, zones);
    if (f) otherRects.push(f);
  }
  let { x, y, w, h } = proposed;
  w = Math.max(minW, w);
  h = Math.max(minH, h);

  for (const o of otherRects) {
    // Skip if already disjoint on either axis.
    if (x + w <= o.x || o.x + o.w <= x || y + h <= o.y || o.y + o.h <= y) continue;

    // Determine which edge is being dragged for each axis: compare proposed vs base.
    const leftMoved = x !== base.x;
    const rightMoved = x + w !== base.x + base.w;
    const topMoved = y !== base.y;
    const bottomMoved = y + h !== base.y + base.h;

    // Pick the axis with the smaller penetration to resolve on.
    const penLeft = x + w - o.x;            // if >0 and right edge is the culprit
    const penRight = o.x + o.w - x;         // if >0 and left edge is the culprit
    const penTop = y + h - o.y;
    const penBottom = o.y + o.h - y;

    const candidates: Array<{ pen: number; apply: () => void }> = [];
    if (rightMoved && penLeft > 0) candidates.push({ pen: penLeft, apply: () => { w = Math.max(minW, o.x - x); } });
    if (leftMoved && penRight > 0)  candidates.push({ pen: penRight, apply: () => { const newX = o.x + o.w; w = Math.max(minW, x + w - newX); x = newX; } });
    if (bottomMoved && penTop > 0) candidates.push({ pen: penTop, apply: () => { h = Math.max(minH, o.y - y); } });
    if (topMoved && penBottom > 0) candidates.push({ pen: penBottom, apply: () => { const newY = o.y + o.h; h = Math.max(minH, y + h - newY); y = newY; } });

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.pen - b.pen);
      candidates[0].apply();
    }
  }
  return { x, y, w, h };
}

/**
 * Visual frame bounds for a floor on the shared canvas.
 * Returns the union of `floor.bounds` (user-set) and zones' bbox + padding (content).
 * So the frame always contains both the user's chosen area and any zones assigned to the floor —
 * dragging a zone outside the user bounds auto-expands the frame rather than orphaning it.
 */
export function getFloorFrameBounds(
  floor: FloorConfig,
  zones: readonly ZoneConfig[],
): Rect | null {
  const derived = deriveZoneBounds(floor, zones);
  const explicit = floor.bounds ?? null;
  if (!derived && !explicit) return null;
  if (!explicit) return derived;
  if (!derived) return explicit;
  const minX = Math.min(explicit.x, derived.x);
  const minY = Math.min(explicit.y, derived.y);
  const maxX = Math.max(explicit.x + explicit.w, derived.x + derived.w);
  const maxY = Math.max(explicit.y + explicit.h, derived.y + derived.h);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function deriveZoneBounds(
  floor: FloorConfig,
  zones: readonly ZoneConfig[],
): Rect | null {
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

/** Shift all children of a floor by (dx, dy) in world coordinates.
 *  Also returns the floor with its background overlay offset shifted by the
 *  same delta so the floor plan image stays glued to its region.
 */
export function shiftFloorChildren(
  floor: FloorConfig,
  dx: number,
  dy: number,
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  waypointGraph: WaypointGraph | null,
): { floor: FloorConfig; zones: ZoneConfig[]; media: MediaPlacement[]; waypointGraph: WaypointGraph | null } {
  if (dx === 0 && dy === 0) {
    return { floor, zones: zones as ZoneConfig[], media: media as MediaPlacement[], waypointGraph };
  }

  const shiftedFloor: FloorConfig = {
    ...floor,
    canvas: {
      ...floor.canvas,
      bgOffsetX: floor.canvas.bgOffsetX + dx,
      bgOffsetY: floor.canvas.bgOffsetY + dy,
    },
  };

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

  return { floor: shiftedFloor, zones: newZones, media: newMedia, waypointGraph: newGraph };
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
      ...shifted.floor,
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

/**
 * After an anchor floor's frame may have auto-grown (e.g. zone added/resized),
 * push other floors so their frames no longer overlap the anchor's.
 * Direction: horizontal — push to whichever side they already lie on (left/right of anchor center).
 * Returns updated floors/zones/media/waypointGraph (children shifted with their floor).
 * Cascades — a pushed floor may push its own neighbor in turn.
 */
export function resolveFloorOverlaps(
  floors: readonly FloorConfig[],
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  waypointGraph: WaypointGraph | null,
  anchorFloorId: string,
): LayoutResult {
  let workingFloors: FloorConfig[] = [...floors];
  let workingZones: ZoneConfig[] = [...zones];
  let workingMedia: MediaPlacement[] = [...media];
  let workingGraph: WaypointGraph | null = waypointGraph;

  // BFS-style: each iteration, push any floor that overlaps the anchor or already-pushed floors.
  const settled = new Set<string>([anchorFloorId]);
  let safety = floors.length * 2; // avoid infinite loops on pathological data
  while (safety-- > 0) {
    let didPush = false;
    for (const settledId of Array.from(settled)) {
      const anchor = workingFloors.find(f => (f.id as string) === settledId);
      if (!anchor) continue;
      const anchorFrame = getFloorFrameBounds(anchor, workingZones);
      if (!anchorFrame) continue;
      const anchorCx = anchorFrame.x + anchorFrame.w / 2;

      for (const other of workingFloors) {
        const oid = other.id as string;
        if (settled.has(oid)) continue;
        const f = getFloorFrameBounds(other, workingZones);
        if (!f) continue;
        if (!rectsOverlap(anchorFrame, f)) continue;

        const otherCx = f.x + f.w / 2;
        const pushRight = otherCx >= anchorCx;
        const dx = pushRight
          ? anchorFrame.x + anchorFrame.w + REGION_GAP - f.x
          : anchorFrame.x - REGION_GAP - (f.x + f.w);
        if (dx === 0) continue;
        const shifted = shiftFloorChildren(other, dx, 0, workingZones, workingMedia, workingGraph);
        const shiftedBounds = other.bounds
          ? { ...other.bounds, x: other.bounds.x + dx, y: other.bounds.y }
          : undefined;
        workingFloors = workingFloors.map(ff => (ff.id as string) === oid
          ? (shiftedBounds ? { ...shifted.floor, bounds: shiftedBounds } : shifted.floor)
          : ff);
        workingZones = shifted.zones;
        workingMedia = shifted.media;
        workingGraph = shifted.waypointGraph;
        settled.add(oid);
        didPush = true;
      }
    }
    if (!didPush) break;
  }

  return { floors: workingFloors, zones: workingZones, media: workingMedia, waypointGraph: workingGraph };
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
