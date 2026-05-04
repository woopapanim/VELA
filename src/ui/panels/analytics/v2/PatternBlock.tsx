import { Clock, Users, MapPin, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import type { TimeSlicePattern, TrendShape, MetricTrend } from '@/analytics/patterns/timeSlices';
import type { ZoneSlicePattern, ZoneSliceEntry } from '@/analytics/patterns/zoneSlices';
import type { ProfileEngagement, VisitorProfileType } from '@/domain';
import { NORMS, evaluateNorm, type NormStatus } from '@/analytics/norms';
import { Sparkline } from '@/ui/components/Sparkline';

interface Props {
  pattern: TimeSlicePattern | null;
  zonePattern: ZoneSlicePattern | null;
  engagementByProfile: Readonly<Partial<Record<VisitorProfileType, ProfileEngagement>>>;
  zoneCount: number;
  mediaCount: number;
  onSelectZone?: (zoneId: string) => void;
  selectedZoneId?: string | null;
  onSelectSlice?: (sliceIndex: number) => void;
  selectedSliceIndex?: number | null;
  onSelectProfile?: (profile: VisitorProfileType) => void;
  selectedProfile?: VisitorProfileType | null;
}

interface MetricRow {
  label: string;
  values: readonly (number | null)[];
  formatter: (v: number) => string;
  evaluate: (v: number) => NormStatus;
  shape: TrendShape;
}

// Monochrome 기본, bad 만 빨강. 셀마다 색을 덮으면 verdict strip 위계가 무너진다 (2026-04-30).
const STATUS_BG: Record<NormStatus, string> = {
  good:    'bg-secondary/40 text-foreground/85',
  warn:    'bg-foreground/[0.06] text-foreground',
  bad:     'bg-[var(--status-danger)]/12 text-[var(--status-danger)]',
  unknown: 'bg-secondary/25 text-muted-foreground',
};

const SHAPE_LABEL: Record<TrendShape, string> = {
  flat: '안정',
  worsening: '악화',
  improving: '개선',
  late_spike: '후반 급변',
  early_spike: '초반 후 안정',
  unknown: '—',
};

// 추세 라벨도 bad-급(악화/late_spike) 만 빨강. 그 외는 monochrome.
const SHAPE_TONE: Record<TrendShape, string> = {
  flat: 'text-muted-foreground',
  worsening: 'text-[var(--status-danger)]',
  improving: 'text-foreground/75',
  late_spike: 'text-[var(--status-danger)]',
  early_spike: 'text-foreground/70',
  unknown: 'text-muted-foreground/60',
};

const PROFILE_LABEL: Record<VisitorProfileType, string> = {
  general: '일반',
  vip: 'VIP',
  child: '어린이',
  elderly: '어르신',
  disabled: '장애인',
};

function ShapeIcon({ shape }: { shape: TrendShape }) {
  switch (shape) {
    case 'worsening':
    case 'late_spike':
      return <TrendingUp className="w-3 h-3" />;
    case 'improving':
      return <TrendingDown className="w-3 h-3" />;
    case 'early_spike':
      return <AlertCircle className="w-3 h-3" />;
    case 'flat':
    case 'unknown':
    default:
      return <Minus className="w-3 h-3" />;
  }
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function evalThroughput(): NormStatus {
  // throughput norm 미정의 — 단순 unknown 처리.
  return 'unknown';
}

export function PatternBlock({
  pattern,
  zonePattern,
  engagementByProfile,
  zoneCount,
  mediaCount,
  onSelectZone,
  selectedZoneId,
  onSelectSlice,
  selectedSliceIndex,
  onSelectProfile,
  selectedProfile,
}: Props) {
  const profileEntries = (Object.entries(engagementByProfile) as [VisitorProfileType, ProfileEngagement][])
    .filter(([, e]) => e && e.sampleCount > 0)
    .sort((a, b) => b[1].sampleCount - a[1].sampleCount);

  const hasTimePattern = pattern !== null;
  const hasZonePattern = zonePattern !== null && zonePattern.entries.length > 0;
  const hasPersonaData = profileEntries.length >= 2;

  if (!hasTimePattern && !hasZonePattern && !hasPersonaData) {
    return null;
  }

  // 각 서브섹션 = 독립 카드 (border/bg). 외곽 wrapper 폐기 — 사용자가 "카드 구분해줘" (2026-04-30).
  // 시간/공간 패턴은 lg+ 2-col, 페르소나는 가변 col 수라 full-width row.
  const cardCls = 'rounded-xl border border-border bg-[var(--surface)] p-3.5';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {hasTimePattern && (
        <section className={cardCls}>
          <TimeSection
            pattern={pattern!}
            onSelectSlice={onSelectSlice}
            selectedSliceIndex={selectedSliceIndex ?? null}
          />
        </section>
      )}
      {hasZonePattern && (
        <section className={cardCls}>
          <SpaceSection
            pattern={zonePattern!}
            onSelectZone={onSelectZone}
            selectedZoneId={selectedZoneId ?? null}
          />
        </section>
      )}
      {hasPersonaData && (
        <section className={`${cardCls} lg:col-span-2`}>
          <PersonaSection
            entries={profileEntries}
            zoneCount={zoneCount}
            mediaCount={mediaCount}
            onSelectProfile={onSelectProfile}
            selectedProfile={selectedProfile ?? null}
          />
        </section>
      )}
    </div>
  );
}

// ─── 시간 패턴 ───────────────────────────────────────────────────────
function TimeSection({
  pattern,
  onSelectSlice,
  selectedSliceIndex,
}: {
  pattern: TimeSlicePattern;
  onSelectSlice?: (i: number) => void;
  selectedSliceIndex: number | null;
}) {
  const { slices, trend } = pattern;
  const interactive = Boolean(onSelectSlice);

  const rows: MetricRow[] = [
    {
      label: '정체 시간%',
      values: slices.map((s) => s.congestionRatio),
      formatter: pct,
      evaluate: (v) => evaluateNorm(NORMS.congestion_time_ratio, v),
      shape: trend.congestion,
    },
    {
      label: '스킵률',
      values: slices.map((s) => s.skipRate),
      formatter: pct,
      evaluate: (v) => evaluateNorm(NORMS.skip_rate, v),
      shape: trend.skip,
    },
    {
      label: '시간당 처리',
      values: slices.map((s) => s.throughputPerHour),
      formatter: (v) => `${Math.round(v)}/h`,
      evaluate: evalThroughput,
      shape: trend.throughput,
    },
    {
      label: '평균 피로도',
      values: slices.map((s) => s.fatigueMean),
      formatter: pct,
      evaluate: (v) => evaluateNorm(NORMS.fatigue_mean, v),
      shape: trend.fatigue,
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-3.5 h-3.5 text-foreground/60" aria-hidden="true" />
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">시간 패턴</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
          시뮬레이션 4구간{interactive && ' · 클릭하여 분해'}
        </span>
        {trend.highlight && <Highlight trend={trend.highlight} />}
      </div>

      {/* Slice 선택 strip — drilldown 진입점 */}
      <div className="flex items-center gap-1 mb-2 text-[10px]">
        {slices.map((s) => {
          const isSelected = selectedSliceIndex === s.index;
          if (!interactive) {
            return (
              <span
                key={s.index}
                className="px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground uppercase tracking-wider"
              >
                {s.label}
              </span>
            );
          }
          return (
            <button
              key={s.index}
              type="button"
              onClick={() => onSelectSlice!(s.index)}
              className={`px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors ${
                isSelected
                  ? 'bg-primary/15 ring-1 ring-primary/40 text-foreground'
                  : 'bg-secondary/30 text-muted-foreground/80 hover:bg-secondary hover:text-foreground'
              }`}
              aria-pressed={isSelected}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        {rows.map((row) => (
          <TimeRow key={row.label} row={row} />
        ))}
      </div>
    </div>
  );
}

function TimeRow({ row }: { row: MetricRow }) {
  const lastVal = row.values[row.values.length - 1];
  const lastStatus: NormStatus = lastVal === null ? 'unknown' : row.evaluate(lastVal);
  // Worst slice — 가장 심각한 시점의 라벨
  const worstSlice = pickWorstSlice(row);
  const sparkStatus: 'good' | 'warn' | 'bad' | 'unknown' =
    row.values.some((v) => v !== null && row.evaluate(v) === 'bad')
      ? 'bad'
      : row.values.some((v) => v !== null && row.evaluate(v) === 'warn')
      ? 'warn'
      : lastStatus;

  // norm threshold (bad 진입 임계) — sparkline 위 dashed line 으로.
  const threshold = pickThreshold(row);
  const numericValues = row.values.map((v) => (v === null ? null : v));
  const finite = numericValues.filter((v): v is number => v !== null);
  // 도메인: ratio metric (0~1) 은 0~max(현재값·임계·0.4) 로 고정해 평탄해보이지 않게.
  // throughput 처럼 norm 없는 metric 은 min/max 자동.
  const isRatioMetric = threshold !== null;
  const max = finite.length > 0 ? Math.max(...finite) : 1;
  const min = finite.length > 0 ? Math.min(...finite) : 0;
  const domain: [number, number] | undefined = finite.length > 0
    ? isRatioMetric
      ? [0, Math.max(max * 1.1, (threshold ?? 0) * 1.3, 0.4)]
      : [Math.max(0, min - (max - min) * 0.1), max + (max - min) * 0.1 + 1]
    : undefined;

  return (
    <div className="grid grid-cols-[88px_1fr_56px_88px] gap-2 items-center">
      <span className="text-[11px] text-muted-foreground/90 truncate">{row.label}</span>
      <div className="h-7 flex items-center">
        <Sparkline
          data={numericValues}
          width={180}
          height={28}
          status={sparkStatus}
          threshold={threshold ?? undefined}
          domain={domain}
          fill
          endDot
          className="w-full"
        />
      </div>
      <span
        className={`text-[11px] font-data tabular-nums text-right ${
          lastStatus === 'bad' ? 'text-[var(--status-danger)]'
          : lastStatus === 'warn' ? 'text-foreground'
          : lastStatus === 'unknown' ? 'text-muted-foreground'
          : 'text-foreground/85'
        }`}
        title={lastVal === null ? '데이터 부족' : `최종 ${row.formatter(lastVal)}`}
      >
        {lastVal === null ? '—' : row.formatter(lastVal)}
      </span>
      <div className={`flex items-center justify-end gap-1 text-[10px] ${SHAPE_TONE[row.shape]}`}>
        <ShapeIcon shape={row.shape} />
        <span className="truncate">
          {worstSlice ? `${SHAPE_LABEL[row.shape]} · ${worstSlice}↑` : SHAPE_LABEL[row.shape]}
        </span>
      </div>
    </div>
  );
}

function pickWorstSlice(row: MetricRow): string | null {
  let worstIdx = -1;
  let worstRank = -1;
  for (let i = 0; i < row.values.length; i++) {
    const v = row.values[i];
    if (v === null) continue;
    const s = row.evaluate(v);
    const rank = s === 'bad' ? 3 : s === 'warn' ? 2 : 0;
    if (rank > worstRank) { worstRank = rank; worstIdx = i; }
  }
  // 슬라이스 라벨은 P1/P2/P3/P4 형식 (대문자) — 위치만 짚어주면 충분.
  if (worstIdx === -1 || worstRank === 0) return null;
  return `P${worstIdx + 1}`;
}

// row.label → norm threshold 0~1 범위에서 (bad 진입선).
function pickThreshold(row: MetricRow): number | null {
  // congestion·skip·fatigue 는 모두 lower_is_better, 0~1 ratio.
  // throughput 은 norm 없음.
  switch (row.label) {
    case '정체 시간%': return NORMS.congestion_time_ratio.warnAt;
    case '스킵률':     return NORMS.skip_rate.warnAt;
    case '평균 피로도': return NORMS.fatigue_mean.warnAt;
    default: return null;
  }
}

function Highlight({ trend }: { trend: MetricTrend }) {
  const metricLabel: Record<MetricTrend['metric'], string> = {
    congestion: '정체',
    skip: '스킵',
    throughput: '처리량',
    fatigue: '피로도',
  };
  const tone = SHAPE_TONE[trend.shape];
  return (
    <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-medium ${tone}`}>
      <ShapeIcon shape={trend.shape} />
      {metricLabel[trend.metric]} {SHAPE_LABEL[trend.shape]}
    </span>
  );
}

// ─── 공간 hotspot ───────────────────────────────────────────────────
interface SpaceMetricDef {
  label: string;
  pick: (e: ZoneSliceEntry) => number;
  formatter: (v: number) => string;
  evaluate: (v: number) => NormStatus;
}

const SPACE_METRICS: SpaceMetricDef[] = [
  {
    label: '정체 시간%',
    pick: (e) => e.congestionRatio,
    formatter: pct,
    evaluate: (v) => evaluateNorm(NORMS.congestion_time_ratio, v),
  },
  {
    label: '피크 점유',
    pick: (e) => e.peakRatio,
    formatter: pct,
    evaluate: (v) => evaluateNorm(NORMS.peak_ratio, v),
  },
  {
    label: '병목 score',
    pick: (e) => e.bottleneckScore,
    formatter: (v) => v.toFixed(2),
    evaluate: (v) => evaluateNorm(NORMS.bottleneck_score, v),
  },
];

function SpaceSection({
  pattern,
  onSelectZone,
  selectedZoneId,
}: {
  pattern: ZoneSlicePattern;
  onSelectZone?: (zoneId: string) => void;
  selectedZoneId: string | null;
}) {
  const { entries, totalZones } = pattern;
  const truncated = totalZones > entries.length;

  // highlight: norm bad 가장 높은 metric
  const highlight = pickSpaceHighlight(entries);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-3.5 h-3.5 text-foreground/60" aria-hidden="true" />
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">공간 hotspot</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
          zone 별 위험 metric{truncated ? ` · top ${entries.length}/${totalZones}` : ''}
          {onSelectZone && ' · 클릭하여 분해'}
        </span>
        {highlight && <SpaceHighlight {...highlight} />}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[360px]">
          <div className="grid grid-cols-[110px_repeat(3,minmax(0,1fr))] gap-2 mb-1.5 px-1">
            <span aria-hidden />
            {SPACE_METRICS.map((m) => (
              <span
                key={m.label}
                className="text-[10px] uppercase tracking-wider text-muted-foreground/70 text-center"
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="space-y-1">
            {entries.map((e) => (
              <SpaceRow
                key={e.zoneId}
                entry={e}
                onSelect={onSelectZone}
                isSelected={selectedZoneId === e.zoneId}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpaceRow({
  entry,
  onSelect,
  isSelected,
}: {
  entry: ZoneSliceEntry;
  onSelect?: (zoneId: string) => void;
  isSelected: boolean;
}) {
  const interactive = Boolean(onSelect);
  const cells = (
    <>
      <span className="text-[11px] text-foreground/85 truncate text-left" title={entry.zoneName}>
        {entry.zoneName}
      </span>
      {SPACE_METRICS.map((m) => {
        const v = m.pick(entry);
        const status = m.evaluate(v);
        return (
          <div
            key={m.label}
            className={`h-7 rounded-md flex items-center justify-center text-[11px] font-data tabular-nums ${STATUS_BG[status]}`}
            title={`${entry.zoneName} ${m.label}: ${m.formatter(v)}`}
          >
            {m.formatter(v)}
          </div>
        );
      })}
    </>
  );

  if (!interactive) {
    return (
      <div className="grid grid-cols-[110px_repeat(3,minmax(0,1fr))] gap-2 items-center">
        {cells}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect!(entry.zoneId)}
      className={`grid grid-cols-[110px_repeat(3,minmax(0,1fr))] gap-2 items-center w-full rounded-md px-1 py-0.5 transition-colors text-left ${
        isSelected
          ? 'bg-primary/10 ring-1 ring-primary/40'
          : 'hover:bg-secondary/50 focus:bg-secondary/50 focus:outline-none focus:ring-1 focus:ring-primary/30'
      }`}
      aria-pressed={isSelected}
    >
      {cells}
    </button>
  );
}

interface SpaceHighlightInfo {
  metricLabel: string;
  zoneName: string;
  value: string;
  status: NormStatus;
}

function pickSpaceHighlight(entries: readonly ZoneSliceEntry[]): SpaceHighlightInfo | null {
  let candidate: SpaceHighlightInfo | null = null;
  let bestRank = 0;
  for (const e of entries) {
    for (const m of SPACE_METRICS) {
      const v = m.pick(e);
      const s = m.evaluate(v);
      const rank = s === 'bad' ? 3 : s === 'warn' ? 2 : 0;
      if (rank > bestRank) {
        bestRank = rank;
        candidate = {
          metricLabel: m.label,
          zoneName: e.zoneName,
          value: m.formatter(v),
          status: s,
        };
      }
    }
  }
  return candidate;
}

function SpaceHighlight({ metricLabel, zoneName, value, status }: SpaceHighlightInfo) {
  const tone = status === 'bad'
    ? 'text-[var(--status-danger)]'
    : status === 'warn'
      ? 'text-[var(--status-warning)]'
      : 'text-muted-foreground';
  return (
    <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-medium ${tone}`}>
      <AlertCircle className="w-3 h-3" />
      {zoneName} {metricLabel} {value}
    </span>
  );
}

// ─── 페르소나 분해 ───────────────────────────────────────────────────
interface PersonaMetricDef {
  label: string;
  pick: (e: ProfileEngagement) => number;
  formatter: (v: number) => string;
  evaluate: ((v: number) => NormStatus) | null; // null = norm 없음, 상대 비교만
  betterIs: 'higher' | 'lower';
}

function PersonaSection({
  entries, zoneCount, mediaCount, onSelectProfile, selectedProfile,
}: {
  entries: readonly [VisitorProfileType, ProfileEngagement][];
  zoneCount: number;
  mediaCount: number;
  onSelectProfile?: (profile: VisitorProfileType) => void;
  selectedProfile: VisitorProfileType | null;
}) {
  const interactive = Boolean(onSelectProfile);
  const completionAvail = zoneCount > 0;
  const mediaAvail = mediaCount > 0;

  const metrics: PersonaMetricDef[] = [
    {
      label: '평균 체류 (분)',
      pick: (e) => e.avgDwellSec / 60,
      formatter: (v) => v.toFixed(1),
      evaluate: null,
      betterIs: 'higher',
    },
    {
      label: '완주율',
      pick: (e) => e.fullCompletion,
      formatter: pct,
      evaluate: completionAvail ? (v) => evaluateNorm(NORMS.completion_rate, v) : null,
      betterIs: 'higher',
    },
    ...(mediaAvail
      ? [{
          label: '작품 도달',
          pick: (e: ProfileEngagement) => e.avgMedia / mediaCount,
          formatter: pct,
          evaluate: null,
          betterIs: 'higher' as const,
        }]
      : []),
    {
      label: '평균 피로도',
      pick: (e) => e.fatigueMean,
      formatter: pct,
      evaluate: (v) => evaluateNorm(NORMS.fatigue_mean, v),
      betterIs: 'lower',
    },
  ];

  // 가장 두드러진 outlier 1개 — norm bad 가 있으면 그것, 없으면 betterIs 기준 worst-vs-best 차이가 큰 것.
  const highlight = pickPersonaHighlight(entries, metrics);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-3.5 h-3.5 text-foreground/60" aria-hidden="true" />
        <h3 className="text-[13px] font-semibold tracking-tight text-foreground">페르소나 분해</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
          profile 별 — exited 방문자 기준{interactive && ' · 클릭하여 분해'}
        </span>
        {highlight && <PersonaHighlight {...highlight} />}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[360px]">
          <div
            className="grid gap-2 mb-1.5 px-1"
            style={{ gridTemplateColumns: `120px repeat(${entries.length}, minmax(0, 1fr))` }}
          >
            <span aria-hidden />
            {entries.map(([type, e]) => {
              const isSelected = selectedProfile === type;
              const inner = (
                <>
                  <span className="text-[11px] text-foreground/80 truncate">
                    {PROFILE_LABEL[type]}
                  </span>
                  <span className="text-[9px] text-muted-foreground/60 font-data tabular-nums">
                    n={e.sampleCount}
                  </span>
                </>
              );
              if (!interactive) {
                return (
                  <div key={type} className="flex flex-col items-center">
                    {inner}
                  </div>
                );
              }
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onSelectProfile!(type)}
                  className={`flex flex-col items-center rounded-md px-1 py-0.5 transition-colors ${
                    isSelected
                      ? 'bg-primary/10 ring-1 ring-primary/40'
                      : 'hover:bg-secondary/50 focus:bg-secondary/50 focus:outline-none focus:ring-1 focus:ring-primary/30'
                  }`}
                  aria-pressed={isSelected}
                >
                  {inner}
                </button>
              );
            })}
          </div>

          <div className="space-y-1">
            {metrics.map((m) => (
              <PersonaRow
                key={m.label}
                metric={m}
                entries={entries}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonaRow({
  metric, entries,
}: {
  metric: PersonaMetricDef;
  entries: readonly [VisitorProfileType, ProfileEngagement][];
}) {
  const values = entries.map(([, e]) => metric.pick(e));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;

  return (
    <div
      className="grid gap-2 items-center"
      style={{ gridTemplateColumns: `120px repeat(${entries.length}, minmax(0, 1fr))` }}
    >
      <span className="text-[11px] text-muted-foreground/90 truncate">{metric.label}</span>
      {entries.map(([type], i) => {
        const v = values[i];
        let status: NormStatus = 'unknown';
        if (metric.evaluate) {
          status = metric.evaluate(v);
        } else if (spread > 0.05) {
          // norm 없을 때 — 상대 비교: 그룹 내 가장 안 좋은 것을 warn 으로.
          const isWorst = metric.betterIs === 'higher' ? v === min : v === max;
          const isBest = metric.betterIs === 'higher' ? v === max : v === min;
          if (isWorst) status = 'warn';
          else if (isBest) status = 'good';
        }
        return (
          <div
            key={type}
            className={`h-7 rounded-md flex items-center justify-center text-[11px] font-data tabular-nums ${STATUS_BG[status]}`}
            title={`${PROFILE_LABEL[type]} ${metric.label}: ${metric.formatter(v)}`}
          >
            {metric.formatter(v)}
            {!Number.isFinite(v) && '—'}
          </div>
        );
      })}
    </div>
  );
}

interface PersonaHighlightInfo {
  metricLabel: string;
  worstProfile: VisitorProfileType;
  worstValue: string;
  status: NormStatus;
}

function pickPersonaHighlight(
  entries: readonly [VisitorProfileType, ProfileEngagement][],
  metrics: readonly PersonaMetricDef[],
): PersonaHighlightInfo | null {
  // 우선순위: norm-bad > norm-warn > 큰 상대 격차.
  let candidate: PersonaHighlightInfo | null = null;
  let best: { rank: number; spread: number } = { rank: 0, spread: 0 };

  for (const m of metrics) {
    const vals = entries.map(([t, e]) => ({ t, v: m.pick(e) }));
    if (m.evaluate) {
      for (const x of vals) {
        const s = m.evaluate(x.v);
        const rank = s === 'bad' ? 3 : s === 'warn' ? 2 : 0;
        if (rank > best.rank) {
          best = { rank, spread: 0 };
          candidate = {
            metricLabel: m.label,
            worstProfile: x.t,
            worstValue: m.formatter(x.v),
            status: s,
          };
        }
      }
    } else {
      // 상대 비교만 가능 — 격차로 후보화 (warn level).
      const sorted = [...vals].sort((a, b) =>
        m.betterIs === 'higher' ? a.v - b.v : b.v - a.v,
      );
      const worst = sorted[0];
      const bestVal = sorted[sorted.length - 1];
      const spread = Math.abs(bestVal.v - worst.v);
      if (best.rank === 0 && spread > best.spread && spread > 0.15) {
        best = { rank: 0, spread };
        candidate = {
          metricLabel: m.label,
          worstProfile: worst.t,
          worstValue: m.formatter(worst.v),
          status: 'warn',
        };
      }
    }
  }
  return candidate;
}

function PersonaHighlight({ metricLabel, worstProfile, worstValue, status }: PersonaHighlightInfo) {
  const tone = status === 'bad'
    ? 'text-[var(--status-danger)]'
    : status === 'warn'
      ? 'text-[var(--status-warning)]'
      : 'text-muted-foreground';
  return (
    <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-medium ${tone}`}>
      <AlertCircle className="w-3 h-3" />
      {PROFILE_LABEL[worstProfile]} {metricLabel} {worstValue}
    </span>
  );
}
