import { useCallback, useEffect } from 'react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { TimeSlotEditor } from './TimeSlotEditor';
import { VisitorPresets } from './VisitorPresets';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { NumField } from '@/ui/components/ConfigFields';
import { computeAutoRecommendedDurationMs } from '@/domain/constants';
import { EXPERIENCE_MODE_REGISTRY, inferExperienceMode } from '@/domain';

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
  // Phase 1 (2026-04-25): non-unlimited 정책은 큐 동작 보장을 위해 time-mode 강제.
  // person-mode 는 totalCount 도달 시 generation 정지 → 정책 sweep 의미 사라짐.
  // ExperienceModePanel 의 모드 선택 핸들러에서도 자동 flip 수행 (이중 안전).
  const policyMode = config?.operations?.entryPolicy?.mode ?? 'unlimited';
  const policyForcesTime = policyMode !== 'unlimited';
  // Phase 1 UX (2026-04-26): 운영 tier 는 시간 모드 강제 + 토글 숨김. 검증 tier 는 자유.
  // (policyForcesTime 은 person 버튼 disable 만 — UX 토글 자체 노출은 tier 로 결정)
  const expMode = scenario?.experienceMode
    ?? inferExperienceMode(scenario?.simulationConfig.operations?.entryPolicy?.mode);
  const showModeToggle = scenario
    ? EXPERIENCE_MODE_REGISTRY[expMode].tier === 'validation'
    : true;
  // Default to auto for legacy scenarios (undefined → true). Only explicit `false` opts out.
  const recAuto = config?.recommendedDurationAuto !== false;
  const autoRecMs = computeAutoRecommendedDurationMs(zones.length, media.length);

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

  // Phase 1 (2026-04-25): 레거시 시나리오 방어 — single-slot 의 endTimeMs 가 duration 보다
  // 작으면 자동으로 duration 까지 확장. 안 그러면 slot 만료 후 spawn rate=0 으로 멈춤.
  // multi-slot 은 사용자 의도 (예: 9-10am 만 운영) 존중 → no-op.
  useEffect(() => {
    if (!scenario || isLocked) return;
    const slots = scenario.simulationConfig.timeSlots;
    if (!slots || slots.length !== 1) return;
    const dur = scenario.simulationConfig.duration;
    if (slots[0].endTimeMs >= dur) return;
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        timeSlots: [{ ...slots[0], endTimeMs: dur }],
      },
    });
  }, [scenario, isLocked, setScenario]);

  const updateDist = useCallback((field: string, value: number) => {
    if (!scenario || isLocked) return;
    setScenario({
      ...scenario,
      visitorDistribution: { ...scenario.visitorDistribution, [field]: value },
    });
  }, [scenario, setScenario, isLocked]);

  const updateConfig = useCallback((field: string, value: number) => {
    if (!scenario || isLocked) return;
    // Phase 1 (2026-04-25): single-slot 시 Duration 변경 시 timeSlots[0].endTimeMs 도 함께 sync.
    // 이전엔 60분 default endTimeMs 가 그대로 남아 Duration 110분이어도 60분 후 spawn rate=0
    // (getActiveTimeSlot 이 null 반환). multi-slot 은 사용자 의도 존중 → no-op.
    const slots = scenario.simulationConfig.timeSlots;
    const isSingleSlot = (slots?.length ?? 0) === 1;
    let nextSlots = slots;
    if (field === 'duration' && isSingleSlot && slots && slots[0]) {
      nextSlots = [{ ...slots[0], endTimeMs: value }];
    }
    setScenario({
      ...scenario,
      simulationConfig: { ...scenario.simulationConfig, [field]: value, timeSlots: nextSlots },
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
    // Person 모드 전환 시 Duration이 safety cap으로 동작하므로 최소 3h는 확보.
    // 기존 저장 시나리오(60분 디폴트 시절)가 조기 cap 발동으로 지표 왜곡되는 것 방지.
    const MIN_PERSON_DUR_MS = 180 * 60_000;
    const currentDur = scenario.simulationConfig.duration;
    const nextDur = next === 'person' && currentDur < MIN_PERSON_DUR_MS
      ? MIN_PERSON_DUR_MS
      : currentDur;
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
      <CollapsibleSection id="spawn-presets" title="Presets">
        <VisitorPresets />
      </CollapsibleSection>

      <CollapsibleSection id="spawn-settings" title="Spawn Settings" defaultOpen>
        {showModeToggle && (
          <div className="mb-2 p-1.5 rounded bg-secondary/50 border border-border">
            <div className="text-[9px] text-muted-foreground mb-1">{t('spawn.mode.label')}</div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setMode('time')}
                disabled={isLocked}
                title={t('spawn.mode.timeHint')}
                className={`px-1.5 py-1 rounded text-[10px] font-medium border transition-colors disabled:opacity-50 ${
                  mode === 'time'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent border-border hover:border-primary/50'
                }`}
              >
                {t('spawn.mode.time')}
              </button>
              <button
                onClick={() => setMode('person')}
                disabled={isLocked || policyForcesTime}
                title={policyForcesTime ? t('spawn.mode.lockedByPolicy') : t('spawn.mode.personHint')}
                className={`px-1.5 py-1 rounded text-[10px] font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  mode === 'person'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent border-border hover:border-primary/50'
                }`}
              >
                {t('spawn.mode.person')}
                {policyForcesTime && <span className="ml-1 text-[8px]">🔒</span>}
              </button>
            </div>
          </div>
        )}
        {policyForcesTime && (
          <div className="mb-2 px-2 py-1.5 rounded bg-primary/5 border border-primary/20 text-[9px] text-muted-foreground leading-tight">
            {t('spawn.policyActiveHint')}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label={policyForcesTime ? `Total Visitors (∞)` : 'Total Visitors'}
            value={dist?.totalCount ?? 200}
            onChange={(v) => updateDist('totalCount', v)}
            disabled={isLocked || policyForcesTime}
          />
          <NumField
            label={policyForcesTime ? `Max Concurrent (∞)` : 'Max Concurrent'}
            // Clamp displayed value to Total — Max > Total is a dead setting
            // (cumulative cap fires first). Intermediate keystrokes on Total
            // would corrupt the stored Max, so we only clamp for display and
            // on-commit here, not by rewriting maxVisitors when Total changes.
            value={Math.min(config?.maxVisitors ?? 500, dist?.totalCount ?? 500)}
            onChange={(v) => updateConfig('maxVisitors', Math.min(v, dist?.totalCount ?? v))}
            disabled={isLocked || policyForcesTime}
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
              label={recAuto ? t('spawn.recStay.labelAuto') : t('spawn.recStay.label')}
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
