/**
 * Exhibit (전시물) — 모든 전시 대상의 상위 개념
 *
 * Phase 0 (2026-04-25) 도입. 기존 `Media*` 타입의 점진 마이그레이션을 위한
 * alias 레이어. 신규 코드는 `Exhibit*` 사용 권장. 기존 `Media*` 타입은
 * 호환성 위해 그대로 유지하며, 다른 작업 시 touch 할 때 점진 마이그레이션.
 *
 * 관련 spec: docs/specs/phase-0-exhibit-vocabulary.md
 *
 * 카테고리 매핑 (큐레이터 관점 ↔ 코드 카테고리):
 *   작품 (Artwork)             ↔ ANALOG
 *   디지털 미디어 (Digital)    ↔ PASSIVE_MEDIA
 *   인터랙티브 (Interactive)   ↔ ACTIVE
 *   이머시브 (Immersive)       ↔ IMMERSIVE
 */

import type {
  MediaPlacement,
  MediaCategory,
  MediaType,
  MediaPreset,
  MediaInteractionType,
  MediaShape,
  ArtworkProps,
  DigitalMediaProps,
  InteractiveProps,
  ArtworkSignificance,
  InteractivityLevel,
  InteractiveSessionMode,
  MediaChapter,
} from './media';

// ── 핵심 alias ────────────────────────────────────────────
/** 전시물 (Exhibit) — 모든 카테고리(작품/디지털/인터랙티브/이머시브) 의 상위 개념. */
export type Exhibit = MediaPlacement;

/** 전시물 카테고리 (analog/passive_media/active/immersive). */
export type ExhibitCategory = MediaCategory;

/** 전시물 세부 타입 (15 종 콘텐츠). */
export type ExhibitType = MediaType;

/** 전시물 프리셋 (defaults). */
export type ExhibitPreset = MediaPreset;

/** 전시물 인터랙션 모드 (passive/active/staged/analog) — 시뮬레이션 차원. */
export type ExhibitEngagementMode = MediaInteractionType;

/** 전시물 형상. */
export type ExhibitShape = MediaShape;

// ── 카테고리별 속성 alias (Phase 0 신규, media.ts 에서 정의) ──
export type {
  ArtworkProps,
  DigitalMediaProps,
  InteractiveProps,
  ArtworkSignificance,
  InteractivityLevel,
  InteractiveSessionMode,
  MediaChapter,
};

// ── 큐레이터 관점 카테고리 키 (UI 표시용) ──
/**
 * 큐레이터 관점에서의 전시물 종류. 코드의 `MEDIA_CATEGORY` 와 1:1 매핑되며,
 * UI/i18n/큐레이션 워크플로우에서는 본 키 사용을 권장.
 */
export const EXHIBIT_KIND = {
  /** 작품 (회화, 조각, 사진, 유물 등 정적 전시물) */
  ARTWORK: 'analog',
  /** 디지털 미디어 (영상, 프로젝션, 미디어월) */
  DIGITAL: 'passive_media',
  /** 인터랙티브 (터치테이블, 키오스크, 핸즈온) */
  INTERACTIVE: 'active',
  /** 이머시브 (VR/AR, 몰입형 룸, 4D) */
  IMMERSIVE: 'immersive',
} as const satisfies Record<string, MediaCategory>;

export type ExhibitKind = (typeof EXHIBIT_KIND)[keyof typeof EXHIBIT_KIND];

/** UI 라벨용 사람 친화 이름 (i18n 키 매핑 시 참고). */
export const EXHIBIT_KIND_LABEL_KEY = {
  [EXHIBIT_KIND.ARTWORK]: 'exhibit.kind.artwork',
  [EXHIBIT_KIND.DIGITAL]: 'exhibit.kind.digital',
  [EXHIBIT_KIND.INTERACTIVE]: 'exhibit.kind.interactive',
  [EXHIBIT_KIND.IMMERSIVE]: 'exhibit.kind.immersive',
} as const;

// ── 헬퍼: 카테고리 → kind 변환 (UI 분기 시) ──
export function exhibitKindOf(exhibit: Pick<Exhibit, 'category'>): ExhibitKind {
  return exhibit.category as ExhibitKind;
}

export function isArtwork(exhibit: Pick<Exhibit, 'category'>): boolean {
  return exhibit.category === EXHIBIT_KIND.ARTWORK;
}

export function isDigitalMedia(exhibit: Pick<Exhibit, 'category'>): boolean {
  return exhibit.category === EXHIBIT_KIND.DIGITAL;
}

export function isInteractive(exhibit: Pick<Exhibit, 'category'>): boolean {
  return exhibit.category === EXHIBIT_KIND.INTERACTIVE;
}

export function isImmersive(exhibit: Pick<Exhibit, 'category'>): boolean {
  return exhibit.category === EXHIBIT_KIND.IMMERSIVE;
}

// 참고: MEDIA_CATEGORY / MEDIA_TYPE 등 기존 const 는 './media' 또는
// `@/domain` 에서 그대로 import 가능 (중복 export 회피).
