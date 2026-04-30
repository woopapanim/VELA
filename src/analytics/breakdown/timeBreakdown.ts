import type {
  KpiTimeSeriesEntry,
  ZoneConfig,
  MediaPlacement,
} from '@/domain';
import type { TimeSlicePattern, TimeSlice } from '@/analytics/patterns/timeSlices';

// 단일 시간 구간 (초반/중반/후반/말) 의 "왜 이 시간대인가" breakdown.
// TimeSection 의 slice 컬럼 클릭 → 이 결과로 답을 채운다.

export interface TimeBreakdownZoneRow {
  readonly zoneId: string;
  readonly zoneName: string;
  readonly congestionRatio: number;       // slice-local 0–1
  readonly congestedMs: number;           // 이 슬라이스 동안 congested 누적
}

export interface TimeBreakdownMediaRow {
  readonly mediaId: string;
  readonly name: string;
  readonly skipCountDelta: number;        // 이 슬라이스에서 늘어난 skip
  readonly approachesDelta: number;       // 이 슬라이스에서 늘어난 approach
  readonly sliceSkipRate: number;         // delta 기반 0–1
}

export interface TimeBreakdown {
  readonly index: number;                 // 0..3
  readonly label: string;                 // 초반/중반/후반/말
  readonly startMs: number;
  readonly endMs: number;
  readonly sliceDurationMs: number;

  // ── 정량 (slice-local 또는 end-of-slice) ──
  readonly congestionRatio: number | null;
  readonly skipRate: number | null;          // cumulative end-of-slice
  readonly throughputPerHour: number | null;
  readonly fatigueMean: number | null;

  // ── 다른 슬라이스 평균 대비 편차 (절대값 차이) ──
  // null = 비교 데이터 부족.
  readonly congestionVsAvg: number | null;
  readonly skipVsAvg: number | null;
  readonly throughputVsAvg: number | null;
  readonly fatigueVsAvg: number | null;

  // ── 분해 — top N (정체/skip 기준) ──
  readonly zoneRows: readonly TimeBreakdownZoneRow[];
  readonly mediaRows: readonly TimeBreakdownMediaRow[];

  // ── reading 1줄 ──
  readonly reading: string;
}

export function computeTimeBreakdown(args: {
  sliceIndex: number;
  pattern: TimeSlicePattern;
  kpiHistory: readonly KpiTimeSeriesEntry[];
  zones: readonly ZoneConfig[];
  media: readonly MediaPlacement[];
}): TimeBreakdown | null {
  const { sliceIndex, pattern, kpiHistory, zones, media } = args;
  const slice = pattern.slices[sliceIndex];
  if (!slice) return null;

  const sorted = [...kpiHistory].sort(
    (a, b) => a.snapshot.simulationTimeMs - b.snapshot.simulationTimeMs,
  );
  if (sorted.length < 2) return null;

  const startSnap = findClosestBefore(sorted, slice.startMs) ?? sorted[0];
  const endSnap = findClosestBefore(sorted, slice.endMs) ?? sorted[sorted.length - 1];
  const sliceDurationMs = Math.max(1, endSnap.snapshot.simulationTimeMs - startSnap.snapshot.simulationTimeMs);

  // ── zone-level slice congestion ──
  const startZoneMap = new Map<string, number>();
  for (const u of startSnap.snapshot.zoneUtilizations) {
    startZoneMap.set(u.zoneId as string, u.cumulativeCongestedMs);
  }
  const zoneRows: TimeBreakdownZoneRow[] = endSnap.snapshot.zoneUtilizations
    .map((u) => {
      const zid = u.zoneId as string;
      const startVal = startZoneMap.get(zid) ?? 0;
      const congestedMs = Math.max(0, u.cumulativeCongestedMs - startVal);
      const ratio = Math.max(0, Math.min(1, congestedMs / sliceDurationMs));
      const z = zones.find((zz) => (zz.id as string) === zid);
      return {
        zoneId: zid,
        zoneName: z?.name ?? zid,
        congestionRatio: ratio,
        congestedMs,
      };
    })
    .filter((r) => r.congestionRatio > 0)
    .sort((a, b) => b.congestionRatio - a.congestionRatio)
    .slice(0, 5);

  // ── media skip delta ──
  const startMediaMap = new Map<string, { skip: number; approaches: number }>();
  for (const m of startSnap.snapshot.skipRate.perMedia) {
    startMediaMap.set(m.mediaId as string, { skip: m.skipCount, approaches: m.totalApproaches });
  }
  const mediaRows: TimeBreakdownMediaRow[] = endSnap.snapshot.skipRate.perMedia
    .map((m) => {
      const mid = m.mediaId as string;
      const start = startMediaMap.get(mid) ?? { skip: 0, approaches: 0 };
      const skipCountDelta = Math.max(0, m.skipCount - start.skip);
      const approachesDelta = Math.max(0, m.totalApproaches - start.approaches);
      const sliceSkipRate = approachesDelta > 0 ? skipCountDelta / approachesDelta : 0;
      const mm = media.find((x) => (x.id as string) === mid);
      return {
        mediaId: mid,
        name: mm?.name ?? mid,
        skipCountDelta,
        approachesDelta,
        sliceSkipRate,
      };
    })
    .filter((r) => r.skipCountDelta > 0)
    .sort((a, b) => b.skipCountDelta - a.skipCountDelta)
    .slice(0, 5);

  // ── vs 다른 slice 평균 ──
  const otherSlices = pattern.slices.filter((s) => s.index !== sliceIndex);
  const congestionVsAvg = deltaVsAvg(slice.congestionRatio, otherSlices.map((s) => s.congestionRatio));
  const skipVsAvg = deltaVsAvg(slice.skipRate, otherSlices.map((s) => s.skipRate));
  const throughputVsAvg = deltaVsAvg(slice.throughputPerHour, otherSlices.map((s) => s.throughputPerHour));
  const fatigueVsAvg = deltaVsAvg(slice.fatigueMean, otherSlices.map((s) => s.fatigueMean));

  const reading = buildTimeReading({
    label: slice.label,
    congestionRatio: slice.congestionRatio,
    congestionVsAvg,
    skipVsAvg,
    fatigueVsAvg,
    topZone: zoneRows[0],
    topMedia: mediaRows[0],
  });

  return {
    index: slice.index,
    label: slice.label,
    startMs: slice.startMs,
    endMs: slice.endMs,
    sliceDurationMs,
    congestionRatio: slice.congestionRatio,
    skipRate: slice.skipRate,
    throughputPerHour: slice.throughputPerHour,
    fatigueMean: slice.fatigueMean,
    congestionVsAvg,
    skipVsAvg,
    throughputVsAvg,
    fatigueVsAvg,
    zoneRows,
    mediaRows,
    reading,
  };
}

