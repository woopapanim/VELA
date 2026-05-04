import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, Eye, MoveHorizontal, Zap } from 'lucide-react';
import type { Translator } from './types';

// 4개 별도 RailCard 폐기 — tab 으로 한 카드에 통합. 우선순위 순서로 노출, 빈 탭은
// dot 색만 회색으로 표시 (2026-04-30).

type HotspotTab = 'bottlenecks' | 'skip' | 'flow' | 'engagement';

export interface BottleneckEntry { name: string; score: number }
export interface SkipMediaEntry { id: string; name: string; rate: number; skipCount: number }
export interface FlowSummary {
  entries: readonly { name: string; count: number }[];
  exits: readonly { name: string; count: number }[];
  unaccountedExits: number;
}
export interface EngagementSummary {
  avgZones: number;
  avgMedia: number;
  fullCompletion: number;
  avgDwellSec: number;
}

interface Props {
  t: Translator;
  topBottlenecks: readonly BottleneckEntry[];
  topSkipMedia: readonly SkipMediaEntry[];
  entryExitFlow: FlowSummary;
  engagementSummary: EngagementSummary;
  zoneCount: number;
  mediaCount: number;
  totalExited: number;
  selectedMediaId: string | null;
  onSelectMedia: (id: string) => void;
}

function pickInitialTab(
  bottlenecks: readonly BottleneckEntry[],
  skip: readonly SkipMediaEntry[],
  flow: FlowSummary,
): HotspotTab {
  if (bottlenecks.length > 0) return 'bottlenecks';
  if (skip.length > 0) return 'skip';
  if (flow.entries.length + flow.exits.length > 0) return 'flow';
  return 'engagement';
}

