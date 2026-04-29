/**
 * buildPolicyComparison — Phase 1 UX (2026-04-26)
 *
 * 정책 A/B/C 슬롯의 KpiSnapshot 들을 비교해 KPI 별 winner 와 종합 winner 를 계산.
 * buildVariantComparison 과 다른 점:
 *   - 같은 시나리오 + 정책만 다름 (cap 값 차이)
 *   - 슬롯 ID (A/B/C) 가 식별자 (variant scenarioId 아님)
 *   - 비교 KPI 5종: satisfaction / completion / peak / abandon / wait
 *
 * 추천 로직 (recommendNextCaps): A 결과의 신호 (포기/피크) 보고 B/C cap 값 제안.
 */

import type { KpiSnapshot } from '@/domain';
import type { PolicySlot, PolicySlotId } from '@/stores';

export type PolicyMetricKey = 'satisfaction' | 'completion' | 'peak' | 'abandon' | 'wait';
export type PolicyTone = 'ok' | 'warn' | 'bad';

export interface PolicyValueCell {
  readonly slotId: PolicySlotId;
  /** 정규화 raw — winner 계산용. NaN = 결과 없음. */
  readonly raw: number;
  readonly display: string;
  readonly tone: PolicyTone;
}

export interface PolicyMetric {
  readonly key: PolicyMetricKey;
  readonly higherBetter: boolean;
  readonly values: readonly PolicyValueCell[];
  readonly winnerSlotId: PolicySlotId | null;
}

export interface PolicyComparisonRow {
  readonly slotId: PolicySlotId;
  readonly capValue: number | null;
  readonly hasResult: boolean;
}

export interface PolicyComparison {
  readonly slots: readonly PolicyComparisonRow[];
  readonly metrics: readonly PolicyMetric[];
  readonly overallWinnerSlotId: PolicySlotId | null;
}

function pickPeakUtilRatio(snap: KpiSnapshot): number {
  let max = 0;
  for (const z of snap.zoneUtilizations) {
    const r = z.capacity > 0 ? z.peakOccupancy / z.capacity : z.ratio;
    if (r > max) max = r;
  }
  return max;
}

function abandonmentRateFromSnapshot(snap: KpiSnapshot, totalSpawned: number, totalExited: number): number {
  // KpiSnapshot 자체엔 entryQueue 정보가 없음 — totalSpawned 가 actually admitted, 외부 큐 abandoned
  // 는 여기까지 안 흘러와서 0 으로 fallback. (slot 캡처 시 totalSpawned/totalExited 만 저장.)
  // 실 abandonment 는 SimEngine.getEntryQueueSnapshot 으로만 얻을 수 있는데, 슬롯 캡처 시점에
  // 엔진이 살아있어야 호출 가능. 추후 확장 여지.
  if (totalSpawned <= 0) return 0;
  // exited - spawned 의 비율은 abandon 이 아니라 단순 진행률. 일단 0 fallback.
  return 0;
}

function avgWaitMsFromSnapshot(_snap: KpiSnapshot): number {
  // KpiSnapshot 에 외부 큐 평균 대기 정보 없음 — 0 fallback. (큐 KPI 는 EntryQueueState 에만 있음.)
  return 0;
}

function tone(key: PolicyMetricKey, raw: number): PolicyTone {
  if (!Number.isFinite(raw)) return 'warn';
  switch (key) {
    case 'satisfaction':
      return raw >= 0.7 ? 'ok' : raw >= 0.5 ? 'warn' : 'bad';
    case 'completion':
      return raw >= 0.7 ? 'ok' : raw >= 0.4 ? 'warn' : 'bad';
    case 'peak':
      return raw <= 1.0 ? 'ok' : raw <= 1.2 ? 'warn' : 'bad';
    case 'abandon':
      return raw <= 0.05 ? 'ok' : raw <= 0.15 ? 'warn' : 'bad';
    case 'wait':
      return raw <= 5 * 60_000 ? 'ok' : raw <= 15 * 60_000 ? 'warn' : 'bad';
  }
}

function display(key: PolicyMetricKey, raw: number): string {
  if (!Number.isFinite(raw)) return '—';
  switch (key) {
    case 'satisfaction':
    case 'completion':
    case 'peak':
    case 'abandon':
      return `${(raw * 100).toFixed(0)}%`;
    case 'wait':
      return `${Math.round(raw / 60_000)}m`;
  }
}

function computeWinner(metric: { values: readonly PolicyValueCell[]; higherBetter: boolean }): PolicySlotId | null {
  const valid = metric.values.filter((v) => Number.isFinite(v.raw));
  if (valid.length < 2) return null;
  const sorted = [...valid].sort((a, b) => (metric.higherBetter ? b.raw - a.raw : a.raw - b.raw));
  if (Math.abs(sorted[0].raw - sorted[1].raw) < 1e-6) return null;
  return sorted[0].slotId;
}

export function buildPolicyComparison(
  slots: { A: PolicySlot; B: PolicySlot; C: PolicySlot },
): PolicyComparison {
  const order: PolicySlotId[] = ['A', 'B', 'C'];

  const rows: PolicyComparisonRow[] = order.map((id) => ({
    slotId: id,
    capValue: slots[id].capValue,
    hasResult: slots[id].status === 'captured' && slots[id].snapshot != null,
  }));

  const perSlot = order.map((id) => {
    const slot = slots[id];
    if (slot.snapshot == null) {
      return {
        slotId: id, satisfaction: NaN, completion: NaN, peak: NaN, abandon: NaN, wait: NaN,
      };
    }
    return {
      slotId: id,
      // satisfaction 은 snapshot 에 직접 없음 — completion 을 proxy 로 사용 (추후 satisfaction calculator 직접 호출 확장 가능)
      satisfaction: slot.snapshot.flowEfficiency.completionRate,
      completion: slot.snapshot.flowEfficiency.completionRate,
      peak: pickPeakUtilRatio(slot.snapshot),
      abandon: abandonmentRateFromSnapshot(slot.snapshot, slot.totalSpawned ?? 0, slot.totalExited ?? 0),
      wait: avgWaitMsFromSnapshot(slot.snapshot),
    };
  });

  const buildMetric = (key: PolicyMetricKey, higherBetter: boolean): PolicyMetric => {
    const values: PolicyValueCell[] = perSlot.map((m) => {
      const raw = m[key];
      return {
        slotId: m.slotId,
        raw,
        display: display(key, raw),
        tone: tone(key, raw),
      };
    });
    return {
      key,
      higherBetter,
      values,
      winnerSlotId: computeWinner({ values, higherBetter }),
    };
  };

  const metrics: PolicyMetric[] = [
    buildMetric('satisfaction', true),
    buildMetric('completion', true),
    buildMetric('peak', false),
    buildMetric('abandon', false),
    buildMetric('wait', false),
  ];

  const wins = new Map<PolicySlotId, number>();
  for (const m of metrics) {
    if (m.winnerSlotId) wins.set(m.winnerSlotId, (wins.get(m.winnerSlotId) ?? 0) + 1);
  }
  let overallWinnerSlotId: PolicySlotId | null = null;
  let topCount = 0;
  let tied = false;
  for (const [id, count] of wins) {
    if (count > topCount) { topCount = count; overallWinnerSlotId = id; tied = false; }
    else if (count === topCount) tied = true;
  }
  if (tied || topCount === 0) overallWinnerSlotId = null;

  return { slots: rows, metrics, overallWinnerSlotId };
}
