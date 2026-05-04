import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, History, X } from 'lucide-react';
import type { RunRecord } from '@/domain';
import type { Translator } from './types';

// 같은 시나리오 (id+version+contentHash) 끼리 묶어서 보여주는 드롭다운.
// dirty-at-capture run 은 별도 그룹으로 자동 분리되며 "변경됨" 태그가 붙는다.
// 이렇게 해야 baseline 묶음 안에서만 비교가 의미 있다.

interface RunGroup {
  readonly key: string;
  readonly scenarioName: string;
  readonly version: number;
  readonly contentHash: string;
  readonly dirty: boolean;
  readonly records: readonly RunRecord[];
}

function groupRecords(records: readonly RunRecord[]): RunGroup[] {
  const map = new Map<string, RunGroup>();
  for (const r of records) {
    const key = `${r.scenarioId}|v${r.scenarioVersion}|${r.contentHash}`;
    const existing = map.get(key);
    if (existing) {
      (existing.records as RunRecord[]).push(r);
    } else {
      map.set(key, {
        key,
        scenarioName: r.scenarioName,
        version: r.scenarioVersion,
        contentHash: r.contentHash,
        dirty: r.dirtyAtCapture,
        records: [r],
      });
    }
  }
  // 그룹 내부 — 최신 run 먼저. 그룹 사이 — 최근 run 시간이 늦은 그룹 먼저.
  const groups = Array.from(map.values()).map((g) => ({
    ...g,
    records: [...g.records].sort((a, b) => b.endedAt - a.endedAt),
  }));
  groups.sort((a, b) => (b.records[0]?.endedAt ?? 0) - (a.records[0]?.endedAt ?? 0));
  return groups;
}

function formatRunTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  records: readonly RunRecord[];
  activeRunId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  t: Translator;
}

export function RunSwitcher({ records, activeRunId, onSelect, onRemove, t }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const activeRecord = activeRunId ? records.find((r) => r.id === activeRunId) ?? null : null;
  const groups = useMemo(() => groupRecords(records), [records]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (records.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-secondary/40 text-muted-foreground text-xs">
        <History className="w-3.5 h-3.5" />
        {t('analyze.runs.live')}
      </div>
    );
  }

  const buttonLabel = activeRecord
    ? `${activeRecord.scenarioName} · v${activeRecord.scenarioVersion}${activeRecord.dirtyAtCapture ? ` · ${t('analyze.runs.dirtyTag')}` : ''}`
    : t('analyze.runs.live');
  const buttonSub = activeRecord ? formatRunTime(activeRecord.endedAt) : '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors max-w-[280px]"
        title={t('analyze.runs.tooltip')}
      >
        <History className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{buttonLabel}</span>
        {buttonSub && (
          <span className="font-data tabular-nums text-muted-foreground/80 flex-shrink-0">
            {buttonSub}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[360px] max-h-[420px] overflow-y-auto bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
          <button
            type="button"
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center justify-between ${
              activeRunId === null ? 'bg-accent/60' : ''
            }`}
          >
            <span className="font-medium">{t('analyze.runs.live')}</span>
            <span className="text-[10px] text-muted-foreground">{t('analyze.runs.live.hint')}</span>
          </button>
          {groups.map((g) => (
            <div key={g.key} className="border-t border-border/40 pt-1 mt-1 first:border-t-0 first:pt-0 first:mt-0">
              <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="truncate flex-1">{g.scenarioName}</span>
                <span className="font-data tabular-nums">v{g.version}</span>
                {g.dirty && (
                  <span className="px-1 py-0.5 rounded bg-[var(--status-warning)]/15 text-[var(--status-warning)] text-[9px] font-semibold">
                    {t('analyze.runs.dirtyTag')}
                  </span>
                )}
                <span className="font-data tabular-nums text-muted-foreground/60">#{g.contentHash.slice(0, 4)}</span>
              </div>
              {g.records.map((r) => {
                const isActive = r.id === activeRunId;
                return (
                  <div
                    key={r.id}
                    className={`group flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent ${
                      isActive ? 'bg-accent/60' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => { onSelect(r.id); setOpen(false); }}
                      className="flex-1 text-left flex items-center gap-2 min-w-0"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isActive ? 'bg-primary' : 'bg-muted-foreground/40'
                      }`} />
                      <span className="font-data tabular-nums text-muted-foreground flex-shrink-0">
                        {formatRunTime(r.endedAt)}
                      </span>
                      <span className="font-data tabular-nums text-foreground/80 flex-shrink-0">
                        {r.totalSpawned}→{r.totalExited}
                      </span>
                      <span className="font-data tabular-nums text-muted-foreground/80 flex-shrink-0">
                        {Math.round((r.latestSnapshot.flowEfficiency.completionRate ?? 0) * 100)}%
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(t('analyze.runs.removeConfirm'))) onRemove(r.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-opacity"
                      title={t('analyze.runs.remove')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
