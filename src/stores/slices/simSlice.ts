import type { StateCreator } from 'zustand';
import type { Visitor, VisitorGroup, SimulationPhase, TimeState, SimulationConfig } from '@/domain';
import { SIMULATION_PHASE } from '@/domain';

export interface SimSlice {
  // State
  visitors: Visitor[];
  groups: VisitorGroup[];
  phase: SimulationPhase;
  timeState: TimeState;
  config: SimulationConfig | null;

  // Cumulative counters
  totalSpawned: number;
  totalExited: number;
  mediaStats: Map<string, { watchCount: number; skipCount: number; waitCount: number; totalWatchMs: number; totalWaitMs: number; peakViewers: number }>;

  // Actions
  setConfig: (config: SimulationConfig) => void;
  setPhase: (phase: SimulationPhase) => void;
  updateSimState: (visitors: Visitor[], groups: VisitorGroup[], timeState: TimeState, phase: SimulationPhase, totalSpawned: number, totalExited: number, mediaStats: Map<string, any>) => void;
  resetSim: () => void;
}

const DEFAULT_TIME_STATE: TimeState = {
  elapsed: 0,
  tickCount: 0,
  fixedDeltaTime: 1000 / 60,
  accumulator: 0,
  realTimeStart: 0,
};

export const createSimSlice: StateCreator<SimSlice, [], [], SimSlice> = (set) => ({
  visitors: [],
  groups: [],
  phase: SIMULATION_PHASE.IDLE,
  timeState: DEFAULT_TIME_STATE,
  config: null,
  totalSpawned: 0,
  totalExited: 0,
  mediaStats: new Map(),

  setConfig: (config) => set({ config }),

  setPhase: (phase) => set({ phase }),

  updateSimState: (visitors, groups, timeState, phase, totalSpawned, totalExited, mediaStats) =>
    set({ visitors, groups, timeState, phase, totalSpawned, totalExited, mediaStats }),

  resetSim: () =>
    set({
      visitors: [],
      groups: [],
      phase: SIMULATION_PHASE.IDLE,
      timeState: DEFAULT_TIME_STATE,
      totalSpawned: 0,
      totalExited: 0,
      mediaStats: new Map(),
    }),
});
