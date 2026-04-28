/**
 * AnalyticsPanel — Analyze 단계 우측 패널 (post-run 전용, 2026-04-28).
 *
 * 2026-04-28 IA 재구성:
 *   - Live 탭(Flow/Behavior/Experience) 제거 → `LivePulse` 가 대체.
 *   - Persistent KPI 블록 제거 → Pulse 가 모니터링 담당, 여기는 회고만.
 *   - Post 탭(Action/Pin/Report)만 유지.
 *
 * 진입 문서: docs/plans/ux-ia-restructure.md §6 Stage B
 */
import { useState } from 'react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { experienceModeTier } from '@/domain';
import { Zap, FileText, Pin, Save, GitBranch } from 'lucide-react';
import { useToast } from '@/ui/components/Toast';
import { scenarioManager } from '@/scenario';
import { PolicyComparisonLauncher } from '../build/PolicyComparisonLauncher';
import { CompletionReport } from './CompletionReport';
import { SensitivityPanel } from './SensitivityPanel';
import { EventLog } from './EventLog';
import { AgentJourney } from './AgentJourney';
import { PinTimeline } from './PinTimeline';
import { PinDetail } from './PinDetail';
import { PinCompare } from './PinCompare';

type AnalyticsTab = 'action' | 'pin' | 'report';

interface TabMeta {
  id: AnalyticsTab;
  label: string;
  icon: typeof Zap;
}

const TABS: TabMeta[] = [
  { id: 'action', label: 'Action', icon: Zap },
  { id: 'pin', label: 'Pin', icon: Pin },
  { id: 'report', label: 'Report', icon: FileText },
];

interface AnalyticsPanelProps {
  /** 시나리오를 변형으로 fork 하고 Build 단계로 이동 (검증 tier Action 탭에서 호출). */
  onForkToBuild?: () => void;
}

