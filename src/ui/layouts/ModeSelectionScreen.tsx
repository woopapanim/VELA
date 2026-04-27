/**
 * ModeSelectionScreen — Setup 단계 화면 (v2 IA 재구성, 2026-04-28)
 *
 * "어떤 시나리오를 시뮬레이션할까요?"
 *
 * 좌/우 패널 12 섹션 재배치 X — Setup 화면은 Setup 만의 디자인:
 *   ┌──────────┬─────────────────────────────────┬────────┐
 *   │ Workflow │  핵심 질문 (binary → sub)         │ 가이드  │
 *   │ steps    │                                 │ 영상    │
 *   └──────────┴─────────────────────────────────┴────────┘
 *
 * Progressive disclosure:
 *   1) 첫 화면: binary 2 카드 (분석 / 운영)
 *   2) 카드 클릭 시 sub-mode 한 줄 리스트로 펼쳐짐
 *
 * 카피는 사용자 톤으로 워싱 — "체험 모드", "Experience Mode" 같은
 * 내부 용어는 사용자 화면에 등장하지 않음.
 *
 * 잠긴 sub-mode 클릭 → LockedModeModal.
 *
 * spec: docs/specs/phase-1-experience-modes.md
 * 진입 문서: docs/plans/ux-ia-restructure.md §3 IA 원칙
 */

import { useState } from 'react';
import { Lock, ArrowRight, Play } from 'lucide-react';
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
import { WorkflowStepIndicator } from './WorkflowStepIndicator';

const DEFAULT_MODE: ExperienceMode = 'free_admission';

interface Props {
  onPicked: () => void;
  onBack: () => void;
}

export function ModeSelectionScreen({ onPicked, onBack }: Props) {
  const t = useT();
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);

  const [branch, setBranch] = useState<ExperienceModeTier | null>(null);
  const [lockedPreview, setLockedPreview] = useState<ExperienceMode | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

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

  const handleSubClick = (mode: ExperienceMode) => {
    if (EXPERIENCE_MODE_REGISTRY[mode].enabled) apply(mode);
    else setLockedPreview(mode);
  };

  return (
    <div className="fixed inset-0 bg-background z-[300] overflow-hidden flex">
      {/* 좌측: 4-step indicator */}
      <aside className="w-64 border-r border-border/60 px-4 py-8 flex-shrink-0 hidden md:block">
        <div className="mb-6">
          <button
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('modeSelect.back')}
          </button>
        </div>
        <WorkflowStepIndicator current={1} variant="vertical" />
      </aside>

      {/* 메인: 핵심 질문 (binary → sub) */}
      <main className="flex-1 overflow-y-auto px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={onBack}
            className="md:hidden text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            {t('modeSelect.back')}
          </button>

          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            {t('modeSelect.title')}
          </h1>
          <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
            {t('modeSelect.subtitle')}
          </p>

          {branch === null ? (
            <BranchPicker onPick={setBranch} t={t} />
          ) : (
            <SubModePicker
              tier={branch}
              onSelect={handleSubClick}
              onChangeBranch={() => setBranch(null)}
              t={t}
            />
          )}

          <div className="text-center mt-10">
            <button
              onClick={() => apply(DEFAULT_MODE)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('modeSelect.skip')}
            </button>
          </div>
        </div>
      </main>

      {/* 우측: 가이드 영상 (작게, dismissable) */}
      <aside className="w-72 border-l border-border/60 px-5 py-8 flex-shrink-0 hidden lg:block">
        <button
          onClick={() => setGuideOpen(true)}
          className="w-full text-left rounded-2xl border border-border/60 bg-secondary/30 hover:border-primary/40 hover:bg-secondary transition-all p-4 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
              <Play className="w-3.5 h-3.5 text-primary" fill="currentColor" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                {t('modeSelect.guide.firstTime')}
              </div>
              <div className="text-sm font-medium">{t('modeSelect.guide.watchIntro')}</div>
            </div>
          </div>
          <div className="aspect-video rounded-lg bg-muted/40 flex items-center justify-center text-[10px] text-muted-foreground/60">
            {t('modeSelect.guide.comingSoon')}
          </div>
        </button>
      </aside>

      <LockedModeModal mode={lockedPreview} onClose={() => setLockedPreview(null)} />

      {guideOpen && (
        <div
          className="fixed inset-0 z-[400] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-card border border-border rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium mb-3">{t('modeSelect.guide.watchIntro')}</div>
            <div className="aspect-video rounded-lg bg-muted/40 flex items-center justify-center text-xs text-muted-foreground/70">
              {t('modeSelect.guide.comingSoon')}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setGuideOpen(false)}
                className="text-xs px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                {t('modeSelect.lockedModalClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Branch picker (Step 1: 분석 vs 운영) ─────────────────────────

function BranchPicker({
  onPick,
  t,
}: {
  onPick: (b: ExperienceModeTier) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const branches: Array<{ tier: ExperienceModeTier; labelKey: string; taglineKey: string }> = [
    { tier: 'validation', labelKey: 'modeSelect.branch.validation.label', taglineKey: 'modeSelect.branch.validation.tagline' },
    { tier: 'operations', labelKey: 'modeSelect.branch.operations.label', taglineKey: 'modeSelect.branch.operations.tagline' },
  ];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-3">
        {t('modeSelect.branch.pickOne')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {branches.map((b) => (
          <button
            key={b.tier}
            onClick={() => onPick(b.tier)}
            className="group relative text-left px-6 py-7 rounded-2xl border border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary transition-all"
          >
            <div className="text-base font-semibold tracking-tight mb-1.5">
              {t(b.labelKey)}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(b.taglineKey)}
            </p>
            <ArrowRight className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Sub-mode picker (Step 2: 선택한 branch 안의 sub-mode) ────────

function SubModePicker({
  tier,
  onSelect,
  onChangeBranch,
  t,
}: {
  tier: ExperienceModeTier;
  onSelect: (m: ExperienceMode) => void;
  onChangeBranch: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const branchLabelKey = tier === 'validation' ? 'modeSelect.branch.validation.label' : 'modeSelect.branch.operations.label';
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
          <span>{t(branchLabelKey)}</span>
        </div>
        <button
          onClick={onChangeBranch}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('modeSelect.branch.changeBranch')}
        </button>
      </div>

      <div className="space-y-2">
        {EXPERIENCE_MODES_BY_TIER[tier].map((m) => {
          const meta = EXPERIENCE_MODE_REGISTRY[m];
          const enabled = meta.enabled;
          return (
            <button
              key={m}
              onClick={() => onSelect(m)}
              className={`group w-full text-left flex items-center gap-3 px-5 py-4 rounded-xl border transition-all
                ${enabled
                  ? 'bg-secondary/30 border-border hover:border-primary/50 hover:bg-secondary'
                  : 'bg-muted/15 border-border/50 hover:border-border'
                }`}
            >
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${enabled ? '' : 'text-muted-foreground'}`}>
                  {t(`modeSelect.sub.${m}`)}
                </div>
              </div>
              {!enabled && (
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 flex-shrink-0">
                  <Lock className="w-3 h-3" aria-hidden />
                  <span>{t('modeSelect.sub.lockedSoon')}</span>
                </div>
              )}
              <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-all
                ${enabled
                  ? 'text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5'
                  : 'text-muted-foreground/20'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
