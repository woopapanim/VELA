import { useStore } from '@/stores';

export function TimelineBar() {
  const timeState = useStore((s) => s.timeState);
  const phase = useStore((s) => s.phase);
  const scenario = useStore((s) => s.scenario);
  const visitors = useStore((s) => s.visitors);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const totalExited = useStore((s) => s.totalExited);

  if (phase === 'idle' || !scenario) return null;

  const duration = scenario.simulationConfig.duration;
  const elapsed = timeState.elapsed;
  const totalCount = scenario.visitorDistribution.totalCount ?? 0;
  // 'person' mode: 종료 기준은 관람객 수. duration 은 safety cap 일 뿐.
  // 'time' mode (default/legacy): 종료 기준은 경과 시간.
  const simMode = scenario.simulationConfig.simulationMode ?? 'time';
  const isPersonMode = simMode === 'person';

  const activeCount = visitors.filter((v) => v.isActive).length;
  const watchingCount = visitors.filter((v) => v.isActive && v.currentAction === 'WATCHING').length;

  // Progress 기준은 모드별로 다름.
  // person: 관람객 누적(스폰 + 이탈) 기준. 모두 들어와서 모두 나가면 100%.
  // time: 경과 시간 / 총 운영시간.
  const progress = isPersonMode
    ? (totalCount > 0 ? Math.min(1, (totalSpawned + totalExited) / (totalCount * 2)) : 0)
    : (duration > 0 ? Math.min(1, elapsed / duration) : 0);

  // Elapsed 시간 표기는 항상 보여줌 (참고용).
  const elapsedMin = Math.floor(elapsed / 60000);
  const elapsedSec = Math.floor((elapsed % 60000) / 1000);
  const elapsedLabel = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSec).padStart(2, '0')}`;

  // Total 표기.
  const totalHr = Math.floor(duration / 3_600_000);
  const totalMinRem = Math.floor((duration % 3_600_000) / 60000);
  const totalLabel = totalHr > 0
    ? `${totalHr}h ${String(totalMinRem).padStart(2, '0')}m`
    : `${totalMinRem}m`;

  // Time slot markers (time mode 에서만 의미 있음).
  const slots = isPersonMode ? [] : scenario.simulationConfig.timeSlots;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 glass border-t border-white/10">
      <div className="px-4 py-2">
        {/* Progress bar */}
        <div className="relative h-2 bg-secondary/50 rounded-full overflow-hidden mb-1.5">
          {/* Time slot regions */}
          {slots.map((slot, i) => {
            const start = slot.startTimeMs / duration;
            const end = slot.endTimeMs / duration;
            return (
              <div
                key={i}
                className="absolute top-0 h-full opacity-20"
                style={{
                  left: `${start * 100}%`,
                  width: `${(end - start) * 100}%`,
                  backgroundColor: i % 2 === 0 ? '#3b82f6' : '#8b5cf6',
                }}
              />
            );
          })}

          {/* Progress fill */}
          <div
            className="absolute top-0 h-full bg-primary rounded-full transition-all duration-200"
            style={{ width: `${progress * 100}%` }}
          />

          {/* Playhead */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background shadow-md"
            style={{ left: `${progress * 100}%`, marginLeft: '-6px' }}
          />
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between text-[9px] font-data">
          <div className="flex items-center gap-3">
            {isPersonMode ? (
              <>
                <span className="text-foreground">
                  {totalSpawned} / {totalCount}
                  <span className="text-muted-foreground"> spawned</span>
                </span>
                <span className="text-foreground">
                  {totalExited} / {totalCount}
                  <span className="text-muted-foreground"> exited</span>
                </span>
              </>
            ) : (
              <span className="text-foreground">
                {elapsedLabel}
                <span className="text-muted-foreground"> / {totalLabel}</span>
              </span>
            )}
            <span className="text-primary">{activeCount} active</span>
            {watchingCount > 0 && (
              <span className="text-[var(--status-success)]">{watchingCount} watching</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isPersonMode && (
              <span className="text-muted-foreground" title="elapsed sim time">
                {elapsedLabel}
              </span>
            )}
            <span className="text-muted-foreground">
              Tick {timeState.tickCount}
            </span>
            <span className="text-muted-foreground">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
