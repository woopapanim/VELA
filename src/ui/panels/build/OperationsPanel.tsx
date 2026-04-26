/**
 * OperationsPanel — Phase 1 (2026-04-25)
 *
 * 입장 정책 (EntryPolicy) 편집 + 라이브 큐 KPI.
 *
 * - 5 모드: unlimited / concurrent-cap / rate-limit / time-slot / hybrid
 * - 모드 전환 시 DEFAULT_POLICY_PARAMS 로 reset, 기존 mode 와 같으면 no-op
 * - 시뮬 진행 중에는 잠금 (정책 도중 변경 = 큐 invariant 깨짐)
 * - 라이브 KPI: 대기 인원 / 최장 대기 / 누적 포기 (entryQueue store slice)
 *
 * 영속화: scenario.simulationConfig.operations.entryPolicy 에 setScenario() 로 저장.
 *
 * 관련 spec: docs/specs/phase-1-operations-policy.md §3
 */

import { useCallback } from 'react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { NumField } from '@/ui/components/ConfigFields';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { SweepLauncher } from './SweepLauncher';
import {
  DEFAULT_OPERATIONS_CONFIG,
  DEFAULT_POLICY_PARAMS,
  EXPERIENCE_MODE_REGISTRY,
  inferExperienceMode,
  type EntryPolicy,
  type EntryPolicyMode,
} from '@/domain';

const MODES: EntryPolicyMode[] = ['unlimited', 'concurrent-cap', 'rate-limit', 'time-slot', 'hybrid'];

