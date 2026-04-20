import type { FloorId } from './common';

/**
 * Cumulative visitor-seconds grid for a single floor.
 *
 * Each cell accumulates total active-visitor seconds spent inside its
 * world-space rectangle. Unlike `HeatmapData` (short-lived decay for live
 * canvas), this is monotonically growing and survives the whole sim run —
 * it's what the report uses to show "where visitors actually dwell".
 */
export interface DensityGrid {
  readonly floorId: FloorId;
  readonly originX: number;   // world px — top-left of grid
  readonly originY: number;
  readonly cellPx: number;    // cell edge length (world px)
  readonly cols: number;
  readonly rows: number;
  readonly data: Float32Array; // length = cols * rows, units = seconds
}
