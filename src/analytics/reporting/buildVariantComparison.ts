/**
 * buildVariantComparison — Phase 1 UX [F1] (2026-04-26)
 *
 * 검증 tier 모드 (layout/curation/media validation) 의 핵심 use case 는
 * "변형 A/B/C 중 어느게 더 나은가?" 비교. 단일 시나리오 리포트만으로는
 * 답할 수 없음 — 사용자가 branch 로 만든 sibling 변형들을 한 화면에 늘어놓고
 * KPI 별 winner 와 종합 winner 를 보여줘야 _결정_ 이 일어남.
 *
 * 본 함수는 _순수_:
 *   입력: 2-3 개 변형 의 (Scenario + 마지막 KpiSnapshot) 튜플 + 현재 모드
 *   출력: 비교 KPI 4종 (completion / peak / skip / fatigue) + KPI 별 winner
 *         + 모드 가중 종합 winner.
 *
 * 모드별 가중치 (tier 기준):
 *   validation: completion 1.0, peak 0.5, skip 1.0, fatigue 0.5
 *     — 디자인 의도 (활성화/완주) 우선, 혼잡/피로는 부차
 *   operations: completion 1.0, peak 1.0, skip 0.5, fatigue 1.0
 *     — 운영 (혼잡/피로) 우선, 활성화는 부차 (이미 운영 중인 컬렉션 가정)
 *
 * 본문 RecosSection / ExecutiveSection 과 _독립_ — 비교 overlay 로 한 장만 추가.
 * 운영 tier 에서는 sibling 비교 대신 [F2] sweep 도구를 쓰므로 이 섹션 미노출 권장
 * (하지만 데이터는 동일 함수로 생성 가능 — UI 조건부 렌더링은 호출 측 책임).
 */

import type {
  Scenario, ScenarioId, ExperienceMode, ExperienceModeTier, KpiSnapshot,
} from '@/domain';
import { EXPERIENCE_MODE_REGISTRY } from '@/domain';

export type ComparisonMetricKey = 'completion' | 'peak' | 'skip' | 'fatigue';
export type ComparisonTone = 'ok' | 'warn' | 'bad';

export interface ComparisonValueCell {
  readonly scenarioId: ScenarioId;
  /** 정규화된 raw (0-1 또는 무한대). winner 계산용. */
  readonly raw: number;
  /** 사용자에게 보일 표기 ("82%", "1.18×", "—"). */
  readonly display: string;
  readonly tone: ComparisonTone;
}

export interface ComparisonMetric {
  readonly key: ComparisonMetricKey;
  readonly label: string;
  /** true = higher raw 가 좋음 (completion). false = lower raw 가 좋음 (peak/skip/fatigue). */
  readonly higherBetter: boolean;
  readonly values: readonly ComparisonValueCell[];
  /** winner scenarioId (동률/missing 일 때 null). */
  readonly winnerScenarioId: ScenarioId | null;
}

export interface ComparisonVariantRow {
  readonly scenarioId: ScenarioId;
  readonly name: string;
  readonly isCurrent: boolean;
  /** false = 저장은 됐지만 시뮬레이션 결과(KpiSnapshot) 없음. KPI 셀 모두 "—". */
  readonly hasResult: boolean;
}

export interface ReportComparison {
  readonly mode: ExperienceMode;
  readonly tier: ExperienceModeTier;
  readonly variants: readonly ComparisonVariantRow[];
  readonly metrics: readonly ComparisonMetric[];
  /** 단순 다수결: 가장 많은 KPI 에서 1 등을 차지한 변형. */
  readonly overallWinnerScenarioId: ScenarioId | null;
  /** 모드 tier 가중치를 적용한 winner. 보통 사용자가 보는 "추천" 라벨. */
  readonly weightedWinnerScenarioId: ScenarioId | null;
  /**
   * 사용자에게 노출할 메모 (e.g. "변형 B 는 아직 시뮬레이션 미실행").
   * 빈 문자열이면 메모 없음.
   */
  readonly note: string;
}

