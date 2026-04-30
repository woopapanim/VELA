import type {
  ZoneConfig,
  KpiSnapshot,
  KpiTimeSeriesEntry,
} from '@/domain';
import type { OperationsConfig } from '@/domain/types/operations';
import type { NormStatus } from '@/analytics/norms';

// Step 4a — 산식 기반 권장 동시 수용인원.
// NFPA 101 / WELL Building Standard 의 1.5m²/person 안전 기준에서 도출.
// recommended = floor(totalArea / 1.5).
// 관측 peak 와 정책 maxConcurrent 를 권장값에 비교해 status + reading 산출.

export const PER_PERSON_AREA_TARGET_M2 = 1.5;
// Step 4b — zone ratio (peak occupancy / capacity) 가 이 값을 처음 넘는 시점 = knee.
// peak_ratio norm 의 warnAt(0.9) 대신 goodAt(0.7) 사용 — "체감 정체 시작" 지점이 더 운영적으로 의미 있음.
export const KNEE_RATIO_THRESHOLD = 0.7;

export interface KneePoint {
  readonly concurrent: number;          // 시설 전체 동시 인원 (knee 시점)
  readonly atTimeMs: number;            // 시뮬레이션 시간
  readonly maxZoneRatio: number;        // knee 시점 가장 부하 큰 zone 의 ratio
  readonly worstZoneId: string;         // 그 zone id
  readonly threshold: number;           // 0.7
  readonly noBreakObserved: boolean;    // true = observed 범위 내 knee 미관측
  readonly maxObservedConcurrent: number; // knee 못 찾은 경우 비교용
}

export interface CapacityRecommendation {
  readonly totalAreaM2: number;
  readonly perPersonTargetM2: number;
  readonly recommendedConcurrent: number;          // floor(totalArea / 1.5)
  readonly currentPolicyMode: string | null;       // entryPolicy.mode (있으면)
  readonly currentPolicyMaxConcurrent: number | null;
  readonly observedPeakConcurrent: number;
  readonly observedPeakAtMs: number;               // simulationTime when peak hit
  readonly observedAvgConcurrent: number;
  readonly utilizationVsRecommended: number;       // observedPeak / recommended (0+)
  readonly policyVsRecommended: number | null;     // policyMax / recommended
  readonly status: NormStatus;
  readonly reading: string;
  readonly hasObservedData: boolean;
  readonly kneePoint: KneePoint | null;            // Step 4b — 관측 knee
}

export function computeCapacityRecommendation(args: {
  zones: readonly ZoneConfig[];
  kpiHistory: readonly KpiTimeSeriesEntry[];
  latestSnapshot: KpiSnapshot | null;
  operations: OperationsConfig | undefined;
}): CapacityRecommendation {
  const { zones, kpiHistory, latestSnapshot, operations } = args;

  const totalAreaM2 = zones.reduce((s, z) => s + (z.area ?? 0), 0);
  const recommendedConcurrent = Math.max(0, Math.floor(totalAreaM2 / PER_PERSON_AREA_TARGET_M2));

  // 관측 peak — 각 timestep 의 zone occupancy 합의 max.
  const concurrentSeries = computeConcurrentSeries(kpiHistory, latestSnapshot);
  const observedPeakConcurrent = concurrentSeries.reduce(
    (m, p) => (p.value > m ? p.value : m),
    0,
  );
  const observedPeakAtMs =
    concurrentSeries.find((p) => p.value === observedPeakConcurrent)?.tMs ?? 0;
  const observedAvgConcurrent = concurrentSeries.length > 0
    ? concurrentSeries.reduce((s, p) => s + p.value, 0) / concurrentSeries.length
    : 0;
  const hasObservedData = concurrentSeries.length > 0 && observedPeakConcurrent > 0;

  const policy = operations?.entryPolicy;
  const currentPolicyMode = policy ? policy.mode : null;
  const currentPolicyMaxConcurrent =
    policy && (policy.mode === 'concurrent-cap' || policy.mode === 'hybrid')
      ? policy.maxConcurrent ?? null
      : null;

  const utilizationVsRecommended =
    recommendedConcurrent > 0 ? observedPeakConcurrent / recommendedConcurrent : 0;
  const policyVsRecommended =
    recommendedConcurrent > 0 && currentPolicyMaxConcurrent !== null
      ? currentPolicyMaxConcurrent / recommendedConcurrent
      : null;

  const status = deriveStatus({
    hasObservedData,
    utilizationVsRecommended,
    policyVsRecommended,
    recommendedConcurrent,
  });

  const kneePoint = computeKneePoint(kpiHistory, latestSnapshot);

  const reading = buildReading({
    recommendedConcurrent,
    totalAreaM2,
    currentPolicyMode,
    currentPolicyMaxConcurrent,
    policyVsRecommended,
    observedPeakConcurrent,
    utilizationVsRecommended,
    hasObservedData,
    kneePoint,
  });

  return {
    totalAreaM2,
    perPersonTargetM2: PER_PERSON_AREA_TARGET_M2,
    recommendedConcurrent,
    currentPolicyMode,
    currentPolicyMaxConcurrent,
    observedPeakConcurrent,
    observedPeakAtMs,
    observedAvgConcurrent,
    utilizationVsRecommended,
    policyVsRecommended,
    status,
    reading,
    hasObservedData,
    kneePoint,
  };
}

