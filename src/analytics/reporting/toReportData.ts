import type {
  Scenario, ZoneConfig, MediaPlacement, FloorConfig,
  Visitor, VisitorGroup, TimeState, KpiSnapshot, KpiTimeSeriesEntry,
  InsightEntry, WaypointGraph, ExperienceMode, ExperienceModeTier,
} from '@/domain';
import {
  INTERNATIONAL_DENSITY_STANDARD,
  EXPERIENCE_MODE_REGISTRY,
  inferExperienceMode,
} from '@/domain';
import { COMPLETION_ZONE_RATIO, EARLY_EXIT_ZONE_RATIO } from '@/domain/constants';
import { generateInsights, extractKeyMoments } from '@/analytics';

export type Severity = 'info' | 'warning' | 'critical';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ReportMeta {
  readonly id: string;             // full runId, e.g. "run_20260423T143011_a1b2c3"
  readonly projectName: string;
  readonly generated: string;      // "YYYY-MM-DD HH:mm"
  readonly duration: string;       // "29m 51s"
  readonly visitors: number;
  readonly active: number;
  readonly exited: number;
  readonly runId: string;          // short-form runId for display (same as id here)
  readonly peakMoment: string | null; // "28:14" or null
  readonly mode: 'time' | 'person';    // 종료 기준 (시나리오에서 선택)
  readonly trimmed: boolean;            // time 모드에서 미완료 상태로 Duration 도달한 경우
  readonly totalConfigured: number;     // 시나리오의 목표 관람객 수 (visitorDistribution.totalCount)
}

export interface ReportEvidence {
  readonly label: string;
  readonly value: string;     // "120%", "96%"
  readonly tone: 'ok' | 'warn' | 'bad';
  readonly note: string;
}

export interface ReportKpi {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly tone?: 'ok' | 'amb' | 'warn';
  readonly note: string;
  readonly hero?: boolean;
  readonly bar?: { readonly pct: number; readonly cap: number; readonly max: number; readonly danger?: boolean };
}

export interface ReportFinding {
  readonly id: string;
  readonly severity: Severity;
  readonly title: string;
  readonly detail: string;
  readonly action: string;
  readonly evidence: { readonly metric: string; readonly value: number; readonly threshold: number };
}

export interface ReportZoneRow {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly area: number;
  readonly cap: number;
  readonly peak: number;
  readonly utilPct: number;       // 0..∞ (over 100 = over capacity)
  readonly areaPerPerson: number;
  readonly stayMin: number;
  readonly bottleneck: number | null;
  readonly grade: Grade;
  readonly visits: number;
  readonly visitPct: number;
  readonly peakAtMs: number | null;  // when this zone hit its peak
  readonly sparkline: readonly number[];  // util ratio (0..1.5+) sampled along kpiHistory
}

export interface ReportMediaRow {
  readonly id: string;
  readonly name: string;
  readonly kind: string;           // analog / passive / active / staged
  readonly zone: string;
  readonly peakViewers: number;
  readonly capacity: number;
  readonly utilPct: number;
  readonly watches: number;
  readonly skips: number;
  readonly engagement: number | null;  // null when no approach data
  readonly avgWatchS: number | null;
  readonly avgWaitS: number | null;
}

export interface ReportFatigueBucket { readonly bucket: string; readonly n: number }

export interface ReportFloorRoom {
  readonly label: string;
  readonly x: number; readonly y: number; readonly w: number; readonly h: number;
  readonly occ: number; readonly cap: number;
}
export interface ReportFloor {
  readonly floorId: string;
  readonly name: string;
  readonly cap: number;
  readonly rooms: readonly ReportFloorRoom[];
  readonly boundsWorld: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
}

export interface ReportTimelinePoint {
  readonly t: number;           // seconds since sim start
  readonly crowdPct: number;    // peak zone utilization %, 0..∞
  readonly fatiguePct: number;  // mean fatigue %, 0..100
  readonly active: number;      // active visitor count
  readonly exited: number;      // cumulative exited count
}

export interface ReportPeakRankRow {
  readonly id: string;
  readonly name: string;
  readonly occ: number;
  readonly cap: number;
  readonly pct: number;         // 0..∞ (capacity %)
}

export interface ReportCompositionRow {
  readonly label: string;
  readonly count: number;
  readonly pct: number;          // 0..100
  readonly tone?: 'danger' | 'warn' | 'ok';
}

export interface ReportSystemOverview {
  readonly zonesCount: number;
  readonly mediaCount: number;
  readonly totalAreaM2: number;
  readonly totalCapacity: number;
  readonly mediaCapacity: number;
  readonly avgCrowdingPct: number;
  readonly avgDwellMin: number;
  readonly throughputPerMin: number;
  /** Configured spawn rate × 60 — useful alongside throughput to see throttle vs. design. */
  readonly spawnRatePerMin: number;
  readonly interpretation: string | null;
}

export interface ReportDwellBucket {
  readonly label: string;         // "0-2m", "2-5m", …
  readonly count: number;
  readonly pct: number;           // 0..100
}

export interface ReportNodeDistRow {
  readonly nodeId: string;
  readonly label: string;
  readonly count: number;
  readonly pct: number;
}

export interface ReportTransitionCell {
  readonly fromId: string;
  readonly fromName: string;
  readonly toId: string;
  readonly toName: string;
  readonly count: number;
  readonly pct: number;        // out of total transitions from `fromId`
}

export interface ReportActiveZoneRow {
  readonly id: string;        // zoneId, or '' for '구역 밖'
  readonly name: string;
  readonly count: number;
  readonly pct: number;       // out of active visitors
}

export interface ReportActiveBreakdown {
  readonly total: number;                              // active 수 (= spawned - exited)
  readonly byAction: readonly ReportCompositionRow[]; // MOVING / WATCHING / WAITING / RESTING / IDLE
  readonly byZone: readonly ReportActiveZoneRow[];   // 현재 어느 존에 있는지 상위 N
}

export interface ReportFlow {
  readonly completed: number;
  readonly avgTotalMin: number;
  readonly throughputPerMin: number;
  /** Configured spawn rate × 60 (same as system.spawnRatePerMin). Mirrored for convenience. */
  readonly spawnRatePerMin: number;
  /** 완주율 = 퇴장자 중 전체 존의 80% 이상 방문한 비율 (0..1). */
  readonly completionRate: number;
  /** 조기이탈률 = 퇴장자 중 전체 존의 20% 이하 방문한 비율 (0..1). */
  readonly earlyExitRate: number;
  /** 완주 판정에 필요한 최소 존 개수 (nZones × 0.8, 올림). UI 라벨 표기용. */
  readonly completionThreshold: number;
  /** 조기 이탈 판정에 걸리는 최대 존 개수 (nZones × 0.2, 내림, 최소 1). UI 라벨 표기용. */
  readonly earlyExitThreshold: number;
  /** 퇴장률 = 퇴장자 / 전체 스폰 (0..1). 시간 내 투어를 마친 방문자 비율 (다른 denominator). */
  readonly exitRate: number;
  readonly groupInducedBottleneckPct: number;
  readonly completionDist: readonly ReportCompositionRow[];
  readonly bottleneckCount: number;
  readonly topRoutes: readonly { readonly path: string; readonly count: number; readonly pct: number }[];
  readonly flowMode: 'free' | 'sequential' | 'hybrid';
  readonly dwellHist: readonly ReportDwellBucket[];
  readonly dwellStats: {
    readonly medianMin: number;
    readonly p90Min: number;
    readonly p99Min: number;
  };
  readonly entryDist: readonly ReportNodeDistRow[];
  readonly exitDist: readonly ReportNodeDistRow[];
  readonly transitionMatrix: {
    readonly zones: readonly { readonly id: string; readonly name: string }[];
    readonly cells: readonly ReportTransitionCell[];
  };
  /** 비퇴장자(= 아직 장내에 남아있는 방문자) 현황. 시뮬레이션이 끝난 시점에
   * 퇴장 못한 사람들이 왜 안 퇴장했는지(WATCHING, MOVING stuck, 등) 파악용. */
  readonly activeBreakdown: ReportActiveBreakdown;
}

