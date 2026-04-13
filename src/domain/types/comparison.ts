import type { ComparisonId, ZoneId, MediaId, UnixMs } from './common';
import type { ScenarioMeta } from './scenario';
import type { MediaType } from './media';

// ---- Delta Metric ----
export interface DeltaMetric {
  readonly valueA: number;
  readonly valueB: number;
  readonly absoluteDelta: number; // B - A
  readonly percentDelta: number; // (B - A) / A * 100
  readonly improvement: boolean; // B is better than A
}

// ---- Per-zone delta ----
export interface ZoneDeltaMetric {
  readonly zoneId: ZoneId;
  readonly zoneName: string;
  readonly utilization: DeltaMetric;
  readonly avgDwellTime: DeltaMetric;
  readonly bottleneckScore: DeltaMetric;
}

// ---- Per-media delta ----
export interface MediaDeltaMetric {
  readonly mediaId: MediaId;
  readonly mediaType: MediaType;
  readonly skipRate: DeltaMetric;
  readonly avgEngagementTime: DeltaMetric;
  readonly queueTime: DeltaMetric;
}

// ---- Full delta result ----
export interface DeltaKpiResult {
  readonly peakCongestion: DeltaMetric;
  readonly avgDwellTime: DeltaMetric;
  readonly globalSkipRate: DeltaMetric;
  readonly flowEfficiency: DeltaMetric;
  readonly bottleneckCount: DeltaMetric;
  readonly avgFatigue: DeltaMetric;
  readonly perZoneDelta: readonly ZoneDeltaMetric[];
  readonly perMediaDelta: readonly MediaDeltaMetric[];
  readonly recommendation: 'A' | 'B' | 'neutral';
  readonly summary: string;
}

// ---- Scenario Comparison ----
export interface ScenarioComparison {
  readonly id: ComparisonId;
  readonly scenarioA: ScenarioMeta;
  readonly scenarioB: ScenarioMeta;
  readonly deltaKpis: DeltaKpiResult;
  readonly createdAt: UnixMs;
}
