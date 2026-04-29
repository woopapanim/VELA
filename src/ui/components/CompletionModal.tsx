import { useEffect, useState } from 'react';
import { Trophy, X, FileText, BarChart3, Play, ArrowRight } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { recommendNextCaps } from '@/analytics/policyComparison';
import { DEFAULT_OPERATIONS_CONFIG, type EntryPolicy } from '@/domain/types/operations';
import type { PolicySlotId } from '@/stores';

const SLOT_ORDER: readonly PolicySlotId[] = ['A', 'B', 'C'];

export function CompletionModal() {
  const t = useT();
  const phase = useStore((s) => s.phase);
  const timeState = useStore((s) => s.timeState);
  const policySlots = useStore((s) => s.policySlots);
  const policyMode = useStore((s) => s.policyMode);
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const setPolicySlotCap = useStore((s) => s.setPolicySlotCap);
  const setActivePolicySlot = useStore((s) => s.setActivePolicySlot);
  const setShowFullReport = useStore((s) => s.setShowFullReport);
  const setShowPolicyCompareModal = useStore((s) => s.setShowPolicyCompareModal);
  const entryQueue = useStore((s) => s.entryQueue);

  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (phase === 'completed' && !dismissed) {
      setShow(true);
    }
    // 새 시뮬 시작 시 (running) 또는 명시적 stop (idle) 둘 다 dismissed 리셋
    // — 그래야 A→B→C 시퀀스에서 매 완료마다 모달이 다시 뜸.
    if (phase === 'idle' || phase === 'running') {
      setDismissed(false);
      setShow(false);
    }
  }, [phase, dismissed]);

  if (!show) return null;

  const mins = Math.floor(timeState.elapsed / 60000);
  const capturedCount = SLOT_ORDER.filter((id) => policySlots[id].status === 'captured').length;
  const nextEmptySlotId = SLOT_ORDER.find((id) => policySlots[id].status !== 'captured') ?? null;
  const isPolicyComparisonMode =
    (scenario?.simulationConfig.operations?.entryPolicy.mode ?? 'unlimited') !== 'unlimited';

  // 점진 모드 + 슬롯 A 캡처됐고 다음 빈 슬롯 있으면 → 추천값 계산
  const nextRecommendation =
    policyMode === 'progressive' &&
    policySlots.A.status === 'captured' &&
    nextEmptySlotId != null
      ? recommendNextCaps({
          basedOnSlot: policySlots.A,
          abandonmentRate: entryQueue.totalArrived > 0
            ? entryQueue.totalAbandoned / entryQueue.totalArrived
            : 0,
        })
      : null;

  const close = () => { setShow(false); setDismissed(true); };

  const handleViewReport = () => {
    setShowFullReport(true);
    close();
  };

  const handleViewCompare = () => {
    setShowPolicyCompareModal(true);
    close();
  };

  // 다음 슬롯 자동 활성화 (점진 모드 추천값 사용)
  const handleContinueAnalysis = () => {
    if (!scenario || !nextEmptySlotId || !nextRecommendation) return;
    const cap = nextEmptySlotId === 'B'
      ? nextRecommendation.suggestedB
      : nextRecommendation.suggestedC;
    setPolicySlotCap(nextEmptySlotId, cap);
    const ops = scenario.simulationConfig.operations ?? DEFAULT_OPERATIONS_CONFIG;
    const newPolicy: EntryPolicy = { ...ops.entryPolicy, maxConcurrent: cap };
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        operations: { ...ops, entryPolicy: newPolicy },
      },
    });
    setActivePolicySlot(nextEmptySlotId);
    close();
  };

  // CTA 분기 결정
  const showContinueCta =
    isPolicyComparisonMode &&
    policyMode === 'progressive' &&
    capturedCount >= 1 &&
    capturedCount < 3 &&
    nextEmptySlotId != null &&
    nextRecommendation != null;
  const showCompareCta = isPolicyComparisonMode && capturedCount >= 2;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="glass rounded-2xl border border-border shadow-2xl w-[28rem] max-w-full overflow-hidden">
        <div className="bg-primary/10 p-6 text-center relative">
          <button
            onClick={close}
            className="absolute top-3 right-3 p-1 rounded hover:bg-secondary"
            aria-label={t('completionModal.close')}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{t('completionModal.title')}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t('completionModal.duration', { mins })}</p>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-[11px] text-muted-foreground text-center">
            {t('completionModal.nextStep')}
          </p>

          {/* ── 점진 모드 — 다음 슬롯으로 분석 계속 ── */}
          {showContinueCta && nextRecommendation && nextEmptySlotId && (
            <button
              onClick={handleContinueAnalysis}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Play className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-[12px] font-medium">
                    {t('completionModal.continueAnalysis', {
                      slot: nextEmptySlotId,
                      cap: nextEmptySlotId === 'B' ? nextRecommendation.suggestedB : nextRecommendation.suggestedC,
                    })}
                  </div>
                  <div className="text-[10px] text-foreground/60">
                    {t('completionModal.continueAnalysisHint', { count: capturedCount })}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>
          )}

          {/* ── 비교 결과 보기 (2개 이상 캡처됐을 때) ── */}
          {showCompareCta && (
            <button
              onClick={handleViewCompare}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-[12px] font-medium">
                    {t('completionModal.viewCompare', { count: capturedCount })}
                  </div>
                  <div className="text-[10px] text-foreground/60">
                    {t('completionModal.viewCompareHint')}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>
          )}

          {/* ── 항상 표시 — 상세 리포트 ── */}
          <button
            onClick={handleViewReport}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4" />
              <div className="text-left">
                <div className="text-[12px] font-medium">{t('completionModal.viewReport')}</div>
                <div className="text-[10px] text-foreground/60">{t('completionModal.viewReportHint')}</div>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={close}
            className="w-full px-4 py-2 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            {t('completionModal.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
