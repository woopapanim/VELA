import { Layout, Image, Users, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { KpiSnapshot, KpiTimeSeriesEntry, ZoneConfig, MediaPlacement } from '@/domain';
import {
  NORMS,
  evaluateNorm,
  deriveConfidence,
  type Confidence,
  type NormStatus,
} from '@/analytics/norms';
import { PerspectiveCard } from './PerspectiveCard';
import type { PerspectiveMetric, PerspectiveTrend } from './types';

export interface EntryStatsCardInput {
  readonly totalArrived: number;
  readonly totalAdmitted: number;
  readonly totalAbandoned: number;
  readonly avgAdmitWaitMs: number;
  readonly rejectionRate: number;
}

interface CardProps {
  snapshot: KpiSnapshot | null;
  zones: readonly ZoneConfig[];
  media: readonly MediaPlacement[];
  totalSpawned: number;
  totalExited: number;
  fatigueMean: number;
  entryStats?: EntryStatsCardInput;
  /** Hero card trend (sparkline) — kpiHistory 에서 추출. */
  kpiHistory?: readonly KpiTimeSeriesEntry[];
  onDrilldown?: () => void;
}

// 시계열에서 sparkline-friendly 16-point 다운샘플.
function downsample<T>(arr: readonly T[], target: number): T[] {
  if (arr.length <= target) return [...arr];
  const out: T[] = [];
  for (let i = 0; i < target; i++) {
    const idx = Math.floor((i / (target - 1)) * (arr.length - 1));
    out.push(arr[idx]);
  }
  return out;
}

// Sparkline-friendly trend classifier — start vs end 비교만으로 단순화 (flat/worsening/improving).
// timeSlices.ts 의 classifyShape 는 4-slice 입력 + late_spike/early_spike 까지 분류하는 별도 변형.
// 16-point downsample 입력에는 spike 검출이 노이즈에 약해서 단순 분류만 사용.
function classifySparklineShape(
  values: readonly number[],
  higherIsWorse: boolean,
): 'flat' | 'worsening' | 'improving' | 'unknown' {
  if (values.length < 3) return 'unknown';
  const v0 = values[0];
  const vN = values[values.length - 1];
  const delta = vN - v0;
  const FLAT = Math.max(0.05, Math.abs(v0) * 0.1);
  if (Math.abs(delta) < FLAT) return 'flat';
  const worse = higherIsWorse ? delta > 0 : delta < 0;
  return worse ? 'worsening' : 'improving';
}

// ── 카드 status 집계용 (PerspectiveCard 내부에서도 동일 logic; 여기선 verdict 산출용으로 export) ──
function aggregateStatuses(metrics: readonly PerspectiveMetric[]): NormStatus {
  if (metrics.length === 0) return 'unknown';
  if (metrics.some((m) => m.status === 'bad')) return 'bad';
  if (metrics.some((m) => m.status === 'warn')) return 'warn';
  if (metrics.every((m) => m.status === 'unknown')) return 'unknown';
  return 'good';
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// ─────────────────────────────────────────────────────────────────────
// 1. 공간 체험 관점
// ─────────────────────────────────────────────────────────────────────
export function computeSpaceMetrics(props: CardProps): {
  metrics: PerspectiveMetric[];
  reading: string;
  confidence: Confidence;
  status: NormStatus;
} {
  const { snapshot, zones } = props;
  if (!snapshot || zones.length === 0) {
    return {
      metrics: [],
      reading: '시뮬레이션 데이터가 아직 없습니다.',
      confidence: 'low',
      status: 'unknown',
    };
  }

  // peak ratio = max(zoneUtilizations 의 peakOcc/capacity)
  let peakRatio = 0;
  let peakZoneId = '';
  for (const u of snapshot.zoneUtilizations) {
    if (u.capacity <= 0) continue;
    const r = u.peakOccupancy / u.capacity;
    if (r > peakRatio) {
      peakRatio = r;
      peakZoneId = u.zoneId as string;
    }
  }
  const peakStatus = evaluateNorm(NORMS.peak_ratio, peakRatio);

  // Step 2: 피크 시점 인당 면적 — 가장 붐빈 zone 기준 m²/person.
  // peakOccupancy 가 0 이면 (방문 없음) unknown.
  let worstAreaPerPerson = Infinity;
  let worstAreaZoneId = '';
  for (const u of snapshot.zoneUtilizations) {
    if (u.peakOccupancy <= 0) continue;
    const zone = zones.find((z) => z.id === u.zoneId);
    if (!zone || zone.area <= 0) continue;
    const m2 = zone.area / u.peakOccupancy;
    if (m2 < worstAreaPerPerson) {
      worstAreaPerPerson = m2;
      worstAreaZoneId = u.zoneId as string;
    }
  }
  const hasAreaData = worstAreaPerPerson !== Infinity;
  const areaStatus: NormStatus = hasAreaData
    ? evaluateNorm(NORMS.area_per_person_peak, worstAreaPerPerson)
    : 'unknown';

  // 공간 효율 = avg(zone peak ratio) — 평균이 너무 낮으면 dead zone 다수.
  let utilSum = 0;
  let utilCount = 0;
  let deadCount = 0;
  for (const u of snapshot.zoneUtilizations) {
    if (u.capacity <= 0) continue;
    const r = u.peakOccupancy / u.capacity;
    utilSum += r;
    utilCount++;
    if (r < NORMS.zone_utilization.warnAt) deadCount++;
  }
  const avgUtil = utilCount > 0 ? utilSum / utilCount : 0;
  const utilStatus = evaluateNorm(NORMS.zone_utilization, avgUtil);

  const metrics: PerspectiveMetric[] = [
    {
      label: '최대 점유율',
      displayValue: pct(peakRatio),
      norm: NORMS.peak_ratio,
      status: peakStatus,
    },
    {
      label: '피크 인당 면적',
      displayValue: hasAreaData ? `${worstAreaPerPerson.toFixed(1)} m²` : '—',
      norm: hasAreaData ? NORMS.area_per_person_peak : undefined,
      status: areaStatus,
    },
    {
      label: '평균 활용도',
      displayValue: pct(avgUtil),
      norm: NORMS.zone_utilization,
      status: utilStatus,
    },
    {
      label: '저활용 zone',
      displayValue: `${deadCount} / ${utilCount}`,
      status: deadCount > utilCount * 0.5 ? 'bad' : deadCount > 0 ? 'warn' : 'good',
    },
  ];

  const status = aggregateStatuses(metrics);
  const reading = readSpaceReading({
    peakStatus, utilStatus, areaStatus,
    deadCount, peakZoneId, worstAreaZoneId,
    worstAreaPerPerson: hasAreaData ? worstAreaPerPerson : null,
    zones,
  });
  const confidence = deriveConfidence({ sourceKind: 'self', status });

  return { metrics, reading, confidence, status };
}

function readSpaceReading(opts: {
  peakStatus: NormStatus;
  utilStatus: NormStatus;
  areaStatus: NormStatus;
  deadCount: number;
  peakZoneId: string;
  worstAreaZoneId: string;
  worstAreaPerPerson: number | null;
  zones: readonly ZoneConfig[];
}): string {
  // narrative = "관측 — 의미 — 조치" 3-요소. hero 카드에서 충분한 분량 확보 (2026-04-30).
  const peakName = opts.zones.find((z) => z.id === opts.peakZoneId)?.name ?? '—';
  const areaName = opts.zones.find((z) => z.id === opts.worstAreaZoneId)?.name ?? '—';
  if (opts.areaStatus === 'bad' && opts.worstAreaPerPerson !== null) {
    return `${areaName} 피크 인당 면적이 ${opts.worstAreaPerPerson.toFixed(1)}m² — 안전 기준(1.0m²) 미만으로 인파 위험. 동선 분산이나 zone capacity 재조정을 우선 검토.`;
  }
  if (opts.peakStatus === 'bad') {
    return `${peakName} 에서 점유율이 한계 근접. 단일 시점에 사람이 쏠리는 패턴이며, 동선 분산 또는 면적 검토가 필요한 신호.`;
  }
  if (opts.areaStatus === 'warn' && opts.worstAreaPerPerson !== null) {
    return `${areaName} 피크 인당 면적이 ${opts.worstAreaPerPerson.toFixed(1)}m² — 권장(1.5m²) 이하. 체감 정체 가능성이 있어 미디어 placement 또는 timing 조정으로 분산 유도.`;
  }
  if (opts.peakStatus === 'warn') {
    return `${peakName} 에 사람이 몰리는 경향이 있어 단기 정체 가능. 시간대별 분포 확인 후 spawn 패턴이나 동선 우회 검토.`;
  }
  if (opts.utilStatus === 'bad') {
    return `${opts.deadCount}개 zone 이 거의 비어있음 — 진입 동기가 약하거나 동선이 단절된 가능성. 비활성 zone 의 visit fraction 분해 후 동선/미디어 재배치.`;
  }
  if (opts.utilStatus === 'warn') {
    return '일부 zone 활용도가 낮음. 빈 zone 의 시간대별 occupancy 를 보고 동선 흐름 재검토 가치 있음.';
  }
  return '공간 점유와 활용 모두 안정 범위. 현재 layout 으로 spawn·visit 분포 적정.';
}

// ─────────────────────────────────────────────────────────────────────
// 2. 작품 관람 관점
// ─────────────────────────────────────────────────────────────────────
export function computeArtworkMetrics(props: CardProps): {
  metrics: PerspectiveMetric[];
  reading: string;
  confidence: Confidence;
  status: NormStatus;
} {
  const { snapshot, media } = props;
  if (!snapshot || media.length === 0) {
    return {
      metrics: [],
      reading: '미디어 데이터가 아직 없습니다.',
      confidence: 'low',
      status: 'unknown',
    };
  }

  const skipRate = snapshot.skipRate.globalSkipRate;
  const skipStatus = evaluateNorm(NORMS.skip_rate, skipRate);

  // 미관람 media 비율 — perMedia 의 totalApproaches=0 인 항목.
  const approachedMediaIds = new Set(
    snapshot.skipRate.perMedia
      .filter((m) => m.totalApproaches > 0)
      .map((m) => m.mediaId as string),
  );
  const unvisited = media.length - approachedMediaIds.size;
  const unvisitedRatio = media.length > 0 ? unvisited / media.length : 0;

  const metrics: PerspectiveMetric[] = [
    {
      label: '평균 스킵률',
      displayValue: pct(skipRate),
      norm: NORMS.skip_rate,
      status: skipStatus,
    },
    {
      label: '미접근 작품',
      displayValue: `${unvisited} / ${media.length}`,
      status: unvisitedRatio > 0.5 ? 'bad' : unvisitedRatio > 0.25 ? 'warn' : 'good',
    },
    {
      label: '관람 작품 수',
      displayValue: `${approachedMediaIds.size}`,
      status: 'unknown',
    },
  ];

  const status = aggregateStatuses(metrics);
  const reading = readArtworkReading({ skipStatus, unvisitedRatio });
  const confidence = deriveConfidence({ sourceKind: 'self', status });

  return { metrics, reading, confidence, status };
}

function readArtworkReading(opts: { skipStatus: NormStatus; unvisitedRatio: number }): string {
  if (opts.skipStatus === 'bad') {
    return '관람 의도가 절반 이상 무산되는 수준. capacity 부족·길이 부담·접근성 중 어느 요인인지 미디어별 분해로 식별 후 위치·길이·인기도 분포 재검토.';
  }
  if (opts.skipStatus === 'warn') {
    return '스킵률이 권장보다 높은 편. 특정 미디어가 끌어내고 있는지, 또는 동선 진입 단계에서 의도 형성이 약한지 미디어별 drilldown 으로 점검.';
  }
  if (opts.unvisitedRatio > 0.5) {
    return '절반 이상의 작품이 한 번도 접근되지 않음 — 동선이 일부 작품에 도달하지 못하는 구조적 문제. zone graph edge 또는 미디어 배치 재검토 필요.';
  }
  if (opts.unvisitedRatio > 0.25) {
    return '미접근 작품이 다수. 동선상 사각지대 또는 진입부 차단 가능성. zone-별 visit count 분포 확인.';
  }
  return '작품 도달과 관람 의도 모두 안정 범위. 현재 미디어 배치로 의도 형성과 도달이 균형.';
}

// ─────────────────────────────────────────────────────────────────────
// 3. 운영 관점
// ─────────────────────────────────────────────────────────────────────
export function computeOperationsMetrics(props: CardProps): {
  metrics: PerspectiveMetric[];
  reading: string;
  confidence: Confidence;
  status: NormStatus;
} {
  const { snapshot, totalSpawned, totalExited, fatigueMean } = props;
  if (!snapshot || totalSpawned === 0) {
    return {
      metrics: [],
      reading: '시뮬레이션 데이터가 아직 없습니다.',
      confidence: 'low',
      status: 'unknown',
    };
  }

  const completion = snapshot.flowEfficiency.completionRate;
  const completionStatus = evaluateNorm(NORMS.completion_rate, completion);
  const fatigueStatus = evaluateNorm(NORMS.fatigue_mean, fatigueMean);
  const throughput = snapshot.flowEfficiency.throughputPerMinute;
  const avgTimeMin = snapshot.flowEfficiency.averageTotalTimeMs / 60_000;

  const metrics: PerspectiveMetric[] = [
    {
      label: '완주율',
      displayValue: pct(completion),
      norm: NORMS.completion_rate,
      status: completionStatus,
    },
    {
      label: '평균 피로도',
      displayValue: pct(fatigueMean),
      norm: NORMS.fatigue_mean,
      status: fatigueStatus,
    },
    {
      label: '시간당 처리',
      displayValue: `${(throughput * 60).toFixed(0)} /h`,
      status: 'unknown',
    },
    {
      label: '평균 체류',
      displayValue: avgTimeMin > 0 ? `${avgTimeMin.toFixed(1)} 분` : '—',
      status: 'unknown',
    },
    {
      label: '입퇴장',
      displayValue: `${totalSpawned}→${totalExited}`,
      status: 'unknown',
    },
  ];

  const status = aggregateStatuses(metrics);
  const reading = readOperationsReading({ completionStatus, fatigueStatus });
  const confidence = deriveConfidence({ sourceKind: 'mode_default', status });

  return { metrics, reading, confidence, status };
}

function readOperationsReading(opts: {
  completionStatus: NormStatus;
  fatigueStatus: NormStatus;
}): string {
  if (opts.completionStatus === 'bad') {
    return '완주율이 낮음 — 진입 단계 또는 중간 zone 에서 이탈하는 패턴이 강함. zone-별 visit fraction 으로 이탈 지점 식별 후 동선 단축 또는 휴식 zone 추가 검토.';
  }
  if (opts.fatigueStatus === 'bad') {
    return '피로도 누적이 높음 — 동선이 길거나 정체가 누적되어 후반부 관람 품질 저하. 시간 패턴 sparkline 으로 누적 시점 확인 후 동선 길이/속도 조정.';
  }
  if (opts.completionStatus === 'warn' || opts.fatigueStatus === 'warn') {
    return '운영 지표가 권장보다 다소 낮음. 완주·피로의 시간 추세를 보고 빈약한 구간을 부분 검토할 가치.';
  }
  return '처리량·완주·피로 모두 안정 운영 범위. 현재 동선/속도 설정으로 부담 없이 관람 진행.';
}

// ─────────────────────────────────────────────────────────────────────
// 4. 위험·마찰 관점
// ─────────────────────────────────────────────────────────────────────
export function computeRiskMetrics(props: CardProps): {
  metrics: PerspectiveMetric[];
  reading: string;
  confidence: Confidence;
  status: NormStatus;
} {
  const { snapshot, zones, entryStats } = props;
  if (!snapshot) {
    return {
      metrics: [],
      reading: '시뮬레이션 데이터가 아직 없습니다.',
      confidence: 'low',
      status: 'unknown',
    };
  }

  // 병목 score 최대값 + 임계 초과 zone 수.
  let topScore = 0;
  let topZoneId = '';
  let bottleneckCount = 0;
  for (const b of snapshot.bottlenecks) {
    if (b.score > topScore) {
      topScore = b.score;
      topZoneId = b.zoneId as string;
    }
    if (b.score >= NORMS.bottleneck_score.goodAt) bottleneckCount++;
  }
  const topStatus = evaluateNorm(NORMS.bottleneck_score, topScore);

  // Step 2 (2026-04-30): zone 별 누적 정체 시간 비율 — 가장 오래 정체였던 zone 기준.
  // simulationTimeMs <= 0 이면 unknown (시뮬레이션 시작 전).
  let worstCongestionRatio = 0;
  let worstCongestionZoneId = '';
  if (snapshot.simulationTimeMs > 0) {
    for (const u of snapshot.zoneUtilizations) {
      const ratio = u.cumulativeCongestedMs / snapshot.simulationTimeMs;
      if (ratio > worstCongestionRatio) {
        worstCongestionRatio = ratio;
        worstCongestionZoneId = u.zoneId as string;
      }
    }
  }
  const hasCongestionData = snapshot.simulationTimeMs > 0;
  const congestionStatus: NormStatus = hasCongestionData
    ? evaluateNorm(NORMS.congestion_time_ratio, worstCongestionRatio)
    : 'unknown';

  const metrics: PerspectiveMetric[] = [
    {
      label: '최고 병목 score',
      displayValue: topScore.toFixed(2),
      norm: NORMS.bottleneck_score,
      status: topStatus,
    },
    {
      label: '정체 시간%',
      displayValue: hasCongestionData ? pct(worstCongestionRatio) : '—',
      norm: hasCongestionData ? NORMS.congestion_time_ratio : undefined,
      status: congestionStatus,
    },
    {
      label: '병목 zone 수',
      displayValue: `${bottleneckCount}`,
      status: bottleneckCount >= 3 ? 'bad' : bottleneckCount >= 1 ? 'warn' : 'good',
    },
  ];

  // Step 2 (2026-04-30): 외부 입장 큐 — EntryController 활성 시나리오만 의미 있음.
  // totalArrived=0 이면 EntryController 가 비활성 → 두 metric 모두 unknown.
  const hasEntryData = !!entryStats && entryStats.totalArrived > 0;
  const rejectionStatus: NormStatus = hasEntryData
    ? evaluateNorm(NORMS.entry_rejection_rate, entryStats!.rejectionRate)
    : 'unknown';
  const waitStatus: NormStatus = hasEntryData && entryStats!.avgAdmitWaitMs > 0
    ? evaluateNorm(NORMS.entry_avg_wait_ms, entryStats!.avgAdmitWaitMs)
    : 'unknown';

  metrics.push({
    label: '입장 거절율',
    displayValue: hasEntryData ? pct(entryStats!.rejectionRate) : '—',
    norm: hasEntryData ? NORMS.entry_rejection_rate : undefined,
    status: rejectionStatus,
  });
  metrics.push({
    label: '평균 대기',
    displayValue: hasEntryData && entryStats!.avgAdmitWaitMs > 0
      ? `${(entryStats!.avgAdmitWaitMs / 1000).toFixed(0)}s`
      : '—',
    norm: hasEntryData && entryStats!.avgAdmitWaitMs > 0 ? NORMS.entry_avg_wait_ms : undefined,
    status: waitStatus,
  });

  const status = aggregateStatuses(metrics);
  const reading = readRiskReading({
    topStatus, bottleneckCount, topZoneId, zones,
    rejectionStatus, waitStatus,
    rejectionRate: hasEntryData ? entryStats!.rejectionRate : null,
    congestionStatus,
    congestionRatio: hasCongestionData ? worstCongestionRatio : null,
    congestionZoneId: worstCongestionZoneId,
  });
  const confidence = deriveConfidence({ sourceKind: 'derived', status });

  return { metrics, reading, confidence, status };
}

function readRiskReading(opts: {
  topStatus: NormStatus;
  bottleneckCount: number;
  topZoneId: string;
  zones: readonly ZoneConfig[];
  rejectionStatus: NormStatus;
  waitStatus: NormStatus;
  rejectionRate: number | null;
  congestionStatus: NormStatus;
  congestionRatio: number | null;
  congestionZoneId: string;
}): string {
  const topName = opts.zones.find((z) => z.id === opts.topZoneId)?.name ?? '—';
  const congName = opts.zones.find((z) => z.id === opts.congestionZoneId)?.name ?? '—';
  if (opts.rejectionStatus === 'bad' && opts.rejectionRate !== null) {
    return `외부 입장에서 ${Math.round(opts.rejectionRate * 100)}% 가 인내심 한계로 이탈 — 입장 큐 처리량이 도착 속도를 못 따라감. 진입 정책의 max-concurrent 상향 또는 스폰 분포 평탄화 검토.`;
  }
  if (opts.congestionStatus === 'bad' && opts.congestionRatio !== null) {
    return `${congName} 이 시뮬레이션 ${Math.round(opts.congestionRatio * 100)}% 동안 정체 상태 — 일시적 혼잡이 아닌 구조적 흐름 문제. 해당 zone 의 gate/capacity 또는 미디어 배치 재검토가 우선.`;
  }
  if (opts.topStatus === 'bad') {
    return `${topName} 에서 흐름 단절 수준의 병목. spawn 도착 속도 대비 처리 속도가 크게 부족하므로 우선 해소 대상 — gate 폭 확장 또는 우회 동선 검토.`;
  }
  if (opts.waitStatus === 'bad') {
    return '외부 대기 시간이 권장(3분)을 크게 초과 — 운영 부담이 커지고 있어 입장 throughput 또는 시간대별 도착 분포 조정 필요.';
  }
  if (opts.rejectionStatus === 'warn' && opts.rejectionRate !== null) {
    return `입장 단계에서 ${Math.round(opts.rejectionRate * 100)}% 가 이탈 — 진입 큐 정체 신호로 임계 도달 전 단계. 도착 속도와 max-concurrent 균형 점검.`;
  }
  if (opts.congestionStatus === 'warn' && opts.congestionRatio !== null) {
    return `${congName} 정체 시간 ${Math.round(opts.congestionRatio * 100)}% — 반복적 혼잡으로 시간대·spawn 패턴이 누적 부하를 만드는 듯. 후반 sparkline 추이 확인.`;
  }
  if (opts.topStatus === 'warn') {
    return `${topName} 에 가시적 정체 — 아직 임계는 아니지만 시간대 또는 spawn 패턴이 부담을 만드는 신호. drilldown 으로 시점 확인.`;
  }
  if (opts.waitStatus === 'warn') {
    return '외부 대기 시간이 권장보다 긺 — 처리 속도가 도착 속도에 거의 못 미침. 입장 흐름 점검 가치.';
  }
  if (opts.bottleneckCount > 0) {
    return `경미한 병목 ${opts.bottleneckCount}곳 발견. 임계 수준은 아니므로 즉시 조치보다는 시간 추세로 추적.`;
  }
  return '병목·정체·입장 신호 모두 안정. 현재 시나리오에서 흐름 차단 요소 없음.';
}

// ─────────────────────────────────────────────────────────────────────
// Card data + slot — PerspectiveGrid 가 한 번 compute, 슬롯으로 렌더 (2026-05-04).
// 기존 SpaceCard/ArtworkCard/... 4개 wrapper 는 compute 중복 (8회) 의 원인이라 폐기.
// ─────────────────────────────────────────────────────────────────────

export type PerspectiveKey = 'space' | 'artwork' | 'operations' | 'risk';

export interface CardData {
  metrics: PerspectiveMetric[];
  reading: string;
  confidence: Confidence;
  status: NormStatus;
  trend?: PerspectiveTrend;
}

const META: Record<PerspectiveKey, { title: string; Icon: LucideIcon }> = {
  space:      { title: '공간 체험', Icon: Layout },
  artwork:    { title: '작품 관람', Icon: Image },
  operations: { title: '운영',     Icon: Users },
  risk:       { title: '위험·마찰', Icon: AlertTriangle },
};

// 각 관점의 dominant metric 을 시계열로 추출 — hero (size='large') 에서만 활용.
function buildSpaceTrend(history?: readonly KpiTimeSeriesEntry[]): PerspectiveTrend | undefined {
  if (!history || history.length < 2) return undefined;
  const sampled = downsample(history, 16);
  const values = sampled.map((e) => {
    let max = 0;
    for (const u of e.snapshot.zoneUtilizations) {
      if (u.capacity > 0) max = Math.max(max, u.peakOccupancy / u.capacity);
    }
    return max;
  });
  return { values, threshold: NORMS.peak_ratio.warnAt, shape: classifySparklineShape(values, true), isRatio: true };
}

function buildArtworkTrend(history?: readonly KpiTimeSeriesEntry[]): PerspectiveTrend | undefined {
  if (!history || history.length < 2) return undefined;
  const sampled = downsample(history, 16);
  const values = sampled.map((e) => e.snapshot.skipRate.globalSkipRate);
  return { values, threshold: NORMS.skip_rate.warnAt, shape: classifySparklineShape(values, true), isRatio: true };
}

function buildOperationsTrend(history?: readonly KpiTimeSeriesEntry[]): PerspectiveTrend | undefined {
  if (!history || history.length < 2) return undefined;
  const sampled = downsample(history, 16);
  // 피로도 누적 추적이 의미 큼 (운영 부담 직접 반영). completion 추세는 별도 chart 가 필요한 경우만.
  const values = sampled.map((e) => e.snapshot.fatigueDistribution.mean);
  return { values, threshold: NORMS.fatigue_mean.warnAt, shape: classifySparklineShape(values, true), isRatio: true };
}

function buildRiskTrend(history?: readonly KpiTimeSeriesEntry[]): PerspectiveTrend | undefined {
  if (!history || history.length < 2) return undefined;
  const sampled = downsample(history, 16);
  const values = sampled.map((e) => {
    let top = 0;
    for (const b of e.snapshot.bottlenecks) if (b.score > top) top = b.score;
    return top;
  });
  return { values, threshold: NORMS.bottleneck_score.warnAt, shape: classifySparklineShape(values, true), isRatio: true };
}

const COMPUTE: Record<PerspectiveKey, (p: CardProps) => Omit<CardData, 'trend'>> = {
  space:      computeSpaceMetrics,
  artwork:    computeArtworkMetrics,
  operations: computeOperationsMetrics,
  risk:       computeRiskMetrics,
};

const TREND_BUILDER: Record<PerspectiveKey, (h?: readonly KpiTimeSeriesEntry[]) => PerspectiveTrend | undefined> = {
  space:      buildSpaceTrend,
  artwork:    buildArtworkTrend,
  operations: buildOperationsTrend,
  risk:       buildRiskTrend,
};

/**
 * 4 관점 모두 한 번에 compute. PerspectiveGrid 에서 useMemo 로 호출해 중복 호출 회피.
 * trend 는 모두 만들어두지만 실제 표시는 size='large' 슬롯에서만.
 */
export function buildAllCardData(props: CardProps): Record<PerspectiveKey, CardData> {
  const out = {} as Record<PerspectiveKey, CardData>;
  const keys: PerspectiveKey[] = ['space', 'artwork', 'operations', 'risk'];
  for (const k of keys) {
    const base = COMPUTE[k](props);
    out[k] = { ...base, trend: TREND_BUILDER[k](props.kpiHistory) };
  }
  return out;
}

interface SlotProps {
  perspectiveKey: PerspectiveKey;
  data: CardData;
  size?: 'compact' | 'large';
  onDrilldown?: () => void;
}

/**
 * 미리 compute 된 CardData 를 받아 PerspectiveCard 로 렌더만 — 자체 compute 호출 안 함.
 */
export function PerspectiveSlot({ perspectiveKey, data, size, onDrilldown }: SlotProps) {
  const { title, Icon } = META[perspectiveKey];
  return (
    <PerspectiveCard
      title={title}
      Icon={Icon}
      reading={data.reading}
      metrics={data.metrics}
      confidence={data.confidence}
      size={size}
      trend={size === 'large' ? data.trend : undefined}
      onDrilldown={onDrilldown}
    />
  );
}
