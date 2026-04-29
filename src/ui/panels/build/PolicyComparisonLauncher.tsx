/**
 * PolicyComparisonLauncher — Phase 1 UX (2026-04-26)
 *
 * SweepLauncher 대체. cap 값 A/B/C 슬롯에 다르게 세팅하고 사용자가 _직접_ 풀
 * 시뮬레이션을 한 슬롯씩 돌려서 결과를 비교. 자동 sweep 의 신뢰성 문제 (5min
 * quick 모드에서 cap 효과 안 드러남) 를 회피하고 _real run_ 데이터만 비교.
 *
 * 동작:
 *   1. 슬롯에 cap 값 입력 → "이 슬롯으로 실행" 클릭 → activePolicySlotId 설정 + scenario.entryPolicy 동기화
 *   2. 사용자가 위쪽 SimulationControls 의 Start 버튼으로 시뮬 실행
 *   3. 시뮬 완료 시 SimulationControls 의 completed hook 이 자동으로 슬롯에 KpiSnapshot 캡처
 *   4. 2개 이상 captured → 비교 모달 활성화
 *
 * 점진 모드: 슬롯 A 캡처 후 추천 카드 자동 노출 — 클릭 한 번에 B/C cap 채워짐.
 */

import { useCallback, useMemo } from 'react';
import { X, Star } from 'lucide-react';
import { useStore } from '@/stores';
import type { PolicySlotId, PolicySlot } from '@/stores';
import { useT } from '@/i18n';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { NumField } from '@/ui/components/ConfigFields';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { useToast } from '@/ui/components/Toast';
import { DEFAULT_OPERATIONS_CONFIG, type EntryPolicy } from '@/domain/types/operations';
import {
  buildPolicyComparison,
  recommendNextCaps,
  decodeReason,
  type PolicyComparison,
  type PolicyMetric,
  type PolicyTone,
} from '@/analytics/policyComparison';

const SLOT_IDS: readonly PolicySlotId[] = ['A', 'B', 'C'];

