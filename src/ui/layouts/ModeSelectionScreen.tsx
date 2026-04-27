/**
 * ModeSelectionScreen — 새 프로젝트 생성 직후 첫 진입 설문 (2026-04-26, IA 재설계 2026-04-28)
 *
 * 흐름: WelcomeScreen.New Project → 이름 입력 → 시나리오 생성 → 이 화면 →
 * 모드 선택 → experienceMode + entryPolicy + satisfactionWeights default 적용 →
 * MainLayout 진입.
 *
 * 카드 구조 (2026-04-28 IA 재설계):
 *   [페르소나]              ← uppercase tiny caption
 *   [핵심 질문]              ← prominent (모드의 본질)
 *   [짧은 설명]              ← muted xs
 *   ─── 주요 분석 결과 ───
 *   [chip] [chip] [chip] [chip]   ← KPI 미리보기
 *
 * 잠긴 모드 (Phase 2/3A/3B) 도 동일한 카드를 노출. 클릭 → LockedModeModal 로
 * 가치 미리보기. spec 약속을 IA 에 정착시키는 IA 재구성의 핵심.
 *
 * Open File / Recent Projects 흐름은 이 화면을 건너뜀 (저장된 시나리오엔
 * 이미 모드가 결정되어 있음). ※ legacy 시나리오는 App.tsx 에서 mode 강제 검증.
 *
 * Skip 옵션: "기본값(자유 관람)으로 시작" — free_admission 으로 적용 후 진입.
 *
 * 메모리: project_question_driven_ux.md (질문 기반 UX 진입)
 * spec: docs/specs/phase-1-experience-modes.md
 * 진입 문서: docs/plans/ux-ia-restructure.md §3 IA 원칙
 */

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import {
  EXPERIENCE_MODE_REGISTRY,
  EXPERIENCE_MODES_BY_TIER,
  resolveExperienceModePolicy,
  SATISFACTION_WEIGHTS_BY_MODE,
  type ExperienceMode,
  type ExperienceModeTier,
} from '@/domain';
import { LockedModeModal } from './LockedModeModal';

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
  const [lockedPreview, setLockedPreview] = useState<ExperienceMode | null>(null);

  const apply = (mode: ExperienceMode) => {
    if (!scenario) return;
    if (!EXPERIENCE_MODE_REGISTRY[mode].enabled) return;

    const nextPolicy = resolveExperienceModePolicy(mode, scenario.zones, scenario.media);
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

  const handleClick = (mode: ExperienceMode) => {
    if (EXPERIENCE_MODE_REGISTRY[mode].enabled) apply(mode);
    else setLockedPreview(mode);
  };

  return (
    <div className="fixed inset-0 bg-background flex items-start justify-center z-[300] overflow-y-auto">
      <div className="w-full max-w-3xl px-6 py-10">
        <button
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          {t('modeSelect.back')}
        </button>

        <h1 className="text-xl font-semibold tracking-tight mb-2">
          {t('modeSelect.title')}
        </h1>
        <p className="text-xs text-muted-foreground mb-8 leading-relaxed">
          {t('modeSelect.subtitle')}
        </p>

        <div className="space-y-7">
          {TIER_ORDER.map((tier) => (
            <div key={tier}>
              <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-3">
                {t(`experienceMode.tier.${tier}`)}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EXPERIENCE_MODES_BY_TIER[tier].map((m) => {
                  const meta = EXPERIENCE_MODE_REGISTRY[m];
                  const enabled = meta.enabled;
                  const labelKey = `${meta.i18nKey}.label`;
                  const descKey = `${meta.i18nKey}.desc`;
                  const phase = meta.enabledFromPhase ?? '';

                  return (
                    <button
                      key={m}
                      onClick={() => handleClick(m)}
                      className={`group relative text-left px-4 py-4 rounded-2xl border transition-all
                        ${enabled
                          ? 'bg-secondary/30 border-border hover:border-primary/50 hover:bg-secondary cursor-pointer'
                          : 'bg-muted/20 border-border/40 hover:border-border cursor-pointer'
                        }
                        ${tier === 'validation' ? 'border-l-2 border-l-primary/40' : ''}
                      `}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                          {t(meta.personaKey)}
                        </div>
                        {!enabled && (
                          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground/60 flex-shrink-0">
                            <Lock className="w-3 h-3" aria-hidden />
                            <span>{phase}</span>
                          </div>
                        )}
                      </div>

                      <div className={`text-sm font-semibold tracking-tight leading-snug mb-1 ${enabled ? '' : 'text-muted-foreground'}`}>
                        {t(meta.questionKey)}
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                        {t(descKey)}
                      </p>

                      <div className="pt-2 border-t border-border/60">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                          {t('modeSelect.previewKpiLabel')}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {meta.previewKpiKeys.map((kpiKey) => (
                            <span
                              key={kpiKey}
                              className={`text-[10px] px-1.5 py-0.5 rounded-md
                                ${enabled
                                  ? 'bg-primary/10 text-primary/90'
                                  : 'bg-muted/40 text-muted-foreground/70'
                                }`}
                            >
                              {t(kpiKey)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-[10px] text-muted-foreground/50 mt-2">
                        {t(labelKey)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => apply(DEFAULT_MODE)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('modeSelect.skip')}
          </button>
        </div>
      </div>

      <LockedModeModal mode={lockedPreview} onClose={() => setLockedPreview(null)} />
    </div>
  );
}
