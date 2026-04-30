import type { SimulationWorld } from '@/simulation/engine';
import type {
  SimulationConfig,
  ZoneConfig,
  MediaPlacement,
  FloorConfig,
  WaypointGraph,
  ElevatorShaft,
} from '@/domain';
import { DEFAULT_OPERATIONS_CONFIG } from '@/domain/types/operations';
import { runHeadlessSweep, type HeadlessSweepResult } from './runHeadlessSweep';

// Step 4c — capacity sweep orchestrator.
// 권장 동시 수용을 anchor 로 3 variant (80% / 100% / 120%) 를 자동 실행해
// peak / abandoned / 완주율을 횡비교한다. 모두 같은 seed/duration/visitor mix.

export type SweepVariantId = 'conservative' | 'recommended' | 'aggressive';

export interface SweepVariant {
  readonly id: SweepVariantId;
  readonly label: string;          // UI 표시용 한국어 라벨
  readonly maxConcurrent: number;  // entryPolicy.maxConcurrent
  readonly ratio: number;          // recommended 대비 비율
}

export interface SweepVariantResult {
  readonly variant: SweepVariant;
  readonly result: HeadlessSweepResult;
  readonly throughputPerHour: number;
  readonly abandonmentRate: number;       // abandoned / (admitted + abandoned)
  readonly completionRate: number;        // exited / spawned
  readonly avgDwellSec: number;
  readonly congestionMinutes: number;     // bottleneck score>0.7 누적 분 (snapshots 기반 근사)
}

export interface SweepInput {
  readonly recommendedConcurrent: number;
  readonly floors: readonly FloorConfig[];
  readonly zones: readonly ZoneConfig[];
  readonly media: readonly MediaPlacement[];
  readonly config: SimulationConfig;
  readonly waypointGraph?: WaypointGraph;
  readonly shafts?: readonly ElevatorShaft[];
  readonly globalFlowMode?: string;
  readonly guidedUntilIndex?: number;
  readonly totalVisitors: number;
  readonly categoryWeights?: Record<string, number>;
}

export function buildVariants(recommendedConcurrent: number): readonly SweepVariant[] {
  const conservative = Math.max(1, Math.floor(recommendedConcurrent * 0.8));
  const recommended = Math.max(1, recommendedConcurrent);
  const aggressive = Math.max(recommended + 1, Math.ceil(recommendedConcurrent * 1.2));
  return [
    { id: 'conservative', label: '보수 (80%)', maxConcurrent: conservative, ratio: 0.8 },
    { id: 'recommended', label: '권장 (100%)', maxConcurrent: recommended, ratio: 1.0 },
    { id: 'aggressive', label: '공격 (120%)', maxConcurrent: aggressive, ratio: 1.2 },
  ];
}

function buildWorldForVariant(input: SweepInput, variant: SweepVariant): SimulationWorld {
  const baseOps = input.config.operations ?? DEFAULT_OPERATIONS_CONFIG;
  const overriddenConfig: SimulationConfig = {
    ...input.config,
    // Sweep 은 같은 visitor budget 으로 도달 시간/이탈을 비교해야 하므로 person 모드로 강제.
    simulationMode: 'person',
    operations: {
      ...baseOps,
      entryPolicy: {
        ...baseOps.entryPolicy,
        mode: 'concurrent-cap',
        maxConcurrent: variant.maxConcurrent,
      },
    },
  };
  const world: SimulationWorld = {
    floors: input.floors,
    zones: input.zones,
    media: input.media,
    config: overriddenConfig,
    globalFlowMode: input.globalFlowMode,
    guidedUntilIndex: input.guidedUntilIndex,
    waypointGraph: input.waypointGraph,
    shafts: input.shafts,
    totalVisitors: input.totalVisitors,
  };
  if (input.categoryWeights) {
    (world as any).categoryWeights = input.categoryWeights;
  }
  return world;
}

function computeAvgDwellSec(result: HeadlessSweepResult): number {
  const snap = result.finalSnapshot;
  // visitDurations 는 zone 단위 평균. 시설 평균은 각 zone 평균의 평균 (단순화).
  if (snap.visitDurations.length === 0) return 0;
  const sum = snap.visitDurations.reduce((s, d) => s + (d.meanDurationMs ?? 0), 0);
  return sum / snap.visitDurations.length / 1000;
}

function computeCongestionMinutes(result: HeadlessSweepResult): number {
  // snapshots 30s 간격. bottleneck score>0.7 인 timestep 의 비율 × 30s.
  if (result.snapshots.length === 0) return 0;
  let congestedTimesteps = 0;
  for (const snap of result.snapshots) {
    const maxScore = snap.bottlenecks.reduce((m, b) => (b.score > m ? b.score : m), 0);
    if (maxScore > 0.7) congestedTimesteps++;
  }
  return (congestedTimesteps * 30) / 60; // sec→min
}

export async function sweepCapacity(
  input: SweepInput,
  options: {
    onVariantStart?: (variant: SweepVariant, idx: number, total: number) => void;
    onVariantProgress?: (variant: SweepVariant, idx: number, progress: number) => void;
    abortSignal?: AbortSignal;
  } = {},
): Promise<readonly SweepVariantResult[]> {
  if (input.recommendedConcurrent <= 0) return [];

  const variants = buildVariants(input.recommendedConcurrent);
  const results: SweepVariantResult[] = [];

  for (let i = 0; i < variants.length; i++) {
    if (options.abortSignal?.aborted) break;
    const variant = variants[i];
    options.onVariantStart?.(variant, i, variants.length);

    const world = buildWorldForVariant(input, variant);
    const result = await runHeadlessSweep(world, {
      onProgress: (p) => options.onVariantProgress?.(variant, i, p),
      abortSignal: options.abortSignal,
    });

    const admitted = result.totalSpawned;
    const abandoned = result.totalAbandoned;
    const arrived = admitted + abandoned;
    const elapsedHours = result.elapsedSimMs / 3_600_000;

    results.push({
      variant,
      result,
      throughputPerHour: elapsedHours > 0 ? result.totalExited / elapsedHours : 0,
      abandonmentRate: arrived > 0 ? abandoned / arrived : 0,
      completionRate: admitted > 0 ? result.totalExited / admitted : 0,
      avgDwellSec: computeAvgDwellSec(result),
      congestionMinutes: computeCongestionMinutes(result),
    });
  }

  return results;
}
