import { useStore } from '@/stores';

export function SpeedIndicator() {
  const phase = useStore((s) => s.phase);
  const scenario = useStore((s) => s.scenario);

  if (phase === 'idle' || !scenario) return null;

  const speed = scenario.simulationConfig.timeScale;
  const isfast = speed > 3;

  return (
    <div className="absolute top-3 left-3 z-10">
      <div className={`px-2 py-1 rounded-lg text-[10px] font-data glass ${
        isfast ? 'text-[var(--status-warning)]' : 'text-muted-foreground'
      }`}>
        {speed}x{speed > 1 ? ' ⚡' : ''}
        {phase === 'paused' && ' ⏸'}
      </div>
    </div>
  );
}
