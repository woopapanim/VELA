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
  const slotsCount = config?.timeSlots?.length ?? 0;

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
            value={config?.maxVisitors ?? 500}
            onChange={(v) => updateConfig('maxVisitors', v)}
            disabled={isLocked}
          />
          <NumField
            label="Spawn Rate /min"
            value={(dist?.spawnRatePerSecond ?? 2) * 60}
            onChange={(v) => updateDist('spawnRatePerSecond', v / 60)}
            disabled={isLocked}
            step={10}
          />
          <NumField
            label="Duration (min)"
            value={durationMin}
            onChange={(v) => updateConfig('duration', v * 60000)}
            disabled={isLocked}
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
