import { useCallback } from 'react';
import { useStore } from '@/stores';
import { DEFAULT_CATEGORY_WEIGHTS } from '@/domain';
import type { VisitorCategory } from '@/domain';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { NumField, PercentMix, CategoryMix } from '@/ui/components/ConfigFields';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { useT } from '@/i18n';

export function VisitorConfig() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);
  const t = useT();

  const isLocked = phase !== 'idle';
  const dist = scenario?.visitorDistribution;
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
    <div>
      <CollapsibleSection id="visitor-profile" title="Profile Mix">
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
      </CollapsibleSection>

      <CollapsibleSection id="visitor-engagement" title="Engagement Mix">
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
      </CollapsibleSection>

      <CollapsibleSection id="visitor-category" title="Category Mix">
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
      </CollapsibleSection>

      <CollapsibleSection id="visitor-skip" title="Skip Threshold">
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
    </div>
  );
}
