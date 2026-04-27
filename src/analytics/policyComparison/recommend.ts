/**
 * Policy A/B/C 점진 모드 추천 — A 결과의 신호 (포기/피크) 보고 B/C cap 제안.
 *
 * 규칙 (우선순위):
 *   1. 포기율 > 5%   → cap 부족. B = +30%, C = +15%.
 *   2. 피크 < 70% AND 포기율 < 1%  → cap 여유. B = -30%, C = -15%.
 *   3. 만족도 < 60%  → 양쪽 탐색. B = +25%, C = -25%.
 *   4. 그 외 (균형점 근처)  → 브래킷. B = +15%, C = -15%.
 *
 * 모든 추천값은 floor=10, 10단위 반올림.
 */

import type { KpiSnapshot } from '@/domain';
import type { PolicySlot, PolicySlotId } from '@/stores';
import type { PolicyRecommendation } from '@/stores';

const ROUND_TO = 10;
const MIN_CAP = 10;
const MAX_CAP = 10_000;

function roundCap(v: number): number {
  return Math.max(MIN_CAP, Math.min(MAX_CAP, Math.round(v / ROUND_TO) * ROUND_TO));
}

function pickPeakUtilRatio(snap: KpiSnapshot): number {
  let max = 0;
  for (const z of snap.zoneUtilizations) {
    const r = z.capacity > 0 ? z.peakOccupancy / z.capacity : z.ratio;
    if (r > max) max = r;
  }
  return max;
}

export interface RecommendInput {
  readonly basedOnSlot: PolicySlot;
  /** 외부 큐에서 측정된 포기율 (0-1). 슬롯 캡처 시점에 SimulationControls 가 별도로 넣어줘야 함. */
  readonly abandonmentRate?: number;
}

export function recommendNextCaps(input: RecommendInput): PolicyRecommendation | null {
  const { basedOnSlot, abandonmentRate = 0 } = input;
  if (basedOnSlot.snapshot == null || basedOnSlot.capValue == null) return null;

  const cap = basedOnSlot.capValue;
  const peak = pickPeakUtilRatio(basedOnSlot.snapshot);
  const completion = basedOnSlot.snapshot.flowEfficiency.completionRate;

  let suggestedB: number;
  let suggestedC: number;
  let reasonKey: string;
  const reasonParams: Record<string, string | number> = {};

  if (abandonmentRate > 0.05) {
    suggestedB = roundCap(cap * 1.30);
    suggestedC = roundCap(cap * 1.15);
    reasonKey = 'policyCompare.recommendation.tooManyAbandons';
    reasonParams.rate = Math.round(abandonmentRate * 100);
  } else if (peak < 0.70 && abandonmentRate < 0.01) {
    suggestedB = roundCap(cap * 0.70);
    suggestedC = roundCap(cap * 0.85);
    reasonKey = 'policyCompare.recommendation.lowPeak';
    reasonParams.peak = Math.round(peak * 100);
  } else if (completion < 0.60) {
    suggestedB = roundCap(cap * 1.25);
    suggestedC = roundCap(cap * 0.75);
    reasonKey = 'policyCompare.recommendation.lowSatisfaction';
    reasonParams.sat = Math.round(completion * 100);
  } else {
    suggestedB = roundCap(cap * 1.15);
    suggestedC = roundCap(cap * 0.85);
    reasonKey = 'policyCompare.recommendation.bracket';
  }

  // B/C 가 같거나 cap 과 같으면 한 단계 조정 — 무의미한 추천 방지.
  if (suggestedB === cap) suggestedB = roundCap(cap + ROUND_TO);
  if (suggestedC === cap) suggestedC = roundCap(cap - ROUND_TO);
  if (suggestedB === suggestedC) suggestedC = roundCap(suggestedC - ROUND_TO);

  // reasonKey 에 reasonParams 를 인코딩해 i18n 호출 시점에 풀어쓸 수 있도록 묶음.
  // 단순하게 query string 형태로 (e.g. "policyCompare.recommendation.tooManyAbandons?rate=12")
  const reasonEncoded = Object.keys(reasonParams).length > 0
    ? `${reasonKey}?${new URLSearchParams(
        Object.fromEntries(Object.entries(reasonParams).map(([k, v]) => [k, String(v)])),
      ).toString()}`
    : reasonKey;

  return {
    basedOnSlotId: basedOnSlot.id as PolicySlotId,
    suggestedB,
    suggestedC,
    reasonKey: reasonEncoded,
  };
}

/** UI 에서 reasonKey 디코딩해 i18n params 분리. */
export function decodeReason(reasonKey: string): { key: string; params: Record<string, string> } {
  const idx = reasonKey.indexOf('?');
  if (idx < 0) return { key: reasonKey, params: {} };
  const key = reasonKey.slice(0, idx);
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(reasonKey.slice(idx + 1))) {
    params[k] = v;
  }
  return { key, params };
}
