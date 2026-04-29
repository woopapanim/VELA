/**
 * Experience Mode — Phase 1 UX (2026-04-26)
 *
 * 엔진 정책 (EntryPolicy: unlimited / concurrent-cap / rate-limit / time-slot / hybrid)
 * 위에 페르소나 친화적 framing 을 입히는 _UX 레이어_ 도메인 모델.
 *
 * 사용자는 "체험 모드" 로 진입 → 모드가 정책 default + 만족도 가중치 + 리포트 shape 결정.
 *
 * 2-tier 분류:
 * - 검증 (validation): 변형 A/B/C 비교, 큐 미발생 (unlimited 강제)
 * - 운영 예상 (operations): 단일 시나리오 timeline + 권장
 *
 * 8 모드 (활성 5 + disabled 3):
 *   validation:  layout_validation ✅ | curation_validation 🔒 Phase 3A | media_experience 🔒 Phase 3B
 *   operations:  free_admission ✅ | free_with_throttle ✅ | timed_reservation ✅
 *                | controlled_admission ✅ | group_visit 🔒 Phase 2
 *
 * 관련 spec: docs/specs/phase-1-experience-modes.md
 * 메모리: project_question_driven_ux.md (2026-04-23 합의)
 */

import type { EntryPolicy } from './operations';
import type { SatisfactionWeights } from './operations';
import type { ZoneConfig } from './zone';
import type { MediaPlacement } from './media';

// ── Tier ────────────────────────────────────────────────

export type ExperienceModeTier = 'validation' | 'operations';

// ── Mode enum ───────────────────────────────────────────

export type ExperienceMode =
  // Validation tier
  | 'layout_validation'
  | 'curation_validation'      // 🔒 Phase 3A
  | 'media_experience'         // 🔒 Phase 3B
  // Operations tier
  | 'free_admission'
  | 'free_with_throttle'
  | 'timed_reservation'
  | 'controlled_admission'
  | 'group_visit';             // 🔒 Phase 2

// ── Meta (UI 표시 + 활성화 정보) ────────────────────────

export interface ExperienceModeMeta {
  readonly mode: ExperienceMode;
  readonly tier: ExperienceModeTier;
  /** 현재 시점에 사용자가 선택 가능한가 */
  readonly enabled: boolean;
  /** disabled 일 때 안내 텍스트용 (예: "Phase 3A") */
  readonly enabledFromPhase?: string;
  /** UI 표시명 i18n 키 (예: 'experienceMode.layout_validation.label') */
  readonly i18nKey: string;
  /**
   * 페르소나 i18n 키 prefix. Ka 카드의 "누구를 위한 모드인가" 라벨.
   * 예: 'experienceMode.layout_validation.persona' → "공간 디자이너".
   */
  readonly personaKey: string;
  /**
   * 핵심 질문 i18n 키. "이 모드가 답하는 질문 한 줄". (한국어 한 문장)
   * 예: 'experienceMode.layout_validation.question'
   *  → "이 레이아웃이 좋은가? 동선이 꼬이지 않는가?"
   */
  readonly questionKey: string;
  /**
   * 이 모드가 켜졌을 때 사용자가 보게 될 핵심 KPI 의 i18n 키들 (2-4 개).
   * 모드 카드의 "여기서 보는 결과" preview, locked 카드의 가치 미리보기에 사용.
   */
  readonly previewKpiKeys: ReadonlyArray<string>;
}

