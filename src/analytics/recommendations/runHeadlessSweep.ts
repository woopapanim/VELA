import { SimulationEngine, type SimulationWorld } from '@/simulation/engine';
import { SIMULATION_PHASE } from '@/domain';
import { assembleKpiSnapshot } from '@/analytics/aggregator';
import type { KpiSnapshot } from '@/domain';

// Step 4c — UI 루프 없이 SimulationEngine 을 tight-loop 로 돌리는 headless runner.
// engine.update(deltaMs) 는 accumulator 기반이므로 큰 delta 도 안전하게 누적 처리된다.
// UI 응답성 보존을 위해 chunk 마다 await 로 event loop 에 양보한다.

// Headless 모드에서는 timeScale 무시하고 큰 delta 를 한 번에 먹여 시뮬을 빠르게 압축한다.
// 한 variant 당 wall-time 안전장치 60s — UI 응답성보다 결과 도달이 우선.
const STEP_REAL_MS = 10_000;        // sim 10s 단위로 update — 3h sim 도 ~1080 step
const YIELD_EVERY = 20;             // 20 step (≈sim 200s) 마다 setTimeout(0) yield
const MAX_WALL_MS = 90_000;         // 1 variant 당 90s wall-clock 초과 시 중단

export interface HeadlessSweepResult {
  readonly elapsedSimMs: number;
  readonly wallMs: number;
  readonly totalSpawned: number;
  readonly totalExited: number;
  readonly totalAbandoned: number;
  readonly peakConcurrent: number;
  readonly avgConcurrent: number;
  readonly snapshots: readonly KpiSnapshot[];      // 30s 간격 sample
  readonly finalSnapshot: KpiSnapshot;
  readonly hitWallTimeout: boolean;
}

/**
 * 한 variant world 를 끝까지 (or duration cap / wall timeout) 돌린다.
 * onProgress 는 0~1 사이 진행도. 사용자 cancel 은 abort signal 로 중단.
 */
export async function runHeadlessSweep(
  world: SimulationWorld,
  options: {
    onProgress?: (progress: number) => void;
    abortSignal?: AbortSignal;
  } = {},
): Promise<HeadlessSweepResult> {
  const engine = new SimulationEngine(world);
  engine.start();

  const wallStart = performance.now();
  const totalCap = world.totalVisitors ?? Infinity;
  const durationCap = world.config.duration;

  let stepCount = 0;
  let lastSampleAtMs = 0;
  let peakConcurrent = 0;
  let sumConcurrent = 0;
  let sampleCount = 0;
  const snapshots: KpiSnapshot[] = [];
  let hitWallTimeout = false;

  while (engine.getState().phase === SIMULATION_PHASE.RUNNING) {
    if (options.abortSignal?.aborted) break;

    engine.update(STEP_REAL_MS);
    stepCount++;

    const elapsedSim = engine.getState().timeState.elapsed;
    const activeCount = engine.getActiveVisitors().length;
    if (activeCount > peakConcurrent) peakConcurrent = activeCount;
    sumConcurrent += activeCount;
    sampleCount++;

    // 30s sim 마다 KPI snapshot 보관 (peak concurrent 추적용)
    if (elapsedSim - lastSampleAtMs >= 30_000) {
      lastSampleAtMs = elapsedSim;
      const snap = assembleKpiSnapshot(
        world.zones, world.media,
        engine.getVisitors(),
        elapsedSim,
        engine.getTotalExited(),
      );
      snapshots.push(snap);
    }

    // wall-time 안전장치
    if (performance.now() - wallStart > MAX_WALL_MS) {
      hitWallTimeout = true;
      break;
    }

    // 진행도 — duration 또는 totalVisitors 중 더 가까이 다가간 쪽
    if (options.onProgress) {
      const byDuration = elapsedSim / Math.max(1, durationCap);
      const consumed = engine.getTotalSpawned() + engine.getTotalAbandoned();
      const byPersons = Number.isFinite(totalCap)
        ? consumed / Math.max(1, totalCap as number)
        : 0;
      options.onProgress(Math.min(0.99, Math.max(byDuration, byPersons)));
    }

    // event loop yield
    if (stepCount % YIELD_EVERY === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  const elapsedSimMs = engine.getState().timeState.elapsed;
  const finalSnapshot = assembleKpiSnapshot(
    world.zones, world.media,
    engine.getVisitors(),
    elapsedSimMs,
    engine.getTotalExited(),
  );

  options.onProgress?.(1);

  return {
    elapsedSimMs,
    wallMs: performance.now() - wallStart,
    totalSpawned: engine.getTotalSpawned(),
    totalExited: engine.getTotalExited(),
    totalAbandoned: engine.getTotalAbandoned(),
    peakConcurrent,
    avgConcurrent: sampleCount > 0 ? sumConcurrent / sampleCount : 0,
    snapshots,
    finalSnapshot,
    hitWallTimeout,
  };
}
