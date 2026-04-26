/**
 * SweepRunner — Phase 1 UX [F2] (2026-04-26)
 *
 * 운영 tier 모드의 핵심 use case 두번째: "cap 을 얼마로 설정해야 하나?"
 *   사용자가 직관으로 답할 수 없는 영역. cap=20 vs 30 vs 40 의 결과를 직접
 *   비교해주는 sweep 도구가 _운영 권장_ 의 백본이 된다.
 *
 * 본 모듈은 _순수_ headless 런처:
 *   - 입력: baseScenario + parameter spec (key + values)
 *   - 출력: SweepResult { rows, recommendedValue, ... }
 *
 * 한 sweep 은 N 개 SimulationEngine 인스턴스를 _순차_ 로 실행 (병렬 X — 모든
 *   에이전트 1000+ 가 동시 동작하면 메모리/CPU 폭발). UI 비차단을 위해 매 batch
 *   마다 setTimeout(0) yield + 진척 콜백 호출.
 *
 * 결과 해석:
 *   - satisfactionAvg: 1차 정렬 키. 모든 변형 중 최고가 추천.
 *   - tiebreak: 만족도 동률 시 _작은 cap_ 우선 (capex 절감).
 *   - 모든 변형의 satisfactionAvg 가 0 이거나 NaN 이면 추천 없음.
 *
 * 비고: 만족도 계산은 deriveSatisfactionInputs + computeSatisfaction 의 동일
 *   로직 사용. SatisfactionWeights 미지정 시 시나리오의 operations 또는 default.
 */

import type {
  Scenario, ScenarioId, SimulationConfig, EntryPolicy, OperationsConfig, SatisfactionWeights,
  WaypointGraph, KpiSnapshot, FloorConfig, ZoneConfig, MediaPlacement, ElevatorShaft,
} from '@/domain';
import {
  SIMULATION_PHASE,
  DEFAULT_OPERATIONS_CONFIG,
} from '@/domain';
import { SimulationEngine, type SimulationWorld } from '@/simulation/engine/SimEngine';
import { assembleKpiSnapshot } from '@/analytics/aggregator';
import {
  computeSatisfaction,
  deriveSatisfactionInputs,
  aggregateSatisfaction,
  satisfactionLabel,
  type SatisfactionLabel,
} from '@/analytics/calculators/satisfaction';

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────

export type SweepParameterKey = 'maxConcurrent' | 'perSlotCap' | 'maxPerHour';

export interface SweepParameter {
  /** EntryPolicy 의 어느 필드를 sweep 할지. */
  readonly key: SweepParameterKey;
  /** 시도할 값 (오름차순 권장 — 추천 tiebreak 가 작은 값 우선이라 결과 가독성 ↑). */
  readonly values: readonly number[];
}

export interface SweepRunInput {
  readonly baseScenario: Scenario;
  readonly waypointGraph?: WaypointGraph;
  readonly parameter: SweepParameter;
  /** 기본: scenario.simulationConfig.duration. UI 빠른 미리보기엔 짧게. */
  readonly durationMsOverride?: number;
  /** 기본: scenario.simulationConfig.operations.satisfactionWeights ?? DEFAULT. */
  readonly satisfactionWeights?: SatisfactionWeights;
  readonly onProgress?: (progress: SweepProgress) => void;
  readonly signal?: AbortSignal;
}

export type SweepPhase = 'starting' | 'running' | 'finalizing' | 'done';

export interface SweepProgress {
  readonly index: number;        // 0-based 현재 변형 인덱스
  readonly total: number;        // values.length
  readonly currentValue: number;
  readonly currentLabel: string; // e.g. "maxConcurrent=30"
  readonly phase: SweepPhase;
  /** 현재 변형 내 sim elapsed (ms). running 단계에서만 의미. */
  readonly simElapsedMs: number;
  readonly simDurationMs: number;
}

export interface SweepResultRow {
  readonly paramValue: number;
  readonly paramLabel: string;
  // KPIs (KpiSnapshot 기반)
  readonly completionRate: number;
  readonly globalSkipRate: number;
  /** 최대 zone peak occupancy / capacity (1.0 = 안전 한계). */
  readonly peakUtilRatio: number;
  readonly p90Fatigue: number;
  // Entry queue
  readonly avgQueueWaitMs: number;
  readonly recentAdmitAvgWaitMs: number;
  readonly totalArrived: number;
  readonly totalAdmitted: number;
  readonly totalAbandoned: number;
  readonly abandonmentRate: number;
  // Satisfaction
  readonly satisfactionAvg: number;
  readonly satisfactionLabel: SatisfactionLabel;
  // Counts
  readonly visitorSampleCount: number;
}

export type SweepRecommendationKey = 'best-satisfaction' | 'tied' | 'no-data' | 'aborted';

export interface SweepResult {
  readonly parameter: SweepParameter;
  readonly rows: readonly SweepResultRow[];
  readonly recommendedValue: number | null;
  readonly recommendationKey: SweepRecommendationKey;
  /** 시작 → 종료 wall-clock (ms). UI "took 12.4s" 표기용. */
  readonly elapsedWallMs: number;
  /** 중단 여부. signal 발동 시 true, 이미 계산된 rows 만 반환. */
  readonly aborted: boolean;
  readonly baseScenarioId: ScenarioId;
  readonly baseScenarioName: string;
}

