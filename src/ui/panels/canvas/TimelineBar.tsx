import { useStore } from '@/stores';

export function TimelineBar() {
  const timeState = useStore((s) => s.timeState);
  const phase = useStore((s) => s.phase);
  const scenario = useStore((s) => s.scenario);
  const visitors = useStore((s) => s.visitors);

  if (phase === 'idle' || !scenario) return null;

  const duration = scenario.simulationConfig.duration;
  const elapsed = timeState.elapsed;
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;

  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  const totalMin = Math.floor(duration / 60000);

  const activeCount = visitors.filter((v) => v.isActive).length;
  const watchingCount = visitors.filter((v) => v.isActive && v.currentAction === 'WATCHING').length;

  // Time slot markers
  const slots = scenario.simulationConfig.timeSlots;

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
            <span className="text-foreground">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              <span className="text-muted-foreground"> / {totalMin}:00</span>
            </span>
            <span className="text-primary">{activeCount} active</span>
            {watchingCount > 0 && (
              <span className="text-[var(--status-success)]">{watchingCount} watching</span>
            )}
          </div>
          <div className="flex items-center gap-3">
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
