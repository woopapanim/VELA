import type { ZoneType } from '@/domain';

/**
 * DraftScenario — the loose shape Claude Vision produces.
 *
 * Scope: ZONES ONLY. Media placements, waypoint nodes, and edges are left to
 * the user after loading — the analyzer just gets the room footprint as close
 * to the plan as possible so the user can draw everything else on top.
 *
 * Coordinates are in **meters**, with origin at the top-left of the input image.
 * IDs are plain strings (branded IDs are minted during hydration).
 */
export interface DraftScenario {
  readonly name: string;
  readonly scale: DraftScale;
  readonly zones: readonly DraftZone[];
  readonly notes?: string;
}

export interface DraftScale {
  /** Raw dimension text detected on plan, e.g. "40'-1\" × 70'-0\"" or "12m × 21m". */
  readonly label: string;
  /** Physical width/height of the image in meters. */
  readonly widthMeters: number;
  readonly heightMeters: number;
}

export interface DraftZone {
  /** Unique slug key the AI invents (e.g. "reception", "treatment_bay"). */
  readonly key: string;
  readonly name: string;
  readonly type: ZoneType;
  /** Axis-aligned bounding rect in METERS. */
  readonly rect: DraftRect;
  /**
   * Optional polygon (METERS, absolute image coords) for L/O/non-rect rooms.
   * When present, supersedes rect for hit-testing but rect still drives layout.
   */
  readonly polygon?: readonly DraftPoint[];
}

export interface DraftRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface DraftPoint {
  readonly x: number;
  readonly y: number;
}

/** Warnings accumulated during hydration — shown in the review UI. */
export interface HydrationWarning {
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
}
