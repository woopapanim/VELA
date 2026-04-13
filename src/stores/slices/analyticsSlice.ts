import type { StateCreator } from 'zustand';
import type { KpiSnapshot, KpiTimeSeriesEntry, StaticInsight } from '@/domain';

export interface AnalyticsSlice {
  // State
  latestSnapshot: KpiSnapshot | null;
  kpiHistory: KpiTimeSeriesEntry[];
  staticInsights: StaticInsight[];

  // Actions
  pushSnapshot: (snapshot: KpiSnapshot) => void;
  setStaticInsights: (insights: StaticInsight[]) => void;
  clearHistory: () => void;
}

export const createAnalyticsSlice: StateCreator<AnalyticsSlice, [], [], AnalyticsSlice> = (set) => ({
  latestSnapshot: null,
  kpiHistory: [],
  staticInsights: [],

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
});
