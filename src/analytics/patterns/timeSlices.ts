import type { KpiTimeSeriesEntry } from '@/domain';

// 시뮬레이션을 4 구간 (초반/중반/후반/말) 으로 나눠 핵심 metric 의 시간 추세를 본다.
// "전체 평균" 만으로는 안 보이는 "후반 폭증" / "꾸준히 악화" 같은 패턴 노출이 목적.

export interface TimeSlice {
  readonly index: number;       // 0..3
  readonly label: string;       // 초반/중반/후반/말
  readonly startMs: number;
  readonly endMs: number;
  // metric — null = 데이터 부족
  readonly congestionRatio: number | null;  // 이 구간에서 가장 정체 심한 zone 의 비율 (slice-local)
  readonly skipRate: number | null;         // end-of-slice cumulative
  readonly throughputPerHour: number | null; // end-of-slice
  readonly fatigueMean: number | null;      // end-of-slice
}

export interface TimeSlicePattern {
  readonly slices: readonly TimeSlice[];
  readonly trend: TimeSliceTrend;
}

export type TrendShape =
  | 'flat'         // 변동 미미
  | 'worsening'    // 후반으로 갈수록 악화
  | 'improving'    // 후반으로 갈수록 개선
  | 'late_spike'   // 마지막 구간에서 폭증
  | 'early_spike'  // 초반 폭증 후 안정
  | 'unknown';     // 판정 불가

export interface MetricTrend {
  readonly metric: 'congestion' | 'skip' | 'throughput' | 'fatigue';
  readonly shape: TrendShape;
}

export interface TimeSliceTrend {
  readonly congestion: TrendShape;
  readonly skip: TrendShape;
  readonly throughput: TrendShape;
  readonly fatigue: TrendShape;
  // 가장 두드러진 패턴 1개 (reading 에 사용).
  readonly highlight: MetricTrend | null;
}

const SLICE_LABELS = ['초반', '중반', '후반', '말'] as const;
const NUM_SLICES = 4;

export function computeTimeSlices(
  kpiHistory: readonly KpiTimeSeriesEntry[],
  totalDurationMs: number,
): TimeSlicePattern | null {
  if (kpiHistory.length < 2 || totalDurationMs <= 0) return null;

  const sliceMs = totalDurationMs / NUM_SLICES;
  const slices: TimeSlice[] = [];

  // 각 구간의 start/end 경계에 가장 가까운 snapshot 을 찾는다.
  // simulationTimeMs 오름차순 가정 (pushSnapshot 이 timestamp 로 push).
  const sorted = [...kpiHistory].sort(
    (a, b) => a.snapshot.simulationTimeMs - b.snapshot.simulationTimeMs,
  );

  for (let i = 0; i < NUM_SLICES; i++) {
    const startMs = i * sliceMs;
    const endMs = (i + 1) * sliceMs;

    // 구간 [startMs, endMs] 안에서 마지막 snapshot 을 end 로, 직전 구간의 마지막 (또는 첫 snapshot) 을 start 로.
    const startSnap = findClosestBefore(sorted, startMs) ?? sorted[0];
    const endSnap = findClosestBefore(sorted, endMs) ?? sorted[sorted.length - 1];

    if (!startSnap || !endSnap) {
      slices.push({
        index: i,
        label: SLICE_LABELS[i],
        startMs,
        endMs,
        congestionRatio: null,
        skipRate: null,
        throughputPerHour: null,
        fatigueMean: null,
      });
      continue;
    }

    // 정체 시간% — slice-local: (cumAtEnd - cumAtStart) / sliceDurationMs, 가장 심한 zone.
    const congestionRatio = sliceCongestion(startSnap, endSnap);
    const skipRate = endSnap.snapshot.skipRate.globalSkipRate;
    const throughputPerHour = endSnap.snapshot.flowEfficiency.throughputPerMinute * 60;
    const fatigueMean = endSnap.snapshot.fatigueDistribution.mean;

    slices.push({
      index: i,
      label: SLICE_LABELS[i],
      startMs,
      endMs,
      congestionRatio,
      skipRate,
      throughputPerHour,
      fatigueMean,
    });
  }

  return {
    slices,
    trend: deriveTrends(slices),
  };
}

function findClosestBefore(
  sorted: readonly KpiTimeSeriesEntry[],
  targetMs: number,
): KpiTimeSeriesEntry | null {
  // sorted 가 오름차순일 때 simulationTimeMs <= targetMs 의 마지막 요소.
  let best: KpiTimeSeriesEntry | null = null;
  for (const e of sorted) {
    if (e.snapshot.simulationTimeMs <= targetMs) best = e;
    else break;
  }
  return best;
}

