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

// ---- Simulation Config ----
export interface SimulationConfig {
  readonly fixedDeltaTime: number; // fixed physics step (default 16.67ms)
  readonly duration: number; // total simulation time (ms)
  readonly timeScale: number; // 1x-10x speed
  readonly maxVisitors: number;
  readonly seed: number; // deterministic PRNG seed
  readonly physics: PhysicsConfig;
  readonly skipThreshold: SkipThreshold;
  readonly timeSlots: readonly TimeSlotConfig[];
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
