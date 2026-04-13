import type { Vector2D, Rect, Polygon } from '@/domain';

// ---- Agent-Agent collision resolution ----
// Applies separation displacement to prevent overlapping
export function resolveAgentOverlap(
  position: Vector2D,
  otherPosition: Vector2D,
  minDistance: number,
): Vector2D {
  const dx = position.x - otherPosition.x;
  const dy = position.y - otherPosition.y;
  const distSq = dx * dx + dy * dy;

  if (distSq >= minDistance * minDistance) return position;
  if (distSq < 0.001) {
    // Exact overlap — nudge randomly
    return { x: position.x + 0.5, y: position.y + 0.5 };
  }

  const dist = Math.sqrt(distSq);
  const overlap = minDistance - dist;
  const nx = dx / dist;
  const ny = dy / dist;

  // Push apart by half the overlap each
  return {
    x: position.x + nx * overlap * 0.5,
    y: position.y + ny * overlap * 0.5,
  };
}

// ---- Wall collision: keep agent inside a rectangular boundary ----
export function clampToRect(position: Vector2D, bounds: Rect, padding: number = 5): Vector2D {
  const x = Math.max(bounds.x + padding, Math.min(bounds.x + bounds.w - padding, position.x));
  const y = Math.max(bounds.y + padding, Math.min(bounds.y + bounds.h - padding, position.y));
  if (x === position.x && y === position.y) return position;
  return { x, y };
}

// ---- Point-in-polygon test (ray casting) ----
export function isPointInPolygon(point: Vector2D, polygon: Polygon): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];

    if (
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x
    ) {
      inside = !inside;
    }
  }

  return inside;
}

// ---- Push agent inside polygon boundary ----
export function clampToPolygon(position: Vector2D, polygon: Polygon, center: Vector2D): Vector2D {
  if (isPointInPolygon(position, polygon)) return position;

  // Find closest point on polygon edge
  let closestDist = Infinity;
  let closestPoint = position;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cp = closestPointOnSegment(position, a, b);
    const dx = cp.x - position.x;
    const dy = cp.y - position.y;
    const dist = dx * dx + dy * dy;

    if (dist < closestDist) {
      closestDist = dist;
      closestPoint = cp;
    }
  }

  // Push slightly inside (toward center)
  const toCenterX = center.x - closestPoint.x;
  const toCenterY = center.y - closestPoint.y;
  const len = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);

  if (len < 0.01) return closestPoint;

  return {
    x: closestPoint.x + (toCenterX / len) * 2,
    y: closestPoint.y + (toCenterY / len) * 2,
  };
}

// ---- Push agent OUTSIDE polygon boundary (for transit collision) ----
export function pushOutsidePolygon(position: Vector2D, polygon: Polygon, center: Vector2D): Vector2D {
  if (!isPointInPolygon(position, polygon)) return position; // already outside

  // Find closest point on polygon edge
  let closestDist = Infinity;
  let closestPoint = position;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cp = closestPointOnSegment(position, a, b);
    const dx = cp.x - position.x;
    const dy = cp.y - position.y;
    const dist = dx * dx + dy * dy;
    if (dist < closestDist) {
      closestDist = dist;
      closestPoint = cp;
    }
  }

  // Push slightly OUTSIDE (away from center)
  const awayX = closestPoint.x - center.x;
  const awayY = closestPoint.y - center.y;
  const len = Math.sqrt(awayX * awayX + awayY * awayY);
  if (len < 0.01) return closestPoint;

  return {
    x: closestPoint.x + (awayX / len) * 3,
    y: closestPoint.y + (awayY / len) * 3,
  };
}

function closestPointOnSegment(p: Vector2D, a: Vector2D, b: Vector2D): Vector2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return a;

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return { x: a.x + t * dx, y: a.y + t * dy };
}

// ---- Velocity reflection off wall ----
export function reflectVelocity(
  velocity: Vector2D,
  wallNormal: Vector2D,
  dampening: number = 0.3,
): Vector2D {
  const dot = velocity.x * wallNormal.x + velocity.y * wallNormal.y;
  return {
    x: (velocity.x - 2 * dot * wallNormal.x) * dampening,
    y: (velocity.y - 2 * dot * wallNormal.y) * dampening,
  };
}
