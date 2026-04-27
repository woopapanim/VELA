import { useState } from 'react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import {
  GitBranch,
  Users,
  Sparkles,
  Zap,
  FileText,
  Pin,
} from 'lucide-react';
import { TrendChart } from './TrendChart';
import { ZoneDetail } from './ZoneDetail';
import { ProfileLegend } from './ProfileLegend';
import { CompletionReport } from './CompletionReport';
import { SensitivityPanel } from './SensitivityPanel';
import { HeatRanking } from './HeatRanking';
import { FollowedAgentCard } from './FollowedAgentCard';
import { EventLog } from './EventLog';
import { ZoneDonutChart } from './ZoneDonutChart';
import { ActionAreaChart } from './ActionAreaChart';
import { ZoneGraphViz } from './ZoneGraphViz';
import { AgentJourney } from './AgentJourney';
import { NodeTraffic } from './NodeTraffic';
import { EngagementHistogram } from './EngagementHistogram';
import { ExperienceQuality } from './ExperienceQuality';
import { ZoneMediaPerformance } from './ZoneMediaPerformance';
import { FlowVsExperience } from './FlowVsExperience';
import { PinTimeline } from './PinTimeline';
import { PinDetail } from './PinDetail';
import { PinCompare } from './PinCompare';

type AnalyticsTab = 'flow' | 'behavior' | 'experience' | 'action' | 'pin' | 'report';

const TABS: { id: AnalyticsTab; label: string; icon: typeof GitBranch }[] = [
  { id: 'flow', label: 'Flow', icon: GitBranch },
  { id: 'behavior', label: 'Behavior', icon: Users },
  { id: 'experience', label: 'Experience', icon: Sparkles },
  { id: 'action', label: 'Action', icon: Zap },
  { id: 'pin', label: 'Pin', icon: Pin },
  { id: 'report', label: 'Report', icon: FileText },
];

