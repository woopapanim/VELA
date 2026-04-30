import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import type { Confidence, Norm, NormStatus } from '@/analytics/norms';
import { NormBadge } from './NormBadge';
import { ConfidenceBadge } from './ConfidenceBadge';

export interface PerspectiveMetric {
  label: string;
  displayValue: string;
  norm?: Norm;
  status: NormStatus;
}

interface Props {
  title: string;
  Icon: LucideIcon;
  reading: string;
  metrics: readonly PerspectiveMetric[];
  confidence: Confidence;
  onDrilldown?: () => void;
  size?: 'compact' | 'large';
}

const STATUS_DOT: Record<NormStatus, string> = {
  good:    'bg-[var(--status-success)]',
  warn:    'bg-[var(--status-warning)]',
  bad:     'bg-[var(--status-danger)]',
  unknown: 'bg-muted-foreground/30',
};

const STATUS_RING: Record<NormStatus, string> = {
  good:    'border-[var(--status-success)]/25',
  warn:    'border-[var(--status-warning)]/40',
  bad:     'border-[var(--status-danger)]/50',
  unknown: 'border-border/60',
};

const STATUS_BAR: Record<NormStatus, string> = {
  good:    'bg-[var(--status-success)]',
  warn:    'bg-[var(--status-warning)]',
  bad:     'bg-[var(--status-danger)]',
  unknown: 'bg-muted-foreground/30',
};

const STATUS_TEXT: Record<NormStatus, string> = {
  good:    'text-[var(--status-success)]',
  warn:    'text-[var(--status-warning)]',
  bad:     'text-[var(--status-danger)]',
  unknown: 'text-muted-foreground',
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
  title, Icon, reading, metrics, confidence, onDrilldown, size = 'compact',
}: Props) {
  const cardStatus = aggregateCardStatus(metrics);
  const isLarge = size === 'large';
  const hero = pickHero(metrics);
  const subMetrics = metrics.filter((m) => m !== hero);
  const isEmpty = metrics.length === 0;

  const Wrapper: 'button' | 'section' = onDrilldown ? 'button' : 'section';
  const wrapperProps = onDrilldown
    ? {
        type: 'button' as const,
        onClick: onDrilldown,
        className: `group text-left rounded-xl border bg-[var(--surface)] flex flex-col transition-all hover:border-foreground/20 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${STATUS_RING[cardStatus]} ${isLarge ? 'p-5' : 'p-4'}`,
      }
    : {
        className: `rounded-xl border bg-[var(--surface)] flex flex-col ${STATUS_RING[cardStatus]} ${isLarge ? 'p-5' : 'p-4'}`,
      };

  return (
    <Wrapper {...(wrapperProps as never)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[cardStatus]}`}
          aria-hidden="true"
        />
        <Icon className="w-3.5 h-3.5 text-foreground/60" aria-hidden="true" />
        <h3 className={`font-semibold tracking-tight text-foreground ${isLarge ? 'text-base' : 'text-[13px]'}`}>
          {title}
        </h3>
        <div className="ml-auto flex items-center gap-1.5">
          <ConfidenceBadge level={confidence} />
          {onDrilldown && (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-foreground/80 group-hover:translate-x-0.5 transition-all" />
          )}
        </div>
      </div>

      {isEmpty ? (
        <p className="text-xs text-muted-foreground/70 italic py-2">{reading}</p>
      ) : (
        <>
          {/* Hero metric — big number + threshold bar */}
          {hero && (
            <div className="mb-3">
              <div className="flex items-baseline gap-2">
                <span className={`font-data tabular-nums leading-none font-bold ${isLarge ? 'text-3xl' : 'text-[26px]'} ${STATUS_TEXT[hero.status]}`}>
                  {hero.displayValue}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 truncate">
                  {hero.label}
                </span>
              </div>
              <HeroBar metric={hero} />
            </div>
          )}

          {/* Sub metrics — compact rows */}
          {subMetrics.length > 0 && (
            <ul className="space-y-1 mb-2.5 border-t border-border/50 pt-2.5">
              {subMetrics.map((m, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground/90 truncate flex-1 min-w-0">{m.label}</span>
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

          {/* Reading — single line, muted */}
          <p className={`text-[11px] leading-snug ${STATUS_TEXT[cardStatus]} ${cardStatus === 'good' || cardStatus === 'unknown' ? 'opacity-75' : ''}`}>
            {reading}
          </p>
        </>
      )}
    </Wrapper>
  );
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
