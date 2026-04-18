import { useStore } from '@/stores';
import { generateInsights } from '@/analytics';
import {
  AlertTriangle,
  Info,
  AlertCircle,
  ArrowRight,
  LayoutDashboard,
  GitBranch,
  Users,
  Zap,
  FileText,
} from 'lucide-react';
import type { InsightEntry } from '@/domain';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { TrendChart } from './TrendChart';
import { ZoneDetail } from './ZoneDetail';
import { ProfileLegend } from './ProfileLegend';
import { CompletionReport } from './CompletionReport';
import { SensitivityPanel } from './SensitivityPanel';
import { StatsDashboard } from './StatsDashboard';
import { HeatRanking } from './HeatRanking';
import { FollowedAgentCard } from './FollowedAgentCard';
import { EventLog } from './EventLog';
import { ZoneDonutChart } from './ZoneDonutChart';
import { ActionAreaChart } from './ActionAreaChart';
import { MediaRanking } from './MediaRanking';
import { ZoneGraphViz } from './ZoneGraphViz';
import { AgentJourney } from './AgentJourney';
import { NodeTraffic } from './NodeTraffic';
import { EngagementHistogram } from './EngagementHistogram';

export function AnalyticsPanel() {
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const phase = useStore((s) => s.phase);
  const timeState = useStore((s) => s.timeState);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const staticInsights = useStore((s) => s.staticInsights);

  const totalSpawned = useStore((s) => s.totalSpawned);
  const totalExited = useStore((s) => s.totalExited);
  const spawnByNode = useStore((s) => s.spawnByNode);
  const exitByNode = useStore((s) => s.exitByNode);
  const graph = useStore((s) => s.waypointGraph);
  const activeCount = visitors.filter((v) => v.isActive).length;
  const elapsed = timeState.elapsed;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const media = useStore((s) => s.media);
  const mediaStats = useStore((s) => s.mediaStats);
  const groups = useStore((s) => s.groups);

  const liveInsights = latestSnapshot
    ? generateInsights(latestSnapshot, zones, media, mediaStats, visitors, groups)
    : [];

  const avgFatigue = latestSnapshot?.fatigueDistribution.mean ?? 0;
  const peakZone = latestSnapshot?.zoneUtilizations
    .reduce((max, u) => (u.ratio > max.ratio ? u : max), { ratio: 0, zoneId: '' as any });
  const peakZoneName = peakZone?.zoneId
    ? zones.find((z) => z.id === peakZone.zoneId)?.name ?? '—'
    : '—';
  const throughput = latestSnapshot?.flowEfficiency.throughputPerMinute ?? 0;

  const hasActionContent =
    liveInsights.length > 0 ||
    (phase === 'idle' && staticInsights.some((si) => si.bottleneckRisk === 'high' || si.bottleneckRisk === 'critical'));

  return (
    <div className="p-3">
      {/* 1. OVERVIEW — 1초 판단 */}
      <CollapsibleSection
        id="analytics-overview"
        defaultOpen={true}
        title="Overview"
        icon={<LayoutDashboard className="w-3 h-3 text-muted-foreground" />}
      >
        <div className="space-y-3">
          <div className="bento-box p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Analytics
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <KpiCard label="Active" value={activeCount} color="text-primary" />
              <KpiCard label="Exited" value={totalExited} color="text-[var(--status-danger)]" />
              <KpiCard label="Spawned" value={totalSpawned} />
              <KpiCard label="Elapsed" value={`${minutes}m ${seconds}s`} />
            </div>
            {graph && (spawnByNode.size > 0 || exitByNode.size > 0) && (
              <div className="mt-3 space-y-1.5">
                {graph.nodes.filter(n => n.type === 'entry').map(n => (
                  <div key={n.id as string} className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
                    <span className="flex-1 truncate font-data">{n.label || 'Entry'}</span>
                    <span className="text-primary font-data">{spawnByNode.get(n.id as string) ?? 0} in</span>
                  </div>
                ))}
                {graph.nodes.filter(n => n.type === 'exit').map(n => (
                  <div key={n.id as string} className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-2 h-2 rounded-full bg-[#ef4444] shrink-0" />
                    <span className="flex-1 truncate font-data">{n.label || 'Exit'}</span>
                    <span className="text-[var(--status-danger)] font-data">{exitByNode.get(n.id as string) ?? 0} out</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {latestSnapshot && (
            <div className="bento-box p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Live KPI
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <KpiCard
                  label="Avg Fatigue"
                  value={`${Math.round(avgFatigue * 100)}%`}
                  color={avgFatigue > 0.6 ? 'text-[var(--status-danger)]' : 'text-primary'}
                />
                <KpiCard
                  label="Throughput"
                  value={`${throughput.toFixed(1)}/m`}
                />
                <KpiCard
                  label="Peak Zone"
                  value={peakZoneName}
                  small
                />
                <KpiCard
                  label="Peak Load"
                  value={`${Math.round((peakZone?.ratio ?? 0) * 100)}%`}
                  color={
                    (peakZone?.ratio ?? 0) > 0.8
                      ? 'text-[var(--status-danger)]'
                      : (peakZone?.ratio ?? 0) > 0.5
                        ? 'text-[var(--status-warning)]'
                        : 'text-primary'
                  }
                />
              </div>
            </div>
          )}

          <div className="bento-box p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Agent Distribution
            </h2>
            <div className="space-y-1.5">
              {(['IDLE', 'MOVING', 'WATCHING', 'WAITING', 'EXITING'] as const).map((action) => {
                const count = visitors.filter((v) => v.isActive && v.currentAction === action).length;
                const pct = activeCount > 0 ? Math.round((count / activeCount) * 100) : 0;
                const barColor =
                  action === 'WATCHING' ? 'bg-[var(--status-success)]' :
                  action === 'WAITING' ? 'bg-[var(--status-warning)]' :
                  action === 'EXITING' ? 'bg-[var(--status-danger)]' :
                  'bg-primary';
                return (
                  <div key={action} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-muted-foreground font-data text-[10px]">{action}</span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-data text-muted-foreground text-[10px]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <StatsDashboard />
          <FollowedAgentCard />
        </div>
      </CollapsibleSection>

      {/* 2. FLOW ANALYSIS — 어디서 왜 터졌는지 */}
      <CollapsibleSection
        id="analytics-flow"
        title="Flow Analysis"
        icon={<GitBranch className="w-3 h-3 text-muted-foreground" />}
      >
        <div className="space-y-3">
          <HeatRanking />
          <NodeTraffic />
          <TrendChart />
          <ActionAreaChart />
          <ZoneDetail />
          <ZoneDonutChart />
          <ZoneGraphViz />
        </div>
      </CollapsibleSection>

      {/* 3. BEHAVIOR */}
      <CollapsibleSection
        id="analytics-behavior"
        title="Behavior"
        icon={<Users className="w-3 h-3 text-muted-foreground" />}
      >
        <div className="space-y-3">
          <ProfileLegend />
          <EngagementHistogram />
          <MediaRanking />
        </div>
      </CollapsibleSection>

      {/* 4. ACTION — 핵심: 의사결정 엔진 */}
      <CollapsibleSection
        id="analytics-action"
        defaultOpen={true}
        title="Action"
        icon={<Zap className="w-3 h-3 text-muted-foreground" />}
      >
        <div className="space-y-3">
          <div className="bento-box p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Insights
            </h2>
            {phase === 'idle' && staticInsights.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Pre-Simulation Analysis</p>
                {staticInsights
                  .filter((si) => si.bottleneckRisk === 'high' || si.bottleneckRisk === 'critical')
                  .map((si) => {
                    const zone = zones.find((z) => z.id === si.zoneId);
                    return (
                      <div key={si.zoneId as string} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-[var(--status-warning)] mt-0.5 shrink-0" />
                        <div className="text-[10px]">
                          <p className="font-medium">{zone?.name}: 사전 면적 확장 권장</p>
                          <p className="text-muted-foreground mt-0.5">
                            예상 밀도 {si.areaPerPerson.toFixed(1)}m²/인 &lt; 기준 2.5m²/인 — 병목 위험 {si.bottleneckRisk}
                          </p>
                          <p className="text-primary mt-1">→ 존 용량 상한 또는 면적 확장으로 사전 대응</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {liveInsights.length > 0 ? (
              <div className="space-y-2">
                {liveInsights.slice(0, 5).map((insight, i) => (
                  <InsightCard key={i} insight={insight} />
                ))}
              </div>
            ) : !hasActionContent ? (
              <p className="text-xs text-muted-foreground">
                {phase === 'idle'
                  ? 'Start simulation to see real-time insights'
                  : 'Collecting data...'}
              </p>
            ) : null}
          </div>

          <SensitivityPanel />
        </div>
      </CollapsibleSection>

      {/* 5. REPORT */}
      <CollapsibleSection
        id="analytics-report"
        title="Report"
        icon={<FileText className="w-3 h-3 text-muted-foreground" />}
      >
        <div className="space-y-3">
          <CompletionReport />
          <EventLog />
          <AgentJourney />
          <div className="bento-box p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Heatmap
            </h2>
            <div className="h-2 rounded-full" style={{
              background: 'linear-gradient(to right, var(--heatmap-cold), var(--heatmap-mid), var(--heatmap-hot))',
            }} />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">Cold</span>
              <span className="text-[10px] text-muted-foreground">Hot</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function KpiCard({ label, value, color, small }: {
  label: string;
  value: string | number;
  color?: string;
  small?: boolean;
}) {
  return (
    <div className="bento-box-elevated p-3 text-center">
      <div className={`font-semibold font-data ${color ?? 'text-primary'} ${small ? 'text-sm' : 'text-lg'}`}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}

/** Map insight category → store action + button label */
function resolveInsightAction(insight: InsightEntry): { label: string; run: () => void } | null {
  const zoneId = insight.affectedZoneIds[0];
  const mediaId = insight.affectedMediaIds[0];
  const s = useStore.getState();

  switch (insight.category) {
    case 'congestion':
      if (!zoneId) return null;
      return { label: '존 편집', run: () => { s.selectZone(zoneId); scrollEditorIntoView('zone'); } };
    case 'capacity':
      if (!zoneId) return null;
      return { label: '용량 편집', run: () => { s.selectZone(zoneId); scrollEditorIntoView('zone'); } };
    case 'skip':
      if (!mediaId) return null;
      return { label: '미디어 편집', run: () => { s.selectMedia(mediaId); scrollEditorIntoView('media'); } };
    case 'fatigue':
      return { label: '히트맵 보기', run: () => s.setOverlayMode('heatmap') };
    case 'flow':
      return { label: '동선 보기', run: () => s.setOverlayMode('flow') };
    case 'space_roi':
      if (!zoneId) return null;
      return { label: '존 편집', run: () => { s.selectZone(zoneId); scrollEditorIntoView('zone'); } };
    case 'content_mix':
      if (!zoneId) return null;
      return { label: '존 편집', run: () => { s.selectZone(zoneId); scrollEditorIntoView('zone'); } };
    case 'group_impact':
      if (zoneId) return { label: '존 확인', run: () => { s.selectZone(zoneId); scrollEditorIntoView('zone'); } };
      return null;
    case 'content_fatigue':
      return {
        label: '밀도 보기',
        run: () => {
          s.setOverlayMode('density');
          if (mediaId) { s.selectMedia(mediaId); scrollEditorIntoView('media'); }
        },
      };
    default:
      return null;
  }
}

function scrollEditorIntoView(kind: 'zone' | 'media') {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(
      kind === 'zone' ? '[data-editor="zone"]' : '[data-editor="media"]',
    );
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

function InsightCard({ insight }: { insight: InsightEntry }) {
  const severityConfig = {
    critical: { icon: AlertCircle, bgClass: 'bg-[var(--status-danger)]/10', borderClass: 'border-[var(--status-danger)]/20', iconClass: 'text-[var(--status-danger)]' },
    warning: { icon: AlertTriangle, bgClass: 'bg-[var(--status-warning)]/10', borderClass: 'border-[var(--status-warning)]/20', iconClass: 'text-[var(--status-warning)]' },
    info: { icon: Info, bgClass: 'bg-[var(--status-info)]/10', borderClass: 'border-[var(--status-info)]/20', iconClass: 'text-[var(--status-info)]' },
  };

  const cfg = severityConfig[insight.severity];
  const Icon = cfg.icon;
  const action = resolveInsightAction(insight);

  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg ${cfg.bgClass} border ${cfg.borderClass}`}>
      <Icon className={`w-3.5 h-3.5 ${cfg.iconClass} mt-0.5 shrink-0`} />
      <div className="text-[10px] min-w-0 flex-1">
        <p className="font-medium">{insight.problem}</p>
        <p className="text-muted-foreground mt-0.5">{insight.cause}</p>
        <p className="text-primary mt-1">{insight.recommendation}</p>
        {action && (
          <button
            onClick={action.run}
            className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium transition-colors"
          >
            {action.label}
            <ArrowRight className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}
