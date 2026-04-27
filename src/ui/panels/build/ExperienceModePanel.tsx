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
 * - 운영 tier + non-unlimited 모드 선택 시 정책 파라미터 (cap / rate / slot / patience) +
 *   PolicyComparisonLauncher (A/B/C 수동 비교) 를 inline 노출 (#1 입장 정책 흡수, 2026-04-26).
 *
 * 시뮬 진행 중 (phase !== 'idle') 잠금 — 정책 도중 변경 = invariant 깨짐.
 *
 * 관련 spec: docs/specs/phase-1-experience-modes.md §5, docs/specs/phase-1-operations-policy.md §3
 */

import { useCallback } from 'react';
import { Lock } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { NumField } from '@/ui/components/ConfigFields';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { PolicyComparisonLauncher } from './PolicyComparisonLauncher';
import {
  EXPERIENCE_MODE_REGISTRY,
  EXPERIENCE_MODES_BY_TIER,
  EXPERIENCE_MODE_POLICY_DEFAULTS,
  resolveExperienceModePolicy,
  SATISFACTION_WEIGHTS_BY_MODE,
  inferExperienceMode,
  type ExperienceMode,
  type ExperienceModeTier,
} from '@/domain';
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

  const setField = useCallback(<K extends keyof EntryPolicy>(key: K, value: EntryPolicy[K]) => {
    if (!scenario || isLocked) return;
    const ops = scenario.simulationConfig.operations ?? DEFAULT_OPERATIONS_CONFIG;
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        operations: {
          ...ops,
          entryPolicy: { ...ops.entryPolicy, [key]: value },
        },
      },
    });
  }, [scenario, setScenario, isLocked]);

  if (!scenario) return null;

  // 명시 저장값 우선, 없으면 기존 entryPolicy 에서 추론 (마이그레이션 경로).
  const currentMode: ExperienceMode = scenario.experienceMode
    ?? inferExperienceMode(scenario.simulationConfig.operations?.entryPolicy?.mode);
  const currentMeta = EXPERIENCE_MODE_REGISTRY[currentMode];
  const isOperationsTier = currentMeta.tier === 'operations';

  const policy = (scenario.simulationConfig.operations ?? DEFAULT_OPERATIONS_CONFIG).entryPolicy;
  const showConcurrent = policy.mode === 'concurrent-cap' || policy.mode === 'hybrid';
  const showRate = policy.mode === 'rate-limit';
  const showSlot = policy.mode === 'time-slot' || policy.mode === 'hybrid';
  const showWait = policy.mode !== 'unlimited';

  const handleSelect = (next: ExperienceMode) => {
    // Read live store to avoid any stale-closure mismatch between the rendered
    // active highlight and the value handleSelect captured. (2026-04-26)
    const live = useStore.getState().scenario;
    if (!live) return;
    const liveMode: ExperienceMode = live.experienceMode
      ?? inferExperienceMode(live.simulationConfig.operations?.entryPolicy?.mode);
    if (next === liveMode || isLocked) return;
    if (!EXPERIENCE_MODE_REGISTRY[next].enabled) return;

    // 사용자가 _현재 모드의 default_ 에서 벗어나게 조정해 둔 상태인지 검사.
    // 벗어나 있다면 mode 전환으로 그 customization 이 날아간다 → confirm.
    const currentDefaults = EXPERIENCE_MODE_POLICY_DEFAULTS[liveMode];
    const currentExpectedWeights = SATISFACTION_WEIGHTS_BY_MODE[liveMode];
    const ops = live.simulationConfig.operations ?? DEFAULT_OPERATIONS_CONFIG;
    const policyCustom = isPolicyCustomized(ops.entryPolicy, currentDefaults);
    const weightsCustom = isWeightsCustomized(ops.satisfactionWeights, currentExpectedWeights);

    if (policyCustom || weightsCustom) {
      const ok = window.confirm(t('experienceMode.changeConfirm'));
      if (!ok) return;
    }

    const nextPolicy = resolveExperienceModePolicy(next, live.zones, live.media);
    const nextWeights = SATISFACTION_WEIGHTS_BY_MODE[next];

    // 운영 tier + non-unlimited → simulationMode 'time' 강제 (person-mode 는
    // totalCount 도달 시 generation 정지 → 큐 sweep 의미 사라짐).
    const nextTier = EXPERIENCE_MODE_REGISTRY[next].tier;
    const needsTimeMode = nextTier === 'operations' && nextPolicy.mode !== 'unlimited';
    const currentSimMode = live.simulationConfig.simulationMode ?? 'time';

    setScenario({
      ...live,
      experienceMode: next,
      simulationConfig: {
        ...live.simulationConfig,
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
                    ? 'bg-primary/15 border-primary text-foreground ring-1 ring-primary/40'
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
                      <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight whitespace-pre-line">
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

      {/* ── 입장 정책 파라미터 (운영 tier + non-unlimited 일 때만) ─────────────
          이전엔 별도 OperationsPanel 이었으나, 모드 picker 가 ExperienceMode 와
          중복돼 #1 작업 (2026-04-26) 에서 이 패널로 흡수. 모드는 위 picker 가
          결정하고, 여기선 그 모드의 cap/slot/patience 파라미터만 노출. */}
      {isOperationsTier && showWait && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <CollapsibleSection
            id="experienceMode-params"
            title={`${t('ops.title')} — ${t(`ops.mode.${policy.mode}`)}`}
            defaultOpen
          >
            <div className="grid grid-cols-2 gap-2">
              {showConcurrent && (
                <NumField
                  label={t('ops.field.maxConcurrent')}
                  value={policy.maxConcurrent ?? 200}
                  onChange={(v) => setField('maxConcurrent', Math.max(1, Math.round(v)))}
                  disabled={isLocked}
                  step={10}
                />
              )}
              {showRate && (
                <NumField
                  label={t('ops.field.maxPerHour')}
                  value={policy.maxPerHour ?? 240}
                  onChange={(v) => setField('maxPerHour', Math.max(1, Math.round(v)))}
                  disabled={isLocked}
                  step={10}
                />
              )}
              {showSlot && (
                <>
                  <NumField
                    label={t('ops.field.slotDurationMin')}
                    value={Math.max(1, Math.round((policy.slotDurationMs ?? 1_800_000) / 60_000))}
                    onChange={(v) => setField('slotDurationMs', Math.max(1, Math.round(v)) * 60_000)}
                    disabled={isLocked}
                    step={5}
                  />
                  <NumField
                    label={t('ops.field.perSlotCap')}
                    value={policy.perSlotCap ?? 80}
                    onChange={(v) => setField('perSlotCap', Math.max(1, Math.round(v)))}
                    disabled={isLocked}
                    step={5}
                  />
                </>
              )}
              <div className="col-span-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[9px] text-muted-foreground">{t('ops.field.maxWaitMin')}</span>
                  <InfoTooltip text={t('ops.patienceGuide')} />
                </div>
                <NumField
                  label=""
                  value={Math.max(1, Math.round((policy.maxWaitBeforeAbandonMs ?? 1_800_000) / 60_000))}
                  onChange={(v) => setField('maxWaitBeforeAbandonMs', Math.max(1, Math.round(v)) * 60_000)}
                  disabled={isLocked}
                  step={5}
                />
              </div>
            </div>

            {/* 인내심 분포 모델 (균일/정규) + σ 입력 UI 는 제거됨 (2026-04-26).
                근거: 평균(인내심)은 모집단 중심값이고 σ 는 그 개인차 분산 — 개념상 이중 가중이 아니지만,
                사용자가 magic number (30%) 를 직접 결정하게 둘 정당한 근거 없음.
                내부적으로는 PATIENCE_DEFAULTS (정규분포, σ = 평균의 30%) 가 유지되어 시뮬에 적용됨.
                전시 성격 차이는 아래의 "프로필/참여도 배수" opt-in 으로 처리. */}

            {/* ── (선택) 프로필/참여도 배수 opt-in ── */}
            <div className="mt-2 px-2 py-1.5 rounded bg-secondary/30 border border-border/50">
              <label className="flex items-start gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.patienceUseModifiers === true}
                  onChange={(e) => setField('patienceUseModifiers', e.target.checked)}
                  disabled={isLocked}
                  className="mt-0.5 cursor-pointer disabled:opacity-50"
                />
                <span className="text-[9px] font-medium leading-tight inline-flex items-center gap-1">
                  {t('ops.useModifiersLabel')}
                  <InfoTooltip text={t('ops.useModifiersHint')} />
                </span>
              </label>
              {policy.patienceUseModifiers === true && (
                <p className="text-[8px] text-muted-foreground mt-1.5 leading-tight whitespace-pre-line">
                  {t('ops.patienceProfileNote')}
                </p>
              )}
            </div>
          </CollapsibleSection>

          {/* ── A/B/C 정책 비교 도구 (unlimited 면 null 반환) ── */}
          <div className="mt-3">
            <PolicyComparisonLauncher />
          </div>
        </div>
      )}
    </div>
  );
}
