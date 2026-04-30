import { useStore } from '@/stores';
import { DEFAULT_CATEGORY_WEIGHTS } from '@/domain';
import type { VisitorCategory } from '@/domain';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { PercentMix, CategoryMix } from '@/ui/components/ConfigFields';
import { useT } from '@/i18n';

// Build / Visitors task — 의도만. "누가 오는가"
// Profile / Engagement / Category Mix 만 다룸. Spawn rate / Skip threshold 등
// 실행 설정은 Simulate phase 의 RunConfigPanel 로 분리됨 (2026-04-29 IA 재정리).
export function VisitorConfig() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);
  const t = useT();

  const isLocked = phase !== 'idle';
  const dist = scenario?.visitorDistribution;

  if (!scenario) return null;

  return (
    <div>
      <CollapsibleSection id="visitor-profile" title={t('visitorConfig.profile')} defaultOpen>
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

      <CollapsibleSection id="visitor-engagement" title={t('visitorConfig.engagement')}>
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

      <CollapsibleSection id="visitor-category" title={t('visitorConfig.category')} defaultOpen>
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
    </div>
  );
}
