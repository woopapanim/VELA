import type { StateCreator } from 'zustand';
import type { Visitor, VisitorGroup, SimulationPhase, TimeState, SimulationConfig, DensityGrid } from '@/domain';
import { SIMULATION_PHASE } from '@/domain';

export interface ShaftQueueSnapshot {
  boarding: { visitorId: string; nodeId: string; progress: number }[];
  queued: { visitorId: string; nodeId: string }[];
}

// Phase 1 (2026-04-25): 외부 입장 큐의 노드별 집계.
// EntryController.peekQueue() 결과를 spawnEntryNodeId 별로 묶은 라이브 스냅샷.
// OutsideQueueRenderer + OperationsPanel KPI 라이브 표시에 사용.
export interface EntryQueueNodeBucket {
  /** 해당 entry node 에서 대기 중인 인원 수. */
  count: number;
  /** 해당 노드 큐의 가장 오래 기다린 사람의 대기 시간 (ms). */
  oldestWaitMs: number;
}

export interface EntryQueueState {
  /** entry node id → bucket. peek 결과를 spawnEntryNodeId 로 group-by. */
  byNode: ReadonlyMap<string, EntryQueueNodeBucket>;
  /** 전체 큐 길이 (모든 노드 합). */
  totalQueueLength: number;
  /** 전체 큐의 가장 오래 기다린 사람 (ms). */
  oldestWaitMs: number;
  /** 누적 abandoned (정책 maxWait 초과 + sim 종료 drain 포함). */
  totalAbandoned: number;
  /** Phase 1+ (2026-04-26): 현재 큐 평균 대기 (ms). 비어있으면 0. */
  avgQueueWaitMs: number;
  /** Phase 1+ (2026-04-26): 최근 admit N=100명 평균 외부 대기 (ms). 운영 결정 KPI. */
  recentAdmitAvgWaitMs: number;
  /** Phase 1+ (2026-04-26): 누적 admit 인원 (admit/h 추정용). */
  totalAdmitted: number;
  /** Phase 1+ (2026-04-26): 누적 도착 인원 (admit + abandoned + 현재 큐). */
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
  // Phase 1: 외부 입장 큐 라이브 스냅샷 (정책이 'unlimited' 이면 항상 빈 상태).
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
