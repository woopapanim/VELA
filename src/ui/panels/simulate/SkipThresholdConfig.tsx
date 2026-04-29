import { useCallback } from 'react';
import { useStore } from '@/stores';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { NumField } from '@/ui/components/ConfigFields';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { useT } from '@/i18n';

// Simulate / RunConfig — Skip threshold (max wait time, multiplier).
// 실행 파라미터이므로 Simulate phase 에 위치. 의도(profile/category mix)와 분리.
export function SkipThresholdConfig() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);
  const t = useT();

  const isLocked = phase !== 'idle';
  const config = scenario?.simulationConfig;

  const updateSkip = useCallback((field: string, value: number) => {
    if (!scenario || isLocked) return;
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        skipThreshold: { ...scenario.simulationConfig.skipThreshold, [field]: value },
      },
    });
  }, [scenario, setScenario, isLocked]);

  if (!scenario) return null;

  return (
    <CollapsibleSection id="run-skip" title="Skip Threshold">
      <div className="flex items-center justify-end mb-1">
        <InfoTooltip text={t('tooltip.skipFormula')} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField
          label="Max Wait (s)"
          value={Math.round((config?.skipThreshold?.maxWaitTimeMs ?? 30000) / 1000)}
          onChange={(v) => updateSkip('maxWaitTimeMs', v * 1000)}
          disabled={isLocked}
          step={5}
        />
        <NumField
          label="Skip Multiplier"
          value={config?.skipThreshold?.skipMultiplier ?? 1.0}
          onChange={(v) => updateSkip('skipMultiplier', v)}
          disabled={isLocked}
          step={0.1}
        />
      </div>
    </CollapsibleSection>
  );
}
