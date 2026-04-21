import type { PhysicsConfig, SkipThreshold } from './types/physics';
import type { HeatmapConfig } from './types/heatmap';
import type { MediaPreset, MediaType } from './types/media';
import type { HexColor } from './types/common';
import type { VisitorCategoryConfig, VisitorCategory } from './types/visitor';

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
  skipMultiplier: 2.0,
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

// ---- 15 Media Presets (4 Categories) ----
export const MEDIA_PRESETS: Record<MediaType, MediaPreset> = {
  // ── 아날로그 (analog) — 눈으로 보고 지나가는 전시물 ──
  artifact:      { type: 'artifact',      category: 'analog', defaultSize: { width: 1.5, height: 1.0 }, defaultCapacity: 6,  avgEngagementTimeMs: 20_000,  isInteractive: false, attractionRadius: 2,  attractionPower: 0.4, queueBehavior: 'none',   groupFriendly: true,  fatigueCategory: 'analog', omnidirectional: true },
  documents:     { type: 'documents',     category: 'analog', defaultSize: { width: 1.2, height: 0.8 }, defaultCapacity: 3,  avgEngagementTimeMs: 22_000,  isInteractive: false, attractionRadius: 1.5, attractionPower: 0.3, queueBehavior: 'none',   groupFriendly: true,  fatigueCategory: 'analog', omnidirectional: false },
  diorama:       { type: 'diorama',       category: 'analog', defaultSize: { width: 3.0, height: 2.0 }, defaultCapacity: 10, avgEngagementTimeMs: 30_000,  isInteractive: false, attractionRadius: 3,  attractionPower: 0.6, queueBehavior: 'none',   groupFriendly: true,  fatigueCategory: 'analog', omnidirectional: true },
  graphic_sign:  { type: 'graphic_sign',  category: 'analog', defaultSize: { width: 2.0, height: 1.5 }, defaultCapacity: 8,  avgEngagementTimeMs: 10_000,  isInteractive: false, attractionRadius: 2,  attractionPower: 0.2, queueBehavior: 'none',   groupFriendly: true,  fatigueCategory: 'analog', omnidirectional: false },

  // ── 패시브 미디어 (passive_media) — 일방향 영상 매체 ──
  media_wall:         { type: 'media_wall',         category: 'passive_media', defaultSize: { width: 6.0, height: 3.0 }, defaultCapacity: 20, avgEngagementTimeMs: 90_000,  isInteractive: false, attractionRadius: 8,  attractionPower: 0.9, queueBehavior: 'none',   groupFriendly: true,  fatigueCategory: 'screen' },
  video_wall:         { type: 'video_wall',         category: 'passive_media', defaultSize: { width: 4.0, height: 2.5 }, defaultCapacity: 15, avgEngagementTimeMs: 45_000,  isInteractive: false, attractionRadius: 5,  attractionPower: 0.7, queueBehavior: 'none',   groupFriendly: true,  fatigueCategory: 'screen' },
  projection_mapping: { type: 'projection_mapping', category: 'passive_media', defaultSize: { width: 8.0, height: 4.0 }, defaultCapacity: 30, avgEngagementTimeMs: 60_000,  isInteractive: false, attractionRadius: 10, attractionPower: 0.8, queueBehavior: 'none',   groupFriendly: true,  fatigueCategory: 'screen' },
  single_display:     { type: 'single_display',     category: 'passive_media', defaultSize: { width: 1.5, height: 1.0 }, defaultCapacity: 3,  avgEngagementTimeMs: 22_000,  isInteractive: false, attractionRadius: 2,  attractionPower: 0.4, queueBehavior: 'none',   groupFriendly: true,  fatigueCategory: 'screen' },

  // ── 액티브 인터랙션 (active) — 직접 조작하는 체험 ──
  kiosk:             { type: 'kiosk',             category: 'active', defaultSize: { width: 0.8, height: 0.5 }, defaultCapacity: 1,  avgEngagementTimeMs: 45_000,  isInteractive: true, attractionRadius: 2,  attractionPower: 0.5, queueBehavior: 'linear', groupFriendly: false, fatigueCategory: 'interactive' },
  touch_table:       { type: 'touch_table',       category: 'active', defaultSize: { width: 2.0, height: 1.2 }, defaultCapacity: 6,  avgEngagementTimeMs: 120_000, isInteractive: true, attractionRadius: 3,  attractionPower: 0.7, queueBehavior: 'area',   groupFriendly: true,  fatigueCategory: 'interactive' },
  interaction_media: { type: 'interaction_media', category: 'active', defaultSize: { width: 4.0, height: 2.5 }, defaultCapacity: 3,  avgEngagementTimeMs: 60_000,  isInteractive: true, attractionRadius: 4,  attractionPower: 0.6, queueBehavior: 'area',   groupFriendly: true,  fatigueCategory: 'interactive' },
  hands_on_model:    { type: 'hands_on_model',    category: 'active', defaultSize: { width: 2.5, height: 1.5 }, defaultCapacity: 4,  avgEngagementTimeMs: 45_000,  isInteractive: true, attractionRadius: 2,  attractionPower: 0.5, queueBehavior: 'linear', groupFriendly: true,  fatigueCategory: 'interactive' },

  // ── 이머시브 (immersive) — 공간 전체 또는 특수장비 체험 ──
  vr_ar_station:  { type: 'vr_ar_station',  category: 'immersive', defaultSize: { width: 3.0, height: 3.0 }, defaultCapacity: 1,  avgEngagementTimeMs: 240_000, isInteractive: true, attractionRadius: 3,  attractionPower: 0.8, queueBehavior: 'linear', groupFriendly: false, fatigueCategory: 'immersive' },
  immersive_room: { type: 'immersive_room', category: 'immersive', defaultSize: { width: 6.0, height: 6.0 }, defaultCapacity: 15, avgEngagementTimeMs: 210_000, isInteractive: true, attractionRadius: 6,  attractionPower: 0.9, queueBehavior: 'area',   groupFriendly: true,  fatigueCategory: 'immersive' },
  simulator_4d:   { type: 'simulator_4d',   category: 'immersive', defaultSize: { width: 4.0, height: 3.0 }, defaultCapacity: 2,  avgEngagementTimeMs: 300_000, isInteractive: true, attractionRadius: 4,  attractionPower: 0.7, queueBehavior: 'linear', groupFriendly: false, fatigueCategory: 'immersive' },
};

