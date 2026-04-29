/**
 * Satisfaction Calculator — Phase 1 (2026-04-26)
 *
 * 방문객 만족도 (0-1) 추정 + 5 라벨 분포 집계.
 *
 * 공식 (spec phase-1-operations-policy.md §1.3):
 *   sat = w_crowd · (1 - crowdScore)
 *       + w_dwell · dwellAdequacyScore
 *       + w_wait  · (1 - waitScore)
 *       + w_engagement · engagementCompletionScore
 *
 * 가중치 (`SatisfactionWeights`) 는 모드별 default + 사용자 조정 가능.
 * 모드별 기본값은 `SATISFACTION_WEIGHTS_BY_MODE` 참조 (검증 tier 는 wait=0 등).
 *
 * 데이터 출처 (per-visitor):
 *   - outsideWaitMs    : visitor.outsideWaitMs (Phase 1 lifecycle, 외부 큐 대기)
 *   - internalWaitMs   : caller 가 누적 (현재 visitor 모델에 없음 → 0 placeholder)
 *   - actualDwellMs    : (exitedAt ?? now) - (admittedAt ?? enteredAt)
 *   - recommendedDwellMs: visitor.visitBudgetMs (스폰 시 계산된 개인 예산)
 *   - crowdScore       : engine 측 per-tick 샘플 필요 (현재 0 placeholder, TODO)
 *   - mediaVisited     : visitor.visitedMediaIds.length
 *   - mediaCompleted   : 완주 (minWatchMs 도달) 미디어 수 — 현재 추적 안 됨 (TODO),
 *                        잠정적으로 visitedMediaIds.length 와 동일 (모두 완주 가정)
 *
 * 한계 (백서/리포트에 표기 필요):
 *   - crowdScore: 현재 0 (placeholder). 엔진 측 per-visitor 평균 혼잡 누적 추가 후 활성.
 *   - engagementCompletionScore: 현재 1.0 (방문=완주 가정). 미디어별 minWatchMs 도달
 *     여부 추적이 추가되면 정확화.
 *
 * 즉 현재 v0 만족도는 사실상 (1 - waitScore) + dwellAdequacy 가중합. 운영 tier
 * (wait 가중치 큼) 에선 의미 있는 신호, 검증 tier (wait=0, engagement 큼) 에선
 * dwell 만 반영 → engagement tracking 추가 후 의미 풍부해짐.
 */

import type { Visitor } from '@/domain';
import type {
  SatisfactionWeights,
  SatisfactionLabel,
  SatisfactionDistribution,
} from '@/domain';
// satisfactionLabel: domain 측 source of truth (operations.ts). 임계값 동기 유지.
import { satisfactionLabel as _satisfactionLabelFromDomain } from '@/domain';

// ── Constants ───────────────────────────────────────────────

/** 외부 + 내부 대기 정규화 상한 (ms). 30분. spec §1.3 */
export const SATISFACTION_W_MAX_MS = 30 * 60_000;

/**
 * 라벨 임계 — spec phase-1-operations-policy.md §1.4.
 * domain/types/operations.ts 의 `satisfactionLabel()` 와 동기화 필수.
 * (한쪽만 바꾸면 분포/평균/UI 라벨 사이 불일치 → invariant 깨짐)
 */
export const SATISFACTION_LABEL_THRESHOLDS = {
  excellent: 0.85,
  good: 0.70,
  fair: 0.50,
  poor: 0.30,
  // bad: < 0.30
} as const;

// Re-export for convenience: 분석 모듈 한 곳에서 import 가능하게.
export type { SatisfactionLabel, SatisfactionDistribution };

export interface SatisfactionAggregate {
  /** 평균 만족도 (0-1). 입력 빈 배열이면 0. */
  readonly avg: number;
  /** 5 라벨별 비율 (합 = 1, 입력 빈 배열이면 모두 0). */
  readonly distribution: SatisfactionDistribution;
  /** 라벨별 인원 수 (디버그/툴팁용). */
  readonly counts: SatisfactionDistribution;
  /** 입력 sample 수 (`avg`/`distribution` 분모). */
  readonly sampleCount: number;
}

// ── Per-visitor inputs ──────────────────────────────────────

export interface SatisfactionInputs {
  /** 외부 큐 대기 시간 (ms). 정책 throttle 시 admittedAt - arrivedAt. */
  readonly outsideWaitMs: number;
  /** 내부 대기 시간 (ms). WAITING 상태 누적. 추적 안 되면 0. */
  readonly internalWaitMs: number;
  /** 실제 체류 시간 (ms). exitedAt - admittedAt(or enteredAt). */
  readonly actualDwellMs: number;
  /** 권장 체류 시간 (ms). visitor.visitBudgetMs. 0 이면 dwellAdequacy = 1 (벌점 없음). */
  readonly recommendedDwellMs: number;
  /** 경로상 평균 혼잡도 (0=한산, 1=과밀). 미추적 시 0. */
  readonly crowdScore: number;
  /** 방문한 미디어 수 (visitedMediaIds.length). */
  readonly mediaVisited: number;
  /** 의미있는 체험 완주 수 (minWatchMs 도달). 미추적 시 mediaVisited 와 동일. */
  readonly mediaCompleted: number;
}

