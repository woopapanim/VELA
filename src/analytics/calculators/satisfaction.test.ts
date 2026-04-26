/**
 * Satisfaction calculator tests — Phase 1 (2026-04-26)
 *
 * 단위:
 *   - computeSatisfaction: 공식 정확성 + 가중치 모드별 효과 + 클램프
 *   - satisfactionLabel: 5 라벨 임계 경계
 *   - aggregateSatisfaction: 평균 + 분포 + 빈 입력
 *   - deriveSatisfactionInputs: Visitor 어댑터 (admittedAt vs enteredAt fallback 등)
 */

import { describe, it, expect } from 'vitest';
import {
  computeSatisfaction,
  satisfactionLabel,
  aggregateSatisfaction,
  deriveSatisfactionInputs,
  SATISFACTION_W_MAX_MS,
  SATISFACTION_LABEL_THRESHOLDS,
  type SatisfactionInputs,
} from './satisfaction';
import {
  SATISFACTION_WEIGHTS_BY_MODE,
  type SatisfactionWeights,
  type Visitor,
  type VisitorProfile,
} from '@/domain';

// ── Test fixtures ───────────────────────────────────────────

/** 모든 component 가 "최악" — 만족도 최저. */
const WORST_INPUTS: SatisfactionInputs = {
  outsideWaitMs: SATISFACTION_W_MAX_MS, // 30분 wait
  internalWaitMs: 0,
  actualDwellMs: 0,                     // 권장 대비 0 → dwellAdequacy 0
  recommendedDwellMs: 60 * 60_000,      // 60분 권장
  crowdScore: 1,                        // 과밀
  mediaVisited: 5,
  mediaCompleted: 0,                    // 완주 0
};

/** 모든 component 가 "최상" — 만족도 만점. */
const BEST_INPUTS: SatisfactionInputs = {
  outsideWaitMs: 0,
  internalWaitMs: 0,
  actualDwellMs: 60 * 60_000,           // 권장과 동일
  recommendedDwellMs: 60 * 60_000,
  crowdScore: 0,                        // 한산
  mediaVisited: 5,
  mediaCompleted: 5,                    // 완주 100%
};

const EQUAL_WEIGHTS: SatisfactionWeights = {
  crowd: 0.25, dwell: 0.25, wait: 0.25, engagement: 0.25,
};

// ── computeSatisfaction ─────────────────────────────────────

