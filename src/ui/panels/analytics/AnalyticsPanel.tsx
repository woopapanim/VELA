import { useStore } from '@/stores';
import { generateInsights } from '@/analytics';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import type { InsightEntry } from '@/domain';
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

  // Generate live insights from latest snapshot
  const liveInsights = latestSnapshot ? generateInsights(latestSnapshot, zones) : [];

  // KPI cards data
  const avgFatigue = latestSnapshot?.fatigueDistribution.mean ?? 0;
  const peakZone = latestSnapshot?.zoneUtilizations
    .reduce((max, u) => (u.ratio > max.ratio ? u : max), { ratio: 0, zoneId: '' as any });
  const peakZoneName = peakZone?.zoneId
    ? zones.find((z) => z.id === peakZone.zoneId)?.name ?? '—'
    : '—';
  const throughput = latestSnapshot?.flowEfficiency.throughputPerMinute ?? 0;

  return (
    <div className="p-3 space-y-3">
      {/* KPI Cards */}
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
        {/* Entry/Exit per-node breakdown */}
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

      {/* Live KPIs */}
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

      {/* Agent Distribution */}
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

      {/* Followed Agent Card */}
      <FollowedAgentCard />

      {/* Live Dashboard */}
      <StatsDashboard />

      {/* Trend Chart */}
      <TrendChart />

      {/* Selected Zone Detail */}
      <ZoneDetail />

      {/* Zone Donut Chart */}
      <ZoneDonutChart />

      {/* Zone Heat Ranking (sortable table) */}
      <HeatRanking />

      {/* Zone Utilization */}
      {latestSnapshot && latestSnapshot.zoneUtilizations.length > 0 && (
        <div className="bento-box p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Zone Utilization
          </h2>
          <div className="space-y-1.5">
            {latestSnapshot.zoneUtilizations
              .filter((u) => u.currentOccupancy > 0)
              .sort((a, b) => b.ratio - a.ratio)
              .map((u) => {
                const zone = zones.find((z) => z.id === u.zoneId);
                if (!zone) return null;
                const pct = Math.round(u.ratio * 100);
                const barColor =
                  pct > 80 ? 'bg-[var(--status-danger)]' :
                  pct > 50 ? 'bg-[var(--status-warning)]' :
                  'bg-primary';
                return (
                  <div key={u.zoneId as string} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: zone.color }} />
                    <span className="w-20 truncate text-[10px]">{zone.name}</span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-data text-[10px] text-muted-foreground">
                      {u.currentOccupancy}/{u.capacity}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Profile Legend */}
      <ProfileLegend />

      {/* Sensitivity Analysis */}
      <SensitivityPanel />

      {/* Completion Report */}
      <CompletionReport />

      {/* Heatmap Legend */}
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

      {/* Agent Journey (when following) */}
      <AgentJourney />

      {/* Node Traffic (pathLog aggregate) */}
      <NodeTraffic />

      {/* Engagement Histogram */}
      <EngagementHistogram />

      {/* Zone Graph */}
      <ZoneGraphViz />

      {/* Media Ranking */}
      <MediaRanking />

      {/* Simulation Timeline Chart */}
      <ActionAreaChart />

      {/* Event Log */}
      <EventLog />

      {/* Insights */}
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
                      <p className="font-medium">{zone?.name}: 병목 위험 ({si.bottleneckRisk})</p>
                      <p className="text-muted-foreground mt-0.5">
                        예상 밀도 {si.areaPerPerson.toFixed(1)}m²/인 (기준: 2.5m²/인)
                      </p>
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
        ) : (
          <p className="text-xs text-muted-foreground">
            {phase === 'idle'
              ? 'Start simulation to see real-time insights'
              : 'Collecting data...'}
          </p>
        )}
      </div>
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

function InsightCard({ insight }: { insight: InsightEntry }) {
  const severityConfig = {
    critical: { icon: AlertCircle, bgClass: 'bg-[var(--status-danger)]/10', borderClass: 'border-[var(--status-danger)]/20', iconClass: 'text-[var(--status-danger)]' },
    warning: { icon: AlertTriangle, bgClass: 'bg-[var(--status-warning)]/10', borderClass: 'border-[var(--status-warning)]/20', iconClass: 'text-[var(--status-warning)]' },
    info: { icon: Info, bgClass: 'bg-[var(--status-info)]/10', borderClass: 'border-[var(--status-info)]/20', iconClass: 'text-[var(--status-info)]' },
  };

  const cfg = severityConfig[insight.severity];
  const Icon = cfg.icon;

  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg ${cfg.bgClass} border ${cfg.borderClass}`}>
      <Icon className={`w-3.5 h-3.5 ${cfg.iconClass} mt-0.5 shrink-0`} />
      <div className="text-[10px] min-w-0">
        <p className="font-medium">{insight.problem}</p>
        <p className="text-muted-foreground mt-0.5">{insight.cause}</p>
        <p className="text-primary mt-1">{insight.recommendation}</p>
      </div>
    </div>
  );
}
