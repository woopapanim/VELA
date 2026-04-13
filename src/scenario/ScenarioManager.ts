import type { Scenario, ScenarioSummary, ScenarioId, KpiTimeSeriesEntry } from '@/domain';

export interface SavedScenario {
  scenario: Scenario;
  kpiHistory: KpiTimeSeriesEntry[];
  savedAt: number;
}

const STORAGE_KEY = 'aion-scenarios';

export class ScenarioManager {
  private scenarios = new Map<string, SavedScenario>();

  constructor() {
    this.loadFromStorage();
  }

  save(scenario: Scenario, kpiHistory: KpiTimeSeriesEntry[] = []): Scenario {
    const updated: Scenario = {
      ...scenario,
      meta: {
        ...scenario.meta,
        version: scenario.meta.version + 1,
        updatedAt: Date.now(),
      },
    };

    this.scenarios.set(updated.meta.id as string, {
      scenario: updated,
      kpiHistory,
      savedAt: Date.now(),
    });

    this.persistToStorage();
    return updated;
  }

  load(id: ScenarioId): SavedScenario | null {
    return this.scenarios.get(id as string) ?? null;
  }

  branch(sourceId: ScenarioId, newName: string): Scenario | null {
    const source = this.scenarios.get(sourceId as string);
    if (!source) return null;

    const newId = `scenario_${Date.now()}` as ScenarioId;
    const branched: Scenario = {
      ...source.scenario,
      meta: {
        ...source.scenario.meta,
        id: newId,
        name: newName,
        version: 1,
        parentId: sourceId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };

    this.scenarios.set(newId as string, {
      scenario: branched,
      kpiHistory: [],
      savedAt: Date.now(),
    });

    this.persistToStorage();
    return branched;
  }

  delete(id: ScenarioId): boolean {
    const result = this.scenarios.delete(id as string);
    if (result) this.persistToStorage();
    return result;
  }

  list(): ScenarioSummary[] {
    return Array.from(this.scenarios.values()).map(({ scenario }) => ({
      meta: scenario.meta,
      floorCount: scenario.floors.length,
      zoneCount: scenario.zones.length,
      totalVisitors: scenario.visitorDistribution.totalCount,
    }));
  }

  getAll(): SavedScenario[] {
    return Array.from(this.scenarios.values());
  }

  private persistToStorage() {
    try {
      const data: Record<string, SavedScenario> = {};
      for (const [key, value] of this.scenarios) {
        data[key] = value;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable
    }
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Record<string, SavedScenario>;
      for (const [key, value] of Object.entries(data)) {
        this.scenarios.set(key, value);
      }
    } catch {
      // corrupted data
    }
  }
}

// Singleton instance
export const scenarioManager = new ScenarioManager();
