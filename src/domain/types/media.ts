import type { MediaId, ZoneId, Vector2D, Degrees } from './common';

// ---- Media Category (4대 분류) ----
export const MEDIA_CATEGORY = {
  ANALOG: 'analog',               // 아날로그 전시물 (Static Display)
  PASSIVE_MEDIA: 'passive_media',  // 패시브 미디어 (Passive Media)
  ACTIVE: 'active',                // 액티브 인터랙션 (Active Interaction)
  IMMERSIVE: 'immersive',          // 이머시브/실감 체험 (Immersive Experience)
} as const;

export type MediaCategory =
  (typeof MEDIA_CATEGORY)[keyof typeof MEDIA_CATEGORY];

// ---- Media Type (15종 콘텐츠) ----
export const MEDIA_TYPE = {
  // 아날로그 (analog)
  ARTIFACT: 'artifact',                   // 유물/제품 전시
  DOCUMENTS: 'documents',                 // 사료/기록물
  DIORAMA: 'diorama',                     // 디오라마/모형
  GRAPHIC_SIGN: 'graphic_sign',           // 그래픽 사인/배너
  // 패시브 미디어 (passive_media)
  MEDIA_WALL: 'media_wall',               // 미디어 월 (대형 LED/LCD)
  VIDEO_WALL: 'video_wall',               // 비디오 월 (멀티 모니터)
  PROJECTION_MAPPING: 'projection_mapping', // 프로젝션 매핑
  SINGLE_DISPLAY: 'single_display',       // 디스플레이 (TV/모니터)
  // 액티브 인터랙션 (active)
  KIOSK: 'kiosk',                         // 정보 키오스크
  TOUCH_TABLE: 'touch_table',             // 터치 테이블
  INTERACTION_MEDIA: 'interaction_media', // 인터랙션 미디어 (동작인식)
  HANDS_ON_MODEL: 'hands_on_model',       // 체험 모형
  // 이머시브 (immersive)
  VR_AR_STATION: 'vr_ar_station',         // VR/AR 스테이션
  IMMERSIVE_ROOM: 'immersive_room',       // 몰입형 미디어 룸
  SIMULATOR_4D: 'simulator_4d',           // 4D 시뮬레이터
} as const;

export type MediaType = (typeof MEDIA_TYPE)[keyof typeof MEDIA_TYPE];

// ---- Queue Behavior ----
export type QueueBehavior = 'none' | 'linear' | 'area';

// ---- Media Preset ----
export interface MediaPreset {
  readonly type: MediaType;
  readonly category: MediaCategory;
  readonly defaultSize: { readonly width: number; readonly height: number }; // meters
  readonly defaultCapacity: number;
  readonly avgEngagementTimeMs: number;
  readonly isInteractive: boolean;
  readonly attractionRadius: number;  // meters — how far it pulls visitors
  readonly attractionPower: number;   // 0-1 — strength of pull
  readonly queueBehavior: QueueBehavior; // none=skip if full, linear=queue, area=spread wait
  readonly groupFriendly: boolean;    // can groups engage simultaneously?
  readonly fatigueCategory: string;   // fatigue group key — same category in sequence → skip↑
}

export type MediaInteractionType = 'passive' | 'active' | 'staged';
export type MediaShape = 'rect' | 'circle';

export interface MediaPlacement {
  readonly id: MediaId;
  readonly name: string;
  readonly type: MediaType;
  readonly category: MediaCategory;
  readonly zoneId: ZoneId;
  readonly position: Vector2D; // local coordinates within zone
  readonly size: { readonly width: number; readonly height: number };
  readonly orientation: Degrees; // front-facing direction (0=up, 90=right, 180=down, 270=left)
  readonly capacity: number;
  readonly avgEngagementTimeMs: number;
  readonly attractiveness: number; // 0-1
  readonly attractionRadius: number; // meters — instance override
  readonly interactionType: MediaInteractionType; // passive=관람형, active=체험형, staged=회차형
  readonly shape?: MediaShape; // rect (default) or circle
  readonly stageIntervalMs?: number; // staged only: time between sessions (e.g. 60000 = 1min)
  readonly queueBehavior?: QueueBehavior;
  readonly groupFriendly?: boolean;
}
