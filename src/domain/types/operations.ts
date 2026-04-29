/**
 * Operations Policy — Phase 1 (2026-04-25)
 *
 * 운영 정책 (입장 제한 + 만족도) 도메인 타입.
 *
 * 핵심 개념:
 * - EntryPolicy: 입장 throttle 방식 (5종)
 * - SatisfactionWeights: 만족도 가중치 (가중합 = 1)
 * - OperationsConfig: 위 둘의 묶음, SimulationConfig.operations 에 부착
 *
 * 백엔드 통합 지점: SimEngine.spawnTick() — outsideQueue + EntryController.
 * 호환성: SimulationConfig.operations 미설정 시 'unlimited' 기본 동작 (회귀 0).
 *
 * Phase 1+ (2026-04-26): 인내심 모델 확장 — 균일 + 정규분포 + 프로필/참여도 배수.
 * 현실 데이터 기반: walk-in 10-15분, 유료 30-45분, 블록버스터 60분 (Wharton 큐잉 연구).
 *
 * 관련 spec: docs/specs/phase-1-operations-policy.md
 */

import type { VisitorProfileType, EngagementLevel } from './visitor';

// ── Entry Policy (입장 정책) ──────────────────────────

export type EntryPolicyMode =
  | 'unlimited'        // 무제한 (현재 기본값, 외부 큐 없음)
  | 'concurrent-cap'   // 동시 수용 N — 내부 인원 < N 일 때만 입장
  | 'rate-limit'       // 시간당 처리 상한 — N 명/h
  | 'time-slot'        // 시간슬롯 예약 — 슬롯당 K 명, slot 만료 시 다음 슬롯
  | 'hybrid';          // concurrent-cap + time-slot 동시 적용 (대형 시설)

export interface EntryPolicy {
  readonly mode: EntryPolicyMode;
  /** concurrent-cap / hybrid: 내부 동시 수용 상한 */
  readonly maxConcurrent?: number;
  /** rate-limit: 시간당 입장 인원 cap */
  readonly maxPerHour?: number;
  /** time-slot / hybrid: 슬롯 길이 (ms). 기본 30분 = 1_800_000 */
  readonly slotDurationMs?: number;
  /** time-slot / hybrid: 슬롯당 입장 인원 cap */
  readonly perSlotCap?: number;
  /** 외부 대기 인내심 (ms). 초과 시 포기 이탈. 기본 30분 = 1_800_000 (현실 기준 유료 전시). */
  readonly maxWaitBeforeAbandonMs?: number;
  /**
   * Phase 1+ (2026-04-26): 인내심 분포 모델.
   * - 'fixed' (기본/legacy): 모두 동일 인내심
   * - 'normal': 정규분포 N(mean × profile × engagement, std), [0.3*mean, 3*mean] 클램프
   */
  readonly patienceModel?: 'fixed' | 'normal';
  /** 정규분포 표준편차 (ms) — patienceModel === 'normal' 일 때만 사용. 기본 9분 = 540_000 (mean 30분의 30%) */
  readonly patienceStdMs?: number;
  /**
   * Phase 1+ (2026-04-26): 프로필/참여도 배수 적용 여부.
   * - false (기본): 모두 같은 평균 (= maxWaitBeforeAbandonMs). 단순 모델.
   * - true: visitor mix 의 프로필 분포에 따라 평균이 달라짐 (VIP 더 오래, 어린이 짧게).
   * 사용자 opt-in 으로 분포 노이즈 (σ) 와 독립 결정.
   */
  readonly patienceUseModifiers?: boolean;
  /** 프로필별 인내심 배수. 미지정 시 DEFAULT_PATIENCE_PROFILE_MODIFIERS. patienceUseModifiers === true 일 때만 발동. */
  readonly patienceProfileModifiers?: Partial<Record<VisitorProfileType, number>>;
  /** 참여도별 인내심 배수. 미지정 시 DEFAULT_PATIENCE_ENGAGEMENT_MODIFIERS. patienceUseModifiers === true 일 때만 발동. */
  readonly patienceEngagementModifiers?: Partial<Record<EngagementLevel, number>>;
}

/**
 * Phase 1+ (2026-04-26): 프로필별 인내심 배수.
 * - vip 1.3: 사전 commitment, 유료 → 더 기다림
 * - child 0.6: 지루함을 빨리 느낌, 부모 압력
 * - elderly/disabled 0.85: 신체적 한계 (서있기 어려움)
 * - general 1.0: 기준
 */
export const DEFAULT_PATIENCE_PROFILE_MODIFIERS: Record<VisitorProfileType, number> = {
  general: 1.0,
  vip: 1.3,
  child: 0.6,
  elderly: 0.85,
  disabled: 0.85,
};

/**
 * Phase 1+ (2026-04-26): 참여도별 인내심 배수.
 * - quick 0.7: 가볍게 둘러보러 옴, 줄서면 바로 떠남
 * - explorer 1.0: 기준
 * - immersive 1.4: 깊은 체험 의도, 줄도 감수
 */