export const EXPERIENCE_MODE_REGISTRY: Readonly<Record<ExperienceMode, ExperienceModeMeta>> = {
  layout_validation: {
    mode: 'layout_validation',
    tier: 'validation',
    enabled: true,
    i18nKey: 'experienceMode.layout_validation',
    personaKey: 'experienceMode.layout_validation.persona',
    questionKey: 'experienceMode.layout_validation.question',
    previewKpiKeys: [
      'experienceMode.kpi.density',
      'experienceMode.kpi.congestionMin',
      'experienceMode.kpi.flowEfficiency',
      'experienceMode.kpi.variantAbc',
    ],
  },
  curation_validation: {
    mode: 'curation_validation',
    tier: 'validation',
    enabled: false,
    enabledFromPhase: 'Phase 3A',
    i18nKey: 'experienceMode.curation_validation',
    personaKey: 'experienceMode.curation_validation.persona',
    questionKey: 'experienceMode.curation_validation.question',
    previewKpiKeys: [
      'experienceMode.kpi.orderFidelity',
      'experienceMode.kpi.seriesCompletion',
      'experienceMode.kpi.heroReach',
      'experienceMode.kpi.backtrack',
    ],
  },
  media_experience: {
    mode: 'media_experience',
    tier: 'validation',
    enabled: false,
    enabledFromPhase: 'Phase 3B',
    i18nKey: 'experienceMode.media_experience',
    personaKey: 'experienceMode.media_experience.persona',
    questionKey: 'experienceMode.media_experience.question',
    previewKpiKeys: [
      'experienceMode.kpi.meaningfulCompletion',
      'experienceMode.kpi.throughput',
      'experienceMode.kpi.contentSkip',
      'experienceMode.kpi.capacityUtil',
    ],
  },
  free_admission: {
    mode: 'free_admission',
    tier: 'operations',
    enabled: true,
    i18nKey: 'experienceMode.free_admission',
    personaKey: 'experienceMode.free_admission.persona',
    questionKey: 'experienceMode.free_admission.question',
    previewKpiKeys: [
      'experienceMode.kpi.concurrentTimeline',
      'experienceMode.kpi.satisfaction',
      'experienceMode.kpi.crowdAccum',
      'experienceMode.kpi.recommendedCap',
    ],
  },
  free_with_throttle: {
    mode: 'free_with_throttle',
    tier: 'operations',
    enabled: true,
    i18nKey: 'experienceMode.free_with_throttle',
    personaKey: 'experienceMode.free_with_throttle.persona',
    questionKey: 'experienceMode.free_with_throttle.question',
    previewKpiKeys: [
      'experienceMode.kpi.outsideQueue',
      'experienceMode.kpi.avgWait',
      'experienceMode.kpi.abandonRate',
      'experienceMode.kpi.recommendedCap',
    ],
  },
  timed_reservation: {
    mode: 'timed_reservation',
    tier: 'operations',
    enabled: true,
    i18nKey: 'experienceMode.timed_reservation',
    personaKey: 'experienceMode.timed_reservation.persona',
    questionKey: 'experienceMode.timed_reservation.question',
    previewKpiKeys: [
      'experienceMode.kpi.slotIntake',
      'experienceMode.kpi.slotUtil',
      'experienceMode.kpi.interSlotWait',
      'experienceMode.kpi.satisfaction',
    ],
  },
  controlled_admission: {
    mode: 'controlled_admission',
    tier: 'operations',
    enabled: true,
    i18nKey: 'experienceMode.controlled_admission',
    personaKey: 'experienceMode.controlled_admission.persona',
    questionKey: 'experienceMode.controlled_admission.question',
    previewKpiKeys: [
      'experienceMode.kpi.satisfaction',
      'experienceMode.kpi.throughputTradeoff',
      'experienceMode.kpi.outsideQueue',
      'experienceMode.kpi.recommendedCapRange',
    ],
  },
  group_visit: {
    mode: 'group_visit',
    tier: 'operations',
    enabled: false,
    enabledFromPhase: 'Phase 2',
    i18nKey: 'experienceMode.group_visit',
    personaKey: 'experienceMode.group_visit.persona',
    questionKey: 'experienceMode.group_visit.question',
    previewKpiKeys: [
      'experienceMode.kpi.groupCohesion',
      'experienceMode.kpi.groupConflict',
      'experienceMode.kpi.docentUtil',
      'experienceMode.kpi.vipImpact',
    ],
  },
};

/** 활성 모드만 (UI 라디오에서 클릭 가능). */
export const ENABLED_EXPERIENCE_MODES: ReadonlyArray<ExperienceMode> = (
  Object.values(EXPERIENCE_MODE_REGISTRY) as ExperienceModeMeta[]
)
  .filter((m) => m.enabled)
  .map((m) => m.mode);

/** Tier 별 모드 묶음 (UI 그룹핑). */
export const EXPERIENCE_MODES_BY_TIER: Readonly<Record<ExperienceModeTier, ReadonlyArray<ExperienceMode>>> = {
  validation: ['layout_validation', 'curation_validation', 'media_experience'],
  operations: ['free_admission', 'free_with_throttle', 'timed_reservation', 'controlled_admission', 'group_visit'],
};

export function isExperienceModeEnabled(mode: ExperienceMode): boolean {
  return EXPERIENCE_MODE_REGISTRY[mode].enabled;
}

