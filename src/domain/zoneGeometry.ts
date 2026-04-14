/**
 * Zone polygon geometry utilities — shared between CanvasPanel and worldSlice.
 */

type Pt = { x: number; y: number };
type Bounds = { x: number; y: number; w: number; h: number };

/** Get zone polygon vertices from bounds + shape */
export function getZoneVertices(
  b: Bounds, shape: string, rx = 0.5, ry = 0.5,
  polygon?: readonly Pt[] | null,
): Pt[] {
  if (shape === 'custom' && polygon && polygon.length > 2) {
    return polygon.map(v => ({ x: v.x, y: v.y }));
  }
  const { x, y, w, h } = b;
  if (shape === 'rect' || !shape.startsWith('l_')) {
    return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  }
  const bx = w * rx, by = h * ry;
  if (shape === 'l_top_right') return [{x,y},{x:x+bx,y},{x:x+bx,y:y+by},{x:x+w,y:y+by},{x:x+w,y:y+h},{x,y:y+h}];
  if (shape === 'l_top_left') return [{x:x+bx,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h},{x,y:y+by},{x:x+bx,y:y+by}];
  if (shape === 'l_bottom_right') return [{x,y},{x:x+w,y},{x:x+w,y:y+by},{x:x+bx,y:y+by},{x:x+bx,y:y+h},{x,y:y+h}];
  return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x:x+bx,y:y+h},{x:x+bx,y:y+by},{x,y:y+by}];
}

/** Point-in-polygon (ray casting) */
export function ptInPoly(pts: Pt[], px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Check if two line segments intersect (proper crossing, not touching) */
function segmentsIntersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / cross;
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / cross;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

/** Check if two polygons overlap (vertex containment + edge intersection) */
export function polygonsOverlap(polyA: Pt[], polyB: Pt[]): boolean {
  for (const p of polyA) if (ptInPoly(polyB, p.x, p.y)) return true;
  for (const p of polyB) if (ptInPoly(polyA, p.x, p.y)) return true;
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i], a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      if (segmentsIntersect(a1, a2, polyB[j], polyB[(j + 1) % polyB.length])) return true;
    }
  }
  return false;
}

/** Check if zone A's polygon overlaps zone B's polygon (AABB pre-filter + polygon check) */
export function zonesOverlap(
  zA: { bounds: Bounds; shape: string; lRatioX?: number; lRatioY?: number; polygon?: readonly Pt[] | null },
  zB: { bounds: Bounds; shape: string; lRatioX?: number; lRatioY?: number; polygon?: readonly Pt[] | null },
): boolean {
  const a = zA.bounds, b = zB.bounds;
  // AABB reject
  if (a.x >= b.x + b.w || a.x + a.w <= b.x || a.y >= b.y + b.h || a.y + a.h <= b.y) return false;
  // If both are simple rects, AABB is sufficient
  const aShape = zA.shape as string;
  const bShape = zB.shape as string;
  if ((aShape === 'rect' || (!aShape.startsWith('l_') && aShape !== 'custom')) &&
      (bShape === 'rect' || (!bShape.startsWith('l_') && bShape !== 'custom'))) {
    return true;
  }
  // Polygon check
  const polyA = getZoneVertices(a, aShape, zA.lRatioX ?? 0.5, zA.lRatioY ?? 0.5, zA.polygon);
  const polyB = getZoneVertices(b, bShape, zB.lRatioX ?? 0.5, zB.lRatioY ?? 0.5, zB.polygon);
  return polygonsOverlap(polyA, polyB);
}
