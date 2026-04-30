import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NormStatus } from '@/analytics/norms';

export const STATUS_BG: Record<NormStatus, string> = {
  good:    'bg-[var(--status-success)]/15 text-[var(--status-success)]',
  warn:    'bg-[var(--status-warning)]/15 text-[var(--status-warning)]',
  bad:     'bg-[var(--status-danger)]/15 text-[var(--status-danger)]',
  unknown: 'bg-secondary/40 text-muted-foreground',
};

export const STATUS_BAR: Record<NormStatus, string> = {
  good:    'bg-[var(--status-success)]',
  warn:    'bg-[var(--status-warning)]',
  bad:     'bg-[var(--status-danger)]',
  unknown: 'bg-muted-foreground/40',
};

export const STATUS_STROKE: Record<NormStatus, string> = {
  good:    'stroke-[var(--status-success)]',
  warn:    'stroke-[var(--status-warning)]',
  bad:     'stroke-[var(--status-danger)]',
  unknown: 'stroke-muted-foreground/40',
};

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function DrilldownHeader({
  Icon, title, kicker, reading, onClose, onForkToBuild, forkLabel,
}: {
  Icon: LucideIcon;
  title: string;
  kicker: string;
  reading: string;
  onClose: () => void;
  onForkToBuild?: () => void;
  forkLabel?: string;
}) {
  return (
    <header className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-hidden />
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground truncate">
            {title}
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 flex-shrink-0">
            {kicker}
          </span>
        </div>
        <p className="text-[12px] text-foreground/85 leading-snug">{reading}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {onForkToBuild && (
          <button
            type="button"
            onClick={onForkToBuild}
            className="px-2.5 h-7 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors"
            title={forkLabel ?? 'Build 으로 가기'}
          >
            {forkLabel ?? 'Build 으로 →'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

export function SubCard({
  Icon, title, children,
}: { Icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
      <h4 className="text-[10px] uppercase tracking-wider font-semibold text-foreground/80 flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 text-primary/80" aria-hidden />
        {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function MetricRow({
  label, value, status, sub,
}: { label: string; value: string; status: NormStatus; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground/90 flex-1 truncate">{label}</span>
        <span
          className={`text-[11px] font-data tabular-nums px-1.5 py-0.5 rounded ${STATUS_BG[status]}`}
        >
          {value}
        </span>
      </div>
      {sub && (
        <div className="text-[9px] text-muted-foreground/70 font-data tabular-nums pl-0">
          {sub}
        </div>
      )}
    </div>
  );
}

export function Sparkline({
  data, evaluate,
}: {
  data: readonly { tMs: number; ratio: number }[];
  evaluate: (v: number) => NormStatus;
}) {
  const w = 160;
  const h = 40;
  const n = data.length;
  if (n < 2) return null;

  const xs = data.map((_, i) => (i / (n - 1)) * w);
  const ys = data.map((d) => h - d.ratio * h);
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const last = data[n - 1];
  const maxRatio = data.reduce((m, d) => Math.max(m, d.ratio), 0);
  const status = evaluate(last.ratio);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
        <path d={path} fill="none" strokeWidth={1.5} className={STATUS_STROKE[status]} />
      </svg>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground/70 font-data tabular-nums mt-1">
        <span>최종 {pct(last.ratio)}</span>
        <span>최대 {pct(maxRatio)}</span>
      </div>
      <div className={`h-0.5 rounded-full mt-1 ${STATUS_BAR[status]}`} style={{ opacity: 0.5 }} />
    </div>
  );
}
