import { useStore } from '@/stores';

export function StatsFooter() {
  const phase = useStore((s) => s.phase);
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const scenario = useStore((s) => s.scenario);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const totalExited = useStore((s) => s.totalExited);

  if (phase === 'idle') return null;
  const active = visitors.filter((v) => v.isActive).length;
  const watching = visitors.filter((v) => v.isActive && v.currentAction === 'WATCHING').length;
  const waiting = visitors.filter((v) => v.isActive && v.currentAction === 'WAITING').length;
  // fatigueDistribution.mean / zoneUtilizations[].ratio 둘 다 active visitor 기반.
  // sim 종료 후엔 0 으로 떨어지므로 historical/all-visitor 값을 footer 에 노출.
  const fatigue = visitors.length > 0
    ? Math.round((visitors.reduce((s, v) => s + (v.fatigue ?? 0), 0) / visitors.length) * 100)
    : 0;
  const peakUtil = latestSnapshot
    ? Math.round(
        Math.max(
          0,
          ...latestSnapshot.zoneUtilizations.map((u) => (u.capacity > 0 ? u.peakOccupancy / u.capacity : 0)),
        ) * 100,
      )
    : 0;
  const bottlenecks = latestSnapshot ? latestSnapshot.bottlenecks.filter((b) => b.score > 0.5).length : 0;

  return (
    <div className="flex items-center gap-4 px-4 py-1 border-t border-border bg-[var(--surface)] text-[9px] font-data text-muted-foreground">
      <span>{scenario?.meta.name}</span>
      <span className="text-primary">{active} active</span>
      <span className="text-[var(--status-success)]">{watching} watching</span>
      {waiting > 0 && <span className="text-[var(--status-warning)]">{waiting} waiting</span>}
      <span className="text-[var(--status-danger)]">{totalExited} exited</span>
      <span>{totalSpawned} spawned</span>
      <span>fatigue {fatigue}%</span>
      <span className={peakUtil > 90 ? 'text-[var(--status-danger)]' : ''}>peak {peakUtil}%</span>
      {bottlenecks > 0 && <span className="text-[var(--status-danger)]">{bottlenecks} bottleneck{bottlenecks > 1 ? 's' : ''}</span>}
      <span className="ml-auto">{zones.length} zones · {media.length} media</span>
    </div>
  );
}
