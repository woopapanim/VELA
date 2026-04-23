import type { PhysicsConfig, SkipThreshold } from './physics';
import type { TimeSlotConfig } from './visitor';

// ---- Simulation Phase ----
export const SIMULATION_PHASE = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
} as const;

export type SimulationPhase =
  (typeof SIMULATION_PHASE)[keyof typeof SIMULATION_PHASE];

// ---- Simulation Mode ----
// 'time'   = 운영 시간 기준. elapsed >= duration 시 종료. 운영 검토용.
// 'person' = 관람객 수 기준. totalSpawned 도달 + activeCount=0 시 종료 (duration 은 safety cap). 설계 검증용.
export type SimulationMode = 'time' | 'person';

// ---- Simulation Config ----
export interface SimulationConfig {
  readonly fixedDeltaTime: number; // fixed physics step (default 16.67ms)
  readonly duration: number; // total simulation time (ms) — time 모드는 종료시점, person 모드는 safety cap
  readonly timeScale: number; // 1x-10x speed
  readonly maxVisitors: number;
  readonly seed: number; // deterministic PRNG seed
  readonly physics: PhysicsConfig;
  readonly skipThreshold: SkipThreshold;
  readonly timeSlots: readonly TimeSlotConfig[];
  // 권장 관람 시간 — visitor.visitBudgetMs 계산의 기준. 미지정 시 DEFAULT_RECOMMENDED_DURATION_MS.
  readonly recommendedDurationMs?: number;
  // true = 시나리오 규모(존+미디어)에 따라 자동 계산. false/undefined = 수동 입력 유지(레거시 호환).
  readonly recommendedDurationAuto?: boolean;
  // 시뮬레이션 종료 기준. 미지정 시 'time' (레거시 호환).
  readonly simulationMode?: SimulationMode;
}

// ---- Time State (Fixed Timestep with accumulator) ----
export interface TimeState {
  readonly elapsed: number; // total elapsed sim time (ms)
  readonly tickCount: number;
  readonly fixedDeltaTime: number;
  readonly accumulator: number; // unprocessed time carried to next frame
  readonly realTimeStart: number; // wall-clock start
}

// ---- Simulation Snapshot ----
export interface SimulationSnapshot {
  readonly timeState: TimeState;
  readonly phase: SimulationPhase;
  readonly visitorCount: number;
  readonly activeVisitorCount: number;
}
