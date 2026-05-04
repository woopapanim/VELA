import type { LucideIcon } from 'lucide-react';
import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Confidence, NormStatus } from '@/analytics/norms';
import { NormBadge } from './NormBadge';
import { ConfidenceBadge } from './ConfidenceBadge';
import { Sparkline } from '@/ui/components/Sparkline';
import type { PerspectiveMetric, PerspectiveTrend } from './types';

export type { PerspectiveMetric, PerspectiveTrend };

interface Props {
  title: string;
  Icon: LucideIcon;
  reading: string;
  metrics: readonly PerspectiveMetric[];
  confidence: Confidence;
  onDrilldown?: () => void;
  size?: 'compact' | 'large';
  /** Large hero 용 inline 차트. */
  trend?: PerspectiveTrend;
}

// 색은 dot 한 곳에서만. border/text/bar 는 monochrome 으로 — 카드별 accent 가
// 사방에 깔리면 verdict strip 위계가 무너진다 (2026-04-30).
const STATUS_DOT: Record<NormStatus, string> = {
  good:    'bg-[var(--status-success)]',
  warn:    'bg-[var(--status-warning)]',
  bad:     'bg-[var(--status-danger)]',
  unknown: 'bg-muted-foreground/30',
};

const STATUS_BAR: Record<NormStatus, string> = {
  good:    'bg-foreground/30',
  warn:    'bg-foreground/55',
  bad:     'bg-[var(--status-danger)]',
  unknown: 'bg-muted-foreground/30',
};

function aggregateCardStatus(metrics: readonly PerspectiveMetric[]): NormStatus {
  if (metrics.length === 0) return 'unknown';
  if (metrics.some((m) => m.status === 'bad')) return 'bad';
  if (metrics.some((m) => m.status === 'warn')) return 'warn';
  if (metrics.every((m) => m.status === 'unknown')) return 'unknown';
  return 'good';
}

// hero metric 결정 — norm 있는 metric 중 status 가장 나쁜 것, 없으면 norm 있는 첫 metric.
function pickHero(metrics: readonly PerspectiveMetric[]): PerspectiveMetric | null {
  const withNorm = metrics.filter((m) => m.norm);
  if (withNorm.length === 0) return null;
  const order: Record<NormStatus, number> = { bad: 0, warn: 1, good: 2, unknown: 3 };
  return [...withNorm].sort((a, b) => order[a.status] - order[b.status])[0];
}

// norm threshold 위치를 0-100 % bar 상의 marker 로 변환 (lower_is_better 기준).
// 시각적: bar 채움 = 현재값 비율, marker = warnAt threshold 위치.
function getBarFill(metric: PerspectiveMetric): { pct: number; warnPct: number } | null {
  if (!metric.norm) return null;
  const numMatch = metric.displayValue.match(/-?\d+(\.\d+)?/);
  if (!numMatch) return null;
  let value = parseFloat(numMatch[0]);
  if (metric.displayValue.includes('%')) value /= 100;

  const norm = metric.norm;
  // lower_is_better: bar 0 = 좋음, 100 = 나쁨. fill = value / warnAt * 100, cap 100.
  // higher_is_better: bar 0 = 나쁨, 100 = 좋음. fill = value / 1.0 * 100, cap 100.
  if (norm.direction === 'lower_is_better') {
    const max = Math.max(norm.warnAt * 1.5, value);
    const pct = Math.min(100, (value / max) * 100);
    const warnPct = (norm.warnAt / max) * 100;
    return { pct, warnPct };
  } else {
    const max = 1;
    const pct = Math.min(100, (value / max) * 100);
    const warnPct = (norm.warnAt / max) * 100;
    return { pct, warnPct };
  }
}