// Step 4b — 단일 run knee-point 휴리스틱.
// "어느 동시 인원에서 zone ratio 가 처음으로 0.7 (체감 정체) 을 넘었나" 를 찾는다.
// 한 timestep 의 가장 부하 큰 zone 의 ratio 가 threshold 를 처음 넘는 순간 = knee.
// 못 찾으면 noBreakObserved=true (관측 범위 내 정체 미관측), maxObservedConcurrent 만 보고.
function computeKneePoint(
  history: readonly KpiTimeSeriesEntry[],
  latestSnapshot: KpiSnapshot | null,
): KneePoint | null {
  const sources = history.length > 0
    ? history.map((h) => h.snapshot)
    : latestSnapshot ? [latestSnapshot] : [];
  if (sources.length === 0) return null;

  let maxObservedConcurrent = 0;
  for (const snap of sources) {
    const c = snap.zoneUtilizations.reduce((s, u) => s + u.currentOccupancy, 0);
    if (c > maxObservedConcurrent) maxObservedConcurrent = c;
  }
  if (maxObservedConcurrent === 0) return null;

  for (const snap of sources) {
    let worstRatio = 0;
    let worstZoneId = '';
    for (const u of snap.zoneUtilizations) {
      if (u.capacity <= 0) continue;
      const r = u.currentOccupancy / u.capacity;
      if (r > worstRatio) {
        worstRatio = r;
        worstZoneId = u.zoneId as string;
      }
    }
    if (worstRatio >= KNEE_RATIO_THRESHOLD) {
      const concurrent = snap.zoneUtilizations.reduce(
        (s, u) => s + u.currentOccupancy,
        0,
      );
      return {
        concurrent,
        atTimeMs: snap.simulationTimeMs,
        maxZoneRatio: worstRatio,
        worstZoneId,
        threshold: KNEE_RATIO_THRESHOLD,
        noBreakObserved: false,
        maxObservedConcurrent,
      };
    }
  }
  return {
    concurrent: 0,
    atTimeMs: 0,
    maxZoneRatio: 0,
    worstZoneId: '',
    threshold: KNEE_RATIO_THRESHOLD,
    noBreakObserved: true,
    maxObservedConcurrent,
  };
}

function computeConcurrentSeries(
  history: readonly KpiTimeSeriesEntry[],
  latestSnapshot: KpiSnapshot | null,
): readonly { tMs: number; value: number }[] {
  const sources = history.length > 0
    ? history.map((h) => h.snapshot)
    : latestSnapshot ? [latestSnapshot] : [];
  return sources.map((snap) => ({
    tMs: snap.simulationTimeMs,
    value: snap.zoneUtilizations.reduce((s, u) => s + u.currentOccupancy, 0),
  }));
}