export function AnalyticsPanel({ onForkToBuild }: AnalyticsPanelProps = {}) {
  const t = useT();
  const scenario = useStore((s) => s.scenario);
  const tier = scenario?.experienceMode
    ? experienceModeTier(scenario.experienceMode)
    : 'operations';

  const [tab, setTab] = useState<AnalyticsTab>('action');

  return (
    <div className="p-3 space-y-3">
      {/* Tab strip — Post 만 (Live 는 LivePulse 가 대체). */}
      <div className="flex gap-0.5 p-0.5 rounded-lg bg-secondary/50 border border-border">
        {TABS.map((meta) => {
          const Icon = meta.icon;
          const active = tab === meta.id;
          return (
            <button
              key={meta.id}
              onClick={() => setTab(meta.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-md transition-colors ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
              title={meta.label}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">{meta.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'action' && (
        <div className="space-y-3">
          {/* 상단 핫스팟 — 어디가 막혔나 / 어디로 흘렀나 (운영/검증 공통, no-scroll 우선순위) */}
          <PostRunHotspots t={t} />
          {/* tier-specific 진입점:
              운영 = PolicyComparisonLauncher (cap A/B/C 비교)
              검증 = ForkToBuild CTA (변형 fork → Build 에서 수정 → 재시뮬) */}
          {tier === 'operations' ? (
            <PolicyComparisonLauncher />
          ) : (
            <ValidationActionCard onForkToBuild={onForkToBuild} t={t} />
          )}
          <SensitivityPanel />
        </div>
      )}

      {tab === 'pin' && (
        <div className="space-y-3">
          <PinTimeline />
          <PinCompare />
          <PinDetail />
        </div>
      )}

      {tab === 'report' && (
        <div className="space-y-3">
          <CompletionReport />
          <EventLog />
          <AgentJourney />
        </div>
      )}
    </div>
  );
}

// ── ValidationActionCard — 검증 tier 의 Action 탭 진입점 ────────
// 결과 요약 (KPI 3개) + 다음 행동 (저장 / 변형 fork) 두 단으로 구성.
// 운영 tier 의 PolicyComparisonLauncher 와 framing 일관성: "본 다음에 결정한다."
function ValidationActionCard({
  onForkToBuild,
  t,
}: {
  onForkToBuild?: () => void;
  t: (key: string) => string;
}) {
  const { toast } = useToast();
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const visitors = useStore((s) => s.visitors);
  const timeState = useStore((s) => s.timeState);
  const scenario = useStore((s) => s.scenario);
  const kpiHistory = useStore((s) => s.kpiHistory);

  const exited = visitors.filter((v) => !v.isActive);
  const avgDwellMs = exited.length > 0
    ? exited.reduce((s, v) => s + ((v.exitedAt ?? timeState.elapsed) - v.enteredAt), 0) / exited.length
    : 0;
  const avgDwellMin = Math.round(avgDwellMs / 60000 * 10) / 10;
  const skipPct = Math.round((latestSnapshot?.skipRate.globalSkipRate ?? 0) * 100);
  const bottleneckCount = latestSnapshot
    ? latestSnapshot.bottlenecks.filter((b) => b.score > 0.5).length
    : 0;

  const handleSave = () => {
    if (!scenario) return;
    scenarioManager.save(scenario, kpiHistory);
    toast('success', t('analytics.action.validation.saved', { name: scenario.meta.name }));
  };

  return (
    <div className="bento-box p-4 space-y-3">
      <h2 className="panel-section">{t('analytics.action.validation.title')}</h2>

      {/* KPI 3 — 무엇을 본 후에 결정할지 명확하게 */}
      <div className="grid grid-cols-3 gap-2">
        <ResultTile
          label={t('analytics.action.validation.kpi.bottleneck')}
          value={String(bottleneckCount)}
          tone={bottleneckCount > 0 ? 'danger' : 'good'}
        />
        <ResultTile
          label={t('analytics.action.validation.kpi.dwell')}
          value={`${avgDwellMin}m`}
          tone="neutral"
        />
        <ResultTile
          label={t('analytics.action.validation.kpi.skip')}
          value={`${skipPct}%`}
          tone={skipPct > 30 ? 'danger' : skipPct > 15 ? 'warning' : 'good'}
        />
      </div>

      <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
        {t('analytics.action.validation.desc')}
      </p>

      {/* 두 CTA 병렬 — 저장 (이대로 OK) / 변형 (다른 안 시험) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-accent text-foreground text-[11px] font-medium transition-colors border border-border"
        >
          <Save className="w-3.5 h-3.5" />
          {t('analytics.action.validation.saveBtn')}
        </button>
        <button
          type="button"
          onClick={onForkToBuild}
          disabled={!onForkToBuild}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/90 hover:bg-primary text-primary-foreground text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <GitBranch className="w-3.5 h-3.5" />
          {t('analytics.action.validation.forkBtn')}
        </button>
      </div>
    </div>
  );
}

// ── PostRunHotspots — Action 탭 상단 핫스팟 (운영/검증 공통) ─────
// 시뮬 끝난 직후 "어디가 막혔나? / 어디로 흘렀나?" 두 질문에 답한다.
// 좌: 병목 점수 상위 3 영역. 우: 누적 watchCount 상위 3 전시물.
// 스크롤 없이 보여야 함 — 두 컬럼 grid, max 3 rows.
function PostRunHotspots({ t }: { t: (key: string, params?: Record<string, any>) => string }) {
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const mediaStats = useStore((s) => s.mediaStats);

  if (!latestSnapshot) return null;

  const topBottlenecks = latestSnapshot.bottlenecks
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .filter((b) => b.score > 0)
    .map((b) => ({
      id: b.zoneId,
      name: zones.find((z) => z.id === b.zoneId)?.name ?? '—',
      score: b.score,
    }));

  const topMedia = Array.from(mediaStats.entries())
    .map(([id, stats]) => ({
      id,
      name: media.find((m) => m.id === id)?.name ?? '—',
      watchCount: stats.watchCount,
    }))
    .filter((m) => m.watchCount > 0)
    .sort((a, b) => b.watchCount - a.watchCount)
    .slice(0, 3);

  return (
    <div className="bento-box p-3 space-y-2">
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
        {t('analytics.action.hotspots.title')}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {/* 좌: 병목 영역 */}
        <div>
          <div className="text-[10px] text-muted-foreground/80 mb-1">
            {t('analytics.action.hotspots.bottleneckTitle')}
          </div>
          {topBottlenecks.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/60 py-1">
              {t('analytics.action.hotspots.bottleneckEmpty')}
            </p>
          ) : (
            <ul className="space-y-1">
              {topBottlenecks.map((b) => {
                const sev = b.score > 0.7 ? 'danger' : b.score > 0.4 ? 'warning' : 'muted';
                const barColor =
                  sev === 'danger' ? 'bg-[var(--status-danger)]'
                  : sev === 'warning' ? 'bg-[var(--status-warning)]'
                  : 'bg-muted-foreground/40';
                const textColor =
                  sev === 'danger' ? 'text-[var(--status-danger)]'
                  : sev === 'warning' ? 'text-[var(--status-warning)]'
                  : 'text-foreground';
                return (
                  <li key={b.id} className="flex items-center gap-1.5 text-[10px]">
                    <span className="flex-1 truncate text-foreground/90">{b.name}</span>
                    <div className="w-8 h-1 bg-secondary/60 rounded-full overflow-hidden shrink-0">
                      <div className={`h-full ${barColor}`} style={{ width: `${Math.round(b.score * 100)}%` }} />
                    </div>
                    <span className={`font-data tabular-nums shrink-0 text-[10px] ${textColor}`}>
                      {b.score.toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {/* 우: 가장 많이 본 전시물 */}
        <div>
          <div className="text-[10px] text-muted-foreground/80 mb-1">
            {t('analytics.action.hotspots.mediaTitle')}
          </div>
          {topMedia.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/60 py-1">
              {t('analytics.action.hotspots.mediaEmpty')}
            </p>
          ) : (
            <ul className="space-y-1">
              {topMedia.map((m) => (
                <li key={m.id} className="flex items-center gap-1.5 text-[10px]">
                  <span className="flex-1 truncate text-foreground/90">{m.name}</span>
                  <span className="font-data tabular-nums shrink-0 text-[10px] text-primary">
                    {t('analytics.action.hotspots.watchCount', { n: m.watchCount })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'warning' | 'danger' | 'neutral';
}) {
  const valColor =
    tone === 'danger' ? 'text-[var(--status-danger)]'
    : tone === 'warning' ? 'text-[var(--status-warning)]'
    : tone === 'good' ? 'text-[var(--status-success)]'
    : 'text-foreground';
  return (
    <div className="rounded-lg bg-secondary/40 border border-border px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-medium leading-tight">
        {label}
      </div>
      <div className={`text-base font-semibold font-data leading-tight mt-0.5 ${valColor}`}>{value}</div>
    </div>
  );
}