export function experienceModeTier(mode: ExperienceMode): ExperienceModeTier {
  return EXPERIENCE_MODE_REGISTRY[mode].tier;
}

// ── 모드별 EntryPolicy default ──────────────────────────
//
// 모드 선택/변경 시 entryPolicy 가 이 default 로 reset.
// 사용자가 ExperienceModePanel 의 파라미터에서 미세 조정한 값은 보호 (모드 변경 시 confirmation).
//
// 검증 tier 는 모두 unlimited (큐 미발생, 동선/체류만 측정).
// 운영 tier 는 모드별 의도에 맞는 정책.

const PATIENCE_DEFAULTS = {
  maxWaitBeforeAbandonMs: 1_800_000, // 30 min (유료 일반 전시 기준)
  patienceModel: 'normal' as const,
  patienceStdMs: 540_000,            // 9 min = 30% of mean
};

export const EXPERIENCE_MODE_POLICY_DEFAULTS: Readonly<Record<ExperienceMode, EntryPolicy>> = {
  // ── 검증: 모두 unlimited ──
  layout_validation:    { mode: 'unlimited' },
  curation_validation:  { mode: 'unlimited' },
  media_experience:     { mode: 'unlimited' },

  // ── 운영 ──
  free_admission:       { mode: 'unlimited' },
  free_with_throttle: {
    mode: 'concurrent-cap',
    maxConcurrent: 400,                // 면적 모를 때만 사용되는 fallback. 실제 default 는 resolveExperienceModePolicy 가 면적 기반으로 계산.
    ...PATIENCE_DEFAULTS,
  },
  timed_reservation: {
    mode: 'time-slot',
    slotDurationMs: 1_800_000,         // 30 min
    perSlotCap: 80,
    ...PATIENCE_DEFAULTS,
  },
  controlled_admission: {
    mode: 'concurrent-cap',
    maxConcurrent: 200,                // 낮은 cap = 강한 통제
    ...PATIENCE_DEFAULTS,
  },
  // group_visit 은 Phase 2 에서 단체 booking 모델과 함께 재정의.
  // 현재는 unlimited placeholder.
  group_visit:          { mode: 'unlimited' },
};

// ── 면적 기반 자동 cap (free_with_throttle) ──────────────
//
// 자유 관람 + 통제 의 의도: "평소 자유, 공간 수용인원 초과 시 발동".
// 그 수용인원은 시나리오의 실제 _점유 가능_ 면적에서 계산해야 의미가 있다 (magic number 금지).
// 기준: 국제 권장 2.5 m²/인 (FullReport.tsx 의 공간 등급 기준과 일치).
// 점유형 zone (lobby/exhibition/corridor/rest/stage) 만 합산 — entrance/exit/gateway 는 통과형.
// 미디어 물리 히트박스 면적은 차감 — 관람객이 실제로 점유할 수 없음.
//   bounding-box 기준 (rect 정확, circle/polygon 은 약간 보수적 = cap 더 작아짐, 안전한 방향).
// 결과는 10명 단위로 반올림 + 최저 50명 보장.
//
// 시나리오에 zone 이 아직 없을 땐 정적 default (400) fallback.

const AREA_PER_PERSON_M2 = 2.5;
const OCCUPIABLE_ZONE_TYPES = new Set<string>(['lobby', 'exhibition', 'corridor', 'rest', 'stage']);

export function computeAreaBasedCap(
  zones: readonly Pick<ZoneConfig, 'id' | 'type' | 'area'>[],
  media: readonly Pick<MediaPlacement, 'zoneId' | 'size'>[] = [],
): number {
  const occupiableZoneIds = new Set(zones.filter((z) => OCCUPIABLE_ZONE_TYPES.has(z.type)).map((z) => z.id));
  const zoneArea = zones
    .filter((z) => OCCUPIABLE_ZONE_TYPES.has(z.type))
    .reduce((s, z) => s + z.area, 0);
  const mediaArea = media
    .filter((m) => occupiableZoneIds.has(m.zoneId))
    .reduce((s, m) => s + Math.max(0, m.size.width * m.size.height), 0);
  const usableArea = Math.max(0, zoneArea - mediaArea);
  if (usableArea <= 0) return 400;
  const cap = Math.round(usableArea / AREA_PER_PERSON_M2 / 10) * 10;
  return Math.max(50, cap);
}

