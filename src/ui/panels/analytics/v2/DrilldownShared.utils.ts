import type { NormStatus } from '@/analytics/norms';

// Status → Tailwind class maps. Kept here (not in DrilldownShared.tsx)
// so React Fast Refresh can hot-reload the components in that file
// without forcing a full page reload.

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