export interface ComparisonInputVariant {
  readonly scenario: Scenario;
  /** 변형의 마지막 KpiSnapshot. null 이면 미실행. */
  readonly kpiSnapshot: KpiSnapshot | null;
  /** totalSpawned 카운터 — completion 산정용. KpiSnapshot 에 없는 경우 fallback. */
  readonly totalSpawned?: number;
  readonly isCurrent: boolean;
}

export interface ComparisonInputs {
  readonly variants: readonly ComparisonInputVariant[]; // 2-3 권장
  readonly mode: ExperienceMode;
  readonly t: (k: string, params?: Record<string, string | number>) => string;
}

const TIER_WEIGHTS: Record<ExperienceModeTier, Record<ComparisonMetricKey, number>> = {
  validation: { completion: 1.0, peak: 0.5, skip: 1.0, fatigue: 0.5 },
  operations: { completion: 1.0, peak: 1.0, skip: 0.5, fatigue: 1.0 },
};

function pickPeakUtilRatio(snap: KpiSnapshot): number {
  // zoneUtilizations 의 최댓값 (peak occupancy 비율).
  // peakOccupancy/capacity 가 더 정확하지만 capacity 0 가드 필요.
  let max = 0;
  for (const z of snap.zoneUtilizations) {
    const r = z.capacity > 0 ? z.peakOccupancy / z.capacity : z.ratio;
    if (r > max) max = r;
  }
  return max;
}

function toneCompletion(r: number): ComparisonTone {
  return r >= 0.6 ? 'ok' : r >= 0.4 ? 'warn' : 'bad';
}
function tonePeak(r: number): ComparisonTone {
  return r <= 1.0 ? 'ok' : r <= 1.2 ? 'warn' : 'bad';
}
function toneSkip(r: number): ComparisonTone {
  return r <= 0.3 ? 'ok' : r <= 0.5 ? 'warn' : 'bad';
}
function toneFatigue(r: number): ComparisonTone {
  return r <= 0.5 ? 'ok' : r <= 0.7 ? 'warn' : 'bad';
}

function computeWinner(metric: Pick<ComparisonMetric, 'values' | 'higherBetter'>): ScenarioId | null {
  // 결과 없는(NaN) 셀은 제외. 동률은 null.
  const valid = metric.values.filter((v) => Number.isFinite(v.raw));
  if (valid.length < 2) return null;
  const ranked = [...valid].sort((a, b) =>
    metric.higherBetter ? b.raw - a.raw : a.raw - b.raw,
  );
  const top = ranked[0];
  const second = ranked[1];
  if (Math.abs(top.raw - second.raw) < 1e-6) return null;
  return top.scenarioId;
}

