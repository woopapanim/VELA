import { useStore } from '@/stores';

// Floating KPI strip — top center, glass card. 캔버스 위에 떠 있어 영구 패널 점유 X.
// Active / Spawned / Exited / Fatigue 4종을 한 줄로. 시간/진행률은 top bar 가 담당.
export function KpiStrip() {
  const visitors = useStore((s) => s.visitors);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const totalExited = useStore((s) => s.totalExited);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const phase = useStore((s) => s.phase);

  if (phase === 'idle') return null;

  const active = visitors.filter((v) => v.isActive).length;
  const fatigue = latestSnapshot?.fatigueDistribution.mean ?? 0;
  const fatiguePct = Math.round(fatigue * 100);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="flex items-stretch gap-0 rounded-xl bg-[var(--surface)]/85 backdrop-blur-md border border-border shadow-lg overflow-hidden pointer-events-auto">
        <Tile label="Active" value={active.toString()} accent="text-primary" />
        <Divider />
        <Tile label="Spawned" value={totalSpawned.toString()} />
        <Divider />
        <Tile label="Exited" value={totalExited.toString()} />
        <Divider />
        <Tile label="Fatigue" value={`${fatiguePct}%`} accent={fatiguePct > 60 ? 'text-[var(--status-warning)]' : ''} />
      </div>
    </div>
  );
}

function Tile({ label, value, accent = '' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="px-4 py-2 flex flex-col items-center justify-center min-w-[64px]">
      <span className={`text-base font-data font-semibold ${accent}`}>{value}</span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px bg-border/60 my-2" />;
}