export interface ReportBehavior {
  readonly groupsCount: number;
  readonly composition: readonly ReportCompositionRow[];
  readonly groupInducedBottleneckPct: number;
}

export interface ReportMediaTotals {
  readonly totalViews: number;
  readonly totalSkips: number;
  readonly totalWatchMin: number;
  readonly activationPct: number;  // 0..100
  readonly activationRatio: string; // "5/6"
}

export interface ReportGlossaryEntry { readonly term: string; readonly def: string }

export interface ReportHeadline {
  readonly a: string;
  readonly b: string;
  readonly tone: 'critical' | 'warning' | 'healthy';
}

// ── Mode Perspective (Phase 1 UX, 2026-04-26) ────────────────
//
// 11개 섹션 본문은 모드 무관 (객관 데이터). 그 위에 _렌즈_ 를 한 장 덧대서
// "이 모드의 의도 기준으로 해석" 을 보여주는 overlay. user 합의:
// "리포트 서두에 총평에 대한 관점 + 비교 + 목적 일치 권고" → 그 중 _관점_ 부분.
//
// 비교 컴포넌트는 [F] (sweep). 여기선 단일 시나리오의 모드 관점.

export interface ReportPerspectivePivot {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly tone: 'ok' | 'warn' | 'bad';
  readonly note?: string;
}

export interface ReportPerspective {
  readonly mode: ExperienceMode;
  readonly tier: ExperienceModeTier;
  /** 모드 라벨 — 사용자에게 보일 친근한 이름 ("자유 관람 + 통제" 등). */
  readonly modeLabel: string;
  /** 1-2 문장 총평. 이 모드의 _목표_ 와 _달성 여부_ 를 결과 데이터에 비추어 평가. */
  readonly verdictA: string;
  readonly verdictB: string;
  readonly verdictTone: 'critical' | 'warning' | 'healthy';
  /** 이 모드의 핵심 지표 3-4 개 — 모드 의도와 직결되는 KPI 만 추려서 클로즈업. */
  readonly pivots: readonly ReportPerspectivePivot[];
  /** 이 모드 관점에서 가장 중요한 권고 1-2 건의 finding id. RecosSection 본문은 그대로 두고 강조만. */
  readonly priorityFindingIds: readonly string[];
}

export interface ReportData {
  readonly meta: ReportMeta;
  readonly headline: ReportHeadline;
  /**
   * Phase 1 UX (2026-04-26): 모드 관점 overlay. 본문 11 섹션은 모드 무관 객관 데이터,
   * 이 perspective 만 모드 의도에 따라 해석 렌즈 제공. 미설정 시 inferExperienceMode 로 추정.
   */
  readonly perspective: ReportPerspective;
  readonly evidence: readonly ReportEvidence[];
  readonly kpis: readonly ReportKpi[];
  readonly findings: readonly ReportFinding[];
  readonly zones: readonly ReportZoneRow[];
  readonly zoneVisitLegend: readonly {
    readonly id: string; readonly name: string; readonly dwellMin: number; readonly pct: number;
  }[];
  readonly media: readonly ReportMediaRow[];
  readonly mediaTotals: ReportMediaTotals;
  readonly fatigueHist: readonly ReportFatigueBucket[];
  readonly fatigueStats: {
    readonly avg: number; readonly median: number; readonly p90: number; readonly p99: number;
  };
  readonly floors: readonly ReportFloor[];
  readonly topMedia: readonly ReportMediaRow[];
  readonly bottomMedia: readonly ReportMediaRow[];
  readonly timeline: readonly ReportTimelinePoint[];
  readonly peakMomentMs: number | null;
  readonly peakRanking: readonly ReportPeakRankRow[];
  readonly system: ReportSystemOverview;
  readonly flow: ReportFlow;
  readonly behavior: ReportBehavior;
  readonly glossary: readonly ReportGlossaryEntry[];
}

export interface ToReportDataInput {
  readonly scenario: Scenario;
  readonly zones: readonly ZoneConfig[];
  readonly media: readonly MediaPlacement[];
  readonly floors: readonly FloorConfig[];
  readonly visitors: readonly Visitor[];
  readonly groups: readonly VisitorGroup[];
  readonly timeState: TimeState;
  readonly latestSnapshot: KpiSnapshot;
  readonly kpiHistory: readonly KpiTimeSeriesEntry[];
  readonly mediaStats: ReadonlyMap<string, {
    readonly watchCount: number; readonly skipCount: number; readonly waitCount: number;
    readonly totalWatchMs: number; readonly totalWaitMs: number; readonly peakViewers: number;
  }>;
  readonly spawnByNode: ReadonlyMap<string, number>;
  readonly exitByNode: ReadonlyMap<string, number>;
  readonly waypointGraph: WaypointGraph | null;
  readonly totalExited: number;
  readonly runId: string | null;
  /**
   * Phase 1 UX (2026-04-26): 외부 입장 큐 스냅샷 (운영 tier 모드 perspective KPI 산정용).
   * 미제공/'unlimited' 정책 시 기본값으로 fallback (모든 큐 KPI = 0).
   */
  readonly entryQueueSnapshot?: {
    readonly avgQueueWaitMs: number;
    readonly recentAdmitAvgWaitMs: number;
    readonly totalAbandoned: number;
    readonly totalArrived: number;
    readonly totalAdmitted: number;
  };
  readonly t: (k: string, params?: Record<string, string | number>) => string;
}