// ── Core formula ────────────────────────────────────────────

/**
 * 단일 방문객 만족도 계산. 0-1 범위.
 *
 * 모든 component 는 [0, 1] 클램프. 가중합 자체도 [0, 1] 안에 들지만 부동소수
 * 오차 방어 차원에서 한 번 더 클램프.
 *
 * 가중치 합이 1 이 아니어도 수학적으로는 동작 — 다만 SatisfactionWeights 설계상
 * 합 = 1 이 invariant (`isSatisfactionWeightsValid` 로 보장).
 */
export function computeSatisfaction(
  inputs: SatisfactionInputs,
  weights: SatisfactionWeights,
): number {
  const totalWaitMs = Math.max(0, inputs.outsideWaitMs) + Math.max(0, inputs.internalWaitMs);
  const waitScore = Math.min(totalWaitMs / SATISFACTION_W_MAX_MS, 1);

  const dwellAdequacy = inputs.recommendedDwellMs > 0
    ? clamp01(inputs.actualDwellMs / inputs.recommendedDwellMs)
    : 1; // 권장 체류가 0 이면 dwell 벌점 없음 (예산 미설정 케이스)

  const crowdScore = clamp01(inputs.crowdScore);

  const engagementCompletion = inputs.mediaVisited > 0
    ? clamp01(inputs.mediaCompleted / inputs.mediaVisited)
    : 1; // 방문 미디어가 0 이면 완주율 만점 (예: layout-only 검증)

  const sat =
      weights.crowd      * (1 - crowdScore)
    + weights.dwell      * dwellAdequacy
    + weights.wait       * (1 - waitScore)
    + weights.engagement * engagementCompletion;

  return clamp01(sat);
}

// ── Visitor → inputs adapter ────────────────────────────────

/**
 * Visitor 객체에서 SatisfactionInputs 추출. 누락 필드 보수적 fallback.
 *
 * @param visitor 대상 방문객 (보통 isActive=false 인 exit 직전/직후)
 * @param now 현재 시뮬 elapsed (ms). exitedAt 미설정 시 actualDwell 산정용 fallback.
 * @param opts.crowdScore engine 측 혼잡 샘플 (0-1). 미제공 시 0.
 * @param opts.mediaCompleted 완주 미디어 수. 미제공 시 visitedMediaIds.length (전부 완주 가정).
 * @param opts.internalWaitMs WAITING 상태 누적 (ms). 미제공 시 0.
 */
export function deriveSatisfactionInputs(
  visitor: Visitor,
  now: number,
  opts?: {
    crowdScore?: number;
    mediaCompleted?: number;
    internalWaitMs?: number;
  },
): SatisfactionInputs {
  // 입장 기준점: admittedAt > enteredAt fallback (legacy 시나리오 호환)
  const startMs = visitor.admittedAt ?? visitor.enteredAt;
  const endMs = visitor.exitedAt ?? now;
  const actualDwellMs = Math.max(0, endMs - startMs);
  const outsideWaitMs = visitor.outsideWaitMs ?? 0;
  const mediaVisited = visitor.visitedMediaIds.length;
  return {
    outsideWaitMs,
    internalWaitMs: opts?.internalWaitMs ?? 0,
    actualDwellMs,
    recommendedDwellMs: visitor.visitBudgetMs,
    crowdScore: opts?.crowdScore ?? 0,
    mediaVisited,
    mediaCompleted: opts?.mediaCompleted ?? mediaVisited,
  };
}

// ── Labels & aggregation ────────────────────────────────────

/**
 * 점수 → 5 라벨. 임계는 SATISFACTION_LABEL_THRESHOLDS.
 *
 * 내부적으로 domain 측 `satisfactionLabel` 로 위임 (단일 진실 공급원).
 * 이 wrapper 는 입력 clamp + 분석 모듈에서 한 곳 import 편의 위해 유지.
 */
export function satisfactionLabel(score: number): SatisfactionLabel {
  return _satisfactionLabelFromDomain(clamp01(score));
}

/**
 * 점수 배열 → avg + 5 라벨 분포 (비율 + 카운트).
 *
 * 입력이 빈 배열이면 avg=0, distribution/counts 모두 0, sampleCount=0.
 */
export function aggregateSatisfaction(scores: readonly number[]): SatisfactionAggregate {
  const n = scores.length;
  if (n === 0) {
    const zero: SatisfactionDistribution = { excellent: 0, good: 0, fair: 0, poor: 0, bad: 0 };
    return { avg: 0, distribution: zero, counts: zero, sampleCount: 0 };
  }
  const counts: { excellent: number; good: number; fair: number; poor: number; bad: number } = {
    excellent: 0, good: 0, fair: 0, poor: 0, bad: 0,
  };
  let sum = 0;
  for (const s of scores) {
    const c = clamp01(s);
    sum += c;
    counts[satisfactionLabel(c)]++;
  }
  const avg = sum / n;
  const distribution: SatisfactionDistribution = {
    excellent: counts.excellent / n,
    good: counts.good / n,
    fair: counts.fair / n,
    poor: counts.poor / n,
    bad: counts.bad / n,
  };
  return { avg, distribution, counts, sampleCount: n };
}

// ── Internals ───────────────────────────────────────────────

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