export function buildVariantComparison(input: ComparisonInputs): ReportComparison | null {
  const { variants, mode, t } = input;
  if (variants.length < 2) return null;

  const tier = EXPERIENCE_MODE_REGISTRY[mode].tier;

  // ── Variant rows ────────────────────────────────────────────
  const rows: ComparisonVariantRow[] = variants.map((v) => ({
    scenarioId: v.scenario.meta.id,
    name: v.scenario.meta.name,
    isCurrent: v.isCurrent,
    hasResult: v.kpiSnapshot != null,
  }));

  // ── Per-variant metrics 추출 ───────────────────────────────
  const perVariant = variants.map((v) => {
    const snap = v.kpiSnapshot;
    if (!snap) {
      return {
        scenarioId: v.scenario.meta.id,
        completion: NaN,
        peak: NaN,
        skip: NaN,
        fatigue: NaN,
      };
    }
    const completion = snap.flowEfficiency.completionRate;
    const peak = pickPeakUtilRatio(snap);
    const skip = snap.skipRate.globalSkipRate;
    const fatigue = snap.fatigueDistribution.p90;
    return {
      scenarioId: v.scenario.meta.id,
      completion,
      peak,
      skip,
      fatigue,
    };
  });

  const cellFor = (
    key: ComparisonMetricKey,
    higherBetter: boolean,
  ): ComparisonMetric => {
    const values: ComparisonValueCell[] = perVariant.map((m) => {
      const raw = m[key];
      if (!Number.isFinite(raw)) {
        return { scenarioId: m.scenarioId, raw: NaN, display: '—', tone: 'warn' as ComparisonTone };
      }
      let display: string;
      let tone: ComparisonTone;
      if (key === 'peak') {
        display = `${(raw * 100).toFixed(0)}%`;
        tone = tonePeak(raw);
      } else if (key === 'fatigue') {
        display = `${(raw * 100).toFixed(0)}%`;
        tone = toneFatigue(raw);
      } else if (key === 'skip') {
        display = `${(raw * 100).toFixed(0)}%`;
        tone = toneSkip(raw);
      } else {
        // completion
        display = `${(raw * 100).toFixed(0)}%`;
        tone = toneCompletion(raw);
      }
      return { scenarioId: m.scenarioId, raw, display, tone };
    });
    const metric = {
      key,
      label: t(`vela.compare.metric.${key}`),
      higherBetter,
      values,
      winnerScenarioId: null as ScenarioId | null,
    };
    metric.winnerScenarioId = computeWinner(metric);
    return metric;
  };

  const metrics: ComparisonMetric[] = [
    cellFor('completion', true),
    cellFor('peak', false),
    cellFor('skip', false),
    cellFor('fatigue', false),
  ];

  // ── Overall winner (단순 다수결) ───────────────────────────
  const wins = new Map<string, number>();
  for (const m of metrics) {
    if (m.winnerScenarioId) {
      wins.set(m.winnerScenarioId as string, (wins.get(m.winnerScenarioId as string) ?? 0) + 1);
    }
  }
  let overallWinnerScenarioId: ScenarioId | null = null;
  let topCount = 0;
  let tied = false;
  for (const [id, count] of wins) {
    if (count > topCount) {
      topCount = count;
      overallWinnerScenarioId = id as ScenarioId;
      tied = false;
    } else if (count === topCount) {
      tied = true;
    }
  }
  if (tied || topCount === 0) overallWinnerScenarioId = null;

  // ── Weighted winner (모드 tier 가중치) ──────────────────────
  const weights = TIER_WEIGHTS[tier];
  const weightedScores = new Map<string, number>();
  for (const m of metrics) {
    const w = weights[m.key];
    // 정규화: higherBetter 면 raw 그대로, 아니면 (1 - raw) clipped.
    for (const v of m.values) {
      if (!Number.isFinite(v.raw)) continue;
      const norm = m.higherBetter ? Math.max(0, Math.min(1, v.raw))
                                  : Math.max(0, 1 - Math.min(1, v.raw));
      weightedScores.set(
        v.scenarioId as string,
        (weightedScores.get(v.scenarioId as string) ?? 0) + norm * w,
      );
    }
  }
  let weightedWinnerScenarioId: ScenarioId | null = null;
  let topScore = -Infinity;
  let weightedTied = false;
  for (const [id, score] of weightedScores) {
    if (score > topScore + 1e-6) {
      topScore = score;
      weightedWinnerScenarioId = id as ScenarioId;
      weightedTied = false;
    } else if (Math.abs(score - topScore) < 1e-6) {
      weightedTied = true;
    }
  }
  if (weightedTied || topScore === -Infinity) weightedWinnerScenarioId = null;

  // ── Note (미실행 변형 안내) ─────────────────────────────────
  const unrunCount = rows.filter((r) => !r.hasResult).length;
  const note = unrunCount > 0
    ? t('vela.compare.note.unrun', { count: unrunCount })
    : '';

  return {
    mode,
    tier,
    variants: rows,
    metrics,
    overallWinnerScenarioId,
    weightedWinnerScenarioId,
    note,
  };
}
