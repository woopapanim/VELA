import { useCallback } from 'react';
import { useStore } from '@/stores';
import { TimeSlotEditor } from './TimeSlotEditor';
import { VisitorPresets } from './VisitorPresets';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { NumField } from '@/ui/components/ConfigFields';

export function SpawnConfig() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);

  const isLocked = phase !== 'idle';
  const dist = scenario?.visitorDistribution;
  const config = scenario?.simulationConfig;

  const updateDist = useCallback((field: string, value: number) => {
    if (!scenario || isLocked) return;
    setScenario({
      ...scenario,
      visitorDistribution: { ...scenario.visitorDistribution, [field]: value },
    });
  }, [scenario, setScenario, isLocked]);

  const updateConfig = useCallback((field: string, value: number) => {
    if (!scenario || isLocked) return;
    setScenario({
      ...scenario,
      simulationConfig: { ...scenario.simulationConfig, [field]: value },
    });
  }, [scenario, setScenario, isLocked]);

  if (!scenario) return null;

  const durationMin = Math.floor((config?.duration ?? 0) / 60000);
  const recommendedMin = Math.floor((config?.recommendedDurationMs ?? 60 * 60_000) / 60000);
  const slotsCount = config?.timeSlots?.length ?? 0;
  const isMultiSlot = slotsCount > 1;
  // Rate source of truth is timeSlots[0]; dist.spawnRatePerSecond is a legacy mirror.
  const rateRps = config?.timeSlots?.[0]?.spawnRatePerSecond ?? dist?.spawnRatePerSecond ?? 2;

  const updateSpawnRatePerMin = (vPerMin: number) => {
    if (!scenario || isLocked || isMultiSlot) return;
    const rps = vPerMin / 60;
    setScenario({
      ...scenario,
      visitorDistribution: { ...scenario.visitorDistribution, spawnRatePerSecond: rps },
      simulationConfig: {
        ...scenario.simulationConfig,
        timeSlots: scenario.simulationConfig.timeSlots.map((s, i) =>
          i === 0 ? { ...s, spawnRatePerSecond: rps } : s
        ),
      },
    });
  };

  return (
    <div>
      <CollapsibleSection id="spawn-presets" title="Presets">
        <VisitorPresets />
      </CollapsibleSection>

      <CollapsibleSection id="spawn-settings" title="Spawn Settings" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="Total Visitors"
            value={dist?.totalCount ?? 200}
            onChange={(v) => updateDist('totalCount', v)}
            disabled={isLocked}
          />
          <NumField
            label="Max Concurrent"
            // Clamp displayed value to Total — Max > Total is a dead setting
            // (cumulative cap fires first). Intermediate keystrokes on Total
            // would corrupt the stored Max, so we only clamp for display and
            // on-commit here, not by rewriting maxVisitors when Total changes.
            value={Math.min(config?.maxVisitors ?? 500, dist?.totalCount ?? 500)}
            onChange={(v) => updateConfig('maxVisitors', Math.min(v, dist?.totalCount ?? v))}
            disabled={isLocked}
          />
          <div>
            <NumField
              label={isMultiSlot ? 'Spawn Rate /min (multi-slot)' : 'Spawn Rate /min'}
              value={Math.round(rateRps * 60 * 10) / 10}
              onChange={updateSpawnRatePerMin}
              disabled={isLocked || isMultiSlot}
              step={1}
            />
            {isMultiSlot && (
              <p className="text-[8px] text-muted-foreground mt-0.5">Edit in Time Slots</p>
            )}
          </div>
          <NumField
            label="Duration (min)"
            value={durationMin}
            onChange={(v) => updateConfig('duration', v * 60000)}
            disabled={isLocked}
          />
          <NumField
            label="Rec. Stay (min)"
            value={recommendedMin}
            onChange={(v) => updateConfig('recommendedDurationMs', Math.max(5, v) * 60000)}
            disabled={isLocked}
            step={5}
          />
          <div>
            <NumField
              label="Seed"
              value={config?.seed ?? 42}
              onChange={(v) => updateConfig('seed', v)}
              disabled={isLocked}
            />
            {!isLocked && (
              <button
                onClick={() => updateConfig('seed', Math.floor(Math.random() * 99999))}
                className="text-[8px] text-primary mt-0.5 hover:underline"
              >
                🎲 Randomize
              </button>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="spawn-slots" title="Time Slots" count={slotsCount}>
        <TimeSlotEditor />
      </CollapsibleSection>
    </div>
  );
}
