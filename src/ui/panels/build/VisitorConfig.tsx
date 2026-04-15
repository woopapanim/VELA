import { useCallback, useState, useRef } from 'react';
import { Users } from 'lucide-react';
import { useStore } from '@/stores';
import { TimeSlotEditor } from './TimeSlotEditor';
import { VisitorPresets } from './VisitorPresets';
import { DEFAULT_CATEGORY_WEIGHTS, CATEGORY_CONFIGS } from '@/domain';
import type { VisitorCategory } from '@/domain';

export function VisitorConfig() {
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

  return (
    <div className="space-y-3">
      {/* Presets */}
      <VisitorPresets />

      {/* Spawn Settings */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Users className="w-3 h-3" /> Visitor Settings
        </p>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Total Visitors" value={dist?.totalCount ?? 200}
            onChange={(v) => updateDist('totalCount', v)} disabled={isLocked} />
          <NumField label="Max Concurrent" value={config?.maxVisitors ?? 500}
            onChange={(v) => updateConfig('maxVisitors', v)} disabled={isLocked} />
          <NumField label="Spawn Rate /min" value={(dist?.spawnRatePerSecond ?? 2) * 60}
            onChange={(v) => updateDist('spawnRatePerSecond', v / 60)} disabled={isLocked} step={10} />
          <NumField label="Duration (min)" value={durationMin}
            onChange={(v) => updateConfig('duration', v * 60000)} disabled={isLocked} />
          <div>
            <NumField label="Seed" value={config?.seed ?? 42}
              onChange={(v) => updateConfig('seed', v)} disabled={isLocked} />
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
      </div>

      {/* Skip Threshold */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Skip Threshold</p>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Max Wait (s)" value={Math.round((config?.skipThreshold?.maxWaitTimeMs ?? 30000) / 1000)}
            onChange={(v) => {
              if (!scenario || isLocked) return;
              setScenario({
                ...scenario,
                simulationConfig: {
                  ...scenario.simulationConfig,
                  skipThreshold: { ...scenario.simulationConfig.skipThreshold, maxWaitTimeMs: v * 1000 },
                },
              });
            }} disabled={isLocked} step={5} />
          <NumField label="Skip Multiplier" value={config?.skipThreshold?.skipMultiplier ?? 1.0}
            onChange={(v) => {
              if (!scenario || isLocked) return;
              setScenario({
                ...scenario,
                simulationConfig: {
                  ...scenario.simulationConfig,
                  skipThreshold: { ...scenario.simulationConfig.skipThreshold, skipMultiplier: v },
                },
              });
            }} disabled={isLocked} step={0.1} />
        </div>
        <p className="text-[8px] text-muted-foreground mt-1">
          Skip if wait {'>'} patience × attractiveness × multiplier × maxWait
        </p>
      </div>

      {/* Profile Weights (sum = 100%) */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Profile Mix</p>
        <PercentMix
          keys={['general', 'vip', 'child', 'elderly', 'disabled']}
          values={dist?.profileWeights as Record<string, number> ?? {}}
          onChange={(newWeights) => {
            if (!scenario || isLocked) return;
            setScenario({
              ...scenario,
              visitorDistribution: { ...scenario.visitorDistribution, profileWeights: newWeights as any },
            });
          }}
          disabled={isLocked}
        />
      </div>

      {/* Engagement Mix (sum = 100%) */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Engagement Mix</p>
        <PercentMix
          keys={['quick', 'explorer', 'immersive']}
          values={dist?.engagementWeights as Record<string, number> ?? {}}
          onChange={(newWeights) => {
            if (!scenario || isLocked) return;
            setScenario({
              ...scenario,
              visitorDistribution: { ...scenario.visitorDistribution, engagementWeights: newWeights as any },
            });
          }}
          disabled={isLocked}
        />
      </div>

      {/* Category Mix */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Category Mix</p>
        <CategoryMix
          values={dist?.categoryWeights as Record<string, number> ?? DEFAULT_CATEGORY_WEIGHTS}
          onChange={(newWeights) => {
            if (!scenario || isLocked) return;
            setScenario({
              ...scenario,
              visitorDistribution: {
                ...scenario.visitorDistribution,
                categoryWeights: newWeights as Record<VisitorCategory, number>,
                // Sync legacy groupRatio from category weights
                groupRatio: ((newWeights['small_group'] ?? 0) + (newWeights['guided_tour'] ?? 0)) / 100,
              },
            });
          }}
          disabled={isLocked}
        />
      </div>

      {/* Time Slots */}
      <TimeSlotEditor />
    </div>
  );
}

function NumField({ label, value, onChange, disabled, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; disabled: boolean; step?: number;
}) {
  const [raw, setRaw] = useState(String(value));
  const prevValue = useRef(value);
  // Sync from parent when value changes externally
  if (value !== prevValue.current) { prevValue.current = value; if (parseFloat(raw) !== value) setRaw(String(value)); }

  return (
    <div>
      <label className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</label>
      <input type="number" value={raw} step={step}
        onChange={(e) => {
          setRaw(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        onBlur={() => {
          const n = parseFloat(raw);
          if (isNaN(n) || raw === '') { setRaw(String(value)); }
        }}
        disabled={disabled}
        className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50" />
    </div>
  );
}

// ── Category labels ──
const CATEGORY_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  solo: { label: '1인 (Solo)', color: '#60a5fa', desc: `${CATEGORY_CONFIGS.solo.baseSpeed / 20}m/s` },
  small_group: { label: '소그룹 (2-4인)', color: '#34d399', desc: `${CATEGORY_CONFIGS.small_group.baseSpeed / 20}m/s, ×${CATEGORY_CONFIGS.small_group.dwellTimeMultiplier}` },
  guided_tour: { label: '도슨트 (10-20인)', color: '#f472b6', desc: `${CATEGORY_CONFIGS.guided_tour.baseSpeed / 20}m/s, ×${CATEGORY_CONFIGS.guided_tour.dwellTimeMultiplier}` },
  vip_expert: { label: 'VIP/전문가', color: '#fbbf24', desc: `${CATEGORY_CONFIGS.vip_expert.baseSpeed / 20}m/s, ×${CATEGORY_CONFIGS.vip_expert.dwellTimeMultiplier}` },
};

function CategoryMix({ values, onChange, disabled }: {
  values: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
  disabled: boolean;
}) {
  const keys = ['solo', 'small_group', 'guided_tour', 'vip_expert'];
  const total = keys.reduce((s, k) => s + (values[k] ?? 0), 0);

  const handleChange = (changedKey: string, newVal: number) => {
    newVal = Math.max(0, Math.min(100, newVal));
    const otherKeys = keys.filter((k) => k !== changedKey);
    const otherTotal = otherKeys.reduce((s, k) => s + (values[k] ?? 0), 0);
    const result: Record<string, number> = { ...values, [changedKey]: newVal };

    if (otherTotal > 0) {
      const remaining = 100 - newVal;
      for (const k of otherKeys) {
        const ratio = (values[k] ?? 0) / otherTotal;
        result[k] = Math.max(0, Math.round(ratio * remaining));
      }
      const currentSum = keys.reduce((s, k) => s + (result[k] ?? 0), 0);
      if (currentSum !== 100) {
        const lastOther = otherKeys[otherKeys.length - 1];
        result[lastOther] = Math.max(0, (result[lastOther] ?? 0) + (100 - currentSum));
      }
    } else {
      const each = Math.floor((100 - newVal) / otherKeys.length);
      otherKeys.forEach((k, i) => {
        result[k] = i === otherKeys.length - 1 ? 100 - newVal - each * (otherKeys.length - 1) : each;
      });
    }
    onChange(result);
  };

  return (
    <div className="space-y-1.5">
      {keys.map((k) => {
        const val = values[k] ?? 0;
        const info = CATEGORY_LABELS[k];
        return (
          <div key={k}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: info?.color }} />
              <span className="flex-1 text-[9px] text-foreground">{info?.label ?? k}</span>
              <span className="text-[8px] text-muted-foreground">{info?.desc}</span>
              <span className="w-8 text-[9px] font-data text-right">{val}%</span>
            </div>
            <input type="range" min="0" max="100" value={val}
              onChange={(e) => handleChange(k, parseInt(e.target.value))}
              disabled={disabled}
              className="w-full h-1" />
          </div>
        );
      })}
      {total !== 100 && (
        <p className="text-[8px] text-[var(--status-warning)]">합계: {total}% (100% 필요)</p>
      )}
    </div>
  );
}

// ── Percentage Mix (sum always = 100%) ──
// When one slider moves up, others shrink proportionally to keep total at 100.
function PercentMix({ keys, values, onChange, disabled }: {
  keys: string[];
  values: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
  disabled: boolean;
}) {
  const total = keys.reduce((s, k) => s + (values[k] ?? 0), 0);

  const handleChange = (changedKey: string, newVal: number) => {
    newVal = Math.max(0, Math.min(100, newVal));
    const oldVal = values[changedKey] ?? 0;
    const delta = newVal - oldVal;
    const otherKeys = keys.filter((k) => k !== changedKey);
    const otherTotal = otherKeys.reduce((s, k) => s + (values[k] ?? 0), 0);

    const result: Record<string, number> = { ...values, [changedKey]: newVal };

    if (otherTotal > 0) {
      // Shrink/grow others proportionally
      let remaining = 100 - newVal;
      for (const k of otherKeys) {
        const ratio = (values[k] ?? 0) / otherTotal;
        result[k] = Math.max(0, Math.round(ratio * remaining));
      }
      // Fix rounding: adjust last key
      const currentSum = keys.reduce((s, k) => s + (result[k] ?? 0), 0);
      if (currentSum !== 100) {
        const lastOther = otherKeys[otherKeys.length - 1];
        result[lastOther] = Math.max(0, (result[lastOther] ?? 0) + (100 - currentSum));
      }
    } else {
      // All others are 0 → distribute remainder equally
      const each = Math.floor((100 - newVal) / otherKeys.length);
      otherKeys.forEach((k, i) => {
        result[k] = i === otherKeys.length - 1 ? 100 - newVal - each * (otherKeys.length - 1) : each;
      });
    }

    onChange(result);
  };

  return (
    <div className="space-y-1">
      {keys.map((k) => {
        const val = values[k] ?? 0;
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="w-14 text-[9px] text-muted-foreground capitalize">{k}</span>
            <input type="range" min="0" max="100" value={val}
              onChange={(e) => handleChange(k, parseInt(e.target.value))}
              disabled={disabled}
              className="flex-1 h-1" />
            <span className="w-8 text-[9px] font-data text-right">{val}%</span>
          </div>
        );
      })}
      {total !== 100 && (
        <p className="text-[8px] text-[var(--status-warning)]">합계: {total}% (100% 필요)</p>
      )}
    </div>
  );
}