// ---- Visitor Category Configs ----
export const CATEGORY_CONFIGS: Record<VisitorCategory, VisitorCategoryConfig> = {
  solo: {
    category: 'solo',
    baseSpeed: 24,            // 1.2 m/s × 20 px/m
    collisionRadius: 6,       // 0.3m × 20
    dwellTimeMultiplier: 1.0,
    skipThresholdMod: 0.7,    // impatient — skips earlier
    groupSizeRange: [1, 1],
    cohesionModel: 'none',
  },
  small_group: {
    category: 'small_group',
    baseSpeed: 18,            // 0.9 m/s × 20
    collisionRadius: 16,      // 0.8m × 20
    dwellTimeMultiplier: 1.5, // socializing → longer dwell
    skipThresholdMod: 1.0,
    groupSizeRange: [2, 4],
    cohesionModel: 'cohesion',
  },
  guided_tour: {
    category: 'guided_tour',
    baseSpeed: 12,            // 0.6 m/s × 20
    collisionRadius: 30,      // 1.5m × 20 — moving obstacle
    dwellTimeMultiplier: 3.0, // docent explains → very long dwell
    skipThresholdMod: 2.0,    // very patient — rarely skips
    groupSizeRange: [10, 20],
    cohesionModel: 'follow_leader',
  },
  vip_expert: {
    category: 'vip_expert',
    baseSpeed: 14,            // 0.7 m/s × 20
    collisionRadius: 8,       // 0.4m × 20
    dwellTimeMultiplier: 2.5, // reads everything thoroughly
    skipThresholdMod: 1.5,    // patient
    groupSizeRange: [1, 1],
    cohesionModel: 'none',
  },
};

// ---- Default Category Weights ----
export const DEFAULT_CATEGORY_WEIGHTS: Record<VisitorCategory, number> = {
  solo: 60,
  small_group: 25,
  guided_tour: 5,
  vip_expert: 10,
};

// ---- Media Physics ----
export const MEDIA_SCALE = 20; // 1 meter = 20 pixels on canvas
export const MEDIA_INTERACTION_OFFSET = 1.5; // meters in front of media for viewing area
export const MEDIA_INTERACTION_DEPTH = 1.5; // meters deep (how far back viewers stand)
export const MEDIA_SQMETER_PER_PERSON = 0.8; // m² per person for capacity calculation
