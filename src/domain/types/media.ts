import type { MediaId, ZoneId, Vector2D, Degrees } from './common';

// ---- Media Type (20 presets) ----
export const MEDIA_TYPE = {
  // Large displays
  LED_WALL: 'led_wall',
  PROJECTION: 'projection',
  TRANSPARENT_LED: 'transparent_led',
  // Interactive
  TOUCHSCREEN_KIOSK: 'touchscreen_kiosk',
  INTERACTIVE_TABLE: 'interactive_table',
  GESTURE_WALL: 'gesture_wall',
  AR_STATION: 'ar_station',
  VR_BOOTH: 'vr_booth',
  PHOTO_BOOTH: 'photo_booth',
  // Informational
  INFO_PANEL: 'info_panel',
  DIGITAL_SIGNAGE: 'digital_signage',
  CATALOG_STAND: 'catalog_stand',
  // Exhibits
  PRODUCT_DISPLAY: 'product_display',
  SHOWCASE_CASE: 'showcase_case',
  ROTATING_PLATFORM: 'rotating_platform',
  // Experiential
  SIMULATOR: 'simulator',
  HANDS_ON_DEMO: 'hands_on_demo',
  // Other
  SPEAKER_PODIUM: 'speaker_podium',
  SEATING_AREA: 'seating_area',
  CUSTOM: 'custom',
} as const;

export type MediaType = (typeof MEDIA_TYPE)[keyof typeof MEDIA_TYPE];

export interface MediaPreset {
  readonly type: MediaType;
  readonly defaultSize: { readonly width: number; readonly height: number }; // meters
  readonly defaultCapacity: number;
  readonly avgEngagementTimeMs: number;
  readonly isInteractive: boolean;
}

export type MediaInteractionType = 'passive' | 'active' | 'staged';
export type MediaShape = 'rect' | 'circle';

export interface MediaPlacement {
  readonly id: MediaId;
  readonly name: string;
  readonly type: MediaType;
  readonly zoneId: ZoneId;
  readonly position: Vector2D; // local coordinates within zone
  readonly size: { readonly width: number; readonly height: number };
  readonly orientation: Degrees; // front-facing direction (0=up, 90=right, 180=down, 270=left)
  readonly capacity: number;
  readonly avgEngagementTimeMs: number;
  readonly attractiveness: number; // 0-1
  readonly interactionType: MediaInteractionType; // passive=관람형, active=체험형, staged=회차형
  readonly shape?: MediaShape; // rect (default) or circle
  readonly stageIntervalMs?: number; // staged only: time between sessions (e.g. 60000 = 1min)
}