describe('computeSatisfaction', () => {
  it('returns 1.0 for all-best inputs (each component perfect)', () => {
    expect(computeSatisfaction(BEST_INPUTS, EQUAL_WEIGHTS)).toBe(1);
  });

  it('returns 0.0 for all-worst inputs (each component zero)', () => {
    expect(computeSatisfaction(WORST_INPUTS, EQUAL_WEIGHTS)).toBe(0);
  });

  it('returns 0.5 for mixed inputs (half components 0, half 1) under equal weights', () => {
    const mixed: SatisfactionInputs = {
      outsideWaitMs: SATISFACTION_W_MAX_MS, // wait = 1 → (1-wait)*0.25 = 0
      internalWaitMs: 0,
      actualDwellMs: 60 * 60_000,
      recommendedDwellMs: 60 * 60_000,      // dwell = 1 → 0.25
      crowdScore: 1,                        // (1-1)*0.25 = 0
      mediaVisited: 4,
      mediaCompleted: 4,                    // engagement = 1 → 0.25
    };
    expect(computeSatisfaction(mixed, EQUAL_WEIGHTS)).toBeCloseTo(0.5, 5);
  });

  it('clamps result to [0,1] even if components / weights misbehave', () => {
    // 가중치 합 > 1 (invariant 깨진 입력) → 결과는 여전히 ≤ 1
    const bogus: SatisfactionWeights = { crowd: 1, dwell: 1, wait: 1, engagement: 1 };
    expect(computeSatisfaction(BEST_INPUTS, bogus)).toBe(1);
  });

  it('handles zero recommendedDwellMs as dwellAdequacy=1 (no penalty)', () => {
    const noBudget: SatisfactionInputs = {
      ...BEST_INPUTS,
      actualDwellMs: 0,
      recommendedDwellMs: 0,
    };
    // dwell=1, crowd=1, wait=1, engagement=1 → 1.0
    expect(computeSatisfaction(noBudget, EQUAL_WEIGHTS)).toBe(1);
  });

  it('handles zero mediaVisited as engagementCompletion=1 (no penalty)', () => {
    const noMedia: SatisfactionInputs = {
      ...BEST_INPUTS,
      mediaVisited: 0,
      mediaCompleted: 0,
    };
    expect(computeSatisfaction(noMedia, EQUAL_WEIGHTS)).toBe(1);
  });

  it('clamps negative outsideWaitMs to 0 (defensive)', () => {
    const negWait: SatisfactionInputs = { ...BEST_INPUTS, outsideWaitMs: -1000 };
    expect(computeSatisfaction(negWait, EQUAL_WEIGHTS)).toBe(1);
  });

  it('clamps wait > SATISFACTION_W_MAX_MS to score=0 (no extra penalty beyond cap)', () => {
    const veryLongWait: SatisfactionInputs = {
      ...WORST_INPUTS,
      outsideWaitMs: SATISFACTION_W_MAX_MS * 10,
    };
    // wait component = (1 - 1) * 0.25 = 0; same as WORST_INPUTS
    expect(computeSatisfaction(veryLongWait, EQUAL_WEIGHTS))
      .toBe(computeSatisfaction(WORST_INPUTS, EQUAL_WEIGHTS));
  });

  it('clamps actualDwell > recommended to dwellAdequacy=1 (no over-stay bonus)', () => {
    const overStay: SatisfactionInputs = {
      ...BEST_INPUTS,
      actualDwellMs: BEST_INPUTS.recommendedDwellMs * 5,
    };
    expect(computeSatisfaction(overStay, EQUAL_WEIGHTS)).toBe(1);
  });

  it('clamps crowdScore > 1 to 1 (defensive)', () => {
    const overCrowd: SatisfactionInputs = { ...BEST_INPUTS, crowdScore: 5 };
    // crowd contribution: (1-1)*0.25 = 0, others unchanged → 0.75
    expect(computeSatisfaction(overCrowd, EQUAL_WEIGHTS)).toBeCloseTo(0.75, 5);
  });

  it('NaN inputs do not propagate (clamp01 absorbs)', () => {
    const naninputs: SatisfactionInputs = {
      ...BEST_INPUTS,
      crowdScore: NaN,
    };
    // crowd=clamp(NaN)=0 → (1-0)*0.25 = 0.25 같이 더해짐
    expect(computeSatisfaction(naninputs, EQUAL_WEIGHTS)).toBe(1);
  });
});

// ── Per-mode weights effect ─────────────────────────────────

