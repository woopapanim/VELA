import { useStore } from '@/stores';

// 단일 게이지 카드 — Throughput (명/min). 트렌드 차트가 아닌 작은 게이지.
// 시뮬 중 봐야 할 가장 의미 있는 단일 지표 1개를 시각적으로 살림.
export function ThroughputGauge() {
  const phase = useStore((s) => s.phase);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const elapsed = useStore((s) => s.timeState.elapsed);

  if (phase === 'idle') return null;

  const minutes = elapsed / 60000;
  const thru = minutes > 0 ? totalSpawned / minutes : 0;
  const expected = useStore.getState().scenario?.visitorDistribution.totalCount ?? 100;
  const expectedThru = useStore.getState().scenario
    ? expected / (useStore.getState().scenario!.simulationConfig.duration / 60000)
    : 1;
  const ratio = expectedThru > 0 ? Math.min(2, thru / expectedThru) : 0;

  const offColor =
    ratio < 0.6 ? 'text-[var(--status-warning)]' : ratio > 1.4 ? 'text-[var(--status-warning)]' : 'text-primary';

  return (
    <div className="absolute top-3 right-[15.5rem] z-10 pointer-events-none">
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[var(--surface)]/85 backdrop-blur-md border border-border shadow-lg pointer-events-auto">
        <Sparkbar value={ratio} />
        <div className="flex flex-col leading-tight">
          <span className={`text-sm font-data font-semibold ${offColor}`}>
            {thru.toFixed(1)}
            <span className="text-[9px] text-muted-foreground ml-0.5">/min</span>
          </span>
          <span className="text-[9px] text-muted-foreground">
            기대 {expectedThru.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

// 단순 mini gauge — horizontal bar with target marker at 1.0 ratio.
function Sparkbar({ value }: { value: number }) {
  const pct = Math.min(1, value / 2) * 100;
  return (
    <div className="relative w-12 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
      <div
        className="absolute top-0 left-0 h-full bg-primary"
        style={{ width: `${pct}%` }}
      />
      {/* target marker at 50% (= 1.0x expected) */}
      <div className="absolute top-0 left-1/2 w-px h-full bg-foreground/40" />
    </div>
  );
}
