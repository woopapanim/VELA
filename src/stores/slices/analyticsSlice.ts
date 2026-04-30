import type { StateCreator } from 'zustand';
import type {
  KpiSnapshot,
  KpiTimeSeriesEntry,
  StaticInsight,
  RunRecord,
  ProfileEngagement,
  Scenario,
  Visitor,
  VisitorProfileType,
} from '@/domain';
import { computeScenarioContentHash } from '@/analytics/scenarioHash';

const MAX_RUN_RECORDS = 30;

export interface AnalyticsSlice {
  // State
  latestSnapshot: KpiSnapshot | null;
  kpiHistory: KpiTimeSeriesEntry[];
  staticInsights: StaticInsight[];
  runRecords: RunRecord[];
  activeRunId: string | null;

  // Actions
  pushSnapshot: (snapshot: KpiSnapshot) => void;
  setStaticInsights: (insights: StaticInsight[]) => void;
  clearHistory: () => void;
  captureRun: (args: {
    runId: string;
    startedAt: number;
    scenario: Scenario;
    dirtyAtCapture: boolean;
    visitors: readonly Visitor[];
    spawnByNode: ReadonlyMap<string, number>;
    exitByNode: ReadonlyMap<string, number>;
    totalSpawned: number;
    totalExited: number;
    latestSnapshot: KpiSnapshot;
    kpiHistory: readonly KpiTimeSeriesEntry[];
    zoneCount: number;
    entryQueue?: {
      totalArrived: number;
      totalAdmitted: number;
      totalAbandoned: number;
      recentAdmitAvgWaitMs: number;
    };
  }) => string | null;
  setActiveRunId: (id: string | null) => void;
  removeRunRecord: (id: string) => void;
  clearRunRecords: () => void;
}

function mapToObject(m: ReadonlyMap<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of m) out[k] = v;
  return out;
}

function summarizeEngagement(visitors: readonly Visitor[], zoneCount: number) {
  const exited = visitors.filter((v) => !v.isActive);
  const sample = exited.length > 0 ? exited : visitors;
  if (sample.length === 0) {
    return { avgZones: 0, avgMedia: 0, fullCompletion: 0, avgDwellSec: 0, fatigueMean: 0 };
  }
  const fatigueSum = sample.reduce((s, v) => s + (v.fatigue ?? 0), 0);
  const fatigueMean = fatigueSum / sample.length;
  if (exited.length === 0) {
    return { avgZones: 0, avgMedia: 0, fullCompletion: 0, avgDwellSec: 0, fatigueMean };
  }
  const sumZones = exited.reduce((s, v) => s + v.visitedZoneIds.length, 0);
  const sumMedia = exited.reduce((s, v) => s + (v.visitedMediaIds?.length ?? 0), 0);
  const full = exited.filter((v) => v.visitedZoneIds.length >= zoneCount).length;
  const sumDwellMs = exited.reduce(
    (s, v) => s + Math.max(0, (v.exitedAt ?? 0) - (v.enteredAt ?? 0)),
    0,
  );
  return {
    avgZones: sumZones / exited.length,
    avgMedia: sumMedia / exited.length,
    fullCompletion: full / exited.length,
    avgDwellSec: sumDwellMs / exited.length / 1000,
    fatigueMean,
  };
}

// profile 별 engagement — exited 방문자만 sample. 빈 그룹은 결과에서 생략.
export function summarizeEngagementByProfile(
  visitors: readonly Visitor[],
  zoneCount: number,
): Partial<Record<VisitorProfileType, ProfileEngagement>> {
  const groups = new Map<VisitorProfileType, Visitor[]>();
  for (const v of visitors) {
    if (v.isActive) continue;
    const t = v.profile.type;
    const arr = groups.get(t);
    if (arr) arr.push(v);
    else groups.set(t, [v]);
  }
  const out: Partial<Record<VisitorProfileType, ProfileEngagement>> = {};
  for (const [type, group] of groups) {
    if (group.length === 0) continue;
    const sumZones = group.reduce((s, v) => s + v.visitedZoneIds.length, 0);
    const sumMedia = group.reduce((s, v) => s + (v.visitedMediaIds?.length ?? 0), 0);
    const full = group.filter((v) => v.visitedZoneIds.length >= zoneCount).length;
    const sumDwellMs = group.reduce(
      (s, v) => s + Math.max(0, (v.exitedAt ?? 0) - (v.enteredAt ?? 0)),
      0,
    );
    const fatigueSum = group.reduce((s, v) => s + (v.fatigue ?? 0), 0);
    out[type] = {
      sampleCount: group.length,
      avgDwellSec: sumDwellMs / group.length / 1000,
      avgZones: sumZones / group.length,
      avgMedia: sumMedia / group.length,
      fullCompletion: full / group.length,
      fatigueMean: fatigueSum / group.length,
    };
  }
  return out;
}

