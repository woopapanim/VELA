import type { ShaftId } from './common';

export type { ShaftId };

// Elevator shaft — multi-floor transit hub.
// Which floors this shaft serves is DERIVED from the set of portal nodes whose shaftId
// points here; not stored on the shaft itself. Agents arriving at any portal of the shaft
// can teleport to any other portal in the same shaft after a combined wait + travel delay.
export interface ElevatorShaft {
  readonly id: ShaftId;
  readonly name: string;              // e.g. "Elevator A"
  readonly capacity: number;           // concurrent boarding cap (queue forms above this)
  readonly waitTimeMs: number;         // door open/close + boarding dwell
  readonly travelTimePerFloorMs: number; // per-floor-level transit time
}
