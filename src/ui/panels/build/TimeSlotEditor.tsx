import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/stores';
import type { TimeSlotConfig } from '@/domain';

export function TimeSlotEditor() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);

  if (!scenario) return null;

  const isLocked = phase !== 'idle';
  const slots = scenario.simulationConfig.timeSlots;
  const duration = scenario.simulationConfig.duration;

  const updateSlot = useCallback((index: number, updates: Partial<TimeSlotConfig>) => {
    if (!scenario || isLocked) return;
    const newSlots = slots.map((s, i) => (i === index ? { ...s, ...updates } : s));
    setScenario({
      ...scenario,
      simulationConfig: { ...scenario.simulationConfig, timeSlots: newSlots },
    });
  }, [scenario, setScenario, slots, isLocked]);

  const addSlot = useCallback(() => {
    if (!scenario || isLocked) return;
    const lastEnd = slots.length > 0 ? slots[slots.length - 1].endTimeMs : 0;
    const newSlot: TimeSlotConfig = {
      startTimeMs: lastEnd,
      endTimeMs: Math.min(lastEnd + 900_000, duration),
      spawnRatePerSecond: 2,
      profileDistribution: { general: 60, vip: 15, child: 10, elderly: 10, disabled: 5 },
      engagementDistribution: { quick: 30, explorer: 40, immersive: 30 },
      groupRatio: 0.3,
    };
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        timeSlots: [...slots, newSlot],
      },
    });
  }, [scenario, setScenario, slots, duration, isLocked]);

  const removeSlot = useCallback((index: number) => {
    if (!scenario || isLocked) return;
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        timeSlots: slots.filter((_, i) => i !== index),
      },
    });
  }, [scenario, setScenario, slots, isLocked]);

  return (
    <div className="space-y-2">
      {!isLocked && (
        <button
          onClick={addSlot}
          className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-3 h-3" /> Add slot
        </button>
      )}

      {/* Slot details */}
      {slots.map((slot, i) => {
        const startMin = Math.floor(slot.startTimeMs / 60000);
        const endMin = Math.floor(slot.endTimeMs / 60000);
        return (
          <div key={i} className="bento-box-elevated p-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-data text-muted-foreground">
                Slot {i + 1}: {startMin}m — {endMin}m
              </span>
              {!isLocked && slots.length > 1 && (
                <button onClick={() => removeSlot(i)} className="p-0.5 rounded hover:bg-[var(--status-danger)]/20">
                  <Trash2 className="w-2.5 h-2.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div>
                <label className="text-[7px] text-muted-foreground">Start (m)</label>
                <input type="number" value={startMin}
                  onChange={(e) => updateSlot(i, { startTimeMs: (parseInt(e.target.value) || 0) * 60000 })}
                  disabled={isLocked}
                  className="w-full px-1 py-0.5 text-[11px] rounded bg-secondary border border-border disabled:opacity-50" />
              </div>
              <div>
                <label className="text-[7px] text-muted-foreground">End (m)</label>
                <input type="number" value={endMin}
                  onChange={(e) => updateSlot(i, { endTimeMs: (parseInt(e.target.value) || 0) * 60000 })}
                  disabled={isLocked}
                  className="w-full px-1 py-0.5 text-[11px] rounded bg-secondary border border-border disabled:opacity-50" />
              </div>
              <div>
                <label className="text-[7px] text-muted-foreground">Rate /s</label>
                <input type="number" step="0.5" value={slot.spawnRatePerSecond}
                  onChange={(e) => updateSlot(i, { spawnRatePerSecond: parseFloat(e.target.value) || 0 })}
                  disabled={isLocked}
                  className="w-full px-1 py-0.5 text-[11px] rounded bg-secondary border border-border disabled:opacity-50" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
