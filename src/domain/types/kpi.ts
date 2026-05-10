import type { ZoneId, FloorId, MediaId, GroupId, UnixMs, ShaftId } from './common';
import type { GroupType } from './visitor';

// ---- Static Insight (pre-simulation) ----
export interface StaticInsight {
  readonly zoneId: ZoneId;
  readonly areaPerPerson: number; // m²/person
  readonly meetsStandard: boolean; // >= 2.5 m²/person international standard
  readonly mediaCapacityTotal: number;
  readonly projectedPeakVisitors: number;
  readonly bottleneckRisk: 'low' | 'medium' | 'high' | 'critical';
}

// ---- Zone Utilization ----
export interface ZoneUtilization {
  readonly zoneId: ZoneId;
  readonly currentOccupancy: number;
  readonly capacity: number;
  readonly ratio: number; // 0-1
  readonly peakOccupancy: number;
  readonly watchingCount: number;   // agents currently WATCHING media
  readonly waitingCount: number;    // agents currently WAITING for media
  readonly timestamp: number;
  // Step 2 (2026-04-30): 이 zone 의 bottleneckIndex.score 가 임계 이상이었던 누적 시간.
  // simulationTimeMs 와 함께 정체 시간 비율 (cumulativeCongestedMs / simulationTimeMs) 산출.
  readonly cumulativeCongestedMs: number;
}

// ---- Bottleneck Index ----
export interface BottleneckIndex {
  readonly zoneId: ZoneId;
  readonly score: number; // 0-1
  readonly avgQueueTime: number;
  readonly flowInRate: number;
  readonly flowOutRate: number;
  readonly groupContribution: number; // 0-1
  readonly isGroupInduced: boolean;
}

// ---- Average Visit Duration ----
export interface AverageVisitDuration {
  readonly zoneId: ZoneId;
  readonly meanDurationMs: number;
  readonly medianDurationMs: number;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly sampleCount: number;
}

// ---- Flow Efficiency ----
export interface FlowEfficiency {
  readonly totalVisitorsProcessed: number;
  readonly averageTotalTimeMs: number;
  readonly throughputPerMinute: number;
  readonly completionRate: number;
}

// ---- Fatigue Distribution ----
export interface FatigueBucket {
  readonly rangeMin: number;
  readonly rangeMax: number;
  readonly count: number;
}

export interface FatigueDistribution {
  readonly mean: number;
  readonly median: number;
  readonly p90: number;
  readonly p99: number;
  readonly histogram: readonly FatigueBucket[];
}

// ---- Skip Rate Analysis ----
export interface MediaSkipEntry {
  readonly mediaId: MediaId;
  readonly skipCount: number;
  readonly totalApproaches: number;
  readonly rate: number;
}

export interface ZoneSkipEntry {
  readonly zoneId: ZoneId;
  readonly skipCount: number;
  readonly rate: number;
}

export interface SkipRateAnalysis {
  /**
   * @deprecated misleading 의미. visitor 한 명 평균 skip 횟수
   * (totalSkips / totalVisitors). visitor 가 여러 미디어 skip 가능하므로
   * 100% 넘을 수 있고 사용자가 "스킵률" 로 인식하는 진짜 비율 아님.
   * 신규 코드는 `approachSkipRate` 사용. label 으로는 "visitor 당 skip 횟수"
   * 같이 표시해야 misleading 안 함.
   */
  readonly globalSkipRate: number;
  /**
   * 진짜 skip 비율 — totalSkips / totalApproaches.
   * 미디어 도착 시도 중 실제 skip 한 비율 (0~1). 사용자가 "스킵률" 로
   * 직관적으로 기대하는 metric. 위험 신호 / 분석 화면 의 default 표시값.
   */
  readonly approachSkipRate: number;
  readonly perMedia: readonly MediaSkipEntry[];
  readonly perZone: readonly ZoneSkipEntry[];
}

// ---- Group Bottleneck Event ----
export interface GroupBottleneckEvent {
  readonly groupId: GroupId;
  readonly groupType: GroupType;
  readonly zoneId: ZoneId;
  readonly memberCount: number;
  readonly startTimeMs: number;
  readonly durationMs: number;
  readonly severity: 'transient' | 'sustained';
}

// ---- KPI Snapshot ----
export interface KpiSnapshot {
  readonly simulationTimeMs: number;
  readonly floorId: FloorId | null; // null = aggregated across all floors
  readonly zoneUtilizations: readonly ZoneUtilization[];
  readonly bottlenecks: readonly BottleneckIndex[];
  readonly visitDurations: readonly AverageVisitDuration[];
  readonly flowEfficiency: FlowEfficiency;
  readonly fatigueDistribution: FatigueDistribution;
  readonly skipRate: SkipRateAnalysis;
  readonly groupBottlenecks: readonly GroupBottleneckEvent[];
}

// ---- Global KPI Report (multi-floor) ----
export interface InterFloorFlowEntry {
  readonly fromFloorId: FloorId;
  readonly toFloorId: FloorId;
  readonly shaftId: ShaftId;
  readonly visitorCount: number;
  readonly avgTransitTimeMs: number;
}

export interface GlobalKpiReport {
  readonly perFloor: readonly KpiSnapshot[];
  readonly aggregated: KpiSnapshot;
  readonly interFloorFlow: readonly InterFloorFlowEntry[];
}

// ---- KPI Time Series ----
export interface KpiTimeSeriesEntry {
  readonly timestamp: number;
  readonly capturedAt: UnixMs;
  readonly snapshot: KpiSnapshot;
}
