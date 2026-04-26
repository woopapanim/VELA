import type { MediaId, ZoneId, Vector2D, Degrees, Polygon } from './common';

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
  readonly omnidirectional?: boolean; // default 360° viewing flag (analog center exhibits)
}

export type MediaInteractionType = 'passive' | 'active' | 'staged' | 'analog';
export type MediaShape = 'rect' | 'circle' | 'ellipse' | 'custom';

// ─── Phase 0 (2026-04-25): 카테고리별 큐레이션 속성 ───
// spec: docs/specs/phase-0-exhibit-vocabulary.md
// 모두 optional — 기존 시나리오 100% 호환 보장.

/** 작품 비중 — KPI 가중 + UI 강조에 사용. */
export type ArtworkSignificance = 'hero' | 'support' | 'context';

/** 작품(Artwork = analog 카테고리) 전용 큐레이션 속성. */
export interface ArtworkProps {
  /** 같은 시리즈 내 의도된 관람 순서 (1-based 정수). */
  readonly curatorialOrder?: number;
  /** 시리즈/섹션 그룹 키 (예: "조선시대 회화", "작가 A 시리즈"). zone 넘나들 수 있음. */
  readonly series?: string;
  /** 작품 비중 — KPI 가중 (hero=3.0, support=1.0, context=0.3) + UI 강조. */
  readonly significance?: ArtworkSignificance;
}

/** 디지털 미디어 챕터 (Phase 3B 에서 활용, Phase 0 에서는 표시만). */
export interface MediaChapter {
  readonly id: string;
  readonly title: string;
  readonly startMs: number;
  readonly endMs: number;
}

/** 디지털 미디어 인터랙션 수준 (Phase 3B 에서 시뮬에 영향). */
export type InteractivityLevel = 'view-only' | 'chapter-select' | 'full-interactive';

/** 디지털 미디어(passive_media 카테고리) 전용 경험 속성. */
export interface DigitalMediaProps {
  /** 컨텐츠 전체 길이. */
  readonly contentDurationMs?: number;
  /** 의미있는 체험으로 인정할 최소 시청 시간. Phase 3B 의 meaningfulCompletionRate 기준. */
  readonly minWatchMs?: number;
  /** 루프 가능 여부 (PASSIVE 모드일 때 의미). */
  readonly loopable?: boolean;
  /** 챕터 (Phase 3B 활용). */
  readonly chapters?: ReadonlyArray<MediaChapter>;
  /** 인터랙션 수준 (Phase 3B 에서 시뮬에 multiplier 적용). */
  readonly interactivityLevel?: InteractivityLevel;
}

/** 인터랙티브(active 카테고리) 세션 모드. */
export type InteractiveSessionMode = 'slot' | 'queue' | 'free';

/** 인터랙티브(active 카테고리) 전용 속성. */
export interface InteractiveProps {
  /** 세션 모드 — 기존 queueBehavior 와 보완 (slot=시간 분할, queue=대기열, free=자유). */
  readonly sessionMode?: InteractiveSessionMode;
  /** 평균 인터랙션 깊이 (0-1). 단순 터치 → 풀 인터랙션. */
  readonly interactionDepth?: number;
}

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
  readonly mustVisit?: boolean; // true=히어로 전시물, 모든 관람객이 반드시 관람 (피로·큐 대기 무시)
  readonly attractionRadius: number; // meters — instance override
  readonly interactionType: MediaInteractionType; // passive=관람형, active=체험형, staged=회차형, analog=실물전시
  readonly omnidirectional?: boolean; // true=360도 관람 가능 (analog용, 중앙 전시물)
  readonly shape?: MediaShape; // rect (default), circle, or custom polygon
  readonly polygon?: Polygon; // custom shape vertices (center-relative local coords, pre-rotation)
  readonly stageIntervalMs?: number; // staged only: time between sessions (e.g. 60000 = 1min)
  readonly queueBehavior?: QueueBehavior;
  readonly groupFriendly?: boolean;

  // ─── Phase 0 (2026-04-25): 카테고리별 큐레이션 속성 ───
  // 모두 optional. category 에 따라 해당 props 를 활용.
  // mustVisit (시뮬 강제) 와 artwork.significance (KPI/UI 표시) 는 직교 — 둘 다 사용 가능.
  /** 작품 (category=ANALOG) 큐레이션 속성. Phase 3A 에서 활용. */
  readonly artwork?: ArtworkProps;
  /** 디지털 미디어 (category=PASSIVE_MEDIA) 경험 속성. Phase 3B 에서 활용. */
  readonly digital?: DigitalMediaProps;
  /** 인터랙티브 (category=ACTIVE) 속성. */
  readonly interactive?: InteractiveProps;
}