// ─────────────────────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────────────────────

/** parameter key 와 값으로 EntryPolicy 변형. 다른 모드 필드는 보존. */
function applyParamToPolicy(
  base: EntryPolicy,
  key: SweepParameterKey,
  value: number,
): EntryPolicy {
  return { ...base, [key]: value };
}

function buildScenarioVariant(
  base: Scenario,
  paramKey: SweepParameterKey,
  paramValue: number,
): Scenario {
  const baseOps: OperationsConfig = base.simulationConfig.operations ?? DEFAULT_OPERATIONS_CONFIG;
  const newPolicy = applyParamToPolicy(baseOps.entryPolicy, paramKey, paramValue);
  const newOps: OperationsConfig = { ...baseOps, entryPolicy: newPolicy };
  const newConfig: SimulationConfig = { ...base.simulationConfig, operations: newOps };
  return { ...base, simulationConfig: newConfig };
}

function buildWorld(
  scenario: Scenario,
  waypointGraph: WaypointGraph | undefined,
  floors: readonly FloorConfig[],
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  shafts: readonly ElevatorShaft[] | undefined,
): SimulationWorld {
  return {
    floors,
    zones,
    media,
    config: scenario.simulationConfig,
    globalFlowMode: scenario.globalFlowMode ?? 'free',
    guidedUntilIndex: scenario.guidedUntilIndex ?? 0,
    waypointGraph,
    shafts,
    totalVisitors: scenario.visitorDistribution.totalCount,
  };
}

function pickPeakUtilRatio(snap: KpiSnapshot): number {
  let max = 0;
  for (const z of snap.zoneUtilizations) {
    const r = z.capacity > 0 ? z.peakOccupancy / z.capacity : z.ratio;
    if (r > max) max = r;
  }
  return max;
}

/**
 * 실행 후 visitor 들에서 만족도 점수 추출.
 * exitedAt 이 있는 visitor 만 (완주자) 집계 — admittedAt 이 있어도 강제 종료된
 * dangling 은 dwell/wait 가 부정확하므로 제외.
 */
function collectSatisfactionScores(
  visitors: readonly { admittedAt?: number; enteredAt: number; exitedAt?: number }[],
  weights: SatisfactionWeights,
  nowMs: number,
): number[] {
  const scores: number[] = [];
  for (const v of visitors) {
    if (v.exitedAt == null) continue;
    const inputs = deriveSatisfactionInputs(v as Parameters<typeof deriveSatisfactionInputs>[0], nowMs);
    const s = computeSatisfaction(inputs, weights);
    scores.push(s);
  }
  return scores;
}

/**
 * 추천 값 결정. tiebreak: 작은 paramValue 우선 (capex).
 *
 * Exported for testing. 외부 소비자가 직접 rows 만 가지고 추천을 재계산하고 싶을 때
 * (e.g., 사용자가 가중치 변경 후 즉시 재정렬) 도 사용 가능.
 */
export function pickRecommendation(rows: readonly SweepResultRow[]): { value: number | null; key: SweepRecommendationKey } {
  if (rows.length === 0) return { value: null, key: 'no-data' };
  const valid = rows.filter((r) => r.visitorSampleCount > 0 && Number.isFinite(r.satisfactionAvg));
  if (valid.length === 0) return { value: null, key: 'no-data' };

  // Pass 1: highest satisfactionAvg.
  let topScore = -Infinity;
  for (const r of valid) {
    if (r.satisfactionAvg > topScore) topScore = r.satisfactionAvg;
  }
  // Pass 2: 모든 row 가 top 의 1e-3 이내면 동률로 간주.
  const TIE_THRESHOLD = 1e-3;
  const winners = valid.filter((r) => Math.abs(r.satisfactionAvg - topScore) < TIE_THRESHOLD);
  // tiebreak: 작은 paramValue 우선 (capex 절감).
  let best = winners[0];
  for (const r of winners) {
    if (r.paramValue < best.paramValue) best = r;
  }
  return {
    value: best.paramValue,
    // 'tied' 는 _점수 동률_ 의미. capex tiebreak 가 적용된 결과여도 사용자에게는
    // "두 변형이 사실상 동등하니 작은 쪽을 추천" 으로 알려줘야 결정 신뢰가 산다.
    key: winners.length > 1 ? 'tied' : 'best-satisfaction',
  };
}

// ─────────────────────────────────────────────────────────────
//  Public — runSweep
// ─────────────────────────────────────────────────────────────

/** 한 batch 에서 처리할 sim tick 수. 너무 크면 UI freeze, 작으면 setTimeout 오버헤드. */
const TICKS_PER_BATCH = 600; // dt ≈ 16.67ms 기준 약 10 sim 초

