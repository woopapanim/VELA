import type { StateCreator } from 'zustand';
import type { Visitor, VisitorGroup, SimulationPhase, TimeState, SimulationConfig, DensityGrid } from '@/domain';
import { SIMULATION_PHASE } from '@/domain';

export interface ShaftQueueSnapshot {
  boarding: { visitorId: string; nodeId: string; progress: number }[];
  queued: { visitorId: string; nodeId: string }[];
}

// Phase 1 (2026-04-26): 외부 입장 큐의 노드별 집계.
// EntryController.peekQueue() 결과를 spawnEntryNodeId 별로 묶은 라이브 스냅샷.
// OutsideQueueRenderer + (추후) OperationsPanel KPI 라이브 표시에 사용.
export interface EntryQueueNodeBucket {
  count: number;
  oldestWaitMs: number;
}

export interface EntryQueueState {
  byNode: ReadonlyMap<string, EntryQueueNodeBucket>;
  totalQueueLength: number;
  oldestWaitMs: number;
  totalAbandoned: number;
  avgQueueWaitMs: number;
  recentAdmitAvgWaitMs: number;
  totalAdmitted: number;
  totalArrived: number;
}

export interface SimSlice {
  // State
  visitors: Visitor[];
  groups: VisitorGroup[];
  phase: SimulationPhase;
  timeState: TimeState;
  config: SimulationConfig | null;

  // Run identity (unique per sim execution; null when idle/never-run)
  runId: string | null;

  // Cumulative counters
  totalSpawned: number;
  totalExited: number;
  mediaStats: Map<string, { watchCount: number; skipCount: number; waitCount: number; totalWatchMs: number; totalWaitMs: number; peakViewers: number }>;
  spawnByNode: ReadonlyMap<string, number>;
  exitByNode: ReadonlyMap<string, number>;
  shaftQueues: ReadonlyMap<string, ShaftQueueSnapshot>;
  densityGrids: ReadonlyMap<string, DensityGrid>;
  entryQueue: EntryQueueState;

  // Actions
  setConfig: (config: SimulationConfig) => void;
  setPhase: (phase: SimulationPhase) => void;
  setRunId: (runId: string | null) => void;
  updateSimState: (visitors: Visitor[], groups: VisitorGroup[], timeState: TimeState, phase: SimulationPhase, totalSpawned: number, totalExited: number, mediaStats: Map<string, any>, spawnByNode: ReadonlyMap<string, number>, exitByNode: ReadonlyMap<string, number>) => void;
  setShaftQueues: (queues: ReadonlyMap<string, ShaftQueueSnapshot>) => void;
  setDensityGrids: (grids: ReadonlyMap<string, DensityGrid>) => void;
  setEntryQueue: (q: EntryQueueState) => void;
  resetSim: () => void;
}

const EMPTY_ENTRY_QUEUE: EntryQueueState = {
  byNode: new Map(),
  totalQueueLength: 0,
  oldestWaitMs: 0,
  totalAbandoned: 0,
  avgQueueWaitMs: 0,
  recentAdmitAvgWaitMs: 0,
  totalAdmitted: 0,
  totalArrived: 0,
};

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
  runId: null,
  totalSpawned: 0,
  totalExited: 0,
  mediaStats: new Map(),
  spawnByNode: new Map(),
  exitByNode: new Map(),
  shaftQueues: new Map(),
  densityGrids: new Map(),
  entryQueue: EMPTY_ENTRY_QUEUE,

  setConfig: (config) => set({ config }),

  setPhase: (phase) => set({ phase }),

  setRunId: (runId) => set({ runId }),

  updateSimState: (visitors, groups, timeState, phase, totalSpawned, totalExited, mediaStats, spawnByNode, exitByNode) =>
    set({ visitors, groups, timeState, phase, totalSpawned, totalExited, mediaStats, spawnByNode, exitByNode }),

  setShaftQueues: (queues) => set({ shaftQueues: queues }),

  setDensityGrids: (grids) => set({ densityGrids: grids }),

  setEntryQueue: (q) => set({ entryQueue: q }),

  resetSim: () =>
    set({
      visitors: [],
      groups: [],
      phase: SIMULATION_PHASE.IDLE,
      timeState: DEFAULT_TIME_STATE,
      runId: null,
      totalSpawned: 0,
      totalExited: 0,
      mediaStats: new Map(),
      spawnByNode: new Map(),
      exitByNode: new Map(),
      shaftQueues: new Map(),
      densityGrids: new Map(),
      entryQueue: EMPTY_ENTRY_QUEUE,
    }),
});
