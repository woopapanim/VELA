import type { Vector2D, ZoneId } from './common';

export interface HeatmapConfig {
  readonly gridResolution: number; // cell size (px), default 4
  readonly gaussianSigma: number; // default 20
  readonly gaussianRadius: number; // default 40
  readonly decayRate: number; // fade-out per tick, default 0.95
  readonly bottleneckThreshold: number; // deep red threshold, default 0.8
}

export interface HeatmapData {
  readonly realtimeDensity: Float32Array;
  readonly cumulativeEngagement: Float32Array;
  readonly gridWidth: number;
  readonly gridHeight: number;
}

export interface BottleneckCluster {
  readonly centroid: Vector2D;
  readonly area: number; // m²
  readonly avgDensity: number; // 0-1
  readonly peakDensity: number;
  readonly affectedZoneIds: readonly ZoneId[];
  readonly severity: 'warning' | 'critical';
}
