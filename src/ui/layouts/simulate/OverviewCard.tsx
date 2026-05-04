import { useStore } from '@/stores';

// 우측 column 최상단. 가장 자주 보는 핵심 수치 + 진행률 바.
// 접근성: 모든 수치에 aria-label, label 폰트 9→11px 상향.
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

  const progress = simMode === 'person'
    ? (totalCount > 0 ? Math.min(1, totalSpawned / totalCount) : 0)
    : (duration > 0 ? Math.min(1, elapsed / duration) : 0);

  const progressLabel = simMode === 'person'
    ? `${totalSpawned} / ${totalCount}`
    : `${formatTime(elapsed)} / ${formatTime(duration)}`;

  return (
    <section
      className="rounded-xl bg-[var(--surface)] border border-border p-3"
      aria-labelledby="overview-heading"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h3
          id="overview-heading"
          className="text-[11px] uppercase tracking-wider font-semibold text-foreground/80"
        >
          Overview
        </h3>
        <span className="text-[10px] text-muted-foreground font-data uppercase">
          <span className="sr-only">Phase: </span>
          {phase}
        </span>
      </div>

      {/* 큰 숫자 — 현재 active */}
      <div className="flex items-baseline gap-1.5 mb-3" aria-label={`${active} active visitors`}>
        <span className="text-3xl font-data font-semibold tabular-nums text-foreground" aria-hidden="true">{active}</span>
        <span className="text-[11px] text-muted-foreground" aria-hidden="true">active</span>
      </div>

      {/* 진행률 바 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-foreground/70 font-data mb-1">
          <span>{progressLabel}</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div
          className="h-1.5 rounded-full bg-secondary/60 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress ${Math.round(progress * 100)}%`}
        >
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* 보조 수치 3개 */}
      <div className="grid grid-cols-3 gap-1.5">
        <Mini label="Spawned" value={totalSpawned.toString()} srLabel={`Total spawned ${totalSpawned}`} />
        <Mini label="Exited" value={totalExited.toString()} srLabel={`Total exited ${totalExited}`} />
        <Mini
          label="/min"
          value={throughput < 10 ? throughput.toFixed(1) : Math.round(throughput).toString()}
          srLabel={`Throughput ${throughput.toFixed(1)} per minute`}
        />
      </div>

      {totalSpawned > 0 && (
        <div className="mt-2 text-[10px] text-foreground/70 font-data" aria-label={`Exit ratio ${Math.round(exitRatio * 100)}%`}>
          Exit ratio <span className="text-foreground font-semibold">{Math.round(exitRatio * 100)}%</span>
        </div>
      )}
    </section>
  );
}

function Mini({ label, value, srLabel }: { label: string; value: string; srLabel: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-1.5" aria-label={srLabel}>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5" aria-hidden="true">{label}</div>
      <div className="text-sm font-data font-semibold tabular-nums leading-none text-foreground" aria-hidden="true">{value}</div>
    </div>
  );
}

function formatTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
