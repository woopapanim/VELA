/**
 * ModeSelectionScreen — 새 프로젝트 생성 직후 첫 진입 설문 (2026-04-26)
 *
 * 흐름: WelcomeScreen.New Project → 이름 입력 → 시나리오 생성 → 이 화면 →
 * 모드 선택 → experienceMode + entryPolicy + satisfactionWeights default 적용 →
 * MainLayout 진입.
 *
 * Open File / Recent Projects 흐름은 이 화면을 건너뜀 (저장된 시나리오엔
 * 이미 모드가 결정되어 있음).
 *
 * Skip 옵션: "기본값(자유 관람)으로 시작" — free_admission 으로 적용 후 진입.
 *
 * 메모리: project_question_driven_ux.md (질문 기반 UX 진입)
 * spec: docs/specs/phase-1-experience-modes.md
 */

import { Lock } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import {
  EXPERIENCE_MODE_REGISTRY,
  EXPERIENCE_MODES_BY_TIER,
  EXPERIENCE_MODE_POLICY_DEFAULTS,
  SATISFACTION_WEIGHTS_BY_MODE,
  type ExperienceMode,
  type ExperienceModeTier,
} from '@/domain';

const TIER_ORDER: ReadonlyArray<ExperienceModeTier> = ['validation', 'operations'];
const DEFAULT_MODE: ExperienceMode = 'free_admission';

interface Props {
  /** 모드 선택 (또는 skip) 후 호출 — App.tsx 가 'ready' step 으로 전환. */
  onPicked: () => void;
  /** 뒤로 가기 — 새 프로젝트 생성을 취소하고 WelcomeScreen 으로 복귀. */
  onBack: () => void;
}

export function ModeSelectionScreen({ onPicked, onBack }: Props) {
  const t = useT();
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);

  const apply = (mode: ExperienceMode) => {
    if (!scenario) return;
    if (!EXPERIENCE_MODE_REGISTRY[mode].enabled) return;

    const nextPolicy = EXPERIENCE_MODE_POLICY_DEFAULTS[mode];
    const nextWeights = SATISFACTION_WEIGHTS_BY_MODE[mode];
    const tier = EXPERIENCE_MODE_REGISTRY[mode].tier;
    const needsTimeMode = tier === 'operations' && nextPolicy.mode !== 'unlimited';
    const currentSimMode = scenario.simulationConfig.simulationMode ?? 'time';

    setScenario({
      ...scenario,
      experienceMode: mode,
      simulationConfig: {
        ...scenario.simulationConfig,
        ...(needsTimeMode && currentSimMode === 'person' ? { simulationMode: 'time' as const } : {}),
        operations: {
          entryPolicy: nextPolicy,
          satisfactionWeights: nextWeights,
        },
      },
    });
    onPicked();
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-[300] overflow-y-auto">
      <div className="w-full max-w-2xl px-6 py-10">
        {/* Back link */}
        <button
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          {t('modeSelect.back')}
        </button>

        {/* Title + subtitle */}
        <h1 className="text-xl font-semibold tracking-tight mb-2">
          {t('modeSelect.title')}
        </h1>
        <p className="text-xs text-muted-foreground mb-8 leading-relaxed">
          {t('modeSelect.subtitle')}
        </p>

        {/* Tiered mode cards */}
        <div className="space-y-6">
          {TIER_ORDER.map((tier) => (
            <div key={tier}>
              <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2">
                {t(`experienceMode.tier.${tier}`)}
              </h2>
              <div className="space-y-2">
                {EXPERIENCE_MODES_BY_TIER[tier].map((m) => {
                  const meta = EXPERIENCE_MODE_REGISTRY[m];
                  const enabled = meta.enabled;
                  const labelKey = `${meta.i18nKey}.label`;
                  const descKey = `${meta.i18nKey}.desc`;

                  return (
                    <button
                      key={m}
                      onClick={() => apply(m)}
                      disabled={!enabled}
                      className={`w-full text-left px-4 py-3 rounded-2xl border transition-all
                        ${enabled
                          ? 'bg-secondary/40 border-border hover:border-primary/40 hover:bg-secondary cursor-pointer'
                          : 'bg-muted/20 border-border/40 opacity-60 cursor-not-allowed'
                        }`}
                      title={!enabled ? t('experienceMode.disabledHint', { phase: meta.enabledFromPhase ?? '' }) : undefined}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-sm font-medium">{t(labelKey)}</span>
                        {!enabled && <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" aria-hidden />}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {enabled
                          ? t(descKey)
                          : t('experienceMode.disabledLine', { phase: meta.enabledFromPhase ?? '' })
                        }
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Skip link — falls through to free_admission default */}
        <div className="text-center mt-8">
          <button
            onClick={() => apply(DEFAULT_MODE)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('modeSelect.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
