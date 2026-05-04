import { useCallback, useEffect } from 'react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { TimeSlotEditor } from './TimeSlotEditor';
import { VisitorPresets } from './VisitorPresets';
import { EntryPolicySection } from './EntryPolicySection';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { NumField } from '@/ui/components/ConfigFields';
import { computeAutoRecommendedDurationMs, computeAutoTotalVisitors } from '@/domain/constants';

export function SpawnConfig() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const phase = useStore((s) => s.phase);
  const t = useT();

  const isLocked = phase !== 'idle';
  const dist = scenario?.visitorDistribution;
  const config = scenario?.simulationConfig;
  // Default to auto for legacy scenarios (undefined → true). Only explicit `false` opts out.
  const recAuto = config?.recommendedDurationAuto !== false;
  const autoRecMs = computeAutoRecommendedDurationMs(zones.length, media.length);
  // Total visitors auto: opt-in (default false for legacy compat).
  const totalAuto = dist?.totalCountAuto === true;
  const totalAreaM2 = zones.reduce((sum, z) => sum + (z.area ?? 0), 0);
  const recMs = config?.recommendedDurationMs ?? autoRecMs;
  const durMs = config?.duration ?? 0;
  const autoTotalCount = computeAutoTotalVisitors(totalAreaM2, durMs, recMs);

  // When auto is on, keep stored recommendedDurationMs in sync with scenario scale.
  // Guarded by isLocked so a running sim isn't retroactively mutated.
  useEffect(() => {
    if (!scenario || isLocked) return;
    if (!recAuto) return;
    if (config?.recommendedDurationMs === autoRecMs) return;
    setScenario({
      ...scenario,
      simulationConfig: { ...scenario.simulationConfig, recommendedDurationMs: autoRecMs },
    });
  }, [scenario, isLocked, recAuto, autoRecMs, config?.recommendedDurationMs, setScenario]);

  // When totalCountAuto is on, keep totalCount in sync with area × turnover.
  useEffect(() => {
    if (!scenario || isLocked) return;
    if (!totalAuto) return;
    if (dist?.totalCount === autoTotalCount) return;
    setScenario({
      ...scenario,
      visitorDistribution: { ...scenario.visitorDistribution, totalCount: autoTotalCount },
    });
  }, [scenario, isLocked, totalAuto, autoTotalCount, dist?.totalCount, setScenario]);

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
  const mode = config?.simulationMode ?? 'time';

  const setMode = (next: 'time' | 'person') => {
    if (!scenario || isLocked || next === mode) return;
    // Person 모드: Duration 이 safety cap. 너무 짧으면 조기 cap → 지표 왜곡되므로 ≥3h 보장.
    // Time 모드 복귀 시: cap 용도로 부풀려진 값을 60min default 로 되돌림. 사용자가
    // 직접 늘린 값(<180min)은 보존 — 180min 이상이면 자동 부풀림으로 간주해 reset.
    const MIN_PERSON_DUR_MS = 180 * 60_000;
    const TIME_DEFAULT_DUR_MS = 60 * 60_000;
    const currentDur = scenario.simulationConfig.duration;
    const nextDur = next === 'person'
      ? (currentDur < MIN_PERSON_DUR_MS ? MIN_PERSON_DUR_MS : currentDur)
      : (currentDur >= MIN_PERSON_DUR_MS ? TIME_DEFAULT_DUR_MS : currentDur);
    setScenario({
      ...scenario,
      simulationConfig: { ...scenario.simulationConfig, simulationMode: next, duration: nextDur },
    });
  };
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
      <EntryPolicySection />

      <CollapsibleSection id="spawn-presets" title="Presets">
        <VisitorPresets />
      </CollapsibleSection>

      <CollapsibleSection id="spawn-settings" title="Spawn Settings" defaultOpen>
        <div className="mb-2">
          <div className="text-[9px] text-muted-foreground mb-1">{t('spawn.mode.label')}</div>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setMode('time')}
              disabled={isLocked}
              title={t('spawn.mode.timeHint')}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-50 ${
                mode === 'time'
                  ? 'bg-primary/15 border-primary/60 text-foreground'
                  : 'bg-secondary/60 border-transparent hover:bg-accent hover:border-border'
              }`}
            >
              {t('spawn.mode.time')}
            </button>
            <button
              onClick={() => setMode('person')}
              disabled={isLocked}
              title={t('spawn.mode.personHint')}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-colors disabled:opacity-50 ${
                mode === 'person'
                  ? 'bg-primary/15 border-primary/60 text-foreground'
                  : 'bg-secondary/60 border-transparent hover:bg-accent hover:border-border'
              }`}
            >
              {t('spawn.mode.person')}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <NumField
              label="Total Visitors"
              value={dist?.totalCount ?? 200}
              onChange={(v) => updateDist('totalCount', v)}
              disabled={isLocked || totalAuto}
            />
            <button
              onClick={() => {
                if (!scenario || isLocked) return;
                const nextAuto = !totalAuto;
                setScenario({
                  ...scenario,
                  visitorDistribution: {
                    ...scenario.visitorDistribution,
                    totalCountAuto: nextAuto,
                    totalCount: nextAuto ? autoTotalCount : scenario.visitorDistribution.totalCount,
                  },
                });
              }}
              disabled={isLocked}
              title={`Auto = floor area / 4 m²·인 × (duration / rec stay). area=${Math.round(totalAreaM2)}m², 회전=${(durMs / Math.max(recMs, 1)).toFixed(1)}×`}
              className="text-[8px] text-primary mt-0.5 hover:underline disabled:opacity-50"
            >
              {totalAuto ? 'Switch to manual' : 'Switch to auto'}
            </button>
          </div>
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
          <div>
            <NumField
              label={t('spawn.recStay.label')}
              value={recommendedMin}
              onChange={(v) => updateConfig('recommendedDurationMs', Math.max(5, v) * 60000)}
              disabled={isLocked || recAuto}
              step={5}
            />
            <button
              onClick={() => {
                if (!scenario || isLocked) return;
                const nextAuto = !recAuto;
                setScenario({
                  ...scenario,
                  simulationConfig: {
                    ...scenario.simulationConfig,
                    recommendedDurationAuto: nextAuto,
                    recommendedDurationMs: nextAuto ? autoRecMs : scenario.simulationConfig.recommendedDurationMs,
                  },
                });
              }}
              disabled={isLocked}
              title={t('spawn.recStay.hint', { zones: zones.length, media: media.length })}
              className="text-[8px] text-primary mt-0.5 hover:underline disabled:opacity-50"
            >
              {recAuto ? t('spawn.recStay.switchManual') : t('spawn.recStay.switchAuto')}
            </button>
          </div>
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