export async function runSweep(input: SweepRunInput): Promise<SweepResult> {
  const t0 = performance.now();
  const {
    baseScenario, waypointGraph, parameter,
    durationMsOverride, satisfactionWeights, onProgress, signal,
  } = input;

  const baseDuration = baseScenario.simulationConfig.duration;
  const simDurationMs = durationMsOverride ?? baseDuration;
  const dt = baseScenario.simulationConfig.fixedDeltaTime;

  const weights = satisfactionWeights
    ?? baseScenario.simulationConfig.operations?.satisfactionWeights
    ?? DEFAULT_OPERATIONS_CONFIG.satisfactionWeights;

  const rows: SweepResultRow[] = [];
  let aborted = false;

  const total = parameter.values.length;
  for (let i = 0; i < total; i++) {
    const paramValue = parameter.values[i];
    const paramLabel = `${parameter.key}=${paramValue}`;

    if (signal?.aborted) { aborted = true; break; }

    onProgress?.({
      index: i, total, currentValue: paramValue, currentLabel: paramLabel,
      phase: 'starting', simElapsedMs: 0, simDurationMs,
    });
    await yieldToEventLoop();

    // ── 변형 시나리오 빌드 ─────────────────────────────────
    const variant = buildScenarioVariant(baseScenario, parameter.key, paramValue);
    // duration override 적용
    const variantWithDur: Scenario = durationMsOverride != null
      ? { ...variant, simulationConfig: { ...variant.simulationConfig, duration: simDurationMs } }
      : variant;

    const world = buildWorld(
      variantWithDur,
      waypointGraph,
      variantWithDur.floors,
      variantWithDur.zones,
      variantWithDur.media,
      variantWithDur.shafts,
    );

    const engine = new SimulationEngine(world);
    engine.start();

    // ── 헤드리스 루프 (batch + yield) ────────────────────
    let safetyTickCount = 0;
    const maxTicks = Math.ceil(simDurationMs / dt) + 1000; // safety guard
    while (engine.getState().phase !== SIMULATION_PHASE.COMPLETED && safetyTickCount < maxTicks) {
      if (signal?.aborted) { aborted = true; break; }

      const batchStart = engine.getState().timeState.elapsed;
      for (let b = 0; b < TICKS_PER_BATCH; b++) {
        engine.update(dt);
        safetyTickCount++;
        if (engine.getState().phase === SIMULATION_PHASE.COMPLETED) break;
      }
      onProgress?.({
        index: i, total, currentValue: paramValue, currentLabel: paramLabel,
        phase: 'running',
        simElapsedMs: engine.getState().timeState.elapsed,
        simDurationMs,
      });
      // 순환 진척 보장 — sim 시간이 멈춘 듯하면 batch 강제 break (방어적).
      if (engine.getState().timeState.elapsed === batchStart) break;
      await yieldToEventLoop();
    }

    if (signal?.aborted) { aborted = true; break; }

    // ── 결과 추출 ─────────────────────────────────────────
    onProgress?.({
      index: i, total, currentValue: paramValue, currentLabel: paramLabel,
      phase: 'finalizing',
      simElapsedMs: engine.getState().timeState.elapsed,
      simDurationMs,
    });
    await yieldToEventLoop();

    const visitors = engine.getVisitors();
    const totalExited = engine.getTotalExited();
    const simElapsed = engine.getState().timeState.elapsed;

    const snap = assembleKpiSnapshot(world.zones, world.media, visitors, simElapsed, totalExited);
    const queue = engine.getEntryQueueSnapshot();
    const arrived = queue.totalArrived;
    const abandonRate = arrived > 0 ? queue.totalAbandoned / arrived : 0;

    const satScores = collectSatisfactionScores(visitors, weights, simElapsed);
    const satAgg = aggregateSatisfaction(satScores);

    rows.push({
      paramValue,
      paramLabel,
      completionRate: snap.flowEfficiency.completionRate,
      globalSkipRate: snap.skipRate.globalSkipRate,
      peakUtilRatio: pickPeakUtilRatio(snap),
      p90Fatigue: snap.fatigueDistribution.p90,
      avgQueueWaitMs: queue.avgQueueWaitMs,
      recentAdmitAvgWaitMs: queue.recentAdmitAvgWaitMs,
      totalArrived: queue.totalArrived,
      totalAdmitted: queue.totalAdmitted,
      totalAbandoned: queue.totalAbandoned,
      abandonmentRate: abandonRate,
      satisfactionAvg: satAgg.avg,
      satisfactionLabel: satisfactionLabel(satAgg.avg),
      visitorSampleCount: satAgg.sampleCount,
    });
  }

  const recom = aborted ? { value: null, key: 'aborted' as const } : pickRecommendation(rows);

  onProgress?.({
    index: total, total, currentValue: 0, currentLabel: '',
    phase: 'done',
    simElapsedMs: simDurationMs, simDurationMs,
  });

  return {
    parameter,
    rows,
    recommendedValue: recom.value,
    recommendationKey: recom.key,
    elapsedWallMs: performance.now() - t0,
    aborted,
    baseScenarioId: baseScenario.meta.id,
    baseScenarioName: baseScenario.meta.name,
  };
}

/**
 * UI 비차단을 위한 microtask yield.
 * setTimeout 0 은 macrotask 라 브라우저 paint 가 끼어들 수 있어 충분.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
