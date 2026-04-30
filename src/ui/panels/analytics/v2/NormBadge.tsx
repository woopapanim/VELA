import { useState } from 'react';
import { Info } from 'lucide-react';
import type { Norm, NormStatus } from '@/analytics/norms';

interface Props {
  status: NormStatus;
  norm: Norm;
  displayValue: string;  // "12%", "1.4 m²/person" 등
}

const STATUS_STYLE: Record<NormStatus, { dot: string; text: string }> = {
  good:    { dot: 'bg-[var(--status-success)]', text: 'text-[var(--status-success)]' },
  warn:    { dot: 'bg-[var(--status-warning)]', text: 'text-[var(--status-warning)]' },
  bad:     { dot: 'bg-[var(--status-danger)]',  text: 'text-[var(--status-danger)]' },
  unknown: { dot: 'bg-muted-foreground/40',     text: 'text-muted-foreground' },
};

export function NormBadge({ status, norm, displayValue }: Props) {
  const [open, setOpen] = useState(false);
  const style = STATUS_STYLE[status];
  const normLabel = formatNormLabel(norm);

  return (
    <div className="relative inline-flex items-baseline gap-1.5">
      <span className={`text-lg font-bold font-data tabular-nums leading-none ${style.text}`}>
        {displayValue}
      </span>
      <span className="text-[10px] text-muted-foreground/70 font-data tabular-nums whitespace-nowrap">
        norm {normLabel}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-muted-foreground/60 hover:text-foreground transition-colors"
        aria-label="norm 출처 보기"
      >
        <Info className="w-3 h-3" />
      </button>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} self-center`} aria-hidden="true" />

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-72 z-50 rounded-lg border border-border bg-popover shadow-lg p-3 text-xs">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              norm
            </span>
            <span className="font-data tabular-nums">{normLabel}</span>
            <span className="text-muted-foreground">·</span>
            <SourceBadge kind={norm.source.kind} />
          </div>
          <div className="font-semibold mb-0.5">{norm.source.cite}</div>
          <p className="text-muted-foreground leading-snug">{norm.source.rationale}</p>
        </div>
      )}
    </div>
  );
}

function formatNormLabel(norm: Norm): string {
  const goodStr = formatThreshold(norm.goodAt, norm.unit);
  const op = norm.direction === 'lower_is_better' ? '<' : '≥';
  return `${op} ${goodStr}`;
}

function formatThreshold(value: number, unit: string): string {
  if (unit === '%') return `${Math.round(value * 100)}%`;
  if (unit === 'score') return value.toFixed(0);
  if (unit === 'ms') {
    // 90초 미만은 초로, 그 이상은 분으로 — "60s" / "3m" 처럼 자연스럽게.
    if (value < 90_000) return `${Math.round(value / 1000)}s`;
    return `${Math.round(value / 60_000)}m`;
  }
  return `${value} ${unit}`;
}

function SourceBadge({ kind }: { kind: Norm['source']['kind'] }) {
  const map: Record<Norm['source']['kind'], { label: string; cls: string }> = {
    industry:     { label: '산업표준', cls: 'bg-[var(--status-success)]/15 text-[var(--status-success)]' },
    mode_default: { label: '모드 default', cls: 'bg-primary/15 text-primary' },
    derived:      { label: '산식', cls: 'bg-secondary text-foreground/70' },
    self:         { label: '자체 권장', cls: 'bg-[var(--status-warning)]/15 text-[var(--status-warning)]' },
  };
  const m = map[kind];
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider uppercase ${m.cls}`}>
      {m.label}
    </span>
  );
}
