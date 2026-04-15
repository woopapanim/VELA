import type { PhysicsConfig, SkipThreshold } from './types/physics';
import type { HeatmapConfig } from './types/heatmap';
import type { MediaPreset, MediaType } from './types/media';
import type { HexColor } from './types/common';

// ---- Physics Defaults ----
export const DEFAULT_PHYSICS: PhysicsConfig = {
  maxSpeed: 120,
  maxAcceleration: 200,
  arrivalRadius: 30,
  arrivalSlowRadius: 80,
  avoidanceRadius: 20,
  separationStrength: 1.5,
  wanderRadius: 40,
  wanderJitter: 0.3,
  obstacleAvoidanceLookahead: 60,
  groupCohesionStrength: 1.0,
  groupCohesionRadius: 80,
  followerSeekWeight: 2.0,
  followerArrivalRadius: 40,
};

export const DEFAULT_SKIP_THRESHOLD: SkipThreshold = {
  skipMultiplier: 1.0,
  maxWaitTimeMs: 30_000, // 30s hard cap — matches typical media engagement time
  skipCooldownMs: 5_000,
};

export const DEFAULT_HEATMAP: HeatmapConfig = {
  gridResolution: 4,
  gaussianSigma: 20,
  gaussianRadius: 40,
  decayRate: 0.95,
  bottleneckThreshold: 0.8,
};

// ---- Simulation Defaults ----
export const DEFAULT_FIXED_DELTA_TIME = 1000 / 60; // ~16.67ms
export const DEFAULT_TIME_SCALE = 1.0;
export const DEFAULT_MAX_VISITORS = 500;
export const DEFAULT_SIMULATION_DURATION = 3_600_000; // 1 hour

// ---- International Standard ----
export const INTERNATIONAL_DENSITY_STANDARD = 2.5; // m² per person

// ---- KPI ----
export const KPI_SAMPLE_INTERVAL_MS = 1000;

// ---- Zone Colors ----
export const ZONE_COLORS: Record<string, HexColor> = {
  lobby: '#14b8a6',
  entrance: '#22c55e',
  exhibition: '#3b82f6',
  corridor: '#6b7280',
  rest: '#f59e0b',
  stage: '#a855f7',
  exit: '#ef4444',
  gateway: '#14b8a6',
};

// ---- Density Color Scale (Cold → Hot, 8 levels) ----
export const DENSITY_SCALE: readonly HexColor[] = [
  '#1e3a5f', // 0 - Empty (deep blue)
  '#2563eb', // 1 - Low
  '#22d3ee', // 2 - Moderate
  '#4ade80', // 3 - Normal
  '#facc15', // 4 - Elevated
  '#f97316', // 5 - High
  '#ef4444', // 6 - Critical
  '#dc2626', // 7 - Overflow
];

// ---- Heatmap Spectral Colors ----
export const HEATMAP_SPECTRAL = {
  cold: '#00ffff',
  mid: '#00ff64',
  hot: '#ff0032',
} as const;

// ---- Visitor Speed by Profile (px/s) ----
export const VISITOR_SPEEDS: Record<string, number> = {
  general: 120,
  vip: 100,
  child: 150,
  elderly: 60,
  disabled: 50,
};

// ---- Visitor Mass by Profile (kg) ----
export const VISITOR_MASS: Record<string, number> = {
  general: 70,
  vip: 70,
  child: 35,
  elderly: 65,
  disabled: 70,
};

// ---- Visitor Max Force by Profile ----
export const VISITOR_MAX_FORCE: Record<string, number> = {
  general: 200,
  vip: 180,
  child: 250,
  elderly: 100,
  disabled: 80,
};

// ---- Fatigue Rates (per ms) ----
// Target: general reaches ~70% fatigue at 30min, 100% at ~45min
export const FATIGUE_RATES: Record<string, number> = {
  general:  0.0000004,   // ~45min to 100%
  vip:      0.0000003,   // ~55min (VIP = more stamina)
  child:    0.0000006,   // ~28min (kids tire faster)
  elderly:  0.0000008,   // ~21min
  disabled: 0.000001,    // ~17min
};

// ---- Patience by Profile (0-1) ----
export const PATIENCE_VALUES: Record<string, number> = {
  general: 0.5,
  vip: 0.3,
  child: 0.2,
  elderly: 0.7,
  disabled: 0.6,
};