export const DEFAULT_PATIENCE_ENGAGEMENT_MODIFIERS: Record<EngagementLevel, number> = {
  quick: 0.7,
  explorer: 1.0,
  immersive: 1.4,
};

// ── Satisfaction Weights (만족도 가중치) ────────────────

export interface SatisfactionWeights {
  readonly crowd: number;      // 혼잡도 영향. default 0.3
  readonly dwell: number;      // 의도된 체류 vs 실제. default 0.3
  readonly wait: number;       // 외부+내부 대기. default 0.2
  readonly engagement: number; // 의미있는 체험 비율. default 0.2
}

/** 가중치 합 검증. 합이 1.0 ± 0.01 범위 안이면 true. */
export function isSatisfactionWeightsValid(w: SatisfactionWeights): boolean {
  const sum = w.crowd + w.dwell + w.wait + w.engagement;
  return Math.abs(sum - 1) < 0.01;
}

// ── Operations Config (Scenario.simulationConfig 에 부착) ──

export interface OperationsConfig {
  readonly entryPolicy: EntryPolicy;
  readonly satisfactionWeights: SatisfactionWeights;
}

// ── Default factory ─────────────────────────────────────

export const DEFAULT_SATISFACTION_WEIGHTS: SatisfactionWeights = {
  crowd: 0.3,
  dwell: 0.3,
  wait: 0.2,
  engagement: 0.2,
};

export const DEFAULT_OPERATIONS_CONFIG: OperationsConfig = {
  entryPolicy: { mode: 'unlimited' },
  satisfactionWeights: DEFAULT_SATISFACTION_WEIGHTS,
};

/**
 * 정책 모드별 기본 파라미터 (UI 에서 모드 전환 시 합리적 default 제공).
 *
 * Phase 1+ (2026-04-26): maxWait 30분 + 정규분포 σ 9분 (30% of mean).
 * 프로필/참여도 배수는 opt-in (patienceUseModifiers default false) — 단순 모델로 시작.
 *
 * 현실 데이터 기반 (Wharton 큐잉 연구, 미술관 평균):
 * - walk-in 무료: 10-15분
 * - 유료 일반 전시: 30-45분  ← default 기준
 * - 블록버스터: 45-60분
 */
const DEFAULT_PATIENCE_FIELDS = {
  maxWaitBeforeAbandonMs: 1_800_000, // 30 min
  patienceModel: 'normal' as const,
  patienceStdMs: 540_000, // 9 min = 30% of mean (유료 일반 전시 가이드)
};

export const DEFAULT_POLICY_PARAMS: Record<EntryPolicyMode, EntryPolicy> = {
  'unlimited': { mode: 'unlimited' },
  'concurrent-cap': {
    mode: 'concurrent-cap',
    maxConcurrent: 200,
    ...DEFAULT_PATIENCE_FIELDS,
  },
  'rate-limit': {
    mode: 'rate-limit',
    maxPerHour: 240,
    ...DEFAULT_PATIENCE_FIELDS,
  },
  'time-slot': {
    mode: 'time-slot',
    slotDurationMs: 1_800_000, // 30 min
    perSlotCap: 80,
    ...DEFAULT_PATIENCE_FIELDS,
  },
  'hybrid': {
    mode: 'hybrid',
    maxConcurrent: 200,
    slotDurationMs: 1_800_000,
    perSlotCap: 80,
    ...DEFAULT_PATIENCE_FIELDS,
  },
};

// ── Operations KPI (analytics 결과) ─────────────────────

export interface SatisfactionDistribution {
  readonly excellent: number;  // 0.85 ~ 1.00
  readonly good: number;       // 0.70 ~ 0.85
  readonly fair: number;       // 0.50 ~ 0.70
  readonly poor: number;       // 0.30 ~ 0.50
  readonly bad: number;        // 0.00 ~ 0.30
}

export interface OperationsKpi {
  // ── 외부 대기 ──
  readonly avgOutsideWaitMs: number;
  readonly maxOutsideWaitMs: number;
  readonly p95OutsideWaitMs: number;
  readonly abandonmentRate: number;     // 포기 이탈 / 도착 인원
  // ── 처리량 ──
  readonly throughputPerHour: number;
  readonly peakConcurrent: number;
  readonly avgConcurrent: number;
  // ── 만족도 ──
  readonly avgSatisfaction: number;
  readonly satisfactionDistribution: SatisfactionDistribution;
  // ── 혼잡 누적 ──
  readonly congestionMinutes: number;   // 시설 평균 혼잡도 > 0.7 누적 분
  // ── 카운트 (invariant 검증용) ──
  readonly totalArrived: number;
  readonly totalAdmitted: number;
  readonly totalAbandoned: number;
  readonly totalCurrentlyWaiting: number;
}

/** 만족도 점수 → 라벨 (UI/리포트용). */
export type SatisfactionLabel = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

export function satisfactionLabel(score: number): SatisfactionLabel {
  if (score >= 0.85) return 'excellent';
  if (score >= 0.70) return 'good';
  if (score >= 0.50) return 'fair';
  if (score >= 0.30) return 'poor';
  return 'bad';
}
