/**
 * SweepRunner.test — Phase 1 UX [F2] (2026-04-26)
 *
 * `runSweep` 자체는 SimulationEngine 인스턴스를 N 번 돌리는 통합 동작이라
 * unit test 단계에선 너무 무겁다 (전체 Scenario fixture 필요). 그건 [G] 단계
 * 통합 테스트로 미루고, 본 파일은 _순수_ helper 만 검증한다.
 *
 * 핵심 helper: `pickRecommendation`
 *   - 만족도 최댓값을 추천
 *   - 동률 시: 작은 paramValue 우선 (capex 절감)
 *   - 모든 row 가 sample=0 이면 'no-data'
 *   - 동률이 1e-3 미만 차이라야 진짜 동률 (그보다 크면 winner)
 */

import { describe, it, expect } from 'vitest';
import { pickRecommendation, type SweepResultRow } from './SweepRunner';

function row(paramValue: number, satisfactionAvg: number, sampleCount = 100): SweepResultRow {
  return {
    paramValue,
    paramLabel: `cap=${paramValue}`,
    completionRate: 0.5,
    globalSkipRate: 0.3,
    peakUtilRatio: 1.0,
    p90Fatigue: 0.5,
    avgQueueWaitMs: 0,
    recentAdmitAvgWaitMs: 0,
    totalArrived: 100,
    totalAdmitted: 90,
    totalAbandoned: 10,
    abandonmentRate: 0.1,
    satisfactionAvg,
    satisfactionLabel: 'fair',
    visitorSampleCount: sampleCount,
  };
}

describe('pickRecommendation', () => {
  it('returns no-data for empty rows', () => {
    const r = pickRecommendation([]);
    expect(r.value).toBeNull();
    expect(r.key).toBe('no-data');
  });

  it('returns no-data when all rows have zero samples', () => {
    const rows = [row(10, 0.7, 0), row(20, 0.8, 0)];
    const r = pickRecommendation(rows);
    expect(r.value).toBeNull();
    expect(r.key).toBe('no-data');
  });

  it('returns no-data when all rows have NaN satisfactionAvg', () => {
    const rows = [row(10, NaN), row(20, NaN)];
    const r = pickRecommendation(rows);
    expect(r.key).toBe('no-data');
  });

  it('picks the row with highest satisfactionAvg', () => {
    const rows = [row(10, 0.5), row(20, 0.7), row(30, 0.6)];
    const r = pickRecommendation(rows);
    expect(r.value).toBe(20);
    expect(r.key).toBe('best-satisfaction');
  });

  it('on tie within 1e-3, picks the smaller paramValue (capex tiebreak)', () => {
    const rows = [row(10, 0.7), row(20, 0.7005), row(30, 0.6995)];
    // 0.7, 0.7005, 0.6995 — pairwise differences < 1e-3, so all tied for best
    // tiebreak: smallest cap, so 10
    const r = pickRecommendation(rows);
    expect(r.value).toBe(10);
    expect(r.key).toBe('tied');
  });

  it('clear winner above 1e-3 threshold is best-satisfaction (not tied)', () => {
    const rows = [row(10, 0.65), row(20, 0.7), row(30, 0.69)];
    // 0.7 vs 0.69 differ by 0.01 (> 1e-3), and 0.7 vs 0.65 differ by 0.05 — clear winner
    const r = pickRecommendation(rows);
    expect(r.value).toBe(20);
    expect(r.key).toBe('best-satisfaction');
  });

  it('skips rows with sampleCount=0 even when others are valid', () => {
    const rows = [row(10, 0.9, 0), row(20, 0.6), row(30, 0.5)];
    // row(10) has sample 0 → excluded; winner among remaining: 20
    const r = pickRecommendation(rows);
    expect(r.value).toBe(20);
    expect(r.key).toBe('best-satisfaction');
  });

  it('handles a single valid row', () => {
    const rows = [row(10, 0.5, 0), row(20, 0.7), row(30, 0.6, 0)];
    const r = pickRecommendation(rows);
    expect(r.value).toBe(20);
    expect(r.key).toBe('best-satisfaction');
  });

  it('larger cap wins outright if satisfaction higher than smaller', () => {
    const rows = [row(50, 0.5), row(100, 0.6), row(150, 0.55)];
    const r = pickRecommendation(rows);
    expect(r.value).toBe(100);
    expect(r.key).toBe('best-satisfaction');
  });

  it('strict ordering: top wins even when tied with second-best', () => {
    // 0.8 > 0.7 (clear winner), 0.7 vs 0.7 (tied second/third)
    const rows = [row(10, 0.8), row(20, 0.7), row(30, 0.7)];
    const r = pickRecommendation(rows);
    expect(r.value).toBe(10);
    expect(r.key).toBe('best-satisfaction');
  });

  it('two-way exact tie picks smaller cap', () => {
    const rows = [row(15, 0.75), row(25, 0.75)];
    const r = pickRecommendation(rows);
    expect(r.value).toBe(15);
    expect(r.key).toBe('tied');
  });

  it('two-way exact tie respects insertion order via tiebreak rule, not by row order', () => {
    // Larger cap first, smaller cap second — should still pick smaller (15)
    const rows = [row(25, 0.75), row(15, 0.75)];
    const r = pickRecommendation(rows);
    expect(r.value).toBe(15);
    expect(r.key).toBe('tied');
  });

  it('handles all-zero satisfaction (still returns smallest cap as tied)', () => {
    const rows = [row(10, 0), row(20, 0), row(30, 0)];
    const r = pickRecommendation(rows);
    expect(r.value).toBe(10);
    expect(r.key).toBe('tied');
  });
});
