import type { ZoneType, FlowType } from '@/domain';
import type { MediaType } from '@/domain';

/**
 * DraftScenario — the loose shape Claude Vision produces.
 *
 * Coordinates are in **meters**, with origin at the top-left of the input image.
 * IDs are plain strings (branded IDs are minted during hydration).
 * Fields the AI cannot reliably infer (visitor distribution, simulation config)
 * are omitted here and filled by the hydrator. The hydrator also builds the
 * waypoint graph from zone roles + connections.
 */
export interface DraftScenario {
  readonly name: string;
  readonly scale: DraftScale;
  readonly zones: readonly DraftZone[];
  readonly media: readonly DraftMedia[];
  readonly notes?: string;
}

export interface DraftScale {
  /** Raw dimension text detected on plan, e.g. "40'-1\" × 70'-0\"" or "12m × 21m". */
  readonly label: string;
  /** Physical width/height of the image in meters. */
  readonly widthMeters: number;
  readonly heightMeters: number;
}

/** Role drives the waypoint node type the hydrator emits for this zone. */
export type DraftZoneRole = 'spawn' | 'exit' | 'exhibit' | 'rest';

export interface DraftZone {
  /** Unique slug key the AI invents (e.g. "reception", "treatment_bay"). */
  readonly key: string;
  readonly name: string;
  readonly type: ZoneType;
  readonly flowType?: FlowType;
  /** Axis-aligned bounding rect in METERS. */
  readonly rect: DraftRect;
  /**
   * Optional polygon (METERS, absolute image coords) for L/O/non-rect rooms.
   * When present, supersedes rect for hit-testing but rect still drives layout.
   */
  readonly polygon?: readonly DraftPoint[];
  /**
   * Waypoint role. Defaults to 'exhibit'. At least one zone should be 'spawn'
   * and at least one should be 'exit' for the simulation to run.
   */
  readonly role?: DraftZoneRole;
  /**
   * Keys of zones this zone connects to (doorways / shared edges). Edges are
   * bidirectional by default. If omitted or empty, the hydrator falls back to
   * spatial adjacency between zone rects.
   */
  readonly connections?: readonly string[];
  readonly attractiveness?: number; // 0-1, optional AI hint
}

export interface DraftMedia {
  readonly name: string;
  readonly type: MediaType;
  /** Key of the zone this media belongs to. */
  readonly zoneKey: string;
  /** Absolute image coords in METERS (center of the placement). */
  readonly position: DraftPoint;
  readonly size?: { readonly width: number; readonly height: number };
  /** 0=up, 90=right, 180=down, 270=left. */
  readonly orientation?: number;
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