describe('computeSatisfaction with per-mode weights', () => {
  // wait 만 나쁨, 나머지 만점 — wait 가중치가 클수록 점수 하락
  const waitOnlyBad: SatisfactionInputs = {
    ...BEST_INPUTS,
    outsideWaitMs: SATISFACTION_W_MAX_MS, // wait=1
  };

  it('validation tier (wait=0 weight) ignores wait penalty', () => {
    const layoutScore = computeSatisfaction(waitOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.layout_validation);
    // wait 가중 0 → wait 가 망해도 만점 유지
    expect(layoutScore).toBe(1);
  });

  it('controlled_admission (wait=0.4) penalizes wait the most among operations modes', () => {
    const ctrl = computeSatisfaction(waitOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.controlled_admission);
    const free = computeSatisfaction(waitOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.free_admission);
    const fwt = computeSatisfaction(waitOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.free_with_throttle);
    const timed = computeSatisfaction(waitOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.timed_reservation);
    // 가장 큰 wait 가중 → 가장 낮은 점수
    expect(ctrl).toBeLessThanOrEqual(free);
    expect(ctrl).toBeLessThanOrEqual(fwt);
    expect(ctrl).toBeLessThanOrEqual(timed);
  });

  it('free_admission (crowd=0.5) penalizes crowd the most', () => {
    const crowdOnlyBad: SatisfactionInputs = { ...BEST_INPUTS, crowdScore: 1 };
    const free = computeSatisfaction(crowdOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.free_admission);
    const fwt = computeSatisfaction(crowdOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.free_with_throttle);
    const ctrl = computeSatisfaction(crowdOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.controlled_admission);
    expect(free).toBeLessThanOrEqual(fwt);
    expect(free).toBeLessThanOrEqual(ctrl);
  });

  it('media_experience (engagement=0.5) penalizes incomplete engagement most', () => {
    const engagementOnlyBad: SatisfactionInputs = {
      ...BEST_INPUTS,
      mediaVisited: 5,
      mediaCompleted: 0,
    };
    const me = computeSatisfaction(engagementOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.media_experience);
    const layout = computeSatisfaction(engagementOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.layout_validation);
    const free = computeSatisfaction(engagementOnlyBad, SATISFACTION_WEIGHTS_BY_MODE.free_admission);
    expect(me).toBeLessThanOrEqual(layout);
    expect(me).toBeLessThanOrEqual(free);
  });
});

// ── satisfactionLabel ───────────────────────────────────────

describe('satisfactionLabel', () => {
  it('maps 1.0 → excellent', () => {
    expect(satisfactionLabel(1)).toBe('excellent');
  });

  it('maps boundary 0.85 → excellent (inclusive)', () => {
    expect(satisfactionLabel(SATISFACTION_LABEL_THRESHOLDS.excellent)).toBe('excellent');
  });

  it('maps just-below 0.85 → good', () => {
    expect(satisfactionLabel(SATISFACTION_LABEL_THRESHOLDS.excellent - 0.001)).toBe('good');
  });

  it('maps boundary 0.70 → good (inclusive)', () => {
    expect(satisfactionLabel(SATISFACTION_LABEL_THRESHOLDS.good)).toBe('good');
  });

  it('maps just-below 0.70 → fair', () => {
    expect(satisfactionLabel(SATISFACTION_LABEL_THRESHOLDS.good - 0.001)).toBe('fair');
  });

  it('maps boundary 0.50 → fair', () => {
    expect(satisfactionLabel(SATISFACTION_LABEL_THRESHOLDS.fair)).toBe('fair');
  });

  it('maps just-below 0.50 → poor', () => {
    expect(satisfactionLabel(SATISFACTION_LABEL_THRESHOLDS.fair - 0.001)).toBe('poor');
  });

  it('maps boundary 0.30 → poor', () => {
    expect(satisfactionLabel(SATISFACTION_LABEL_THRESHOLDS.poor)).toBe('poor');
  });

  it('maps just-below 0.30 → bad', () => {
    expect(satisfactionLabel(SATISFACTION_LABEL_THRESHOLDS.poor - 0.001)).toBe('bad');
  });

  it('maps 0 → bad', () => {
    expect(satisfactionLabel(0)).toBe('bad');
  });

  it('clamps out-of-range inputs', () => {
    expect(satisfactionLabel(2)).toBe('excellent'); // clamp01(2) = 1
    expect(satisfactionLabel(-1)).toBe('bad');      // clamp01(-1) = 0
    expect(satisfactionLabel(NaN)).toBe('bad');     // clamp01(NaN) = 0
  });
});

// ── aggregateSatisfaction ───────────────────────────────────