export function HotspotsRail({
  t, topBottlenecks, topSkipMedia, entryExitFlow, engagementSummary,
  zoneCount, mediaCount, totalExited, selectedMediaId, onSelectMedia,
}: Props) {
  // 초기 탭 — lazy init 으로 첫 마운트 시 데이터 있는 탭 선택.
  // 이후엔 사용자 의도 우선 — 빈 탭 클릭하면 빈 상태 표시 (auto-reset 폐기, 의도 무시 버그).
  const [tab, setTab] = useState<HotspotTab>(() =>
    pickInitialTab(topBottlenecks, topSkipMedia, entryExitFlow),
  );

  const tabMeta: Record<HotspotTab, { label: string; Icon: LucideIcon; hasData: boolean; count: number }> = {
    bottlenecks: { label: t('analyze.tab.bottlenecks'), Icon: Activity,       hasData: topBottlenecks.length > 0, count: topBottlenecks.length },
    skip:        { label: t('analyze.tab.skip'),        Icon: Zap,            hasData: topSkipMedia.length > 0,   count: topSkipMedia.length },
    flow:        { label: t('analyze.tab.flow'),        Icon: MoveHorizontal, hasData: entryExitFlow.entries.length + entryExitFlow.exits.length > 0, count: entryExitFlow.entries.length + entryExitFlow.exits.length },
    engagement:  { label: t('analyze.tab.engagement'),  Icon: Eye,            hasData: totalExited > 0, count: 0 },
  };
  const tabOrder: readonly HotspotTab[] = ['bottlenecks', 'skip', 'flow', 'engagement'];

  // ARIA tab 패턴 — 화살표 키로 탭 이동.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = tabOrder.indexOf(tab);
    const next = e.key === 'ArrowRight'
      ? tabOrder[(i + 1) % tabOrder.length]
      : tabOrder[(i - 1 + tabOrder.length) % tabOrder.length];
    setTab(next);
  };

  return (
    <aside
      className="w-72 border-l border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-hidden"
      aria-label="Insights rail"
    >
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <h2 className="text-[13px] font-semibold tracking-tight">{t('analyze.rail.title')}</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          {t('analyze.rail.hint')}
        </p>
      </div>

      <div className="border-b border-border flex-shrink-0 px-1 pt-1">
        <div role="tablist" className="grid grid-cols-4 gap-0.5" onKeyDown={onKeyDown}>
          {tabOrder.map((key) => {
            const meta = tabMeta[key];
            const isActive = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`hotspots-panel-${key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setTab(key)}
                className={`relative flex flex-col items-center gap-0.5 py-1.5 rounded-md text-[10px] transition-colors ${
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <meta.Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : ''}`} />
                <span className="leading-none">{meta.label}</span>
                {meta.hasData && key !== 'engagement' && meta.count > 0 && (
                  <span className="absolute top-1 right-1.5 w-1 h-1 rounded-full bg-foreground/40" />
                )}
                {!meta.hasData && (
                  <span className="absolute top-1 right-1.5 w-1 h-1 rounded-full bg-muted-foreground/30" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`hotspots-panel-${tab}`}
        className="flex-1 overflow-y-auto p-3"
      >
        {tab === 'bottlenecks' && <BottlenecksPanel data={topBottlenecks} t={t} />}
        {tab === 'skip' && (
          <SkipPanel
            data={topSkipMedia}
            selectedMediaId={selectedMediaId}
            onSelectMedia={onSelectMedia}
            t={t}
          />
        )}
        {tab === 'flow' && <FlowPanel data={entryExitFlow} t={t} />}
        {tab === 'engagement' && (
          <EngagementPanel
            data={engagementSummary}
            zoneCount={zoneCount}
            mediaCount={mediaCount}
            totalExited={totalExited}
            t={t}
          />
        )}
      </div>
    </aside>
  );
}

function Empty({ t }: { t: Translator }) {
  return <p className="text-[11px] text-muted-foreground italic py-2">{t('analyze.bento.empty')}</p>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-data tabular-nums">{value}</span>
    </div>
  );
}

function BottlenecksPanel({ data, t }: { data: readonly BottleneckEntry[]; t: Translator }) {
  if (data.length === 0) return <Empty t={t} />;
  return (
    <ul className="space-y-2">
      {data.map((b, i) => (
        <li key={i} className="space-y-1">
          <div className="flex items-baseline gap-2 text-[11px]">
            <span className="font-data tabular-nums text-muted-foreground/60 w-4">{i + 1}.</span>
            <span className="flex-1 truncate">{b.name}</span>
            <span className="font-data tabular-nums text-foreground/85">
              {Math.round(b.score * 100)}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-secondary/60 overflow-hidden ml-5">
            <div
              className={`h-full ${
                b.score > 0.7 ? 'bg-[var(--status-danger)]'
                : b.score > 0.5 ? 'bg-foreground/65'
                : 'bg-foreground/40'
              }`}
              style={{ width: `${Math.round(b.score * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SkipPanel({
  data, selectedMediaId, onSelectMedia, t,
}: {
  data: readonly SkipMediaEntry[];
  selectedMediaId: string | null;
  onSelectMedia: (id: string) => void;
  t: Translator;
}) {
  if (data.length === 0) return <Empty t={t} />;
  return (
    <ul className="space-y-1">
      {data.map((m) => {
        const isSelected = selectedMediaId === m.id;
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelectMedia(m.id)}
              className={`w-full flex items-center gap-2 text-[11px] rounded-md px-2 py-1.5 transition-colors text-left ${
                isSelected
                  ? 'bg-primary/10 ring-1 ring-primary/40'
                  : 'hover:bg-secondary/50'
              }`}
              aria-pressed={isSelected}
            >
              <span className="flex-1 truncate">{m.name}</span>
              <span className="font-data tabular-nums text-muted-foreground/70 text-[10px]">
                {m.skipCount}회
              </span>
              <span className={`font-data tabular-nums w-9 text-right ${
                m.rate > 0.5 ? 'text-[var(--status-danger)]'
                : m.rate > 0.3 ? 'text-foreground'
                : 'text-foreground/85'
              }`}>
                {Math.round(m.rate * 100)}%
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FlowPanel({ data, t }: { data: FlowSummary; t: Translator }) {
  if (data.entries.length === 0 && data.exits.length === 0) return <Empty t={t} />;
  const totalIn = data.entries.reduce((s, e) => s + e.count, 0);
  const totalOut = data.exits.reduce((s, e) => s + e.count, 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-secondary/40 py-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">in</div>
          <div className="font-data tabular-nums text-base font-semibold">{totalIn}</div>
        </div>
        <div className="rounded-lg bg-secondary/40 py-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">out</div>
          <div className="font-data tabular-nums text-base font-semibold">{totalOut}</div>
        </div>
      </div>
      {data.entries.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">진입</div>
          <div className="space-y-0.5">
            {data.entries.map((e, i) => (
              <div key={`in-${i}`} className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] shrink-0" />
                <span className="flex-1 truncate">{e.name}</span>
                <span className="font-data tabular-nums text-foreground/85">{e.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.exits.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">이탈</div>
          <div className="space-y-0.5">
            {data.exits.map((e, i) => (
              <div key={`out-${i}`} className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                <span className="flex-1 truncate">{e.name}</span>
                <span className="font-data tabular-nums text-foreground/85">{e.count}</span>
              </div>
            ))}
            {data.unaccountedExits > 0 && (
              <div className="flex items-center gap-2 text-[11px] pt-1 mt-1 border-t border-border/40">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                <span className="flex-1 truncate text-muted-foreground italic">
                  {t('analyze.bento.entryExit.sessionEnd')}
                </span>
                <span className="font-data tabular-nums text-muted-foreground">
                  {data.unaccountedExits}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EngagementPanel({
  data, zoneCount, mediaCount, totalExited, t,
}: {
  data: EngagementSummary;
  zoneCount: number;
  mediaCount: number;
  totalExited: number;
  t: Translator;
}) {
  if (totalExited === 0) return <Empty t={t} />;
  const completionPct = Math.round(data.fullCompletion * 100);
  const dwellMin = data.avgDwellSec / 60;
  return (
    <div className="space-y-3 text-[11px]">
      <div className="rounded-lg bg-secondary/40 px-2.5 py-2">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
          {t('analyze.engagement.fullCompletion')}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-data tabular-nums text-2xl font-semibold leading-none">
            {completionPct}%
          </span>
          <span className="text-[10px] text-muted-foreground">n={totalExited}</span>
        </div>
        <div className="h-1 rounded-full bg-secondary mt-1.5 overflow-hidden">
          <div
            className={`h-full ${
              completionPct >= 70 ? 'bg-[var(--status-success)]'
              : completionPct >= 40 ? 'bg-foreground/55'
              : 'bg-[var(--status-danger)]'
            }`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Row label={t('analyze.engagement.avgZones')}  value={`${data.avgZones.toFixed(1)} / ${zoneCount}`} />
        <Row label={t('analyze.engagement.avgMedia')}  value={`${data.avgMedia.toFixed(1)} / ${mediaCount}`} />
        <Row label={t('analyze.engagement.avgDwell')}  value={`${dwellMin.toFixed(1)}분`} />
      </div>
    </div>
  );
}
