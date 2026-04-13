/**
 * Zone Transit Module
 *
 * Handles gate-to-gate navigation between zones.
 * Computes waypoints that the steering engine follows (no teleportation).
 *
 * Waypoint sequence:
 *   [0] exit gate position (agent walks here inside current zone)
 *   [1] entrance gate position (agent walks here in open space)
 *   [2] 20px inward from entrance gate (agent enters destination zone)
 */

import type { ZoneConfig, Gate, Vector2D, GateId } from '@/domain';

// ── Gate finder (supports bidirectional fallback) ──

export function findExitGate(zone: ZoneConfig): Gate | null {
  const gates = zone.gates as readonly Gate[];
  return gates.find((g) => g.type === 'exit') ??
         gates.find((g) => g.type === 'bidirectional') ??
         null;
}

export function findEntranceGate(zone: ZoneConfig): Gate | null {
  const gates = zone.gates as readonly Gate[];
  return gates.find((g) => g.type === 'entrance') ??
         gates.find((g) => g.type === 'bidirectional') ??
         null;
}

// ── Transit waypoint computation ──

export interface TransitResult {
  waypoints: Vector2D[];
  exitGateId: GateId | null;
  entryGateId: GateId | null;
}

export function computeTransitWaypoints(
  fromZone: ZoneConfig,
  toZone: ZoneConfig,
): TransitResult {
  const exitGate = findExitGate(fromZone);
  const entrGate = findEntranceGate(toZone);

  const waypoints: Vector2D[] = [];
  const exitGateId = exitGate ? (exitGate.id as GateId) : null;
  const entryGateId = entrGate ? (entrGate.id as GateId) : null;

  // wp[0]: exit gate position + 15px outward (ensures agent clears the zone boundary)
  if (exitGate) {
    const ep = exitGate.position;
    const fcx = fromZone.bounds.x + fromZone.bounds.w / 2;
    const fcy = fromZone.bounds.y + fromZone.bounds.h / 2;
    const ox = ep.x - fcx, oy = ep.y - fcy;
    const olen = Math.sqrt(ox * ox + oy * oy) || 1;
    waypoints.push({ x: ep.x + (ox / olen) * 15, y: ep.y + (oy / olen) * 15 });
  }

  // wp[1]: entrance gate position
  // wp[2]: zone center (agent walks fully inside the zone)
  if (entrGate) {
    const gp = entrGate.position;
    waypoints.push({ x: gp.x, y: gp.y });
    // Final waypoint = zone center — ensures agent is clearly inside the zone
    waypoints.push({
      x: toZone.bounds.x + toZone.bounds.w / 2,
      y: toZone.bounds.y + toZone.bounds.h / 2,
    });
  } else {
    waypoints.push({
      x: toZone.bounds.x + toZone.bounds.w / 2,
      y: toZone.bounds.y + toZone.bounds.h / 2,
    });
  }

  return { waypoints, exitGateId, entryGateId };
}

// ── Zone polygon generation (shared, replaces duplicated code) ──

export function getZonePolygon(zone: ZoneConfig): Vector2D[] {
  if (zone.polygon && zone.polygon.length >= 3) {
    return zone.polygon as Vector2D[];
  }

  const { x, y, w, h } = zone.bounds;
  const shape = zone.shape as string;

  if (shape?.startsWith('l_')) {
    const rx = (zone as any).lRatioX ?? 0.5;
    const ry = (zone as any).lRatioY ?? 0.5;
    const bx = w * rx, by = h * ry;

    if (shape === 'l_top_right')
      return [{ x, y }, { x: x + bx, y }, { x: x + bx, y: y + by }, { x: x + w, y: y + by }, { x: x + w, y: y + h }, { x, y: y + h }];
    if (shape === 'l_top_left')
      return [{ x: x + bx, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y: y + by }, { x: x + bx, y: y + by }];
    if (shape === 'l_bottom_right')
      return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + by }, { x: x + bx, y: y + by }, { x: x + bx, y: y + h }, { x, y: y + h }];
    // l_bottom_left
    return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x: x + bx, y: y + h }, { x: x + bx, y: y + by }, { x, y: y + by }];
  }

  // Default: rectangle
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

// ── Zone wall segments (for obstacle avoidance steering) ──

export interface WallSegment {
  a: Vector2D;
  b: Vector2D;
}

export function getZoneWalls(zone: ZoneConfig): WallSegment[] {
  const poly = getZonePolygon(zone);
  const walls: WallSegment[] = [];
  for (let i = 0; i < poly.length; i++) {
    walls.push({ a: poly[i], b: poly[(i + 1) % poly.length] });
  }
  return walls;
}