function deriveStatus(args: {
  hasObservedData: boolean;
  utilizationVsRecommended: number;
  policyVsRecommended: number | null;
  recommendedConcurrent: number;
}): NormStatus {
  const { hasObservedData, utilizationVsRecommended, policyVsRecommended, recommendedConcurrent } = args;
  if (recommendedConcurrent <= 0) return 'unknown';
  // 정책이 권장 초과 → 무조건 위험.
  if (policyVsRecommended !== null && policyVsRecommended > 1.0) return 'bad';
  if (!hasObservedData) {
    // 정책만 있는 경우.
    if (policyVsRecommended !== null) {
      if (policyVsRecommended > 0.9) return 'warn';
      return 'good';
    }
    return 'unknown';
  }
  if (utilizationVsRecommended > 1.0) return 'bad';
  if (utilizationVsRecommended > 0.7) return 'warn';
  return 'good';
}

function buildReading(args: {
  recommendedConcurrent: number;
  totalAreaM2: number;
  currentPolicyMode: string | null;
  currentPolicyMaxConcurrent: number | null;
  policyVsRecommended: number | null;
  observedPeakConcurrent: number;
  utilizationVsRecommended: number;
  hasObservedData: boolean;
  kneePoint: KneePoint | null;
}): string {
  const {
    recommendedConcurrent, totalAreaM2,
    currentPolicyMode, currentPolicyMaxConcurrent, policyVsRecommended,
    observedPeakConcurrent, utilizationVsRecommended, hasObservedData,
    kneePoint,
  } = args;

  if (recommendedConcurrent <= 0 || totalAreaM2 <= 0) {
    return 'zone 면적이 없어 권장값을 산출할 수 없습니다.';
  }

  const parts: string[] = [];
  parts.push(
    `권장 동시 수용 ${recommendedConcurrent}명 (${Math.round(totalAreaM2)}m² ÷ 1.5m²/인 · NFPA 101)`,
  );

  if (currentPolicyMaxConcurrent !== null && policyVsRecommended !== null) {
    const pct = Math.round(policyVsRecommended * 100);
    if (policyVsRecommended > 1.0) {
      parts.push(`정책 ${currentPolicyMaxConcurrent}명 — 권장 ${pct - 100}% 초과`);
    } else if (policyVsRecommended > 0.9) {
      parts.push(`정책 ${currentPolicyMaxConcurrent}명 — 권장의 ${pct}% (여유 부족)`);
    } else {
      parts.push(`정책 ${currentPolicyMaxConcurrent}명 — 권장의 ${pct}%`);
    }
  } else if (currentPolicyMode && currentPolicyMode !== 'unlimited') {
    parts.push(`정책 ${currentPolicyMode} — 동시 cap 미설정`);
  }

  if (hasObservedData) {
    const utilPct = Math.round(utilizationVsRecommended * 100);
    if (utilizationVsRecommended > 1.0) {
      parts.push(`관측 peak ${observedPeakConcurrent}명 (권장 ${utilPct - 100}% 초과)`);
    } else {
      parts.push(`관측 peak ${observedPeakConcurrent}명 (권장의 ${utilPct}%)`);
    }
  }

  // Step 4b — knee 보고. 관측에서 처음으로 정체 시작한 시점을 산식 권장과 비교.
  if (kneePoint && !kneePoint.noBreakObserved) {
    const kneeVsRec = recommendedConcurrent > 0
      ? kneePoint.concurrent / recommendedConcurrent
      : 0;
    const kneePct = Math.round(kneeVsRec * 100);
    if (kneeVsRec < 0.85) {
      parts.push(`관측 knee ${kneePoint.concurrent}명 — 산식보다 보수적 (권장의 ${kneePct}%)`);
    } else if (kneeVsRec > 1.15) {
      parts.push(`관측 knee ${kneePoint.concurrent}명 — 산식보다 공격적 (권장의 ${kneePct}%)`);
    } else {
      parts.push(`관측 knee ${kneePoint.concurrent}명 — 산식과 근접`);
    }
  } else if (kneePoint && kneePoint.noBreakObserved && kneePoint.maxObservedConcurrent > 0) {
    parts.push(`관측 ${kneePoint.maxObservedConcurrent}명까지 정체 신호 없음 (knee 미관측)`);
  }

  return parts.join(' · ');
}
