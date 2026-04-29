import { useStore } from '@/stores';

// 우측 column 최상단. 가장 자주 보는 3-4개 핵심 수치 + 진행률 바.
// 레퍼런스의 "Dining hall 148/3000" 패턴 — total/budget + 보조 수치.
export function OverviewCard() {
  const phase = useStore((s) => s.phase);
  const visitors = useStore((s) => s.visitors);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const totalExited = useStore((s) => s.totalExited);
  const elapsed = useStore((s) => s.timeState.elapsed);
  const duration = useStore((s) => s.scenario?.simulationConfig.duration ?? 0);
  const totalCount = useStore((s) => s.scenario?.visitorDistribution.totalCount ?? 0);
  const simMode = useStore((s) => s.scenario?.simulationConfig.simulationMode ?? 'time');
  const latest = useStore((s) => s.latestSnapshot);

  const active = visitors.filter((v) => v.isActive).length;
  const throughput = latest?.flowEfficiency.throughputPerMinute ?? 0;
  const exitRatio = totalSpawned > 0 ? totalExited / totalSpawned : 0;

  // person 모드: 진행률 = totalSpawned / totalCount. time 모드: elapsed / duration.
  const progress = simMode === 'person'
    ? (totalCount > 0 ? Math.min(1, totalSpawned / totalCount) : 0)
    : (duration > 0 ? Math.min(1, elapsed / duration) : 0);

  const progressLabel = simMode === 'person'
    ? `${totalSpawned} / ${totalCount}`
    : `${formatTime(elapsed)} / ${formatTime(duration)}`;

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-border p-3">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Overview
        </h3>
        <span className="text-[9px] text-muted-foreground font-data uppercase">{phase}</span>
      </div>

      {/* 큰 숫자 — 현재 active */}
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-2xl font-data font-semibold tabular-nums">{active}</span>
        <span className="text-[10px] text-muted-foreground">active</span>
      </div>

      {/* 진행률 바 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground font-data mb-1">
          <span>{progressLabel}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-1 rounded-full bg-secondary/60 overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* 보조 수치 3개 — 입출/throughput/완료율 */}
      <div className="grid grid-cols-3 gap-1.5">
        <Mini label="Spawned" value={totalSpawned.toString()} />
        <Mini label="Exited" value={totalExited.toString()} />
        <Mini
          label="/min"
          value={throughput < 10 ? throughput.toFixed(1) : Math.round(throughput).toString()}
        />
      </div>

      {totalSpawned > 0 && (
        <div className="mt-2 text-[9px] text-muted-foreground font-data">
          Exit ratio {Math.round(exitRatio * 100)}%
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-1.5 py-1">
      <div className="text-[8px] text-muted-foreground/80 uppercase tracking-wider leading-none mb-0.5">{label}</div>
      <div className="text-xs font-data font-semibold tabular-nums leading-none">{value}</div>
    </div>
  );
}

function formatTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
