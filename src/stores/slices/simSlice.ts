import type { StateCreator } from 'zustand';
import type { Visitor, VisitorGroup, SimulationPhase, TimeState, SimulationConfig, DensityGrid } from '@/domain';
import { SIMULATION_PHASE } from '@/domain';

export interface ShaftQueueSnapshot {
  boarding: { visitorId: string; nodeId: string; progress: number }[];
  queued: { visitorId: string; nodeId: string }[];
}

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
  spawnByNode: ReadonlyMap<string, number>;
  exitByNode: ReadonlyMap<string, number>;
  shaftQueues: ReadonlyMap<string, ShaftQueueSnapshot>;
  densityGrids: ReadonlyMap<string, DensityGrid>;

  // Actions
  setConfig: (config: SimulationConfig) => void;
  setPhase: (phase: SimulationPhase) => void;
  updateSimState: (visitors: Visitor[], groups: VisitorGroup[], timeState: TimeState, phase: SimulationPhase, totalSpawned: number, totalExited: number, mediaStats: Map<string, any>, spawnByNode: ReadonlyMap<string, number>, exitByNode: ReadonlyMap<string, number>) => void;
  setShaftQueues: (queues: ReadonlyMap<string, ShaftQueueSnapshot>) => void;
  setDensityGrids: (grids: ReadonlyMap<string, DensityGrid>) => void;
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
  spawnByNode: new Map(),
  exitByNode: new Map(),
  shaftQueues: new Map(),
  densityGrids: new Map(),

  setConfig: (config) => set({ config }),

  setPhase: (phase) => set({ phase }),

  updateSimState: (visitors, groups, timeState, phase, totalSpawned, totalExited, mediaStats, spawnByNode, exitByNode) =>
    set({ visitors, groups, timeState, phase, totalSpawned, totalExited, mediaStats, spawnByNode, exitByNode }),

  setShaftQueues: (queues) => set({ shaftQueues: queues }),

  setDensityGrids: (grids) => set({ densityGrids: grids }),

  resetSim: () =>
    set({
      visitors: [],
      groups: [],
      phase: SIMULATION_PHASE.IDLE,
      timeState: DEFAULT_TIME_STATE,
      totalSpawned: 0,
      totalExited: 0,
      mediaStats: new Map(),
      spawnByNode: new Map(),
      exitByNode: new Map(),
      shaftQueues: new Map(),
      densityGrids: new Map(),
    }),
});