export const createAnalyticsSlice: StateCreator<AnalyticsSlice, [], [], AnalyticsSlice> = (set, get) => ({
  latestSnapshot: null,
  kpiHistory: [],
  staticInsights: [],
  runRecords: [],
  activeRunId: null,

  pushSnapshot: (snapshot) =>
    set((s) => ({
      latestSnapshot: snapshot,
      kpiHistory: [
        ...s.kpiHistory,
        { timestamp: snapshot.simulationTimeMs, capturedAt: Date.now(), snapshot },
      ],
    })),

  setStaticInsights: (insights) => set({ staticInsights: insights }),

  clearHistory: () => set({ latestSnapshot: null, kpiHistory: [], staticInsights: [] }),

  captureRun: (args) => {
    const {
      runId, startedAt, scenario, dirtyAtCapture,
      visitors, spawnByNode, exitByNode,
      totalSpawned, totalExited,
      latestSnapshot, kpiHistory, zoneCount,
      entryQueue,
    } = args;
    if (!runId || !scenario) return null;

    const contentHash = computeScenarioContentHash(scenario);
    const profileWeights = scenario.visitorDistribution.profileWeights as Readonly<Record<VisitorProfileType, number>>;

    const eq = entryQueue ?? { totalArrived: 0, totalAdmitted: 0, totalAbandoned: 0, recentAdmitAvgWaitMs: 0 };
    const rejectionRate = eq.totalArrived > 0 ? eq.totalAbandoned / eq.totalArrived : 0;

    const record: RunRecord = {
      id: runId,
      startedAt,
      endedAt: Date.now(),
      scenarioId: scenario.meta.id as string,
      scenarioName: scenario.meta.name,
      scenarioVersion: scenario.meta.version,
      contentHash,
      dirtyAtCapture,
      persona: {
        profileWeights,
        totalCount: scenario.visitorDistribution.totalCount,
      },
      seed: scenario.simulationConfig.seed,
      latestSnapshot,
      kpiHistory: [...kpiHistory],
      totalSpawned,
      totalExited,
      spawnByNode: mapToObject(spawnByNode),
      exitByNode: mapToObject(exitByNode),
      engagement: summarizeEngagement(visitors, zoneCount),
      engagementByProfile: summarizeEngagementByProfile(visitors, zoneCount),
      entryStats: {
        totalArrived: eq.totalArrived,
        totalAdmitted: eq.totalAdmitted,
        totalAbandoned: eq.totalAbandoned,
        avgAdmitWaitMs: eq.recentAdmitAvgWaitMs,
        rejectionRate,
      },
    };

    set((s) => {
      const existingIdx = s.runRecords.findIndex((r) => r.id === runId);
      const next = existingIdx >= 0
        ? s.runRecords.map((r, i) => (i === existingIdx ? record : r))
        : [...s.runRecords, record];
      const trimmed = next.length > MAX_RUN_RECORDS ? next.slice(next.length - MAX_RUN_RECORDS) : next;
      return { runRecords: trimmed, activeRunId: runId };
    });

    return runId;
  },

  setActiveRunId: (id) => {
    if (id === null) {
      set({ activeRunId: null });
      return;
    }
    const exists = get().runRecords.some((r) => r.id === id);
    if (exists) set({ activeRunId: id });
  },

  removeRunRecord: (id) =>
    set((s) => ({
      runRecords: s.runRecords.filter((r) => r.id !== id),
      activeRunId: s.activeRunId === id ? null : s.activeRunId,
    })),

  clearRunRecords: () => set({ runRecords: [], activeRunId: null }),
});