/**
 * 모드의 entry policy default 를 시나리오 컨텍스트로 풀어서 반환.
 * 정적 EXPERIENCE_MODE_POLICY_DEFAULTS 위에서 free_with_throttle 의 maxConcurrent 만 면적 기반으로 덮어씀.
 */
export function resolveExperienceModePolicy(
  mode: ExperienceMode,
  zones: readonly Pick<ZoneConfig, 'id' | 'type' | 'area'>[],
  media: readonly Pick<MediaPlacement, 'zoneId' | 'size'>[] = [],
): EntryPolicy {
  const base = EXPERIENCE_MODE_POLICY_DEFAULTS[mode];
  if (mode === 'free_with_throttle' && base.mode === 'concurrent-cap') {
    return { ...base, maxConcurrent: computeAreaBasedCap(zones, media) };
  }
  return base;
}

// ── 모드별 만족도 가중치 default ─────────────────────────
//
// 각 모드의 _의도_ 가 다르므로 만족도 4 요소 (혼잡 / 체류 / 대기 / 체험완주) 가중치도 다름.
// 사용자는 ExperienceModePanel 의 가중치 슬라이더로 미세 조정 가능 (default 는 아래).
//
// 검증 tier: wait 0 (큐 미발생). 모드별로 핵심 KPI 가중.
// 운영 tier: wait 가중 ↑, free 계열은 crowd ↑, controlled 는 wait ↑↑.

export const SATISFACTION_WEIGHTS_BY_MODE: Readonly<Record<ExperienceMode, SatisfactionWeights>> = {
  // 검증: 큐 미발생 → wait = 0
  layout_validation:    { crowd: 0.4, dwell: 0.3, wait: 0.0, engagement: 0.3 },
  curation_validation:  { crowd: 0.3, dwell: 0.3, wait: 0.0, engagement: 0.4 }, // 체험완주 ↑
  media_experience:     { crowd: 0.2, dwell: 0.3, wait: 0.0, engagement: 0.5 }, // 체험완주 ↑↑

  // 운영
  free_admission:       { crowd: 0.5, dwell: 0.2, wait: 0.1, engagement: 0.2 }, // 혼잡 ↑↑
  free_with_throttle:   { crowd: 0.4, dwell: 0.2, wait: 0.2, engagement: 0.2 }, // 혼잡+대기 균형
  timed_reservation:    { crowd: 0.2, dwell: 0.3, wait: 0.3, engagement: 0.2 }, // 슬롯 낭비 = wait
  controlled_admission: { crowd: 0.2, dwell: 0.2, wait: 0.4, engagement: 0.2 }, // 외부 대기 ↑↑
  group_visit:          { crowd: 0.3, dwell: 0.3, wait: 0.2, engagement: 0.2 }, // Phase 2 재정의
};

// ── 마이그레이션: 기존 시나리오 → ExperienceMode 추론 ────
//
// 기존 시나리오는 experienceMode 가 없음. 로드 시점에 entryPolicy.mode 로 추론.
// 사용자가 명시적으로 모드를 선택하면 그때부터 시나리오 파일에 저장 → 다음 로드 시 추론 불필요.
//
// 매핑 근거:
// - unlimited → free_admission (기본)
// - concurrent-cap → controlled_admission (보수적, cap 낮은 가정)
// - rate-limit → controlled_admission (외부 throttle, 같은 성격)
// - time-slot → timed_reservation
// - hybrid → controlled_admission (slot + cap 조합, 강한 통제로 분류)

export function inferExperienceMode(entryMode: EntryPolicy['mode'] | undefined): ExperienceMode {
  switch (entryMode) {
    case 'unlimited':       return 'free_admission';
    case 'concurrent-cap':  return 'controlled_admission';
    case 'rate-limit':      return 'controlled_admission';
    case 'time-slot':       return 'timed_reservation';
    case 'hybrid':          return 'controlled_admission';
    case undefined:         return 'free_admission';
    default: {
      // exhaustiveness 체크 — 새 EntryPolicyMode 추가 시 컴파일 에러로 알림
      const _exhaustive: never = entryMode;
      void _exhaustive;
      return 'free_admission';
    }
  }
}

/** 기본 모드 — 새 시나리오 생성 시 초기값. */
export const DEFAULT_EXPERIENCE_MODE: ExperienceMode = 'free_admission';