describe('aggregateSatisfaction', () => {
  it('returns zero-shaped result for empty input', () => {
    const result = aggregateSatisfaction([]);
    expect(result.avg).toBe(0);
    expect(result.sampleCount).toBe(0);
    expect(result.distribution).toEqual({
      excellent: 0, good: 0, fair: 0, poor: 0, bad: 0,
    });
    expect(result.counts).toEqual({
      excellent: 0, good: 0, fair: 0, poor: 0, bad: 0,
    });
  });

  it('single excellent visitor: avg = score, distribution.excellent = 1', () => {
    const result = aggregateSatisfaction([0.95]);
    expect(result.avg).toBe(0.95);
    expect(result.sampleCount).toBe(1);
    expect(result.counts.excellent).toBe(1);
    expect(result.distribution.excellent).toBe(1);
  });

  it('mixed distribution: avg + counts + ratios sum to 1', () => {
    // 1×excellent (0.9), 1×good (0.75), 1×fair (0.6), 1×poor (0.4), 1×bad (0.1)
    const scores = [0.9, 0.75, 0.6, 0.4, 0.1];
    const result = aggregateSatisfaction(scores);
    expect(result.sampleCount).toBe(5);
    expect(result.avg).toBeCloseTo((0.9 + 0.75 + 0.6 + 0.4 + 0.1) / 5, 5);
    expect(result.counts).toEqual({
      excellent: 1, good: 1, fair: 1, poor: 1, bad: 1,
    });
    // 분포 합 = 1
    const distSum =
      result.distribution.excellent + result.distribution.good +
      result.distribution.fair + result.distribution.poor + result.distribution.bad;
    expect(distSum).toBeCloseTo(1, 5);
    expect(result.distribution.excellent).toBeCloseTo(0.2, 5);
  });

  it('clamps individual scores before bucketing (out-of-range tolerated)', () => {
    const result = aggregateSatisfaction([2, -1, 0.5]); // → 1, 0, 0.5
    expect(result.sampleCount).toBe(3);
    expect(result.avg).toBeCloseTo((1 + 0 + 0.5) / 3, 5);
    expect(result.counts.excellent).toBe(1); // clamp(2)=1
    expect(result.counts.bad).toBe(1);       // clamp(-1)=0 → bad
    expect(result.counts.fair).toBe(1);      // 0.5 → fair
  });
});

// ── deriveSatisfactionInputs (Visitor adapter) ──────────────

const STUB_PROFILE: VisitorProfile = {
  type: 'general',
  engagementLevel: 'explorer',
  maxSpeed: 50,
  mass: 70,
  maxForce: 100,
  fatigueRate: 0.001,
  patience: 0.5,
} as VisitorProfile;

function makeVisitor(overrides: Partial<Visitor>): Visitor {
  // Tests don't exercise most fields — cast to satisfy partial init.
  return {
    id: 'v1' as Visitor['id'],
    profile: STUB_PROFILE,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    fatigue: 0,
    currentAction: 'IDLE',
    currentFloorId: 'f1' as Visitor['currentFloorId'],
    currentZoneId: 'z1' as Visitor['currentZoneId'],
    targetZoneId: null,
    targetFloorId: null,
    targetMediaId: null,
    targetPosition: null,
    visitedZoneIds: [],
    visitedMediaIds: [],
    category: 'solo',
    groupId: undefined,
    isGroupLeader: false,
    steering: {} as Visitor['steering'],
    waitStartedAt: null,
    enteredAt: 0,
    visitBudgetMs: 60 * 60_000,
    zoneEnteredAtMs: 0,
    exitedAt: null,
    isActive: true,
    lastGateTransitTime: 0,
    currentNodeId: null,
    targetNodeId: null,
    pathLog: [],
    spawnEntryNodeId: null,
    ...overrides,
  };
}