const MS_MIN = 60_000;

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}m ${String(ss).padStart(2, '0')}s`;
}

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function fmtDateStamp(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function gradeFor(areaPerPerson: number): Grade {
  if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 2) return 'A';
  if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD) return 'B';
  if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 0.7) return 'C';
  if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 0.4) return 'D';
  return 'F';
}

function findingFromInsight(e: InsightEntry, idx: number): ReportFinding {
  const sev: Severity = e.severity === 'critical' ? 'critical' : e.severity === 'warning' ? 'warning' : 'info';
  return {
    id: String(idx + 1).padStart(2, '0'),
    severity: sev,
    title: e.problem,
    detail: e.cause,
    action: e.recommendation,
    evidence: { metric: e.dataEvidence.metric, value: e.dataEvidence.value, threshold: e.dataEvidence.threshold },
  };
}

// ── Mode perspective helpers (Phase 1 UX, 2026-04-26) ──────────
//
// 모드별 _핵심 지표_ 결정 로직. 본문 KPI 와 동일한 원천 데이터를 가져와
// "이 모드 의도엔 이 3-4 개가 가장 중요" 하는 클로즈업.
//
// validation tier (큐 미발생): completion / skip / activation / utilization
// operations tier (큐 발생): + abandonmentRate / avgWaitMin / throughput

interface PerspectiveBuildInput {
  readonly mode: ExperienceMode;
  readonly findings: readonly ReportFinding[];
  readonly peakUtilRatio: number;
  readonly mediaActivationRatio: number;
  readonly completionRate: number;
  readonly globalSkipRate: number;
  readonly p90Fat: number;
  readonly entryQueue?: ToReportDataInput['entryQueueSnapshot'];
  readonly t: ToReportDataInput['t'];
}

function buildPerspective(inp: PerspectiveBuildInput): ReportPerspective {
  const { mode, findings, peakUtilRatio, mediaActivationRatio, completionRate, globalSkipRate, p90Fat, entryQueue, t } = inp;
  const tier = EXPERIENCE_MODE_REGISTRY[mode].tier;
  const modeLabel = t(`experienceMode.${mode}.label`);
  const verdictPctLocal = (r: number) => Math.round(r * 100);

  // ── Pivot KPI 선택 (모드별) ────────────────────────────────
  const pivots: ReportPerspectivePivot[] = [];

  // 공통: 완주율 (모든 모드에서 의미 있음)
  pivots.push({
    key: 'completion',
    label: t('vela.persp.kpi.completion'),
    value: `${verdictPctLocal(completionRate)}%`,
    tone: completionRate >= 0.5 ? 'ok' : completionRate >= 0.3 ? 'warn' : 'bad',
    note: t('vela.persp.kpi.completion.note'),
  });

  if (tier === 'validation') {
    // 검증 tier: 미디어 노출 + skip — 디자인 의도가 잘 닿았는지
    pivots.push({
      key: 'activation',
      label: t('vela.persp.kpi.activation'),
      value: `${verdictPctLocal(mediaActivationRatio)}%`,
      tone: mediaActivationRatio >= 0.7 ? 'ok' : mediaActivationRatio >= 0.5 ? 'warn' : 'bad',
      note: t('vela.persp.kpi.activation.note'),
    });
    pivots.push({
      key: 'skip',
      label: t('vela.persp.kpi.skip'),
      value: `${verdictPctLocal(globalSkipRate)}%`,
      tone: globalSkipRate <= 0.3 ? 'ok' : globalSkipRate <= 0.5 ? 'warn' : 'bad',
      note: t('vela.persp.kpi.skip.note'),
    });
    pivots.push({
      key: 'peak',
      label: t('vela.persp.kpi.peak'),
      value: `${verdictPctLocal(peakUtilRatio)}%`,
      tone: peakUtilRatio <= 1 ? 'ok' : peakUtilRatio <= 1.2 ? 'warn' : 'bad',
      note: t('vela.persp.kpi.peak.note'),
    });
  } else {
    // 운영 tier: 외부 대기 + 포기율 + 피크 (큐 KPI). entryQueue 없으면 fallback "—".
    const arrived = entryQueue?.totalArrived ?? 0;
    const abandoned = entryQueue?.totalAbandoned ?? 0;
    const abandonmentRate = arrived > 0 ? abandoned / arrived : 0;
    const recentWaitMin = entryQueue ? Math.round(entryQueue.recentAdmitAvgWaitMs / MS_MIN) : 0;

    pivots.push({
      key: 'wait',
      label: t('vela.persp.kpi.wait'),
      value: entryQueue ? `${recentWaitMin}m` : '—',
      tone: !entryQueue ? 'ok' : recentWaitMin <= 10 ? 'ok' : recentWaitMin <= 25 ? 'warn' : 'bad',
      note: t('vela.persp.kpi.wait.note'),
    });
    pivots.push({
      key: 'abandon',
      label: t('vela.persp.kpi.abandon'),
      value: arrived > 0 ? `${verdictPctLocal(abandonmentRate)}%` : '—',
      tone: arrived === 0 ? 'ok' : abandonmentRate <= 0.05 ? 'ok' : abandonmentRate <= 0.15 ? 'warn' : 'bad',
      note: t('vela.persp.kpi.abandon.note'),
    });
    pivots.push({
      key: 'peak',
      label: t('vela.persp.kpi.peak'),
      value: `${verdictPctLocal(peakUtilRatio)}%`,
      tone: peakUtilRatio <= 1 ? 'ok' : peakUtilRatio <= 1.2 ? 'warn' : 'bad',
      note: t('vela.persp.kpi.peak.note'),
    });
  }

  // ── Verdict (모드별 1-2 문장) ─────────────────────────────
  // 가장 강한 신호 하나 + 모드 의도와의 alignment 한 줄.
  let verdictTone: ReportPerspective['verdictTone'] = 'healthy';
  let signalKey = 'balanced';
  if (mode === 'controlled_admission' || mode === 'timed_reservation') {
    // 운영 통제 — 외부 대기 / 포기 우선
    const arrived = entryQueue?.totalArrived ?? 0;
    const abandoned = entryQueue?.totalAbandoned ?? 0;
    const abandonmentRate = arrived > 0 ? abandoned / arrived : 0;
    if (abandonmentRate > 0.15) { verdictTone = 'critical'; signalKey = 'abandon'; }
    else if (abandonmentRate > 0.05) { verdictTone = 'warning'; signalKey = 'abandon'; }
    else if (peakUtilRatio > 1.2) { verdictTone = 'warning'; signalKey = 'peak'; }
  } else if (mode === 'free_admission' || mode === 'free_with_throttle') {
    // 자유 관람 — 혼잡 / 피로 우선
    if (peakUtilRatio > 1.3) { verdictTone = 'critical'; signalKey = 'peak'; }
    else if (peakUtilRatio > 1) { verdictTone = 'warning'; signalKey = 'peak'; }
    else if (p90Fat > 0.7) { verdictTone = 'warning'; signalKey = 'fatigue'; }
  } else {
    // 검증 tier — 디자인 의도 (활성화 / 완주) 우선
    if (mediaActivationRatio < 0.5) { verdictTone = 'warning'; signalKey = 'activation'; }
    else if (completionRate < 0.3) { verdictTone = 'warning'; signalKey = 'completion'; }
    else if (globalSkipRate > 0.4) { verdictTone = 'warning'; signalKey = 'skip'; }
  }

  const verdictA = t(`vela.persp.verdict.${signalKey}.a`, {
    mode: modeLabel,
    pct: verdictPctLocal(
      signalKey === 'peak' ? peakUtilRatio :
      signalKey === 'abandon' ? ((entryQueue?.totalArrived ?? 0) > 0 ? (entryQueue!.totalAbandoned / entryQueue!.totalArrived) : 0) :
      signalKey === 'activation' ? mediaActivationRatio :
      signalKey === 'completion' ? completionRate :
      signalKey === 'skip' ? globalSkipRate :
      signalKey === 'fatigue' ? p90Fat :
      0,
    ),
  });
  const verdictB = t(`vela.persp.verdict.${signalKey}.b`);

  // ── Priority finding ids — 모드 의도와 매칭되는 권고 1-2 건 ──
  // simple keyword 매칭: 모드별 우선순위 키워드 → finding.title/detail 검색
  const priorityKeywords: Record<ExperienceMode, readonly string[]> = {
    layout_validation: ['미디어', 'media', '활성', 'activation', '존', 'zone', 'flow'],
    curation_validation: ['순서', 'order', 'curat', '경로'],
    media_experience: ['skip', '미디어', '체험', 'engagement'],
    free_admission: ['혼잡', 'crowd', '피크', 'peak', '용량', 'capacity'],
    free_with_throttle: ['혼잡', 'crowd', '피크', 'peak', '용량'],
    timed_reservation: ['슬롯', 'slot', '대기', 'wait', '예약'],
    controlled_admission: ['대기', 'wait', '포기', 'abandon', '큐', 'queue'],
    group_visit: ['단체', 'group', '동반'],
  };
  const kws = priorityKeywords[mode] ?? [];
  const priorityFindingIds = findings
    .filter((f) => {
      const hay = (f.title + ' ' + f.detail).toLowerCase();
      return kws.some((k) => hay.includes(k.toLowerCase()));
    })
    .slice(0, 2)
    .map((f) => f.id);

  return {
    mode,
    tier,
    modeLabel,
    verdictA,
    verdictB,
    verdictTone,
    pivots,
    priorityFindingIds,
  };
}

export function toReportData(input: ToReportDataInput): ReportData {
  const {
    scenario, zones, media, floors, visitors, groups,
    timeState, latestSnapshot, kpiHistory, mediaStats,
    spawnByNode, exitByNode, waypointGraph,
    totalExited, runId, entryQueueSnapshot, t,
  } = input;

  const exited = visitors.filter((v) => !v.isActive);
  const active = visitors.filter((v) => v.isActive);
  const durationMs = timeState.elapsed;

  // ---- Peak util ---------------------------------------------------------
  const peakRatioByZone = new Map<string, number>();
  for (const u of latestSnapshot.zoneUtilizations) {
    const cap = u.capacity > 0 ? u.capacity : 1;
    peakRatioByZone.set(u.zoneId as string, u.peakOccupancy / cap);
  }
  const peakUtilRatio = Math.max(0, ...peakRatioByZone.values());
  const peakZoneUtil = latestSnapshot.zoneUtilizations.reduce(
    (best, u) => {
      const r = peakRatioByZone.get(u.zoneId as string) ?? 0;
      const bestR = best ? (peakRatioByZone.get(best.zoneId as string) ?? -1) : -1;
      return r > bestR ? u : best;
    },
    latestSnapshot.zoneUtilizations[0] ?? null,
  );
  const peakZoneName = peakZoneUtil
    ? zones.find((z) => z.id === peakZoneUtil.zoneId)?.name ?? '—'
    : '—';

  // ---- Per-zone cumulative max bottleneck --------------------------------
  const peakBottleneckByZone = new Map<string, { score: number; avgQueueTime: number; isGroupInduced: boolean }>();
  for (const entry of kpiHistory) {
    for (const b of entry.snapshot.bottlenecks) {
      const k = b.zoneId as string;
      const prev = peakBottleneckByZone.get(k);
      if (!prev || b.score > prev.score) peakBottleneckByZone.set(k, b);
    }
  }

  // ---- Per-zone peak moment (timestamp of max occupancy) -----------------
  const zonePeakAt = new Map<string, { occ: number; ts: number }>();
  for (const entry of kpiHistory) {
    for (const u of entry.snapshot.zoneUtilizations) {
      const k = u.zoneId as string;
      const prev = zonePeakAt.get(k);
      if (!prev || u.currentOccupancy > prev.occ) {
        zonePeakAt.set(k, { occ: u.currentOccupancy, ts: entry.timestamp });
      }
    }
  }

  // ---- Per-zone sparkline (utilization ratio along downsampled history) --
  const SPARK_POINTS = 48;
  const sparkStep = kpiHistory.length > SPARK_POINTS
    ? Math.ceil(kpiHistory.length / SPARK_POINTS)
    : 1;
  const zoneSparkline = new Map<string, number[]>();
  for (const z of zones) {
    zoneSparkline.set(z.id as string, []);
  }
  for (let i = 0; i < kpiHistory.length; i += sparkStep) {
    const snap = kpiHistory[i].snapshot;
    const utilByZone = new Map<string, number>();
    for (const u of snap.zoneUtilizations) {
      const cap = u.capacity > 0 ? u.capacity : 1;
      utilByZone.set(u.zoneId as string, u.currentOccupancy / cap);
    }
    for (const z of zones) {
      zoneSparkline.get(z.id as string)!.push(utilByZone.get(z.id as string) ?? 0);
    }
  }

  // ---- Zone visit counts -------------------------------------------------
  const zoneVisitCount = new Map<string, number>();
  for (const v of visitors) {
    for (const zid of v.visitedZoneIds) {
      const k = zid as string;
      zoneVisitCount.set(k, (zoneVisitCount.get(k) ?? 0) + 1);
    }
  }
  const totalVisits = [...zoneVisitCount.values()].reduce((s, n) => s + n, 0);

  // ---- Zone rows ---------------------------------------------------------
  const zoneRows: ReportZoneRow[] = zones.map((z) => {
    const util = latestSnapshot.zoneUtilizations.find((u) => u.zoneId === z.id);
    const visit = latestSnapshot.visitDurations.find((v) => v.zoneId === z.id);
    const currentActive = active.filter((v) => v.currentZoneId === z.id).length;
    const peak = util?.peakOccupancy ?? currentActive;
    const utilPct = z.capacity > 0 ? (peak / z.capacity) * 100 : 0;
    const areaPerPerson = peak > 0 ? z.area / peak : z.area;
    const visits = zoneVisitCount.get(z.id as string) ?? 0;
    const visitPct = totalVisits > 0 ? Math.round((visits / totalVisits) * 100) : 0;
    const bn = peakBottleneckByZone.get(z.id as string);
    const peakAt = zonePeakAt.get(z.id as string);
    return {
      id: z.id as string,
      name: z.name,
      type: z.type,
      area: z.area,
      cap: z.capacity,
      peak,
      utilPct: Math.round(utilPct),
      areaPerPerson,
      stayMin: (visit?.meanDurationMs ?? 0) / MS_MIN,
      bottleneck: bn ? Math.round(bn.score * 100) : null,
      grade: gradeFor(areaPerPerson),
      visits,
      visitPct,
      peakAtMs: peakAt?.ts ?? null,
      sparkline: zoneSparkline.get(z.id as string) ?? [],
    };
  });

  // ---- Media rows --------------------------------------------------------
  const mediaRows: ReportMediaRow[] = media.map((m) => {
    const stat = mediaStats.get(m.id as string);
    const zone = zones.find((z) => z.id === m.zoneId);
    const watches = stat?.watchCount ?? 0;
    const skips = stat?.skipCount ?? 0;
    const waits = stat?.waitCount ?? 0;
    const totalApproaches = watches + skips;
    const engagement = totalApproaches >= 3
      ? Math.round((watches / totalApproaches) * 100)
      : null;
    const avgWatchS = watches > 0 ? Math.round((stat?.totalWatchMs ?? 0) / watches / 1000) : null;
    const avgWaitS = waits > 0 ? Math.round((stat?.totalWaitMs ?? 0) / waits / 1000) : null;
    const peakViewers = stat?.peakViewers ?? 0;
    const utilPct = m.capacity > 0 ? Math.round((peakViewers / m.capacity) * 100) : 0;
    // Fallback: 레거시 시나리오 중 name 미설정인 경우 type 기반 보기 좋게 표시
    const displayName = (m.name && m.name.trim())
      || (m.type ? String(m.type).replace(/_/g, ' ') : (m.id as string));
    return {
      id: m.id as string,
      name: displayName,
      kind: String(m.interactionType ?? 'analog').toLowerCase(),
      zone: zone?.name ?? '—',
      peakViewers,
      capacity: m.capacity,
      utilPct,
      watches,
      skips,
      engagement,
      avgWatchS,
      avgWaitS,
    };
  });

  const totalWatches = mediaRows.reduce((s, m) => s + m.watches, 0);
  const totalSkips = mediaRows.reduce((s, m) => s + m.skips, 0);
  const totalApproaches = totalWatches + totalSkips;
  const globalSkipRate = totalApproaches > 0 ? totalSkips / totalApproaches : 0;
  const mediaActiveCount = mediaRows.filter((m) => m.watches > 0).length;

  const mediaSortable = mediaRows.filter((m) => m.engagement != null);
  const topMedia = [...mediaSortable].sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0)).slice(0, 3);
  const bottomMedia = [...mediaSortable].sort((a, b) => (a.engagement ?? 0) - (b.engagement ?? 0)).slice(0, 3);

  // ---- Fatigue stats -----------------------------------------------------
  const fv = visitors.map((v) => v.fatigue).sort((a, b) => a - b);
  const fN = fv.length;
  const avgFat = fN > 0 ? fv.reduce((s, f) => s + f, 0) / fN : 0;
  const medFat = fN > 0 ? fv[Math.floor(fN / 2)] : 0;
  const p90Fat = fN > 0 ? fv[Math.floor(fN * 0.9)] : 0;
  const p99Fat = fN > 0 ? fv[Math.min(fN - 1, Math.floor(fN * 0.99))] : 0;
  const fatigueHist: ReportFatigueBucket[] = Array.from({ length: 10 }, (_, i) => {
    const lo = i * 10, hi = (i + 1) * 10;
    const isLast = i === 9;
    const frac = fv.filter((f) => {
      const pct = f * 100;
      return pct >= lo && (isLast ? pct <= hi : pct < hi);
    }).length;
    return { bucket: `${lo}-${hi}`, n: frac };
  });

  // ---- Zone-count buckets (for completion / early-exit definitions) ------
  // 퇴장자만을 대상으로 방문한 essential 존 수 분포 — essential 존 수 대비 비율 기준.
  // Rest 는 amenity 이므로 분모/분자 모두에서 제외 (완주 정의는 투어 essential 의 비율).
  // 기준은 domain/constants.ts 의 COMPLETION_ZONE_RATIO / EARLY_EXIT_ZONE_RATIO.
  // 소규모 시나리오에서도 lowMax < highMin 이 유지되도록 clamp.
  const restZoneIds = new Set(
    zones.filter((z) => (z as any).type === 'rest').map((z) => z.id as string),
  );
  const nZones = zones.length - restZoneIds.size;
  const lowMax = nZones > 0 ? Math.max(1, Math.floor(nZones * EARLY_EXIT_ZONE_RATIO)) : 0;
  const highMin = nZones > 0 ? Math.max(lowMax + 1, Math.ceil(nZones * COMPLETION_ZONE_RATIO)) : 0;
  const fb = { zero: 0, low: 0, mid: 0, high: 0 };
  for (const v of exited) {
    const n = v.visitedZoneIds.reduce(
      (acc, id) => (restZoneIds.has(id as string) ? acc : acc + 1),
      0,
    );
    if (n === 0) fb.zero++;
    else if (n <= lowMax) fb.low++;
    else if (n >= highMin) fb.high++;
    else fb.mid++;
  }

  // ---- Derived top-level KPIs --------------------------------------------
  // 완주율 = ≥80% 존 방문 / 퇴장자.
  const completionRate = exited.length > 0 ? fb.high / exited.length : 0;
  // 퇴장률 = 퇴장자 / 전체 스폰. "시뮬 시간 안에 투어를 마친 사람" 비율 (다른 차원의 정보).
  const exitRate = visitors.length > 0 ? exited.length / visitors.length : 0;
  // Average stay covers exited visitors (completed dwell) and active visitors (current dwell so far)
  // so the KPI is non-zero even before anyone exits.
  const avgDwellMs = visitors.length > 0
    ? visitors.reduce((s, v) => s + ((v.exitedAt ?? durationMs) - v.enteredAt), 0) / visitors.length
    : 0;
  const minutesElapsed = durationMs / MS_MIN;
  const throughputPerMin = minutesElapsed > 0 ? totalExited / minutesElapsed : 0;

  // ---- Bottleneck count (>0.5 ever) --------------------------------------
  // Both sets share the same score threshold so the ratio never exceeds 1.
  const everBottle = new Set<string>();
  const everGroupInduced = new Set<string>();
  for (const entry of kpiHistory) {
    for (const b of entry.snapshot.bottlenecks) {
      if (b.score > 0.5) {
        everBottle.add(b.zoneId as string);
        if (b.isGroupInduced) everGroupInduced.add(b.zoneId as string);
      }
    }
  }

  // ---- Insights → findings ----------------------------------------------
  const insights = generateInsights(latestSnapshot, zones, media, mediaStats, visitors, groups, t);
  const findings: ReportFinding[] = insights
    .slice(0, 6)
    .map((e, i) => findingFromInsight(e, i));

  // ---- Key moment --------------------------------------------------------
  const keyMoments = extractKeyMoments(kpiHistory);
  // KeyMomentKind: peak_congestion / first_bottleneck / peak_fatigue / peak_active / final
  const peakMomentMs = keyMoments.find((k) => k.kind === 'peak_congestion')?.timestampMs
    ?? keyMoments[0]?.timestampMs
    ?? null;
  const peakMoment = peakMomentMs != null ? fmtClock(peakMomentMs) : null;

  // ---- Peak-moment zone ranking ----------------------------------------
  let peakRanking: ReportPeakRankRow[] = [];
  if (peakMomentMs != null && kpiHistory.length > 0) {
    const nearest = kpiHistory.reduce((best, entry) =>
      Math.abs(entry.timestamp - peakMomentMs) < Math.abs(best.timestamp - peakMomentMs) ? entry : best,
    kpiHistory[0]);
    const zoneNameMap = new Map(zones.map((z) => [z.id as string, z.name]));
    peakRanking = nearest.snapshot.zoneUtilizations
      .filter((u) => u.currentOccupancy > 0 || u.capacity > 0)
      .map((u) => ({
        id: u.zoneId as string,
        name: zoneNameMap.get(u.zoneId as string) ?? '—',
        occ: u.currentOccupancy,
        cap: u.capacity,
        pct: u.capacity > 0 ? Math.round((u.currentOccupancy / u.capacity) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 8);
  }

  // ---- Meta --------------------------------------------------------------
  // Run ID uniquely identifies each simulation execution (timestamp + structural hash).
  // Falls back to "run_unknown" when a report is rendered without a completed run
  // (shouldn't happen in practice because the hero gates on hasSim).
  const resolvedRunId = runId ?? 'run_unknown';
  const mode = scenario.simulationConfig.simulationMode ?? 'time';
  const totalConfigured = scenario.visitorDistribution.totalCount ?? 0;
  // "잘림" 판정: 스폰이 목표에 못 미쳤거나(입장 못한 사람) 활성 visitor 가 남아있음(관람 중 잘림).
  // time 모드: Duration 도달로 자연 종료, person 모드: Max Duration safety cap 발동 — 둘 다 같은 증상.
  const trimmed = visitors.length < totalConfigured || active.length > 0;
  const meta: ReportMeta = {
    id: resolvedRunId,
    projectName: scenario.meta.name,
    generated: fmtDateStamp(),
    duration: fmtDuration(durationMs),
    visitors: visitors.length,
    active: active.length,
    exited: exited.length,
    runId: resolvedRunId,
    peakMoment,
    mode,
    trimmed,
    totalConfigured,
  };

  // ---- Evidence (TL;DR) --------------------------------------------------
  const mediaActivationPct = media.length > 0 ? Math.round((mediaActiveCount / media.length) * 100) : 0;
  const mediaActivationRatio = media.length > 0 ? mediaActiveCount / media.length : 0;

  // ---- Key verdict — first matching signal wins ------------------------
  const verdictPct = (r: number) => Math.round(r * 100);
  let headline: ReportHeadline;
  if (peakUtilRatio > 1) {
    headline = {
      tone: 'critical',
      a: t('vela.verdict.over.a', { zone: peakZoneName, pct: verdictPct(peakUtilRatio) }),
      b: t('vela.verdict.over.b'),
    };
  } else if (everBottle.size > 0 && everGroupInduced.size > 0 && everGroupInduced.size / everBottle.size >= 0.5) {
    headline = {
      tone: 'warning',
      a: t('vela.verdict.group.a', { count: everBottle.size, induced: everGroupInduced.size }),
      b: t('vela.verdict.group.b'),
    };
  } else if (globalSkipRate > 0.4) {
    headline = {
      tone: 'warning',
      a: t('vela.verdict.skip.a', { pct: verdictPct(globalSkipRate) }),
      b: t('vela.verdict.skip.b'),
    };
  } else if (p90Fat > 0.7) {
    headline = {
      tone: 'warning',
      a: t('vela.verdict.fatigue.a', { pct: verdictPct(p90Fat) }),
      b: t('vela.verdict.fatigue.b'),
    };
  } else if (completionRate < 0.3 && exited.length >= 10) {
    headline = {
      tone: 'warning',
      a: t('vela.verdict.completion.a', { pct: verdictPct(completionRate) }),
      b: t('vela.verdict.completion.b'),
    };
  } else if (mediaActivationRatio < 0.5 && media.length > 0) {
    headline = {
      tone: 'warning',
      a: t('vela.verdict.activation.a', { pct: verdictPct(mediaActivationRatio) }),
      b: t('vela.verdict.activation.b'),
    };
  } else {
    headline = {
      tone: 'healthy',
      a: t('vela.verdict.balanced.a', {
        peak: verdictPct(peakUtilRatio),
        activation: verdictPct(mediaActivationRatio),
        skip: verdictPct(globalSkipRate),
      }),
      b: t('vela.verdict.balanced.b'),
    };
  }

  const evidence: ReportEvidence[] = [
    {
      label: t('vela.ev.peak.label'),
      value: `${Math.round(peakUtilRatio * 100)}%`,
      tone: peakUtilRatio > 1 ? 'bad' : peakUtilRatio > 0.85 ? 'warn' : 'ok',
      note: peakUtilRatio > 1 ? t('vela.ev.peak.noteOver', { zone: peakZoneName }) : t('vela.ev.peak.note', { zone: peakZoneName }),
    },
    {
      label: t('vela.ev.fatigue.label'),
      value: `${Math.round(p90Fat * 100)}%`,
      tone: p90Fat > 0.8 ? 'bad' : p90Fat > 0.6 ? 'warn' : 'ok',
      note: t('vela.ev.fatigue.note'),
    },
    {
      label: t('vela.ev.activation.label'),
      value: `${mediaActivationPct}%`,
      tone: mediaActivationPct >= 80 ? 'ok' : mediaActivationPct >= 50 ? 'warn' : 'bad',
      note: t('vela.ev.activation.note', { total: media.length, active: mediaActiveCount }),
    },
    {
      label: t('vela.ev.skip.label'),
      value: `${Math.round(globalSkipRate * 100)}%`,
      tone: globalSkipRate > 0.5 ? 'bad' : globalSkipRate > 0.3 ? 'warn' : 'ok',
      note: t('vela.ev.skip.note', { views: totalWatches, skips: totalSkips }),
    },
  ];

  // ---- KPIs --------------------------------------------------------------
  const peakPct = Math.round(peakUtilRatio * 100);
  const kpis: ReportKpi[] = [
    {
      key: 'peak',
      label: t('vela.kpi.peak.label'),
      value: String(peakPct),
      unit: '%',
      tone: peakUtilRatio > 1 ? 'warn' : undefined,
      note: t('vela.kpi.peak.note', { zone: peakZoneName }),
      hero: true,
      bar: { pct: peakPct, cap: 100, max: Math.max(120, peakPct + 10), danger: peakUtilRatio > 1 },
    },
    {
      key: 'visitors',
      label: t('vela.kpi.visitors.label'),
      value: String(visitors.length),
      note: t('vela.kpi.visitors.note', { active: active.length, exited: exited.length }),
    },
    {
      key: 'stay',
      label: t('vela.kpi.stay.label'),
      value: (avgDwellMs / MS_MIN).toFixed(1),
      unit: t('vela.kpi.stay.unit'),
      note: t('vela.kpi.stay.note', { pct: Math.round(completionRate * 100) }),
    },
    {
      key: 'fatigue',
      label: t('vela.kpi.fatigue.label'),
      value: String(Math.round(avgFat * 100)),
      unit: '%',
      note: t('vela.kpi.fatigue.note', { pct: Math.round(p90Fat * 100) }),
    },
    {
      key: 'skip',
      label: t('vela.kpi.skip.label'),
      value: String(Math.round(globalSkipRate * 100)),
      unit: '%',
      tone: globalSkipRate > 0.3 ? 'amb' : undefined,
      note: t('vela.kpi.skip.note', { watches: totalWatches, skips: totalSkips }),
    },
    {
      key: 'bottleneck',
      label: t('vela.kpi.bottleneck.label'),
      value: String(everBottle.size),
      note: t('vela.kpi.bottleneck.note', { count: everGroupInduced.size }),
    },
    {
      key: 'throughput',
      label: t('vela.kpi.throughput.label'),
      value: throughputPerMin.toFixed(1),
      unit: t('vela.kpi.throughput.unit'),
      note: t('vela.kpi.throughput.note'),
    },
  ];

  // ---- Floors (normalized bounds) ----------------------------------------
  const floorsOut: ReportFloor[] = floors.map((f) => {
    const floorZones = zones.filter((z) => f.zoneIds.includes(z.id));
    if (floorZones.length === 0) {
      return {
        floorId: f.id as string,
        name: f.name,
        cap: 0,
        rooms: [],
        boundsWorld: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const z of floorZones) {
      minX = Math.min(minX, z.bounds.x);
      minY = Math.min(minY, z.bounds.y);
      maxX = Math.max(maxX, z.bounds.x + z.bounds.w);
      maxY = Math.max(maxY, z.bounds.y + z.bounds.h);
    }
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const pad = 0.04;
    const cap = floorZones.reduce((s, z) => s + z.capacity, 0);
    const rooms: ReportFloorRoom[] = floorZones.map((z) => {
      const util = latestSnapshot.zoneUtilizations.find((u) => u.zoneId === z.id);
      const occ = util?.peakOccupancy ?? 0;
      return {
        label: z.name,
        x: pad + ((z.bounds.x - minX) / spanX) * (1 - pad * 2),
        y: pad + ((z.bounds.y - minY) / spanY) * (1 - pad * 2),
        w: (z.bounds.w / spanX) * (1 - pad * 2),
        h: (z.bounds.h / spanY) * (1 - pad * 2),
        occ,
        cap: z.capacity,
      };
    });
    return {
      floorId: f.id as string,
      name: f.name,
      cap,
      rooms,
      boundsWorld: { minX, minY, maxX, maxY },
    };
  });

  // ---- Timeline (downsampled from kpiHistory) ----------------------------
  const MAX_POINTS = 120;
  const step = kpiHistory.length > MAX_POINTS ? Math.ceil(kpiHistory.length / MAX_POINTS) : 1;
  const timeline: ReportTimelinePoint[] = [];
  for (let i = 0; i < kpiHistory.length; i += step) {
    const entry = kpiHistory[i];
    const snap = entry.snapshot;
    let maxRatio = 0;
    for (const u of snap.zoneUtilizations) {
      const cap = u.capacity > 0 ? u.capacity : 1;
      const r = u.currentOccupancy / cap;
      if (r > maxRatio) maxRatio = r;
    }
    const activeAt = snap.zoneUtilizations.reduce((s, u) => s + u.currentOccupancy, 0);
    const exitedAt = snap.flowEfficiency?.totalVisitorsProcessed ?? 0;
    timeline.push({
      t: Math.round(entry.timestamp / 1000),
      crowdPct: Math.round(maxRatio * 100),
      fatiguePct: Math.round((snap.fatigueDistribution?.mean ?? 0) * 100),
      active: activeAt,
      exited: exitedAt,
    });
  }
  if (timeline.length === 0) {
    timeline.push({
      t: 0,
      crowdPct: Math.round(peakUtilRatio * 100),
      fatiguePct: Math.round(avgFat * 100),
      active: active.length,
      exited: totalExited,
    });
  }

  // ---- Zone dwell-time legend -------------------------------------------
  // Share of cumulative time spent in each zone (meanDwell × visitors who
  // completed a dwell). More informative than visit counts, which are
  // uniform when every visitor traverses every zone (sequential flow).
  const zoneDwellMin = new Map<string, number>();
  for (const d of latestSnapshot.visitDurations) {
    const totalMin = (d.meanDurationMs * d.sampleCount) / MS_MIN;
    if (totalMin > 0) zoneDwellMin.set(d.zoneId as string, totalMin);
  }
  const totalDwellMin = [...zoneDwellMin.values()].reduce((s, v) => s + v, 0);
  const zoneVisitLegend = zoneRows
    .map((z) => {
      const dwellMin = zoneDwellMin.get(z.id) ?? 0;
      const pct = totalDwellMin > 0 ? Math.round((dwellMin / totalDwellMin) * 100) : 0;
      return { id: z.id, name: z.name, dwellMin: Math.round(dwellMin * 10) / 10, pct };
    })
    .filter((z) => z.dwellMin > 0)
    .sort((a, b) => b.dwellMin - a.dwellMin);

  // ---- System overview ---------------------------------------------------
  const totalArea = zones.reduce((s, z) => s + z.area, 0);
  const totalCap = zones.reduce((s, z) => s + z.capacity, 0);
  const mediaCap = media.reduce((s, m) => s + (m.capacity ?? 0), 0);
  // Time-averaged crowding across the whole run (not the last snapshot).
  let crowdSum = 0;
  let crowdSamples = 0;
  for (const entry of kpiHistory) {
    const occ = entry.snapshot.zoneUtilizations.reduce((s, u) => s + u.currentOccupancy, 0);
    if (totalCap > 0) {
      crowdSum += occ / totalCap;
      crowdSamples++;
    }
  }
  const avgCrowdingPct = crowdSamples > 0 ? Math.round((crowdSum / crowdSamples) * 100) : 0;
  let interpretation: string | null = null;
  if (peakUtilRatio > 1) {
    interpretation = t('vela.sys.interp.over', { zone: peakZoneName, pct: Math.round(peakUtilRatio * 100) });
  } else if (peakUtilRatio > 0.85) {
    interpretation = t('vela.sys.interp.near', { zone: peakZoneName, pct: Math.round(peakUtilRatio * 100) });
  }
  // Configured spawn rate: prefer active timeslot, fall back to the legacy distribution mirror.
  const configuredSpawnRps =
    scenario.simulationConfig?.timeSlots?.[0]?.spawnRatePerSecond
    ?? scenario.visitorDistribution?.spawnRatePerSecond
    ?? 0;
  const spawnRatePerMin = configuredSpawnRps * 60;
  const system: ReportSystemOverview = {
    zonesCount: zones.length,
    mediaCount: media.length,
    totalAreaM2: Math.round(totalArea * 10) / 10,
    totalCapacity: totalCap,
    mediaCapacity: mediaCap,
    avgCrowdingPct,
    avgDwellMin: avgDwellMs / MS_MIN,
    throughputPerMin,
    spawnRatePerMin,
    interpretation,
  };

  // ---- Flow --------------------------------------------------------------
  // (fb bucket counts computed earlier alongside completionRate)
  const exTotal = Math.max(1, exited.length);
  const completionDist: ReportCompositionRow[] = [
    { label: t('vela.flow.dist.zero'), count: fb.zero, pct: Math.round((fb.zero / exTotal) * 100), tone: 'danger' },
    { label: t('vela.flow.dist.low', { max: lowMax }), count: fb.low, pct: Math.round((fb.low / exTotal) * 100), tone: 'warn' },
    { label: t('vela.flow.dist.mid', { lo: lowMax + 1, hi: highMin - 1 }), count: fb.mid, pct: Math.round((fb.mid / exTotal) * 100) },
    { label: t('vela.flow.dist.high', { min: highMin }), count: fb.high, pct: Math.round((fb.high / exTotal) * 100), tone: 'ok' },
  ];
  const earlyExitRate = exited.length > 0 ? (fb.zero + fb.low) / exited.length : 0;
  const groupInducedPct = everBottle.size > 0 ? everGroupInduced.size / everBottle.size : 0;

  // Avg total duration among *completed* visitors (fall back to all if none exited yet).
  const exitedDwellMs = exited.length > 0
    ? exited.reduce((s, v) => s + ((v.exitedAt ?? durationMs) - v.enteredAt), 0) / exited.length
    : avgDwellMs;

  // ---- Top routes (from visitor zone sequences) -------------------------
  const zoneNameById = new Map(zones.map((z) => [z.id as string, z.name]));
  const routeCounts = new Map<string, { count: number; path: string }>();
  let routedVisitors = 0;
  for (const v of visitors) {
    if (v.visitedZoneIds.length < 2) continue;
    const ids = v.visitedZoneIds.map((id) => id as string);
    const names = ids.map((id) => zoneNameById.get(id) ?? '—');
    const path = names.join(' → ');
    const key = ids.join('|');
    const prev = routeCounts.get(key);
    if (prev) prev.count++;
    else routeCounts.set(key, { count: 1, path });
    routedVisitors++;
  }
  const topRoutes = [...routeCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((r) => ({
      path: r.path,
      count: r.count,
      pct: routedVisitors > 0 ? Math.round((r.count / routedVisitors) * 100) : 0,
    }));

  // ---- Dwell histogram (exited visitors only) --------------------------
  // Buckets in minutes: [0,2), [2,5), [5,10), [10,15), [15,20), [20,30), [30,45), [45,+∞)
  const DWELL_EDGES = [0, 2, 5, 10, 15, 20, 30, 45, Infinity];
  const dwellCounts = new Array(DWELL_EDGES.length - 1).fill(0);
  const dwellMinsSorted: number[] = [];
  for (const v of exited) {
    const min = ((v.exitedAt ?? durationMs) - v.enteredAt) / MS_MIN;
    dwellMinsSorted.push(min);
    for (let i = 0; i < DWELL_EDGES.length - 1; i++) {
      if (min >= DWELL_EDGES[i] && min < DWELL_EDGES[i + 1]) { dwellCounts[i]++; break; }
    }
  }
  dwellMinsSorted.sort((a, b) => a - b);
  const dwellTotal = Math.max(1, exited.length);
  const dwellHist: ReportDwellBucket[] = dwellCounts.map((count, i) => {
    const lo = DWELL_EDGES[i];
    const hi = DWELL_EDGES[i + 1];
    const label = hi === Infinity ? `${lo}m+` : `${lo}-${hi}m`;
    return { label, count, pct: Math.round((count / dwellTotal) * 100) };
  });
  const dwellAt = (p: number) => dwellMinsSorted.length > 0
    ? dwellMinsSorted[Math.min(dwellMinsSorted.length - 1, Math.floor(dwellMinsSorted.length * p))]
    : 0;

  // ---- Entry / exit node distribution ----------------------------------
  const nodeLabelById = new Map<string, string>();
  if (waypointGraph) {
    for (const n of waypointGraph.nodes) {
      nodeLabelById.set(n.id as string, n.label || (n.id as string).slice(0, 6));
    }
  }
  const buildDist = (src: ReadonlyMap<string, number>): ReportNodeDistRow[] => {
    const total = [...src.values()].reduce((s, n) => s + n, 0);
    return [...src.entries()]
      .filter(([, c]) => c > 0)
      .map(([nodeId, count]) => ({
        nodeId,
        label: nodeLabelById.get(nodeId) ?? nodeId.slice(0, 6),
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  };
  const entryDist = buildDist(spawnByNode);
  const exitDist = buildDist(exitByNode);

  // ---- Zone transition matrix (A → B counts from visitedZoneIds) --------
  const transitionZoneIds = zones.map((z) => z.id as string);
  const transitionZoneNames = new Map(zones.map((z) => [z.id as string, z.name]));
  const transitionCounts = new Map<string, Map<string, number>>();
  const rowTotals = new Map<string, number>();
  for (const v of visitors) {
    const ids = v.visitedZoneIds.map((id) => id as string);
    for (let i = 0; i < ids.length - 1; i++) {
      const from = ids[i], to = ids[i + 1];
      if (from === to) continue;
      if (!transitionCounts.has(from)) transitionCounts.set(from, new Map());
      const row = transitionCounts.get(from)!;
      row.set(to, (row.get(to) ?? 0) + 1);
      rowTotals.set(from, (rowTotals.get(from) ?? 0) + 1);
    }
  }
  const transitionCells: ReportTransitionCell[] = [];
  for (const [fromId, row] of transitionCounts) {
    const rowTotal = rowTotals.get(fromId) ?? 0;
    for (const [toId, count] of row) {
      transitionCells.push({
        fromId,
        fromName: transitionZoneNames.get(fromId) ?? '—',
        toId,
        toName: transitionZoneNames.get(toId) ?? '—',
        count,
        pct: rowTotal > 0 ? Math.round((count / rowTotal) * 100) : 0,
      });
    }
  }
  // Only include zones that actually participated (either as from or to)
  const transitionZoneSet = new Set<string>();
  for (const c of transitionCells) { transitionZoneSet.add(c.fromId); transitionZoneSet.add(c.toId); }
  const transitionZones = transitionZoneIds
    .filter((id) => transitionZoneSet.has(id))
    .map((id) => ({ id, name: transitionZoneNames.get(id) ?? '—' }));

  // ---- Active (non-exited) breakdown ----------------------------------
  // 시뮬 종료 시점에 아직 장내에 남아있는 방문자를 action + 현재 zone 별로 집계.
  // "Entry 수 − Exit 수" 괴리의 실체를 드러내기 위함.
  const activeTotal = active.length;
  const actionCounts = new Map<string, number>();
  const activeZoneCounts = new Map<string, number>();
  for (const v of active) {
    const act = v.currentAction as string;
    actionCounts.set(act, (actionCounts.get(act) ?? 0) + 1);
    const zid = (v.currentZoneId as string) ?? '';
    activeZoneCounts.set(zid, (activeZoneCounts.get(zid) ?? 0) + 1);
  }
  const ACTION_ORDER: ReadonlyArray<[string, string]> = [
    ['MOVING', t('vela.flow.active.action.moving')],
    ['WATCHING', t('vela.flow.active.action.watching')],
    ['WAITING', t('vela.flow.active.action.waiting')],
    ['RESTING', t('vela.flow.active.action.resting')],
    ['IDLE', t('vela.flow.active.action.idle')],
    ['EXITING', t('vela.flow.active.action.exiting')],
  ];
  const activeByAction: ReportCompositionRow[] = ACTION_ORDER
    .map(([key, label]) => {
      const n = actionCounts.get(key) ?? 0;
      return {
        label,
        count: n,
        pct: activeTotal > 0 ? Math.round((n / activeTotal) * 100) : 0,
      };
    })
    .filter((r) => r.count > 0);
  const activeByZone: ReportActiveZoneRow[] = [...activeZoneCounts.entries()]
    .map(([zid, count]) => ({
      id: zid,
      name: zid ? (zoneNameById.get(zid) ?? zid.slice(0, 6)) : t('vela.flow.active.zone.outside'),
      count,
      pct: activeTotal > 0 ? Math.round((count / activeTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const activeBreakdown: ReportActiveBreakdown = {
    total: activeTotal,
    byAction: activeByAction,
    byZone: activeByZone,
  };

  const flowMode = (scenario.globalFlowMode ?? 'free') as 'free' | 'sequential' | 'hybrid';
  const flow: ReportFlow = {
    completed: exited.length,
    avgTotalMin: exitedDwellMs / MS_MIN,
    throughputPerMin,
    spawnRatePerMin,
    completionRate,
    earlyExitRate,
    completionThreshold: highMin,
    earlyExitThreshold: lowMax,
    exitRate,
    groupInducedBottleneckPct: groupInducedPct,
    completionDist,
    bottleneckCount: everBottle.size,
    topRoutes,
    flowMode,
    dwellHist,
    dwellStats: {
      medianMin: dwellAt(0.5),
      p90Min: dwellAt(0.9),
      p99Min: dwellAt(0.99),
    },
    entryDist,
    exitDist,
    transitionMatrix: {
      zones: transitionZones,
      cells: transitionCells,
    },
    activeBreakdown,
  };

  // ---- Behavior (visitor composition) -----------------------------------
  const catCounts = new Map<string, number>();
  for (const v of visitors) catCounts.set(v.category, (catCounts.get(v.category) ?? 0) + 1);
  const total = Math.max(1, visitors.length);
  const composition: ReportCompositionRow[] = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }));
  const behavior: ReportBehavior = {
    groupsCount: groups.length,
    composition,
    groupInducedBottleneckPct: groupInducedPct,
  };

  // ---- Media totals ------------------------------------------------------
  const totalWatchMs = [...mediaStats.values()].reduce((s, v) => s + (v.totalWatchMs ?? 0), 0);
  const mediaTotals: ReportMediaTotals = {
    totalViews: totalWatches,
    totalSkips,
    totalWatchMin: Math.round(totalWatchMs / MS_MIN),
    activationPct: mediaActivationPct,
    activationRatio: `${mediaActiveCount}/${media.length}`,
  };

  // ---- Mode Perspective (Phase 1 UX, 2026-04-26) -----------------------
  // 본문 11 섹션 위에 덧대는 _렌즈_. 모드별로 핵심 KPI 와 총평 어조가 달라짐.
  // 미설정 시 inferExperienceMode 로 entryPolicy.mode 기반 추정 (legacy 호환).
  const resolvedMode: ExperienceMode = scenario.experienceMode
    ?? inferExperienceMode(scenario.simulationConfig.operations?.entryPolicy?.mode);
  const perspective = buildPerspective({
    mode: resolvedMode,
    findings,
    peakUtilRatio,
    mediaActivationRatio,
    completionRate,
    globalSkipRate,
    p90Fat,
    entryQueue: entryQueueSnapshot,
    t,
  });

  // ---- Glossary ---------------------------------------------------------
  const glossary: ReportGlossaryEntry[] = [
    { term: t('vela.gl.peak.term'), def: t('vela.gl.peak.def') },
    { term: t('vela.gl.density.term'), def: t('vela.gl.density.def') },
    { term: t('vela.gl.bottleneck.term'), def: t('vela.gl.bottleneck.def') },
    { term: t('vela.gl.completion.term'), def: t('vela.gl.completion.def') },
    { term: t('vela.gl.skip.term'), def: t('vela.gl.skip.def') },
    { term: t('vela.gl.engagement.term'), def: t('vela.gl.engagement.def') },
    { term: t('vela.gl.fatigue.term'), def: t('vela.gl.fatigue.def') },
    { term: t('vela.gl.group.term'), def: t('vela.gl.group.def') },
  ];

  return {
    meta,
    headline,
    perspective,
    evidence,
    kpis,
    findings,
    zones: zoneRows,
    zoneVisitLegend,
    media: mediaRows,
    mediaTotals,
    fatigueHist,
    fatigueStats: { avg: avgFat, median: medFat, p90: p90Fat, p99: p99Fat },
    floors: floorsOut,
    topMedia,
    bottomMedia,
    timeline,
    peakMomentMs,
    peakRanking,
    system,
    flow,
    behavior,
    glossary,
  };
}
