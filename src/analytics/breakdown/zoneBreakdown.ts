import type {
  KpiSnapshot,
  KpiTimeSeriesEntry,
  ZoneConfig,
  Visitor,
  MediaPlacement,
} from '@/domain';

// 단일 zone 의 "왜 이 zone 이 위험한가" breakdown.
// space hotspot row 클릭 → 이 결과로 답을 채운다.

export interface ZoneBreakdownMediaRow {
  readonly mediaId: string;
  readonly name: string;
  readonly skipRate: number;       // 0–1
  readonly skipCount: number;
  readonly totalApproaches: number;
}

export interface ZoneBreakdown {
  readonly zoneId: string;
  readonly zoneName: string;

  // ── 정량 지표 ──
  readonly areaM2: number;
  readonly capacity: number;
  readonly peakOccupancy: number;
  readonly peakRatio: number;            // peakOccupancy / capacity
  readonly currentOccupancy: number;
  readonly cumulativeCongestedMs: number;
  readonly congestionRatio: number;      // 0–1
  readonly bottleneckScore: number;      // 0–1
  readonly bottleneckAvgQueueTimeMs: number;
  readonly bottleneckFlowIn: number;
  readonly bottleneckFlowOut: number;

  // ── 방문 통계 ──
  readonly visitCount: number;           // exited 방문자 중 이 zone 방문한 수
  readonly avgDwellMs: number;           // 이 zone 의 평균 체류 시간
  readonly visitFraction: number;        // 0–1, 이 zone 방문자 / 전체 exited

  // ── 미디어 분해 ──
  readonly mediaCount: number;
  readonly mediaSkips: readonly ZoneBreakdownMediaRow[]; // skip rate 높은 순

  // ── 시간 — 정체 추이 ──
  readonly congestionOverTime: readonly { tMs: number; ratio: number }[];

  // ── reading 1줄 ──
  readonly reading: string;
}

export function computeZoneBreakdown(args: {
  zoneId: string;
  zone: ZoneConfig;
  latestSnapshot: KpiSnapshot;
  kpiHistory: readonly KpiTimeSeriesEntry[];
  visitors: readonly Visitor[];
  media: readonly MediaPlacement[];
  totalExited: number;
}): ZoneBreakdown {
  const { zoneId, zone, latestSnapshot, kpiHistory, visitors, media, totalExited } = args;
  const totalMs = latestSnapshot.simulationTimeMs || 1;

  const u = latestSnapshot.zoneUtilizations.find((x) => (x.zoneId as string) === zoneId);
  const b = latestSnapshot.bottlenecks.find((x) => (x.zoneId as string) === zoneId);
  const visitDur = latestSnapshot.visitDurations.find((x) => (x.zoneId as string) === zoneId);

  const peakBottleneck = kpiHistory.reduce((best, h) => {
    const bb = h.snapshot.bottlenecks.find((x) => (x.zoneId as string) === zoneId);
    return bb && bb.score > best ? bb.score : best;
  }, b?.score ?? 0);

  // exited 방문자 중 이 zone 을 방문한 수.
  const exited = visitors.filter((v) => !v.isActive);
  const visitedHere = exited.filter((v) =>
    v.visitedZoneIds.some((zid) => (zid as string) === zoneId),
  );
  const visitCount = visitedHere.length;
  const visitFraction = totalExited > 0 ? visitCount / totalExited : 0;

  // 미디어 skip — perMedia 중 이 zone 의 mediaIds 만.
  const zoneMediaIds = new Set<string>(zone.mediaIds as readonly string[]);
  const mediaSkips: ZoneBreakdownMediaRow[] = latestSnapshot.skipRate.perMedia
    .filter((m) => zoneMediaIds.has(m.mediaId as string))
    .map((m) => ({
      mediaId: m.mediaId as string,
      name: media.find((mm) => (mm.id as string) === (m.mediaId as string))?.name ?? '—',
      skipRate: m.rate,
      skipCount: m.skipCount,
      totalApproaches: m.totalApproaches,
    }))
    .sort((a, b) => b.skipRate - a.skipRate);

  // 시간 추이 — kpiHistory 의 snapshot 마다 cumulativeCongestedMs / simulationTimeMs.
  const congestionOverTime = kpiHistory
    .map((h) => {
      const uu = h.snapshot.zoneUtilizations.find((x) => (x.zoneId as string) === zoneId);
      const tMs = h.snapshot.simulationTimeMs;
      if (!uu || tMs <= 0) return null;
      return { tMs, ratio: Math.max(0, Math.min(1, uu.cumulativeCongestedMs / tMs)) };
    })
    .filter((x): x is { tMs: number; ratio: number } => x !== null);

  const peakOccupancy = u?.peakOccupancy ?? 0;
  const capacity = u?.capacity ?? zone.capacity;
  const peakRatio = capacity > 0 ? peakOccupancy / capacity : 0;
  const cumulativeCongestedMs = u?.cumulativeCongestedMs ?? 0;
  const congestionRatio = Math.max(0, Math.min(1, cumulativeCongestedMs / totalMs));

  const reading = buildReading({
    congestionRatio,
    peakRatio,
    bottleneckScore: peakBottleneck,
    topSkipRate: mediaSkips[0]?.skipRate ?? 0,
    visitFraction,
  });

  return {
    zoneId,
    zoneName: zone.name ?? zoneId,
    areaM2: zone.area,
    capacity,
    peakOccupancy,
    peakRatio,
    currentOccupancy: u?.currentOccupancy ?? 0,
    cumulativeCongestedMs,
    congestionRatio,
    bottleneckScore: peakBottleneck,
    bottleneckAvgQueueTimeMs: b?.avgQueueTime ?? 0,
    bottleneckFlowIn: b?.flowInRate ?? 0,
    bottleneckFlowOut: b?.flowOutRate ?? 0,
    visitCount,
    avgDwellMs: visitDur?.meanDurationMs ?? 0,
    visitFraction,
    mediaCount: zone.mediaIds.length,
    mediaSkips,
    congestionOverTime,
    reading,
  };
}

function buildReading(args: {
  congestionRatio: number;
  peakRatio: number;
  bottleneckScore: number;
  topSkipRate: number;
  visitFraction: number;
}): string {
  const { congestionRatio, peakRatio, bottleneckScore, topSkipRate, visitFraction } = args;
  const reasons: string[] = [];
  if (congestionRatio >= 0.25) reasons.push(`정체 시간 ${Math.round(congestionRatio * 100)}%`);
  else if (congestionRatio >= 0.10) reasons.push(`정체 시간 ${Math.round(congestionRatio * 100)}% (주의)`);

  if (peakRatio >= 0.9) reasons.push(`피크 점유 ${Math.round(peakRatio * 100)}% — 거의 만석`);
  else if (peakRatio >= 0.7) reasons.push(`피크 점유 ${Math.round(peakRatio * 100)}%`);

  if (bottleneckScore >= 0.8) reasons.push(`병목 score ${bottleneckScore.toFixed(2)} — 흐름 단절`);
  else if (bottleneckScore >= 0.6) reasons.push(`병목 score ${bottleneckScore.toFixed(2)}`);

  if (topSkipRate >= 0.5) reasons.push(`최다 skip 미디어 ${Math.round(topSkipRate * 100)}%`);

  if (visitFraction < 0.3 && visitFraction > 0) {
    reasons.push(`방문률 ${Math.round(visitFraction * 100)}% — dead zone 의심`);
  }

  if (reasons.length === 0) return '주요 위험 신호 없음. 다른 zone 비교 검토.';
  return reasons.join(' · ');
}