function findClosestBefore(
  sorted: readonly KpiTimeSeriesEntry[],
  targetMs: number,
): KpiTimeSeriesEntry | null {
  let best: KpiTimeSeriesEntry | null = null;
  for (const e of sorted) {
    if (e.snapshot.simulationTimeMs <= targetMs) best = e;
    else break;
  }
  return best;
}

function deltaVsAvg(
  current: number | null,
  others: readonly (number | null)[],
): number | null {
  if (current === null || !Number.isFinite(current)) return null;
  const valid = others.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length === 0) return null;
  const avg = valid.reduce((s, v) => s + v, 0) / valid.length;
  return current - avg;
}

function buildTimeReading(args: {
  label: string;
  congestionRatio: number | null;
  congestionVsAvg: number | null;
  skipVsAvg: number | null;
  fatigueVsAvg: number | null;
  topZone: TimeBreakdownZoneRow | undefined;
  topMedia: TimeBreakdownMediaRow | undefined;
}): string {
  const { label, congestionRatio, congestionVsAvg, skipVsAvg, fatigueVsAvg, topZone, topMedia } = args;
  const reasons: string[] = [];

  if (congestionRatio !== null && congestionRatio >= 0.25) {
    reasons.push(`정체 ${Math.round(congestionRatio * 100)}%`);
  }
  if (congestionVsAvg !== null && congestionVsAvg >= 0.10) {
    reasons.push(`평균 대비 +${Math.round(congestionVsAvg * 100)}%p`);
  } else if (congestionVsAvg !== null && congestionVsAvg <= -0.10) {
    reasons.push(`평균 대비 ${Math.round(congestionVsAvg * 100)}%p`);
  }
  if (skipVsAvg !== null && skipVsAvg >= 0.10) {
    reasons.push(`스킵률 +${Math.round(skipVsAvg * 100)}%p`);
  }
  if (fatigueVsAvg !== null && fatigueVsAvg >= 0.10) {
    reasons.push(`피로도 +${Math.round(fatigueVsAvg * 100)}%p`);
  }
  if (topZone && topZone.congestionRatio >= 0.20) {
    reasons.push(`${topZone.zoneName} 정체 ${Math.round(topZone.congestionRatio * 100)}%`);
  }
  if (topMedia && topMedia.skipCountDelta >= 3) {
    reasons.push(`${topMedia.name} skip +${topMedia.skipCountDelta}`);
  }

  if (reasons.length === 0) return `${label} 구간 — 주요 위험 신호 없음.`;
  return `${label} — ${reasons.join(' · ')}`;
}
