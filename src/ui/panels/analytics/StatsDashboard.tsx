import { useMemo } from 'react';
import { useStore } from '@/stores';
import { Sparkline } from '@/ui/components/Sparkline';

export function StatsDashboard() {
  const kpiHistory = useStore((s) => s.kpiHistory);
  const visitors = useStore((s) => s.visitors);
  const latestSnapshot = useStore((s) => s.latestSnapshot);

  const stats = useMemo(() => {
    if (!latestSnapshot || kpiHistory.length < 2) return null;

    const active = visitors.filter((v) => v.isActive);
    const watching = active.filter((v) => v.currentAction === 'WATCHING').length;
    const moving = active.filter((v) => v.currentAction === 'MOVING').length;

    // Peak utilization over time
    const peakHistory = kpiHistory.slice(-30).map((e) =>
      Math.max(...e.snapshot.zoneUtilizations.map((u) => u.ratio), 0) * 100,
    );

    // Fatigue over time
    const fatigueHistory = kpiHistory.slice(-30).map((e) =>
      e.snapshot.fatigueDistribution.mean * 100,
    );

    // Visitor count over time
    const visitorHistory = kpiHistory.slice(-30).map((e) =>
      e.snapshot.zoneUtilizations.reduce((s, u) => s + u.currentOccupancy, 0),
    );

    // Watching ratio over time
    const watchingHistory = kpiHistory.slice(-30).map(() =>
      active.length > 0 ? (watching / active.length) * 100 : 0,
    );

    return {
      active: active.length,
      watching,
      moving,
      avgFatigue: latestSnapshot.fatigueDistribution.mean,
      peakUtil: Math.max(...latestSnapshot.zoneUtilizations.map((u) => u.ratio), 0),
      bottlenecks: latestSnapshot.bottlenecks.filter((b) => b.score > 0.5).length,
      peakHistory,
      fatigueHistory,
      visitorHistory,
      watchingHistory,
    };
  }, [latestSnapshot, kpiHistory, visitors]);

  if (!stats) return null;

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Live Dashboard
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <DashItem
          label="Active"
          value={stats.active}
          sparkData={stats.visitorHistory}
          color="#3b82f6"
        />
        <DashItem
          label="Watching"
          value={stats.watching}
          sparkData={stats.watchingHistory}
          color="#22c55e"
        />
        <DashItem
          label="Peak Util"
          value={`${Math.round(stats.peakUtil * 100)}%`}
          sparkData={stats.peakHistory}
          color={stats.peakUtil > 0.9 ? '#ef4444' : '#f59e0b'}
        />
        <DashItem
          label="Fatigue"
          value={`${Math.round(stats.avgFatigue * 100)}%`}
          sparkData={stats.fatigueHistory}
          color={stats.avgFatigue > 0.7 ? '#ef4444' : '#fbbf24'}
        />
      </div>
    </div>
  );
}

function DashItem({ label, value, sparkData, color }: {
  label: string;
  value: string | number;
  sparkData: number[];
  color: string;
}) {
  return (
    <div className="bento-box-elevated p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-muted-foreground uppercase">{label}</span>
        <span className="text-xs font-semibold font-data" style={{ color }}>{value}</span>
      </div>
      <Sparkline data={sparkData} width={70} height={14} color={color} />
    </div>
  );
}