export function PolicyComparisonLauncher() {
  const t = useT();
  const toast = useToast();
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);
  const entryQueue = useStore((s) => s.entryQueue);

  const policySlots = useStore((s) => s.policySlots);
  const policyMode = useStore((s) => s.policyMode);
  const activePolicySlotId = useStore((s) => s.activePolicySlotId);
  const policyRecommendation = useStore((s) => s.policyRecommendation);

  const setPolicyMode = useStore((s) => s.setPolicyMode);
  const setPolicySlotCap = useStore((s) => s.setPolicySlotCap);
  const setActivePolicySlot = useStore((s) => s.setActivePolicySlot);
  const clearPolicySlot = useStore((s) => s.clearPolicySlot);
  const clearAllPolicySlots = useStore((s) => s.clearAllPolicySlots);
  const setPolicyRecommendation = useStore((s) => s.setPolicyRecommendation);

  const showCompareModal = useStore((s) => s.showPolicyCompareModal);
  const setShowCompareModal = useStore((s) => s.setShowPolicyCompareModal);
  // 슬롯 변경/활성화는 시뮬 진행 중 (running/paused) 에만 잠금.
  // 'completed' 에선 다음 슬롯 활성화 허용 — Start 버튼이 자동 reset 처리.
  const isLocked = phase === 'running' || phase === 'paused';

  const policy = scenario?.simulationConfig.operations?.entryPolicy;
  const currentMode = policy?.mode ?? 'unlimited';

  const capturedCount = useMemo(
    () => SLOT_IDS.filter((id) => policySlots[id].status === 'captured').length,
    [policySlots],
  );

  // 점진 모드 자동 추천 — 슬롯 A 캡처되고 B/C 가 비어있을 때 자동 계산.
  const autoRecommendation = useMemo(() => {
    if (policyMode !== 'progressive') return null;
    if (policyRecommendation) return policyRecommendation; // 이미 발급된 게 있으면 유지
    const slotA = policySlots.A;
    if (slotA.status !== 'captured') return null;
    const bEmpty = policySlots.B.status === 'empty';
    const cEmpty = policySlots.C.status === 'empty';
    if (!bEmpty && !cEmpty) return null;
    return recommendNextCaps({
      basedOnSlot: slotA,
      abandonmentRate: entryQueue.totalArrived > 0
        ? entryQueue.totalAbandoned / entryQueue.totalArrived
        : 0,
    });
  }, [policyMode, policyRecommendation, policySlots, entryQueue]);

  // 슬롯 활성화 — scenario.entryPolicy.maxConcurrent 동기화 + activeSlot 설정.
  const handleActivate = useCallback((slotId: PolicySlotId) => {
    if (!scenario || isLocked) return;
    const slot = policySlots[slotId];
    if (slot.capValue == null) return;
    const ops = scenario.simulationConfig.operations ?? DEFAULT_OPERATIONS_CONFIG;
    const newPolicy: EntryPolicy = { ...ops.entryPolicy, maxConcurrent: slot.capValue };
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        operations: { ...ops, entryPolicy: newPolicy },
      },
    });
    setActivePolicySlot(slotId);
    toast('info', t('policyCompare.activatedToast', { id: slotId, cap: slot.capValue }));
  }, [scenario, setScenario, setActivePolicySlot, policySlots, isLocked, toast, t]);

  const handleApplyRecommendation = useCallback(() => {
    if (!autoRecommendation) return;
    if (policySlots.B.status === 'empty') setPolicySlotCap('B', autoRecommendation.suggestedB);
    if (policySlots.C.status === 'empty') setPolicySlotCap('C', autoRecommendation.suggestedC);
    setPolicyRecommendation(autoRecommendation);
  }, [autoRecommendation, policySlots, setPolicySlotCap, setPolicyRecommendation]);

  const handleDismissRecommendation = useCallback(() => {
    setPolicyRecommendation({
      basedOnSlotId: 'A',
      suggestedB: -1, suggestedC: -1, reasonKey: 'dismissed',
    });
  }, [setPolicyRecommendation]);

  if (!scenario) return null;
  if (currentMode === 'unlimited') return null;

  return (
    <CollapsibleSection id="policy-compare" title={t('policyCompare.title')} defaultOpen={true}>
      <p className="text-[9px] text-muted-foreground mb-2 leading-tight">
        {t('policyCompare.intro')}
      </p>

      {isLocked && (
        <p className="text-[9px] text-amber-400 mb-2 italic">{t('policyCompare.lockedHint')}</p>
      )}

      {/* ── 모드 토글 ── */}
      <div className="flex gap-1 mb-3 p-0.5 rounded-md bg-secondary/40 border border-border">
        {(['progressive', 'preset'] as const).map((m) => {
          const active = policyMode === m;
          return (
            <button
              key={m}
              onClick={() => setPolicyMode(m)}
              disabled={isLocked}
              className={`flex-1 px-2 py-1 rounded text-[10px] transition-colors disabled:opacity-50 ${
                active ? 'bg-primary/15 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`policyCompare.mode.${m}`)}
            </button>
          );
        })}
      </div>

      <p className="text-[9px] text-muted-foreground mb-2 leading-tight">
        {t(`policyCompare.mode.${policyMode}.desc`)}
      </p>

      {/* ── 활성 슬롯 안내 ── */}
      {activePolicySlotId && (
        <div className="mb-2 px-2 py-1.5 rounded bg-primary/10 border border-primary/30 text-[10px] flex items-center justify-between gap-2">
          <span className="text-foreground">{t('policyCompare.activateHint', { id: activePolicySlotId })}</span>
          <button
            onClick={() => setActivePolicySlot(null)}
            className="shrink-0 px-1.5 py-0.5 rounded text-[9px] bg-secondary hover:bg-accent"
          >
            {t('policyCompare.deactivate')}
          </button>
        </div>
      )}

      {/* ── 슬롯 카드 3개 ── */}
      <div className="space-y-1.5 mb-3">
        {SLOT_IDS.map((id) => (
          <SlotCard
            key={id}
            slotId={id}
            slot={policySlots[id]}
            isActive={activePolicySlotId === id}
            isLocked={isLocked}
            onCapChange={(v) => setPolicySlotCap(id, v)}
            onActivate={() => handleActivate(id)}
            onClear={() => clearPolicySlot(id)}
          />
        ))}
      </div>

      {/* ── 점진 모드 추천 카드 ── */}
      {autoRecommendation && autoRecommendation.suggestedB > 0 && (
        <RecommendationCard
          slotId={autoRecommendation.basedOnSlotId}
          suggestedB={autoRecommendation.suggestedB}
          suggestedC={autoRecommendation.suggestedC}
          reasonKey={autoRecommendation.reasonKey}
          onApply={handleApplyRecommendation}
          onDismiss={handleDismissRecommendation}
        />
      )}

      {/* ── 액션 row ── */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setShowCompareModal(true)}
          disabled={capturedCount < 2}
          className="flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium bg-primary/15 text-foreground border border-primary/30 hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed"
          title={capturedCount < 2 ? t('policyCompare.compareDisabled') : undefined}
        >
          {t('policyCompare.viewCompare', { count: capturedCount })}
        </button>
        <button
          onClick={clearAllPolicySlots}
          disabled={isLocked || capturedCount === 0}
          className="px-2 py-1.5 rounded-md text-[10px] bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-40"
        >
          {t('policyCompare.clearAll')}
        </button>
      </div>

      {!activePolicySlotId && capturedCount === 0 && (
        <p className="text-[9px] text-muted-foreground italic mt-2">{t('policyCompare.runHint')}</p>
      )}

      {showCompareModal && (
        <ComparisonModal
          slots={policySlots}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </CollapsibleSection>
  );
}

function SlotCard({
  slotId, slot, isActive, isLocked, onCapChange, onActivate, onClear,
}: {
  slotId: PolicySlotId;
  slot: PolicySlot;
  isActive: boolean;
  isLocked: boolean;
  onCapChange: (v: number) => void;
  onActivate: () => void;
  onClear: () => void;
}) {
  const t = useT();
  const captured = slot.status === 'captured';
  const ringClass = isActive
    ? 'ring-1 ring-primary/50 border-primary/40'
    : captured
      ? 'border-amber-500/30'
      : 'border-border';

  return (
    <div className={`rounded-md border bg-secondary/20 p-2 ${ringClass}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-foreground">
            {t('policyCompare.slot.label', { id: slotId })}
          </span>
          {isActive && (
            <span className="px-1 py-0.5 rounded text-[8px] font-medium bg-primary/20 text-primary border border-primary/30">
              {t('policyCompare.slot.activeBadge')}
            </span>
          )}
          {captured && (
            <span className="px-1 py-0.5 rounded text-[8px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {t('policyCompare.slot.captured')}
            </span>
          )}
        </div>
        {(slot.capValue != null || captured) && (
          <button
            onClick={onClear}
            disabled={isLocked}
            className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30"
            title={t('policyCompare.clear')}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <NumField
            label={t('policyCompare.slot.capLabel')}
            value={slot.capValue ?? 0}
            onChange={(v) => onCapChange(Math.max(0, Math.round(v)))}
            disabled={isLocked || captured}
            step={10}
          />
        </div>
        <button
          onClick={onActivate}
          disabled={isLocked || slot.capValue == null || slot.capValue <= 0 || isActive || captured}
          className="shrink-0 mb-[1px] px-2 py-1 rounded text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('policyCompare.activate')}
        </button>
      </div>

      {captured && slot.snapshot && (
        <div className="mt-2 grid grid-cols-3 gap-1 text-[9px]">
          <MiniKpi
            label={t('policyCompare.col.complete')}
            value={`${(slot.snapshot.flowEfficiency.completionRate * 100).toFixed(0)}%`}
          />
          <MiniKpi
            label={t('policyCompare.col.peak')}
            value={`${(pickPeak(slot) * 100).toFixed(0)}%`}
          />
          <MiniKpi
            label="Spawn"
            value={`${slot.totalSpawned ?? 0}`}
          />
        </div>
      )}
    </div>
  );
}

function pickPeak(slot: PolicySlot): number {
  if (!slot.snapshot) return 0;
  let max = 0;
  for (const z of slot.snapshot.zoneUtilizations) {
    const r = z.capacity > 0 ? z.peakOccupancy / z.capacity : z.ratio;
    if (r > max) max = r;
  }
  return max;
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bento-box-elevated px-1 py-0.5 text-center">
      <div className="text-[10px] font-data font-semibold text-foreground tabular-nums">{value}</div>
      <div className="text-[8px] text-muted-foreground uppercase truncate">{label}</div>
    </div>
  );
}

function RecommendationCard({
  slotId, suggestedB, suggestedC, reasonKey, onApply, onDismiss,
}: {
  slotId: PolicySlotId;
  suggestedB: number;
  suggestedC: number;
  reasonKey: string;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const decoded = decodeReason(reasonKey);
  return (
    <div className="mb-3 px-2 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px]">
      <div className="flex items-center gap-1.5 mb-1">
        <Star className="w-3 h-3 text-amber-400" />
        <span className="font-medium text-amber-400">
          {t('policyCompare.recommendTitle', { id: slotId })}
        </span>
      </div>
      <p className="text-foreground/80 mb-2 leading-tight">
        {t(decoded.key, decoded.params)}
      </p>
      <div className="flex gap-1.5">
        <button
          onClick={onApply}
          className="flex-1 px-2 py-1 rounded bg-amber-500 text-white font-medium hover:bg-amber-600 text-[10px]"
        >
          {t('policyCompare.recommendApply', { B: suggestedB, C: suggestedC })}
        </button>
        <button
          onClick={onDismiss}
          className="px-2 py-1 rounded text-[10px] bg-secondary text-secondary-foreground hover:bg-accent"
        >
          {t('policyCompare.recommendDismiss')}
        </button>
      </div>
    </div>
  );
}

function ComparisonModal({
  slots, onClose,
}: {
  slots: { A: PolicySlot; B: PolicySlot; C: PolicySlot };
  onClose: () => void;
}) {
  const t = useT();
  const comparison: PolicyComparison = useMemo(() => buildPolicyComparison(slots), [slots]);
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{t('policyCompare.modalTitle')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            aria-label={t('policyCompare.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <ComparisonMatrix comparison={comparison} slots={slots} />
        </div>
      </div>
    </div>
  );
}

function ComparisonMatrix({
  comparison, slots,
}: {
  comparison: PolicyComparison;
  slots: { A: PolicySlot; B: PolicySlot; C: PolicySlot };
}) {
  const t = useT();
  const captured = comparison.slots.filter((r) => r.hasResult);
  if (captured.length < 2) {
    return <p className="text-[12px] text-muted-foreground">{t('policyCompare.noResults')}</p>;
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-secondary/40">
            <tr>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap text-muted-foreground">KPI</th>
              {comparison.slots.map((row) => (
                <th
                  key={row.slotId}
                  className={`text-right px-3 py-2 font-medium whitespace-nowrap ${
                    comparison.overallWinnerSlotId === row.slotId
                      ? 'text-amber-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {t('policyCompare.slot.label', { id: row.slotId })}
                  {row.capValue != null && (
                    <span className="ml-1 text-[9px] text-foreground/70 font-data">cap={row.capValue}</span>
                  )}
                  {comparison.overallWinnerSlotId === row.slotId && (
                    <span className="ml-1 text-amber-400">★</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.metrics.map((metric) => (
              <MetricRow key={metric.key} metric={metric} />
            ))}
            <tr className="bg-secondary/20">
              <td className="px-3 py-2 text-[10px] text-muted-foreground italic">Spawn / Exit</td>
              {comparison.slots.map((row) => {
                const slot = slots[row.slotId];
                return (
                  <td key={row.slotId} className="px-3 py-2 text-right text-[10px] text-muted-foreground tabular-nums">
                    {slot.snapshot
                      ? `${slot.totalSpawned ?? 0} / ${slot.totalExited ?? 0}`
                      : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricRow({ metric }: { metric: PolicyMetric }) {
  const t = useT();
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 font-medium whitespace-nowrap text-foreground">
        {t(`policyCompare.col.${metric.key}` as const)}
      </td>
      {metric.values.map((cell) => {
        const isWinner = metric.winnerSlotId === cell.slotId;
        return (
          <td
            key={cell.slotId}
            className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${toneClass(cell.tone)} ${
              isWinner ? 'font-semibold' : ''
            }`}
          >
            {cell.display}
            {isWinner && <span className="ml-1 text-amber-400">★</span>}
          </td>
        );
      })}
    </tr>
  );
}

function toneClass(tone: PolicyTone): string {
  if (tone === 'ok') return 'text-[var(--status-success)]';
  if (tone === 'warn') return 'text-[var(--status-warning)]';
  if (tone === 'bad') return 'text-[var(--status-danger)]';
  return 'text-foreground';
}