// ---- Patience by Engagement Level ----
export const ENGAGEMENT_PATIENCE_MODIFIER: Record<string, number> = {
  quick: 0.7,
  explorer: 1.0,
  immersive: 1.3,
};

// ---- 20 Media Presets ----
export const MEDIA_PRESETS: Record<MediaType, MediaPreset> = {
  led_wall: { type: 'led_wall', defaultSize: { width: 6, height: 3 }, defaultCapacity: 20, avgEngagementTimeMs: 30_000, isInteractive: false },
  projection: { type: 'projection', defaultSize: { width: 8, height: 4 }, defaultCapacity: 30, avgEngagementTimeMs: 45_000, isInteractive: false },
  transparent_led: { type: 'transparent_led', defaultSize: { width: 4, height: 2.5 }, defaultCapacity: 15, avgEngagementTimeMs: 20_000, isInteractive: false },
  touchscreen_kiosk: { type: 'touchscreen_kiosk', defaultSize: { width: 0.8, height: 0.5 }, defaultCapacity: 2, avgEngagementTimeMs: 60_000, isInteractive: true },
  interactive_table: { type: 'interactive_table', defaultSize: { width: 2, height: 1.2 }, defaultCapacity: 6, avgEngagementTimeMs: 90_000, isInteractive: true },
  gesture_wall: { type: 'gesture_wall', defaultSize: { width: 4, height: 2.5 }, defaultCapacity: 4, avgEngagementTimeMs: 45_000, isInteractive: true },
  ar_station: { type: 'ar_station', defaultSize: { width: 2, height: 2 }, defaultCapacity: 2, avgEngagementTimeMs: 120_000, isInteractive: true },
  vr_booth: { type: 'vr_booth', defaultSize: { width: 3, height: 3 }, defaultCapacity: 1, avgEngagementTimeMs: 180_000, isInteractive: true },
  photo_booth: { type: 'photo_booth', defaultSize: { width: 2.5, height: 2.5 }, defaultCapacity: 4, avgEngagementTimeMs: 60_000, isInteractive: true },
  info_panel: { type: 'info_panel', defaultSize: { width: 1.2, height: 2 }, defaultCapacity: 3, avgEngagementTimeMs: 15_000, isInteractive: false },
  digital_signage: { type: 'digital_signage', defaultSize: { width: 2, height: 1.5 }, defaultCapacity: 10, avgEngagementTimeMs: 10_000, isInteractive: false },
  catalog_stand: { type: 'catalog_stand', defaultSize: { width: 0.6, height: 0.4 }, defaultCapacity: 2, avgEngagementTimeMs: 20_000, isInteractive: false },
  product_display: { type: 'product_display', defaultSize: { width: 2, height: 2 }, defaultCapacity: 8, avgEngagementTimeMs: 30_000, isInteractive: false },
  showcase_case: { type: 'showcase_case', defaultSize: { width: 1.5, height: 1 }, defaultCapacity: 6, avgEngagementTimeMs: 25_000, isInteractive: false },
  rotating_platform: { type: 'rotating_platform', defaultSize: { width: 3, height: 3 }, defaultCapacity: 12, avgEngagementTimeMs: 20_000, isInteractive: false },
  simulator: { type: 'simulator', defaultSize: { width: 4, height: 3 }, defaultCapacity: 2, avgEngagementTimeMs: 300_000, isInteractive: true },
  hands_on_demo: { type: 'hands_on_demo', defaultSize: { width: 3, height: 2 }, defaultCapacity: 4, avgEngagementTimeMs: 120_000, isInteractive: true },
  speaker_podium: { type: 'speaker_podium', defaultSize: { width: 2, height: 1.5 }, defaultCapacity: 50, avgEngagementTimeMs: 600_000, isInteractive: false },
  seating_area: { type: 'seating_area', defaultSize: { width: 5, height: 4 }, defaultCapacity: 20, avgEngagementTimeMs: 300_000, isInteractive: false },
  custom: { type: 'custom', defaultSize: { width: 2, height: 2 }, defaultCapacity: 5, avgEngagementTimeMs: 60_000, isInteractive: false },
};

// ---- Media Physics ----
export const MEDIA_SCALE = 20; // 1 meter = 20 pixels on canvas
export const MEDIA_INTERACTION_OFFSET = 1.5; // meters in front of media for viewing area
export const MEDIA_INTERACTION_DEPTH = 1.5; // meters deep (how far back viewers stand)
export const MEDIA_SQMETER_PER_PERSON = 0.8; // m² per person for capacity calculation