export function PerspectiveCard({
  title, Icon, reading, metrics, confidence, onDrilldown, size = 'compact', trend,
}: Props) {
  const cardStatus = aggregateCardStatus(metrics);
  const isLarge = size === 'large';
  const hero = pickHero(metrics);
  const subMetrics = metrics.filter((m) => m !== hero);
  const isEmpty = metrics.length === 0;

  // Hero 카드는 좌측 4px status accent bar 로 위계 강조 — bad/warn 만 색, good/unknown 은 monochrome.
  const heroAccent = isLarge && (cardStatus === 'bad' || cardStatus === 'warn')
    ? cardStatus === 'bad'
      ? 'before:bg-[var(--status-danger)]'
      : 'before:bg-[var(--status-warning)]'
    : 'before:bg-transparent';
  const heroAccentClass = isLarge
    ? `relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-xl ${heroAccent}`
    : '';

  const heightCls = isLarge ? 'h-full' : '';
  const baseCls = `rounded-xl border border-border/60 bg-[var(--surface)] flex flex-col ${isLarge ? 'p-5' : 'p-3.5'} ${heightCls} ${heroAccentClass}`;
  const buttonCls = `group text-left transition-all hover:border-foreground/20 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${baseCls}`;

  // 동적 Wrapper + spread 보다 명시적 분기 — TS 가 prop union 을 못 좁혀서 `as never` 케스팅이 필요했던 코드 정리.
  const renderInner = () => (
    <>
      {/* Header */}
      <div className={`flex items-center gap-2 ${isLarge ? 'mb-4' : 'mb-2.5'}`}>
        <span
          className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[cardStatus]}`}
          aria-hidden="true"
        />
        <Icon className={`text-foreground/60 ${isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} aria-hidden="true" />
        <h3 className={`font-semibold tracking-tight text-foreground ${isLarge ? 'text-[15px]' : 'text-[12px]'}`}>
          {title}
        </h3>
        {isLarge && (cardStatus === 'bad' || cardStatus === 'warn') && (
          <span
            className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
              cardStatus === 'bad'
                ? 'bg-[var(--status-danger)]/12 text-[var(--status-danger)]'
                : 'bg-[var(--status-warning)]/15 text-[var(--status-warning)]'
            }`}
          >
            {cardStatus === 'bad' ? '위험' : '검토'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <ConfidenceBadge level={confidence} />
          {onDrilldown && (
            <ChevronRight className={`text-muted-foreground/60 group-hover:text-foreground/80 group-hover:translate-x-0.5 transition-all ${isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
          )}
        </div>
      </div>

      {isEmpty ? (
        <p className={`italic ${isLarge ? 'text-sm text-muted-foreground py-3' : 'text-[11px] text-muted-foreground/70 py-2'}`}>
          {reading}
        </p>
      ) : (
        <>
          {/* Hero metric — big number + threshold bar */}
          {hero && (
            <div className={isLarge ? 'mb-4' : 'mb-2.5'}>
              <div className="flex items-baseline gap-2">
                <span className={`font-data tabular-nums leading-none font-bold text-foreground ${
                  isLarge ? 'text-[40px]' : 'text-[22px]'
                }`}>
                  {hero.displayValue}
                </span>
                <span className={`uppercase tracking-wider text-muted-foreground/80 truncate ${
                  isLarge ? 'text-[11px]' : 'text-[10px]'
                }`}>
                  {hero.label}
                </span>
                {isLarge && trend && trend.shape && trend.shape !== 'unknown' && (
                  <span className={`ml-auto inline-flex items-center gap-1 text-[10px] flex-shrink-0 ${
                    trend.shape === 'worsening' ? 'text-[var(--status-danger)]'
                    : trend.shape === 'improving' ? 'text-foreground/70'
                    : 'text-muted-foreground'
                  }`}>
                    {trend.shape === 'worsening' ? <TrendingUp className="w-3 h-3" />
                      : trend.shape === 'improving' ? <TrendingDown className="w-3 h-3" />
                      : <Minus className="w-3 h-3" />}
                    {trend.shape === 'worsening' ? '악화'
                      : trend.shape === 'improving' ? '개선'
                      : '안정'}
                  </span>
                )}
              </div>
              <HeroBar metric={hero} />
            </div>
          )}

          {/* Hero 시계열 — Large 카드만, 빈 공간을 정보로 채움 (2026-04-30) */}
          {isLarge && trend && (
            <HeroTrendChart trend={trend} status={hero?.status ?? cardStatus} />
          )}

          {/* Sub metrics — compact rows. Large 모드는 더 큰 spacing 으로 가독성 ↑ */}
          {subMetrics.length > 0 && (
            <ul className={`${isLarge ? 'space-y-1.5 mb-3 border-t border-border/40 pt-3' : 'space-y-0.5 mb-2 border-t border-border/40 pt-2'}`}>
              {subMetrics.map((m, i) => (
                <li key={i} className={`flex items-center gap-2 ${isLarge ? 'text-[12px]' : 'text-[10.5px]'}`}>
                  <span className={`truncate flex-1 min-w-0 ${isLarge ? 'text-muted-foreground/90' : 'text-muted-foreground/85'}`}>{m.label}</span>
                  {m.norm ? (
                    <NormBadge norm={m.norm} status={m.status} displayValue={m.displayValue} />
                  ) : (
                    <span className={`font-data tabular-nums ${m.status === 'unknown' ? 'text-muted-foreground/60' : 'text-foreground/85'}`}>
                      {m.displayValue}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Reading — Large 는 emphasized 카피, compact 는 muted */}
          <p className={
            isLarge
              ? 'text-[12.5px] leading-relaxed text-foreground/80 mt-auto pt-2 border-t border-border/40'
              : 'text-[10.5px] leading-snug text-muted-foreground'
          }>
            {reading}
          </p>
        </>
      )}
    </>
  );

  if (onDrilldown) {
    return (
      <button type="button" onClick={onDrilldown} className={buttonCls}>
        {renderInner()}
      </button>
    );
  }
  return <section className={baseCls}>{renderInner()}</section>;
}

function HeroBar({ metric }: { metric: PerspectiveMetric }) {
  const fill = getBarFill(metric);
  if (!fill) return null;
  return (
    <div className="mt-2 relative h-1 rounded-full bg-secondary/60 overflow-hidden">
      <div
        className={`absolute left-0 top-0 h-full ${STATUS_BAR[metric.status]}`}
        style={{ width: `${fill.pct}%` }}
      />
      {/* warn threshold marker */}
      <div
        className="absolute top-[-2px] bottom-[-2px] w-px bg-foreground/40"
        style={{ left: `${fill.warnPct}%` }}
        aria-label="권장 임계"
      />
    </div>
  );
}

// Hero 카드 inline 시계열 차트 — flex-1 로 카드의 빈 공간 자동 채움 (2026-04-30).
function HeroTrendChart({ trend, status }: { trend: PerspectiveTrend; status: NormStatus }) {
  const finite = trend.values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (finite.length < 2) return null;
  const max = Math.max(...finite);
  const min = Math.min(...finite);
  const domain: [number, number] = trend.isRatio
    ? [0, Math.max(max * 1.1, (trend.threshold ?? 0) * 1.3, 0.4)]
    : [Math.max(0, min - (max - min) * 0.1), max + (max - min) * 0.1 + 1];
  return (
    <div className="mb-4 rounded-lg bg-secondary/30 px-3 py-2.5 flex-1 flex flex-col min-h-[100px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          시계열 추이
        </span>
        <span className="text-[9px] text-muted-foreground/70">
          {trend.values.length} 슬라이스 · 시작 → 끝
        </span>
      </div>
      <div className="flex-1 flex items-stretch min-h-0">
        <Sparkline
          data={trend.values}
          width={400}
          height={120}
          status={status === 'good' || status === 'warn' || status === 'bad' || status === 'unknown' ? status : 'neutral'}
          threshold={trend.threshold}
          domain={domain}
          fill
          endDot
          fillContainer
        />
      </div>
    </div>
  );
}