function sliceCongestion(
  startEntry: KpiTimeSeriesEntry,
  endEntry: KpiTimeSeriesEntry,
): number | null {
  const dt = endEntry.snapshot.simulationTimeMs - startEntry.snapshot.simulationTimeMs;
  if (dt <= 0) return null;

  const startMap = new Map<string, number>();
  for (const u of startEntry.snapshot.zoneUtilizations) {
    startMap.set(u.zoneId as string, u.cumulativeCongestedMs);
  }

  let worst = 0;
  for (const u of endEntry.snapshot.zoneUtilizations) {
    const startVal = startMap.get(u.zoneId as string) ?? 0;
    const delta = u.cumulativeCongestedMs - startVal;
    const ratio = Math.max(0, Math.min(1, delta / dt));
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

// 4 구간 시퀀스에서 패턴 형태를 분류.
// 변동 임계 = 절대값 0.05 (5%p) — 작은 변동은 flat 으로 간주.
function classifyShape(
  vals: readonly (number | null)[],
  isHigherWorse: boolean,
): TrendShape {
  const cleaned = vals.filter((v): v is number => v !== null);
  if (cleaned.length < 3) return 'unknown';

  const v0 = vals[0];
  const v3 = vals[3];
  const v2 = vals[2];
  if (v0 === null || v3 === null) return 'unknown';

  const FLAT_THRESHOLD = 0.05;
  const SPIKE_THRESHOLD = 0.15;

  const max = Math.max(...cleaned);
  const min = Math.min(...cleaned);
  const range = max - min;
  if (range < FLAT_THRESHOLD) return 'flat';

  // late_spike: v3 가 최고이면서 v2 보다 SPIKE_THRESHOLD 이상 높을 때.
  if (v2 !== null) {
    if (isHigherWorse && v3 === max && v3 - v2 >= SPIKE_THRESHOLD) return 'late_spike';
    if (!isHigherWorse && v3 === min && v2 - v3 >= SPIKE_THRESHOLD) return 'late_spike';
  }

  // early_spike: v0 가 최고이면서 후반에 안정.
  if (isHigherWorse && v0 === max && v0 - v3 >= SPIKE_THRESHOLD) return 'early_spike';
  if (!isHigherWorse && v0 === min && v3 - v0 >= SPIKE_THRESHOLD) return 'early_spike';

  // worsening / improving: 끝이 시작보다 충분히 변했으면.
  const dirDelta = isHigherWorse ? v3 - v0 : v0 - v3;
  if (dirDelta >= FLAT_THRESHOLD) return 'worsening';
  if (-dirDelta >= FLAT_THRESHOLD) return 'improving';

  return 'flat';
}

function deriveTrends(slices: readonly TimeSlice[]): TimeSliceTrend {
  const congestion = classifyShape(slices.map((s) => s.congestionRatio), true);
  const skip = classifyShape(slices.map((s) => s.skipRate), true);
  // throughput 은 normalize 가 어려우므로 "flat / worsening / improving" 만 본다.
  // 시간당 처리는 보통 100 단위 — 5% 임계 적용하려면 정규화 필요. 임시로 ratio scale 사용.
  const throughputVals = slices.map((s) => s.throughputPerHour);
  const tMax = Math.max(...throughputVals.filter((v): v is number => v !== null), 1);
  const throughput = classifyShape(
    throughputVals.map((v) => (v === null ? null : v / tMax)),
    false, // throughput 은 높을수록 좋음
  );
  const fatigue = classifyShape(slices.map((s) => s.fatigueMean), true);

  // highlight = 가장 "위험" 한 패턴.
  // 우선순위: late_spike > worsening > early_spike > improving > flat > unknown.
  const trends: MetricTrend[] = [
    { metric: 'congestion', shape: congestion },
    { metric: 'skip', shape: skip },
    { metric: 'fatigue', shape: fatigue },
    { metric: 'throughput', shape: throughput },
  ];
  const priority: Record<TrendShape, number> = {
    late_spike: 4,
    worsening: 3,
    early_spike: 2,
    improving: 1,
    flat: 0,
    unknown: -1,
  };
  trends.sort((a, b) => priority[b.shape] - priority[a.shape]);
  const highlight = trends[0].shape === 'flat' || trends[0].shape === 'unknown' ? null : trends[0];

  return { congestion, skip, throughput, fatigue, highlight };
}
