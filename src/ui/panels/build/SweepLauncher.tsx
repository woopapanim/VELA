/**
 * SweepLauncher — Phase 1 UX [F2b] (2026-04-26)
 *
 * 운영 tier 모드에서 cap 파라미터를 직접 sweep 해보고 만족도 최적값을
 * 추천받는 UI 패널. OperationsPanel 안에 collapsible 로 마운트.
 *
 * 흐름:
 *   1. 사용자가 sweep 대상 파라미터 선택 (현재 policy.mode 와 호환되는 후보만 노출)
 *   2. range (from, to, step) 입력 → values list 미리보기
 *   3. [Run sweep] → SweepRunner.runSweep() async
 *   4. 진척: "Variant 3/6 — maxConcurrent=20 (running, 4:30 / 10:00)"
 *   5. 결과 테이블 + 추천 banner + [Apply recommended] 한 클릭으로 정책 반영
 *
 * 시뮬 진행 중에는 sweep 비활성 (engine 인스턴스 충돌 + 결과 신뢰성 낮음).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { NumField } from '@/ui/components/ConfigFields';
import {
  runSweep,
  type SweepResult,
  type SweepProgress,
  type SweepParameterKey,
} from '@/analytics/sweep';
import type { EntryPolicy } from '@/domain';

const PARAM_OPTIONS: Record<SweepParameterKey, {
  label: string;
  modes: ReadonlyArray<EntryPolicy['mode']>;
  defaultRange: { from: number; to: number; step: number };
}> = {
  maxConcurrent: {
    label: 'maxConcurrent',
    modes: ['concurrent-cap', 'hybrid'],
    defaultRange: { from: 50, to: 300, step: 50 },
  },
  perSlotCap: {
    label: 'perSlotCap',
    modes: ['time-slot', 'hybrid'],
    defaultRange: { from: 20, to: 120, step: 20 },
  },
  maxPerHour: {
    label: 'maxPerHour',
    modes: ['rate-limit'],
    defaultRange: { from: 60, to: 360, step: 60 },
  },
};

const QUICK_DURATION_MS = 5 * 60_000;
const MS_MIN = 60_000;

export function SweepLauncher() {
  const t = useT();
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);
  const waypointGraph = useStore((s) => s.waypointGraph);

  const isLocked = phase !== 'idle';
  const policy = scenario?.simulationConfig.operations?.entryPolicy;
  const currentMode = policy?.mode ?? 'unlimited';

  // 호환 가능한 param 후보 — 정책 모드와 매칭되는 것만.
  const availableParams = useMemo(() => {
    return (Object.entries(PARAM_OPTIONS) as Array<[SweepParameterKey, typeof PARAM_OPTIONS[SweepParameterKey]]>)
      .filter(([, info]) => info.modes.includes(currentMode))
      .map(([key]) => key);
  }, [currentMode]);

  const [paramKey, setParamKey] = useState<SweepParameterKey>(availableParams[0] ?? 'maxConcurrent');
  const [from, setFrom] = useState(PARAM_OPTIONS[paramKey].defaultRange.from);
  const [to, setTo] = useState(PARAM_OPTIONS[paramKey].defaultRange.to);
  const [step, setStep] = useState(PARAM_OPTIONS[paramKey].defaultRange.step);
  const [useQuickDuration, setUseQuickDuration] = useState(true);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SweepProgress | null>(null);
  const [result, setResult] = useState<SweepResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Param key 전환 시 range default 로 리셋 (이전 값이 무관 단위라 위험).
  const onChangeParam = useCallback((next: SweepParameterKey) => {
    setParamKey(next);
    const def = PARAM_OPTIONS[next].defaultRange;
    setFrom(def.from);
    setTo(def.to);
    setStep(def.step);
    setResult(null);
  }, []);

  const values = useMemo(() => {
    const out: number[] = [];
    if (step <= 0 || from > to) return out;
    for (let v = from; v <= to + 1e-6; v += step) out.push(Math.round(v));
    return out;
  }, [from, to, step]);

  const canRun = !!scenario && !isLocked && !running && availableParams.length > 0 && values.length >= 2;

  const handleRun = useCallback(async () => {
    if (!canRun || !scenario) return;
    setRunning(true);
    setResult(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await runSweep({
        baseScenario: scenario,
        waypointGraph: waypointGraph ?? undefined,
        parameter: { key: paramKey, values },
        durationMsOverride: useQuickDuration ? QUICK_DURATION_MS : undefined,
        onProgress: (p) => setProgress(p),
        signal: ctrl.signal,
      });
      setResult(res);
    } catch (err) {
      console.error('Sweep failed', err);
      alert(`Sweep failed: ${(err as Error)?.message ?? 'unknown'}`);
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  }, [canRun, scenario, waypointGraph, paramKey, values, useQuickDuration]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleApplyRecommended = useCallback(() => {
    if (!scenario || !result || result.recommendedValue == null || isLocked) return;
    const ops = scenario.simulationConfig.operations!;
    const newPolicy: EntryPolicy = { ...ops.entryPolicy, [paramKey]: result.recommendedValue };
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        operations: { ...ops, entryPolicy: newPolicy },
      },
    });
  }, [scenario, result, paramKey, setScenario, isLocked]);

  if (!scenario) return null;
  if (currentMode === 'unlimited') return null; // unlimited 정책엔 sweep 할 게 없음

  return (
    <CollapsibleSection id="ops-sweep" title={t('sweep.title')} defaultOpen={false}>
      <p className="text-[9px] text-muted-foreground mb-2 leading-tight whitespace-pre-line">
        {t('sweep.intro')}
      </p>

      {availableParams.length === 0 ? (
        <p className="text-[10px] text-amber-700">{t('sweep.noParamForMode')}</p>
      ) : (
        <>
          {/* ── 파라미터 선택 ── */}
          <div className="mb-2">
            <div className="text-[9px] text-muted-foreground mb-1">{t('sweep.paramLabel')}</div>
            <div className="flex gap-1 flex-wrap">
              {availableParams.map((k) => (
                <button
                  key={k}
                  onClick={() => onChangeParam(k)}
                  disabled={isLocked || running}
                  className={`px-2 py-1 rounded text-[10px] border transition-colors disabled:opacity-50 ${
                    paramKey === k
                      ? 'bg-primary/15 border-primary/40 text-foreground'
                      : 'bg-transparent border-border hover:border-primary/30'
                  }`}
                >
                  {PARAM_OPTIONS[k].label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Range 입력 ── */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <NumField
              label={t('sweep.from')}
              value={from}
              onChange={(v) => setFrom(Math.max(1, Math.round(v)))}
              disabled={isLocked || running}
              step={10}
            />
            <NumField
              label={t('sweep.to')}
              value={to}
              onChange={(v) => setTo(Math.max(from, Math.round(v)))}
              disabled={isLocked || running}
              step={10}
            />
            <NumField
              label={t('sweep.step')}
              value={step}
              onChange={(v) => setStep(Math.max(1, Math.round(v)))}
              disabled={isLocked || running}
              step={5}
            />
          </div>

          <div className="text-[9px] text-muted-foreground mb-2">
            {t('sweep.preview', { count: values.length, list: values.slice(0, 8).join(', ') + (values.length > 8 ? ', …' : '') })}
          </div>

          {/* ── 빠른 미리보기 토글 ── */}
          <label className="flex items-center gap-1.5 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useQuickDuration}
              onChange={(e) => setUseQuickDuration(e.target.checked)}
              disabled={isLocked || running}
              className="cursor-pointer disabled:opacity-50"
            />
            <span className="text-[10px]">{t('sweep.quickDuration')}</span>
            <span className="text-[9px] text-muted-foreground">
              ({useQuickDuration ? '5min' : `${Math.round(scenario.simulationConfig.duration / MS_MIN)}min`})
            </span>
          </label>

          {/* ── Run / Stop 버튼 ── */}
          <div className="flex gap-2 mb-3">
            {!running ? (
              <button
                onClick={handleRun}
                disabled={!canRun}
                className="flex-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
              >
                {t('sweep.runBtn', { count: values.length })}
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="flex-1 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-[11px] font-medium hover:bg-destructive/90"
              >
                {t('sweep.stopBtn')}
              </button>
            )}
          </div>

          {/* ── 진척 표시 ── */}
          {running && progress && (
            <div className="mb-3 p-2 rounded bg-secondary/40 border border-border/50">
              <div className="text-[10px] font-medium mb-1">
                {t('sweep.progress.variant', { idx: progress.index + 1, total: progress.total, label: progress.currentLabel })}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {t(`sweep.progress.phase.${progress.phase}`)}
                {progress.phase === 'running' && (
                  <span> · {Math.round(progress.simElapsedMs / 1000)}s / {Math.round(progress.simDurationMs / 1000)}s</span>
                )}
              </div>
              {/* progress bar */}
              <div className="mt-1 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.round(((progress.index + (progress.simElapsedMs / progress.simDurationMs)) / progress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── 결과 ── */}
          {result && <SweepResultsView result={result} onApply={handleApplyRecommended} canApply={!isLocked} />}
        </>
      )}
    </CollapsibleSection>
  );
}

function SweepResultsView({
  result,
  onApply,
  canApply,
}: {
  result: SweepResult;
  onApply: () => void;
  canApply: boolean;
}) {
  const t = useT();

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* 추천 banner */}
      {result.recommendedValue != null && (
        <div className="px-2 py-1.5 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between">
          <div className="text-[10px]">
            <span className="font-bold text-amber-800 mr-1">★ {t('sweep.recommended')}:</span>
            <span className="font-medium">{result.parameter.key}={result.recommendedValue}</span>
            <span className="text-amber-700 ml-1">
              ({t(`sweep.recommendKey.${result.recommendationKey}`)})
            </span>
          </div>
          <button
            onClick={onApply}
            disabled={!canApply}
            className="px-2 py-0.5 rounded text-[9px] bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {t('sweep.apply')}
          </button>
        </div>
      )}
      {result.recommendedValue == null && (
        <div className="px-2 py-1.5 bg-secondary/40 border-b border-border text-[10px] text-muted-foreground">
          {t(`sweep.recommendKey.${result.recommendationKey}`)}
        </div>
      )}

      {/* Result table */}
      <table className="w-full text-[9px]">
        <thead className="bg-secondary/30">
          <tr>
            <th className="text-left px-1.5 py-1 font-medium">{result.parameter.key}</th>
            <th className="text-right px-1.5 py-1 font-medium">{t('sweep.col.satisfaction')}</th>
            <th className="text-right px-1.5 py-1 font-medium">{t('sweep.col.wait')}</th>
            <th className="text-right px-1.5 py-1 font-medium">{t('sweep.col.abandon')}</th>
            <th className="text-right px-1.5 py-1 font-medium">{t('sweep.col.peak')}</th>
            <th className="text-right px-1.5 py-1 font-medium">{t('sweep.col.complete')}</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => {
            const isWinner = row.paramValue === result.recommendedValue;
            return (
              <tr
                key={row.paramValue}
                className={isWinner ? 'bg-yellow-50' : 'hover:bg-secondary/20'}
              >
                <td className="px-1.5 py-1 font-medium">
                  {row.paramValue}
                  {isWinner && <span className="ml-1 text-amber-700">★</span>}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {(row.satisfactionAvg * 100).toFixed(0)}%
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {Math.round(row.recentAdmitAvgWaitMs / MS_MIN)}m
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {(row.abandonmentRate * 100).toFixed(0)}%
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {(row.peakUtilRatio * 100).toFixed(0)}%
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {(row.completionRate * 100).toFixed(0)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="px-2 py-1 text-[8px] text-muted-foreground italic border-t border-border">
        {t('sweep.elapsed', { sec: Math.round(result.elapsedWallMs / 1000) })}
        {result.aborted && ' · ' + t('sweep.abortedNote')}
      </div>
    </div>
  );
}