export function OperationsPanel() {
  const t = useT();
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);

  const isLocked = phase !== 'idle';
  const ops = scenario?.simulationConfig.operations ?? DEFAULT_OPERATIONS_CONFIG;
  const policy = ops.entryPolicy;

  const writePolicy = useCallback((next: EntryPolicy) => {
    if (!scenario || isLocked) return;
    // Phase 1 (2026-04-25): non-unlimited 정책 + person-mode 조합은
    // generation cap (totalCount) 이 큐 처리량보다 먼저 도달 → "캡 sweep" 의도와 어긋남.
    // 정책 ON 으로 전환하는 순간 simulationMode 가 person 이면 time 으로 자동 flip.
    const currentMode = scenario.simulationConfig.simulationMode ?? 'time';
    const needsModeFlip = next.mode !== 'unlimited' && currentMode === 'person';
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        ...(needsModeFlip ? { simulationMode: 'time' as const } : {}),
        operations: {
          ...DEFAULT_OPERATIONS_CONFIG,
          ...(scenario.simulationConfig.operations ?? {}),
          entryPolicy: next,
        },
      },
    });
  }, [scenario, setScenario, isLocked]);

  const setMode = (mode: EntryPolicyMode) => {
    if (mode === policy.mode) return;
    // 새 모드의 합리적 default 로 초기화 — 사용자가 다시 조정.
    writePolicy(DEFAULT_POLICY_PARAMS[mode]);
  };

  const setField = <K extends keyof EntryPolicy>(key: K, value: EntryPolicy[K]) => {
    writePolicy({ ...policy, [key]: value });
  };

  if (!scenario) return null;

  // ── Phase 1 UX (2026-04-26): 검증 tier 에선 입장 정책 패널 자체를 숨김.
  // 검증 모드들은 모두 `unlimited` 강제 (큐 미발생) 이므로 정책 노브를 노출하면
  // 사용자가 무심코 throttle 모드로 바꿔 검증 invariant 를 깸. 운영 tier 에서만 노출.
  const currentExpMode = scenario.experienceMode
    ?? inferExperienceMode(scenario.simulationConfig.operations?.entryPolicy?.mode);
  if (EXPERIENCE_MODE_REGISTRY[currentExpMode].tier === 'validation') return null;

  // ── 모드별 conditional fields ──
  const showConcurrent = policy.mode === 'concurrent-cap' || policy.mode === 'hybrid';
  const showRate = policy.mode === 'rate-limit';
  const showSlot = policy.mode === 'time-slot' || policy.mode === 'hybrid';
  const showWait = policy.mode !== 'unlimited';

  return (
    <div className="bento-box p-4">
      <h2 className="panel-section mb-3">{t('ops.title')}</h2>

      {isLocked && (
        <p className="text-[9px] text-muted-foreground mb-2 italic">
          {t('ops.lockedHint')}
        </p>
      )}

      {/* ── Mode selector — 5 buttons stacked, with description ── */}
      <CollapsibleSection id="ops-mode" title={t('ops.modeLabel')} defaultOpen>
        <div className="space-y-1">
          {MODES.map((m) => {
            const active = policy.mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={isLocked}
                className={`w-full text-left px-2 py-1.5 rounded-lg border transition-colors disabled:opacity-50
                  ${active
                    ? 'bg-primary/10 border-primary/40 text-foreground'
                    : 'bg-transparent border-border hover:border-primary/30'
                  }`}
              >
                <div className="text-[11px] font-medium">{t(`ops.mode.${m}`)}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                  {t(`ops.mode.${m}.desc`)}
                </div>
              </button>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* ── Policy params (conditional per mode) ── */}
      {policy.mode !== 'unlimited' && (
        <CollapsibleSection id="ops-params" title="Parameters" defaultOpen>
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
            {showWait && (
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
            )}
          </div>

          {/* ── 인내심 분포 모델 토글 + σ (% of mean) 입력 ── */}
          {showWait && (
            <div className="mt-2 px-2 py-1.5 rounded bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] font-medium">{t('ops.patienceModelLabel')}</span>
                <InfoTooltip text={t('ops.patienceModelHint')} />
              </div>
              <div className="grid grid-cols-2 gap-1 mb-1.5">
                <button
                  onClick={() => setField('patienceModel', 'fixed')}
                  disabled={isLocked}
                  className={`px-1.5 py-1 rounded text-[10px] border transition-colors disabled:opacity-50 ${
                    (policy.patienceModel ?? 'fixed') === 'fixed'
                      ? 'bg-primary/15 border-primary/40 text-foreground'
                      : 'bg-transparent border-border hover:border-primary/30'
                  }`}
                >
                  {t('ops.patienceModel.fixed')}
                </button>
                <button
                  onClick={() => setField('patienceModel', 'normal')}
                  disabled={isLocked}
                  className={`px-1.5 py-1 rounded text-[10px] border transition-colors disabled:opacity-50 ${
                    policy.patienceModel === 'normal'
                      ? 'bg-primary/15 border-primary/40 text-foreground'
                      : 'bg-transparent border-border hover:border-primary/30'
                  }`}
                >
                  {t('ops.patienceModel.normal')}
                </button>
              </div>
              {policy.patienceModel === 'normal' && (() => {
                const meanMs = policy.maxWaitBeforeAbandonMs ?? 1_800_000;
                const stdMs = policy.patienceStdMs ?? Math.round(meanMs * 0.3);
                const stdPct = Math.max(1, Math.round((stdMs / meanMs) * 100));
                return (
                  <NumField
                    label={t('ops.field.patienceStdPct')}
                    value={stdPct}
                    onChange={(v) => {
                      const pct = Math.max(1, Math.min(80, Math.round(v)));
                      setField('patienceStdMs', Math.round(meanMs * (pct / 100)));
                    }}
                    disabled={isLocked}
                    step={5}
                  />
                );
              })()}
            </div>
          )}

          {/* ── (선택) 프로필/참여도 배수 opt-in ── */}
          {showWait && (
            <div className="mt-2 px-2 py-1.5 rounded bg-secondary/30 border border-border/50">
              <label className="flex items-start gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.patienceUseModifiers === true}
                  onChange={(e) => setField('patienceUseModifiers', e.target.checked)}
                  disabled={isLocked}
                  className="mt-0.5 cursor-pointer disabled:opacity-50"
                />
                <span className="text-[9px] font-medium leading-tight">
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
          )}
        </CollapsibleSection>
      )}

      {/* ── Phase 1 UX [F2b] (2026-04-26): cap sweep 도구 — 운영 tier 전용 ── */}
      {policy.mode !== 'unlimited' && (
        <div className="mt-3">
          <SweepLauncher />
        </div>
      )}

      {/* ── 라이브 큐 → Experience 탭으로 이동 (Phase 1+, 2026-04-26) ── */}
      <p className="text-[9px] text-muted-foreground italic mt-2">
        {t('ops.liveMovedHint')}
      </p>
    </div>
  );
}
