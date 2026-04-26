/**
 * ExperienceModePanel — Phase 1 UX (2026-04-26)
 *
 * 패널 최상단 (Project / Simulation 다음). 사용자가 "무엇을 검증/예측할지"
 * _체험 모드_ 로 선언하면, 그 선택이 입장 정책 + 만족도 가중치 default 를 결정.
 *
 * - 2 tier (검증 / 운영 예상) 별로 collapsible
 * - 8 모드 (활성 5 + disabled 3) 모두 노출, disabled 는 Lock + tooltip
 * - 모드 변경 시 사용자 customization 검출 → confirm dialog
 * - 운영 tier + non-unlimited 정책 → simulationMode 'time' 강제 (큐 invariant)
 *
 * 시뮬 진행 중 (phase !== 'idle') 잠금 — 정책 도중 변경 = invariant 깨짐.
 *
 * 관련 spec: docs/specs/phase-1-experience-modes.md §5
 */

import { Lock } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import {
  EXPERIENCE_MODE_REGISTRY,
  EXPERIENCE_MODES_BY_TIER,
  EXPERIENCE_MODE_POLICY_DEFAULTS,
  SATISFACTION_WEIGHTS_BY_MODE,
  inferExperienceMode,
  type ExperienceMode,
  type ExperienceModeTier,
} from '@/domain';
// operations.ts is the Phase 1 engine layer (separate prior commit). Imported via
// explicit path to keep the experienceMode barrel addition self-contained.
import {
  DEFAULT_OPERATIONS_CONFIG,
  type EntryPolicy,
  type SatisfactionWeights,
} from '@/domain/types/operations';

const TIER_ORDER: ReadonlyArray<ExperienceModeTier> = ['validation', 'operations'];

/** Customization 검출 — 모드별 default 와의 의미있는 차이 (mode/cap/슬롯/가중치). */
function isPolicyCustomized(p: EntryPolicy, def: EntryPolicy): boolean {
  if (p.mode !== def.mode) return true;
  if ((p.maxConcurrent ?? null) !== (def.maxConcurrent ?? null)) return true;
  if ((p.maxPerHour ?? null) !== (def.maxPerHour ?? null)) return true;
  if ((p.slotDurationMs ?? null) !== (def.slotDurationMs ?? null)) return true;
  if ((p.perSlotCap ?? null) !== (def.perSlotCap ?? null)) return true;
  return false;
}

function isWeightsCustomized(w: SatisfactionWeights, def: SatisfactionWeights): boolean {
  return (
    Math.abs(w.crowd - def.crowd) > 0.001 ||
    Math.abs(w.dwell - def.dwell) > 0.001 ||
    Math.abs(w.wait - def.wait) > 0.001 ||
    Math.abs(w.engagement - def.engagement) > 0.001
  );
}

export function ExperienceModePanel() {
  const t = useT();
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);
  const isLocked = phase !== 'idle';

  if (!scenario) return null;

  // 명시 저장값 우선, 없으면 기존 entryPolicy 에서 추론 (마이그레이션 경로).
  const currentMode: ExperienceMode = scenario.experienceMode
    ?? inferExperienceMode(scenario.simulationConfig.operations?.entryPolicy?.mode);
  const currentMeta = EXPERIENCE_MODE_REGISTRY[currentMode];

  const handleSelect = (next: ExperienceMode) => {
    if (next === currentMode || isLocked) return;
    if (!EXPERIENCE_MODE_REGISTRY[next].enabled) return;

    // 사용자가 _현재 모드의 default_ 에서 벗어나게 조정해 둔 상태인지 검사.
    // 벗어나 있다면 mode 전환으로 그 customization 이 날아간다 → confirm.
    const currentDefaults = EXPERIENCE_MODE_POLICY_DEFAULTS[currentMode];
    const currentExpectedWeights = SATISFACTION_WEIGHTS_BY_MODE[currentMode];
    const ops = scenario.simulationConfig.operations ?? DEFAULT_OPERATIONS_CONFIG;
    const policyCustom = isPolicyCustomized(ops.entryPolicy, currentDefaults);
    const weightsCustom = isWeightsCustomized(ops.satisfactionWeights, currentExpectedWeights);

    if (policyCustom || weightsCustom) {
      const ok = window.confirm(t('experienceMode.changeConfirm'));
      if (!ok) return;
    }

    const nextPolicy = EXPERIENCE_MODE_POLICY_DEFAULTS[next];
    const nextWeights = SATISFACTION_WEIGHTS_BY_MODE[next];

    // 운영 tier + non-unlimited → simulationMode 'time' 강제 (person-mode 는
    // totalCount 도달 시 generation 정지 → 큐 sweep 의미 사라짐).
    const nextTier = EXPERIENCE_MODE_REGISTRY[next].tier;
    const needsTimeMode = nextTier === 'operations' && nextPolicy.mode !== 'unlimited';
    const currentSimMode = scenario.simulationConfig.simulationMode ?? 'time';

    setScenario({
      ...scenario,
      experienceMode: next,
      simulationConfig: {
        ...scenario.simulationConfig,
        ...(needsTimeMode && currentSimMode === 'person' ? { simulationMode: 'time' as const } : {}),
        operations: {
          entryPolicy: nextPolicy,
          satisfactionWeights: nextWeights,
        },
      },
    });
  };

  return (
    <div className="bento-box p-4">
      <h2 className="panel-section mb-3 flex items-center gap-1.5">
        {t('experienceMode.title')}
        <InfoTooltip text={t('experienceMode.titleHint')} />
      </h2>

      {isLocked && (
        <p className="text-[9px] text-muted-foreground mb-2 italic">
          {t('experienceMode.lockedHint')}
        </p>
      )}

      <p className="text-[10px] text-muted-foreground mb-2">
        {t('experienceMode.question')}
      </p>

      <div className="space-y-2">
        {TIER_ORDER.map((tier) => {
          const tierActive = currentMeta.tier === tier;
          return (
            <CollapsibleSection
              key={tier}
              id={`experienceMode-${tier}`}
              title={t(`experienceMode.tier.${tier}`)}
              defaultOpen={tierActive}
            >
              <div className="space-y-1">
                {EXPERIENCE_MODES_BY_TIER[tier].map((m: ExperienceMode) => {
                  const meta = EXPERIENCE_MODE_REGISTRY[m];
                  const active = currentMode === m;
                  const enabled = meta.enabled;

                  const buttonClass = active
                    ? 'bg-primary/10 border-primary/40 text-foreground'
                    : enabled
                      ? 'bg-transparent border-border hover:border-primary/30'
                      : 'bg-muted/20 border-border/40 opacity-60 cursor-not-allowed';

                  const descKey = `${meta.i18nKey}.desc`;
                  const labelKey = `${meta.i18nKey}.label`;

                  return (
                    <button
                      key={m}
                      onClick={() => handleSelect(m)}
                      disabled={isLocked || !enabled}
                      className={`w-full text-left px-2 py-1.5 rounded-lg border transition-colors disabled:cursor-not-allowed ${buttonClass}`}
                      title={!enabled ? t('experienceMode.disabledHint', { phase: meta.enabledFromPhase ?? '' }) : undefined}
                      aria-pressed={active}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium">{t(labelKey)}</span>
                        {!enabled && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" aria-hidden />}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                        {enabled
                          ? t(descKey)
                          : t('experienceMode.disabledLine', { phase: meta.enabledFromPhase ?? '' })
                        }
                      </div>
                    </button>
                  );
                })}
              </div>
            </CollapsibleSection>
          );
        })}
      </div>
    </div>
  );
}
