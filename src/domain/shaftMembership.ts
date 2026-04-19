import type { FloorId, ShaftId, WaypointGraph } from '@/domain';

/**
 * Which floors does a shaft serve?
 * Derived from the set of portal nodes whose shaftId points at this shaft —
 * the shaft itself does not store floorIds. Adding or removing a portal is
 * therefore the *only* way the membership changes, eliminating sync bugs.
 */
export function getShaftFloorIds(shaftId: ShaftId, graph: WaypointGraph | null): FloorId[] {
  if (!graph) return [];
  const seen = new Set<string>();
  const out: FloorId[] = [];
  for (const n of graph.nodes) {
    if (n.type !== 'portal') continue;
    if ((n.shaftId as string | null | undefined) !== (shaftId as string)) continue;
    const fid = n.floorId as string;
    if (seen.has(fid)) continue;
    seen.add(fid);
    out.push(n.floorId as FloorId);
  }
  return out;
}
