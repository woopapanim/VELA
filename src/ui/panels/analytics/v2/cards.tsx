import { Layout, Image, Users, AlertTriangle } from 'lucide-react';
import type { KpiSnapshot, ZoneConfig, MediaPlacement } from '@/domain';
import {
  NORMS,
  evaluateNorm,
  deriveConfidence,
  type Confidence,
  type NormStatus,
} from '@/analytics/norms';
import { PerspectiveCard, type PerspectiveMetric } from './PerspectiveCard';

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
  onDrilldown?: () => void;
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
  const peakName = opts.zones.find((z) => z.id === opts.peakZoneId)?.name ?? '—';
  const areaName = opts.zones.find((z) => z.id === opts.worstAreaZoneId)?.name ?? '—';
  if (opts.areaStatus === 'bad' && opts.worstAreaPerPerson !== null) {
    return `${areaName} 피크 인당 면적 ${opts.worstAreaPerPerson.toFixed(1)}m² — 안전 기준(1.0m²) 미만, 인파 위험 신호.`;
  }
  if (opts.peakStatus === 'bad') {
    return `${peakName} 에서 점유 한계 근접. 동선 분산 또는 면적 검토가 필요한 신호.`;
  }
  if (opts.areaStatus === 'warn' && opts.worstAreaPerPerson !== null) {
    return `${areaName} 피크 인당 면적 ${opts.worstAreaPerPerson.toFixed(1)}m² — 권장(1.5m²) 이하, 체감 정체 가능.`;
  }
  if (opts.peakStatus === 'warn') {
    return `${peakName} 에 사람이 몰리는 경향. 단기 정체 가능성.`;
  }
  if (opts.utilStatus === 'bad') {
    return `${opts.deadCount}개 zone 이 거의 비어있음 — 진입 동기 또는 동선 단절 의심.`;
  }
  if (opts.utilStatus === 'warn') {
    return '일부 zone 활용도 낮음. 동선 흐름 재검토 가치.';
  }
  return '공간 점유와 활용 모두 안정 범위.';
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
    return '관람 의도가 절반 이상 무산. 미디어 위치·길이·인기도 분포 재검토.';
  }
  if (opts.skipStatus === 'warn') {
    return '스킵률이 권장보다 높음. 특정 미디어 또는 동선 진입 단계 점검.';
  }
  if (opts.unvisitedRatio > 0.5) {
    return '절반 이상의 작품이 한 번도 접근되지 않음 — 동선이 일부 작품에 도달 못함.';
  }
  if (opts.unvisitedRatio > 0.25) {
    return '미접근 작품이 다수. 동선상 사각지대 가능성.';
  }
  return '작품 도달과 관람 의도 모두 안정.';
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
    return '완주율 낮음 — 진입 단계 또는 중간 zone 에서 이탈하는 패턴.';
  }
  if (opts.fatigueStatus === 'bad') {
    return '피로도 누적 높음 — 동선 길이 또는 정체로 후반부 관람 품질 저하.';
  }
  if (opts.completionStatus === 'warn' || opts.fatigueStatus === 'warn') {
    return '운영 지표가 권장보다 다소 낮음. 부분 검토 가치.';
  }
  return '처리량·완주·피로 모두 안정 운영 범위.';
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
    return `외부 입장에서 ${Math.round(opts.rejectionRate * 100)}% 가 인내심 한계로 이탈 — 진입 정책 또는 스폰 분포 재검토.`;
  }
  if (opts.congestionStatus === 'bad' && opts.congestionRatio !== null) {
    return `${congName} 이 시뮬레이션 ${Math.round(opts.congestionRatio * 100)}% 동안 정체 — 구조적 흐름 문제, 운영 개선 필요.`;
  }
  if (opts.topStatus === 'bad') {
    return `${topName} 에서 흐름 단절 수준의 병목. 우선 해소 대상.`;
  }
  if (opts.waitStatus === 'bad') {
    return '외부 대기 시간이 권장(3분)을 크게 초과 — 운영 부담 증가.';
  }
  if (opts.rejectionStatus === 'warn' && opts.rejectionRate !== null) {
    return `입장 단계 이탈 ${Math.round(opts.rejectionRate * 100)}% — 진입 큐 정체 신호.`;
  }
  if (opts.congestionStatus === 'warn' && opts.congestionRatio !== null) {
    return `${congName} 정체 시간 ${Math.round(opts.congestionRatio * 100)}% — 반복적 혼잡, 시간대·spawn 검토.`;
  }
  if (opts.topStatus === 'warn') {
    return `${topName} 에 가시적 정체 — 시간대 또는 spawn 패턴 점검.`;
  }
  if (opts.waitStatus === 'warn') {
    return '외부 대기 시간이 권장보다 긺 — 입장 흐름 점검 가치.';
  }
  if (opts.bottleneckCount > 0) {
    return `경미한 병목 ${opts.bottleneckCount}곳. 큰 문제 아님.`;
  }
  return '병목·정체·입장 신호 모두 안정.';
}

// ─────────────────────────────────────────────────────────────────────
// Card components (mount in grid)
// ─────────────────────────────────────────────────────────────────────

interface MountProps extends CardProps {
  size?: 'compact' | 'large';
}

export function SpaceCard(props: MountProps) {
  const { metrics, reading, confidence } = computeSpaceMetrics(props);
  return (
    <PerspectiveCard
      title="공간 체험"
      Icon={Layout}
      reading={reading}
      metrics={metrics}
      confidence={confidence}
      onDrilldown={props.onDrilldown}
      size={props.size}
    />
  );
}

export function ArtworkCard(props: MountProps) {
  const { metrics, reading, confidence } = computeArtworkMetrics(props);
  return (
    <PerspectiveCard
      title="작품 관람"
      Icon={Image}
      reading={reading}
      metrics={metrics}
      confidence={confidence}
      onDrilldown={props.onDrilldown}
      size={props.size}
    />
  );
}

export function OperationsCard(props: MountProps) {
  const { metrics, reading, confidence } = computeOperationsMetrics(props);
  return (
    <PerspectiveCard
      title="운영"
      Icon={Users}
      reading={reading}
      metrics={metrics}
      confidence={confidence}
      onDrilldown={props.onDrilldown}
      size={props.size}
    />
  );
}

export function RiskCard(props: MountProps) {
  const { metrics, reading, confidence } = computeRiskMetrics(props);
  return (
    <PerspectiveCard
      title="위험·마찰"
      Icon={AlertTriangle}
      reading={reading}
      metrics={metrics}
      confidence={confidence}
      onDrilldown={props.onDrilldown}
      size={props.size}
    />
  );
}