export function AnalyticsPanel() {
  const [tab, setTab] = useState<AnalyticsTab>('action');
  const t = useT();

  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const timeState = useStore((s) => s.timeState);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const totalExited = useStore((s) => s.totalExited);
  const spawnByNode = useStore((s) => s.spawnByNode);
  const exitByNode = useStore((s) => s.exitByNode);
  const graph = useStore((s) => s.waypointGraph);

  const activeCount = visitors.filter((v) => v.isActive).length;
  const elapsed = timeState.elapsed;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const avgFatigue = latestSnapshot?.fatigueDistribution.mean ?? 0;
  const peakZone = latestSnapshot?.zoneUtilizations
    .reduce((max, u) => (u.ratio > max.ratio ? u : max), { ratio: 0, zoneId: '' as any });
  const peakZoneName = peakZone?.zoneId
    ? zones.find((z) => z.id === peakZone.zoneId)?.name ?? '—'
    : '—';
  const peakLoadPct = Math.round((peakZone?.ratio ?? 0) * 100);
  const throughput = latestSnapshot?.flowEfficiency.throughputPerMinute ?? 0;

  return (
    <div className="p-3 space-y-3">
      {/* ─── PERSISTENT TOP ─── */}
      <div className="bento-box p-3">
        <h2 className="panel-section mb-2 flex items-center gap-1.5">
          Summary
          <InfoTooltip text={t('tooltip.summary')} />
        </h2>
        <div className="grid grid-cols-3 gap-1.5">
          <KpiTile label="Active" value={activeCount} />
          <KpiTile label="Spawned" value={totalSpawned} />
          <KpiTile label="Exited" value={totalExited} accent="danger" />
          <KpiTile
            label="Fatigue"
            value={`${Math.round(avgFatigue * 100)}%`}
            accent={avgFatigue > 0.6 ? 'danger' : 'primary'}
          />
          <KpiTile label="Thru/min" value={throughput.toFixed(1)} />
          <KpiTile label="Elapsed" value={`${minutes}:${seconds.toString().padStart(2, '0')}`} />
        </div>
        {latestSnapshot && (
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Peak Zone</span>
            <span className="font-data truncate max-w-[60%]">{peakZoneName}</span>
            <span
              className={`font-data ${peakLoadPct > 80 ? 'text-[var(--status-danger)]' : peakLoadPct > 50 ? 'text-[var(--status-warning)]' : 'text-primary'}`}
            >
              {peakLoadPct}%
            </span>
          </div>
        )}
      </div>

      <div className="bento-box p-3">
        <h2 className="panel-section mb-2 flex items-center gap-1.5">
          Agent Distribution
          <InfoTooltip text={t('tooltip.agentDistribution')} />
        </h2>
        <div className="space-y-1">
          {(['MOVING', 'WATCHING', 'WAITING', 'RESTING', 'EXITING'] as const).map((action) => {
            const count = visitors.filter((v) => v.isActive && v.currentAction === action).length;
            const pct = activeCount > 0 ? Math.round((count / activeCount) * 100) : 0;
            const barColor =
              action === 'WATCHING' ? 'bg-[var(--status-success)]' :
              action === 'WAITING' ? 'bg-[var(--status-warning)]' :
              action === 'RESTING' ? 'bg-[var(--status-info)]' :
              action === 'EXITING' ? 'bg-[var(--status-danger)]' :
              'bg-primary';
            return (
              <div key={action} className="flex items-center gap-2">
                <span className="w-14 text-muted-foreground font-data text-[10px]">{action}</span>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-7 text-right font-data text-muted-foreground text-[10px]">{count}</span>
              </div>
            );
          })}
          {/* CONGESTED: subset of MOVING — stuck by physics (velocity below crawl speed). */}
          {(() => {
            const congestedCount = visitors.filter((v) => {
              if (!v.isActive || v.currentAction !== 'MOVING') return false;
              const speed = Math.hypot(v.velocity.x, v.velocity.y);
              return speed < 5;
            }).length;
            const pct = activeCount > 0 ? Math.round((congestedCount / activeCount) * 100) : 0;
            return (
              <div className="flex items-center gap-2">
                <span className="w-14 text-muted-foreground font-data text-[10px] opacity-70">CONGESTED</span>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 bg-[var(--status-warning)] opacity-60"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-7 text-right font-data text-muted-foreground text-[10px]">{congestedCount}</span>
              </div>
            );
          })()}
        </div>
        {graph && (spawnByNode.size > 0 || exitByNode.size > 0) && (
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            {graph.nodes.filter((n) => n.type === 'entry').map((n) => (
              <div key={n.id as string} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                <span className="flex-1 truncate font-data">{n.label || 'Entry'}</span>
                <span className="text-primary font-data">{spawnByNode.get(n.id as string) ?? 0} in</span>
              </div>
            ))}
            {graph.nodes.filter((n) => n.type === 'exit').map((n) => (
              <div key={n.id as string} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
                <span className="flex-1 truncate font-data">{n.label || 'Exit'}</span>
                <span className="text-[var(--status-danger)] font-data">{exitByNode.get(n.id as string) ?? 0} out</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── TAB STRIP ─── */}
      <div className="flex gap-0.5 p-0.5 rounded-lg bg-secondary/50 border border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-md transition-colors ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
              title={t.label}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── TAB CONTENT ─── */}
      {tab === 'flow' && (
        <div className="space-y-3">
          <HeatRanking />
          <NodeTraffic />
          <TrendChart />
          <ZoneDetail />
          <ZoneDonutChart />
          <ZoneGraphViz />
        </div>
      )}

      {tab === 'behavior' && (
        <div className="space-y-3">
          <ProfileLegend />
          <ActionAreaChart />
          <FollowedAgentCard />
        </div>
      )}

      {tab === 'experience' && (
        <div className="space-y-3">
          <EngagementHistogram />
          <ExperienceQuality />
          <ZoneMediaPerformance />
          <FlowVsExperience />
        </div>
      )}

      {tab === 'action' && (
        <div className="space-y-3">
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

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'primary' | 'danger' | 'warning';
}) {
  const color =
    accent === 'danger'
      ? 'text-[var(--status-danger)]'
      : accent === 'warning'
        ? 'text-[var(--status-warning)]'
        : 'text-primary';
  return (
    <div className="bento-box-elevated p-2 text-center">
      <div className={`text-sm font-semibold font-data ${color}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase mt-0.5 truncate">
        {label}
      </div>
    </div>
  );
}

