import { useStore } from '@/stores';

export function StatsFooter() {
  const phase = useStore((s) => s.phase);
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const scenario = useStore((s) => s.scenario);

  if (phase === 'idle') return null;

  const active = visitors.filter((v) => v.isActive).length;
  const watching = visitors.filter((v) => v.isActive && v.currentAction === 'WATCHING').length;
  const waiting = visitors.filter((v) => v.isActive && v.currentAction === 'WAITING').length;
  const fatigue = latestSnapshot ? Math.round(latestSnapshot.fatigueDistribution.mean * 100) : 0;
  const peakUtil = latestSnapshot ? Math.round(Math.max(...latestSnapshot.zoneUtilizations.map((u) => u.ratio)) * 100) : 0;
  const bottlenecks = latestSnapshot ? latestSnapshot.bottlenecks.filter((b) => b.score > 0.5).length : 0;

  return (
    <div className="flex items-center gap-4 px-4 py-1 border-t border-border bg-[var(--surface)] text-[9px] font-data text-muted-foreground">
      <span>{scenario?.meta.name}</span>
      <span className="text-primary">{active} active</span>
      <span className="text-[var(--status-success)]">{watching} watching</span>
      {waiting > 0 && <span className="text-[var(--status-warning)]">{waiting} waiting</span>}
      <span>fatigue {fatigue}%</span>
      <span className={peakUtil > 90 ? 'text-[var(--status-danger)]' : ''}>peak {peakUtil}%</span>
      {bottlenecks > 0 && <span className="text-[var(--status-danger)]">{bottlenecks} bottleneck{bottlenecks > 1 ? 's' : ''}</span>}
      <span className="ml-auto">{zones.length} zones · {media.length} media</span>
    </div>
  );
}