describe('deriveSatisfactionInputs', () => {
  it('uses admittedAt when present (correct dwell start)', () => {
    const v = makeVisitor({
      enteredAt: 0,
      admittedAt: 5 * 60_000,
      exitedAt: 65 * 60_000,
      visitBudgetMs: 60 * 60_000,
      visitedMediaIds: ['m1' as Visitor['visitedMediaIds'][number]],
      outsideWaitMs: 5 * 60_000,
    });
    const inputs = deriveSatisfactionInputs(v, 100 * 60_000);
    expect(inputs.actualDwellMs).toBe(60 * 60_000); // 65 - 5
    expect(inputs.outsideWaitMs).toBe(5 * 60_000);
    expect(inputs.recommendedDwellMs).toBe(60 * 60_000);
  });

  it('falls back to enteredAt when admittedAt missing (legacy scenarios)', () => {
    const v = makeVisitor({
      enteredAt: 10 * 60_000,
      exitedAt: 70 * 60_000,
    });
    const inputs = deriveSatisfactionInputs(v, 100 * 60_000);
    expect(inputs.actualDwellMs).toBe(60 * 60_000); // 70 - 10
  });

  it('falls back to now when exitedAt missing (in-flight visitor)', () => {
    const v = makeVisitor({
      enteredAt: 10 * 60_000,
      exitedAt: null,
    });
    const inputs = deriveSatisfactionInputs(v, 30 * 60_000);
    expect(inputs.actualDwellMs).toBe(20 * 60_000); // 30 - 10
  });

  it('clamps negative dwell to 0 (defensive: corrupt timestamps)', () => {
    const v = makeVisitor({
      enteredAt: 50 * 60_000,
      exitedAt: 10 * 60_000, // exit before enter (impossible but defensive)
    });
    const inputs = deriveSatisfactionInputs(v, 100 * 60_000);
    expect(inputs.actualDwellMs).toBe(0);
  });

  it('defaults missing outsideWaitMs / opts to 0', () => {
    const v = makeVisitor({});
    const inputs = deriveSatisfactionInputs(v, 0);
    expect(inputs.outsideWaitMs).toBe(0);
    expect(inputs.internalWaitMs).toBe(0);
    expect(inputs.crowdScore).toBe(0);
  });

  it('defaults mediaCompleted to mediaVisited (whitepaper TODO: minWatchMs tracking)', () => {
    const visitedMediaIds = ['m1', 'm2', 'm3'] as unknown as Visitor['visitedMediaIds'];
    const v = makeVisitor({ visitedMediaIds });
    const inputs = deriveSatisfactionInputs(v, 0);
    expect(inputs.mediaVisited).toBe(3);
    expect(inputs.mediaCompleted).toBe(3); // 완주 가정
  });

  it('uses opts overrides when provided (engine-side tracking ready path)', () => {
    const visitedMediaIds = ['m1', 'm2', 'm3'] as unknown as Visitor['visitedMediaIds'];
    const v = makeVisitor({ visitedMediaIds });
    const inputs = deriveSatisfactionInputs(v, 0, {
      crowdScore: 0.45,
      mediaCompleted: 2,
      internalWaitMs: 90_000,
    });
    expect(inputs.crowdScore).toBe(0.45);
    expect(inputs.mediaCompleted).toBe(2);
    expect(inputs.internalWaitMs).toBe(90_000);
  });

  it('end-to-end: derive → compute matches manual formula (sanity check)', () => {
    const v = makeVisitor({
      enteredAt: 0,
      admittedAt: 0,
      exitedAt: 30 * 60_000,
      visitBudgetMs: 60 * 60_000, // 권장 60분, 실제 30분 → dwell=0.5
      outsideWaitMs: 0,
      visitedMediaIds: ['m1', 'm2'] as unknown as Visitor['visitedMediaIds'],
    });
    const inputs = deriveSatisfactionInputs(v, 30 * 60_000);
    const score = computeSatisfaction(inputs, EQUAL_WEIGHTS);
    // wait=0 → (1-0)*0.25 = 0.25
    // dwell=0.5 → 0.5*0.25 = 0.125
    // crowd=0 → (1-0)*0.25 = 0.25
    // engagement=1 → 1*0.25 = 0.25
    // sum = 0.875
    expect(score).toBeCloseTo(0.875, 5);
  });
});
