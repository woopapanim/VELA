import type { ZoneId, MediaId, UnixMs } from './common';
import type { ScenarioMeta } from './scenario';
import type { MediaType } from './media';

// ---- Structured Report ----
export interface StructuredReport {
  readonly scenarioMeta: ScenarioMeta;
  readonly generatedAt: UnixMs;
  readonly summary: ReportSummary;
  readonly spaceAnalysis: readonly SpaceAnalysisEntry[];
  readonly experienceAnalysis: readonly ExperienceAnalysisEntry[];
  readonly insights: readonly InsightEntry[];
}

// ---- Report Summary ----
export interface ReportSummary {
  readonly totalVisitors: number;
  readonly avgDwellTimeMs: number;
  readonly peakCongestionRatio: number;
  readonly bottleneckCount: number;
  readonly globalSkipRate: number;
  readonly completionRate: number;
}

// ---- Space Analysis (per zone) ----
export interface SpaceAnalysisEntry {
  readonly zoneId: ZoneId;
  readonly zoneName: string;
  readonly areaPerPerson: number; // m²/person
  readonly comfortGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly peakOccupancy: number;
  readonly avgDwellTimeMs: number;
  readonly bottleneckDuration: number;
}

// ---- Experience Analysis (per media) ----
export interface ExperienceAnalysisEntry {
  readonly mediaId: MediaId;
  readonly mediaType: MediaType;
  readonly totalInteractions: number;
  readonly avgEngagementTimeMs: number;
  readonly skipRate: number;
  readonly avgQueueTimeMs: number;
  readonly queueEfficiencyIndex: number; // dwell time / wait time ratio
}

// ---- Insight Entry (problem → cause → recommendation) ----
export interface InsightEntry {
  readonly severity: 'info' | 'warning' | 'critical';
  readonly category: 'congestion' | 'skip' | 'fatigue' | 'flow' | 'capacity';
  readonly problem: string;
  readonly cause: string;
  readonly recommendation: string;
  readonly affectedZoneIds: readonly ZoneId[];
  readonly affectedMediaIds: readonly MediaId[];
  readonly dataEvidence: {
    readonly metric: string;
    readonly value: number;
    readonly threshold: number;
  };
}
