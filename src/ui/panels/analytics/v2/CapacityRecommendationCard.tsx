import { useState, useRef, useCallback } from 'react';
import { Gauge, Info, ChevronDown, Play, Loader2, X } from 'lucide-react';
import type { CapacityRecommendation } from '@/analytics/recommendations/capacityRecommendation';
import {
  sweepCapacity,
  type SweepInput,
  type SweepVariant,
  type SweepVariantResult,
} from '@/analytics/recommendations/sweepCapacity';
import { STATUS_BG, STATUS_BAR } from './DrilldownShared';

interface Props {
  recommendation: CapacityRecommendation;
  sweepInput?: Omit<SweepInput, 'recommendedConcurrent'> | null;
}

interface SweepUiState {
  status: 'idle' | 'running' | 'done' | 'error';
  variantIdx: number;            // 현재/마지막 variant (0-based)
  variantLabel: string;
  variantProgress: number;       // 0~1
  results: readonly SweepVariantResult[];
  errorMessage: string | null;
}

function formatTime(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export function CapacityRecommendationCard({ recommendation, sweepInput }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sweep, setSweep] = useState<SweepUiState>({
    status: 'idle',
    variantIdx: 0,
    variantLabel: '',
    variantProgress: 0,
    results: [],
    errorMessage: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const {
    totalAreaM2,
    perPersonTargetM2,
    recommendedConcurrent,
    currentPolicyMode,
    currentPolicyMaxConcurrent,
    observedPeakConcurrent,
    observedPeakAtMs,
    observedAvgConcurrent,
    utilizationVsRecommended,
    policyVsRecommended,
    status,
    reading,
    hasObservedData,
    kneePoint,
  } = recommendation;

  const kneeVsRec = kneePoint && !kneePoint.noBreakObserved && recommendedConcurrent > 0
    ? kneePoint.concurrent / recommendedConcurrent
    : null;

  const utilPct = recommendedConcurrent > 0
    ? Math.min(100, Math.round((observedPeakConcurrent / recommendedConcurrent) * 100))
    : 0;

  const sweepReady = sweepInput !== null && sweepInput !== undefined && recommendedConcurrent > 0;
  const sweepRunning = sweep.status === 'running';

  const startSweep = useCallback(async () => {
    if (!sweepInput || recommendedConcurrent <= 0) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSweep({
      status: 'running', variantIdx: 0, variantLabel: '',
      variantProgress: 0, results: [], errorMessage: null,
    });
    try {
      const results = await sweepCapacity(
        { ...sweepInput, recommendedConcurrent },
        {
          onVariantStart: (v: SweepVariant, idx) => {
            setSweep((prev) => ({
              ...prev,
              variantIdx: idx,
              variantLabel: v.label,
              variantProgress: 0,
            }));
          },
          onVariantProgress: (_v, _idx, progress) => {
            setSweep((prev) => ({ ...prev, variantProgress: progress }));
          },
          abortSignal: ctrl.signal,
        },
      );
      if (!ctrl.signal.aborted) {
        setSweep({
          status: 'done', variantIdx: results.length - 1,
          variantLabel: '', variantProgress: 1,
          results, errorMessage: null,
        });
      }
    } catch (e) {
      setSweep((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      abortRef.current = null;
    }
  }, [sweepInput, recommendedConcurrent]);

  const cancelSweep = useCallback(() => {
    abortRef.current?.abort();
    setSweep({
      status: 'idle', variantIdx: 0, variantLabel: '',
      variantProgress: 0, results: [], errorMessage: null,
    });
  }, []);

  return (
    <section className="rounded-xl border border-border bg-[var(--surface)] p-3 space-y-2.5">
      <header className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-3.5 h-3.5 text-primary flex-shrink-0" aria-hidden />
            <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
              운영 권장 — 동시 수용인원
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 flex-shrink-0">
              산식 즉답
            </span>
          </div>
          <p className="text-[12px] text-foreground/85 leading-snug">{reading}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          aria-label={expanded ? '접기' : '펼치기'}
          aria-expanded={expanded}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </header>

      {/* 핵심 4 수치 — 권장 / 정책 / 관측 / knee */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <NumberTile
          label="권장"
          value={recommendedConcurrent}
          unit="명"
          accent="good"
          sub={`${Math.round(totalAreaM2)}m² ÷ ${perPersonTargetM2}m²/인`}
        />
        <NumberTile
          label="현재 정책"
          value={currentPolicyMaxConcurrent}
          unit="명"
          accent={
            policyVsRecommended === null
              ? 'unknown'
              : policyVsRecommended > 1.0
                ? 'bad'
                : policyVsRecommended > 0.9
                  ? 'warn'
                  : 'good'
          }
          sub={
            currentPolicyMode === null
              ? '미설정'
              : currentPolicyMode === 'unlimited'
                ? '무제한'
                : policyVsRecommended !== null
                  ? `권장의 ${Math.round(policyVsRecommended * 100)}%`
                  : currentPolicyMode
          }
        />
        <NumberTile
          label="관측 peak"
          value={hasObservedData ? observedPeakConcurrent : null}
          unit="명"
          accent={
            !hasObservedData
              ? 'unknown'
              : utilizationVsRecommended > 1.0
                ? 'bad'
                : utilizationVsRecommended > 0.7
                  ? 'warn'
                  : 'good'
          }
          sub={
            hasObservedData
              ? `${formatTime(observedPeakAtMs)} 시점 · 권장의 ${Math.round(utilizationVsRecommended * 100)}%`
              : '데이터 없음'
          }
        />
        <NumberTile
          label="관측 knee"
          value={
            kneePoint === null
              ? null
              : kneePoint.noBreakObserved
                ? null
                : kneePoint.concurrent
          }
          unit="명"
          accent={
            kneePoint === null
              ? 'unknown'
              : kneePoint.noBreakObserved
                ? 'good'
                : kneeVsRec !== null && kneeVsRec < 0.85
                  ? 'warn'
                  : 'good'
          }
          sub={
            kneePoint === null
              ? '데이터 없음'
              : kneePoint.noBreakObserved
                ? `${kneePoint.maxObservedConcurrent}명까지 정체 없음`
                : `${formatTime(kneePoint.atTimeMs)} · ratio ${Math.round(kneePoint.maxZoneRatio * 100)}%`
          }
        />
      </div>

      {/* 활용도 bar (관측 vs 권장) */}
      {hasObservedData && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>활용도 (peak / 권장)</span>
            <span className="font-data tabular-nums">
              {Math.round(utilizationVsRecommended * 100)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden relative">
            <div
              className={`h-full ${STATUS_BAR[status]} transition-all`}
              style={{ width: `${utilPct}%` }}
            />
            {/* 100% 권장선 — bar 너비 자체가 100% 까지만 그려지므로 100% 도달 시점이 끝지점.
                권장 초과는 status=bad 색으로 alone 표시. */}
          </div>
          <div className="flex items-center justify-between text-[9px] text-muted-foreground/60 font-data tabular-nums mt-0.5">
            <span>0</span>
            <span>평균 {Math.round(observedAvgConcurrent)}명</span>
            <span>권장 {recommendedConcurrent}명</span>
          </div>
        </div>
      )}

      {/* 펼치기 — 산식 출처 + 추가 설명 */}
      {expanded && (
        <div className="pt-2 border-t border-border/40 space-y-1.5 text-[11px] text-foreground/85 leading-relaxed">
          <div className="flex items-start gap-1.5">
            <Info className="w-3 h-3 text-primary/80 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <div className="font-medium mb-0.5">산식 — total area ÷ 1.5m²/인</div>
              <p className="text-muted-foreground">
                NFPA 101 / WELL Building Standard 의 인파 안전 기준. 1.5m² 미만은 체감 정체,
                1.0m² 미만은 위험 수준으로 분류됩니다. 본 권장은 floor-level 동시 수용 상한 가이드입니다.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Info className="w-3 h-3 text-primary/80 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <div className="font-medium mb-0.5">관측 peak 의 의미</div>
              <p className="text-muted-foreground">
                kpiHistory 의 모든 timestep 에서 zone 별 currentOccupancy 의 합 — 그 중 max.
                권장 대비 70% 이상이면 정체 가능, 100% 초과는 동선 분산 또는 entry policy 검토 신호입니다.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Info className="w-3 h-3 text-primary/80 flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <div className="font-medium mb-0.5">관측 knee 의 의미</div>
              <p className="text-muted-foreground">
                실제 run 에서 zone ratio (currentOccupancy / capacity) 가 처음 70% 를 넘은 시점의 동시 인원.
                산식(NFPA) 은 면적 기반 안전 상한, knee 는 이 시나리오 고유의 동선·미디어 부하가 만든 한계.
                knee 가 산식보다 작으면 동선/배치 병목, 크면 면적 기준이 보수적임을 의미합니다.
              </p>
            </div>
          </div>
          {!hasObservedData && (
            <p className="text-muted-foreground italic">
              관측 데이터 없음 — 시뮬레이션 실행 후 정책 적정성을 검증할 수 있습니다.
            </p>
          )}
        </div>
      )}

      {/* Step 4c — Capacity sweep (3 variants) */}
      {sweepReady && (
        <div className="pt-2 border-t border-border/40 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-foreground/90">
                Sweep — 3 variant 자동 비교
              </div>
              <div className="text-[10px] text-muted-foreground/80 leading-tight">
                보수(80%) · 권장(100%) · 공격(120%) — 같은 visitor mix · person 모드
              </div>
            </div>
            {sweep.status === 'idle' && (
              <button
                type="button"
                onClick={startSweep}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
              >
                <Play className="w-3 h-3" aria-hidden />
                Sweep 실행
              </button>
            )}
            {sweep.status === 'running' && (
              <button
                type="button"
                onClick={cancelSweep}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-[11px] font-medium hover:bg-destructive/20 transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3" aria-hidden />
                중단
              </button>
            )}
            {(sweep.status === 'done' || sweep.status === 'error') && (
              <button
                type="button"
                onClick={startSweep}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-[11px] font-medium hover:bg-secondary transition-colors flex-shrink-0"
              >
                <Play className="w-3 h-3" aria-hidden />
                다시 실행
              </button>
            )}
          </div>

          {sweepRunning && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin text-primary" aria-hidden />
                <span>
                  {sweep.variantIdx + 1}/3 · {sweep.variantLabel || '준비 중'}
                </span>
                <span className="ml-auto font-data tabular-nums">
                  {Math.round(sweep.variantProgress * 100)}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${
                      ((sweep.variantIdx + sweep.variantProgress) / 3) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {sweep.status === 'error' && (
            <p className="text-[11px] text-destructive">
              Sweep 실패: {sweep.errorMessage ?? '알 수 없는 오류'}
            </p>
          )}

          {sweep.status === 'done' && sweep.results.length > 0 && (
            <SweepResultsTable
              results={sweep.results}
              recommendedConcurrent={recommendedConcurrent}
            />
          )}
        </div>
      )}
    </section>
  );
}

function SweepResultsTable({
  results, recommendedConcurrent,
}: {
  results: readonly SweepVariantResult[];
  recommendedConcurrent: number;
}) {
  // Pick "best" variant on a composite — high completion, low abandon, low congestion.
  const bestIdx = (() => {
    let bestI = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const s = r.completionRate - r.abandonmentRate - r.congestionMinutes / 60;
      if (s > bestScore) { bestScore = s; bestI = i; }
    }
    return bestI;
  })();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
            <th className="text-left font-medium pb-1.5 pr-2">variant</th>
            <th className="text-right font-medium pb-1.5 px-1.5">cap</th>
            <th className="text-right font-medium pb-1.5 px-1.5">peak</th>
            <th className="text-right font-medium pb-1.5 px-1.5">완주율</th>
            <th className="text-right font-medium pb-1.5 px-1.5">이탈</th>
            <th className="text-right font-medium pb-1.5 px-1.5">처리/h</th>
            <th className="text-right font-medium pb-1.5 px-1.5">정체분</th>
          </tr>
        </thead>
        <tbody className="font-data tabular-nums">
          {results.map((r, i) => {
            const isBest = i === bestIdx;
            return (
              <tr
                key={r.variant.id}
                className={`border-t border-border/40 ${
                  isBest ? 'bg-[var(--status-success)]/5' : ''
                }`}
              >
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      r.variant.id === 'conservative' ? 'bg-[var(--status-success)]'
                      : r.variant.id === 'recommended' ? 'bg-primary'
                      : 'bg-[var(--status-warning)]'
                    }`} />
                    <span className="text-foreground/85 font-sans">
                      {r.variant.label}
                    </span>
                    {isBest && (
                      <span className="text-[8px] uppercase tracking-wider text-[var(--status-success)] font-sans font-medium">
                        best
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-right py-1.5 px-1.5 text-foreground/85">
                  {r.variant.maxConcurrent}
                </td>
                <td className="text-right py-1.5 px-1.5">
                  <span className={
                    r.result.peakConcurrent > recommendedConcurrent
                      ? 'text-[var(--status-warning)]' : 'text-foreground/85'
                  }>
                    {r.result.peakConcurrent}
                  </span>
                </td>
                <td className="text-right py-1.5 px-1.5">
                  <span className={
                    r.completionRate >= 0.85 ? 'text-[var(--status-success)]'
                    : r.completionRate >= 0.6 ? 'text-foreground/85'
                    : 'text-[var(--status-warning)]'
                  }>
                    {Math.round(r.completionRate * 100)}%
                  </span>
                </td>
                <td className="text-right py-1.5 px-1.5">
                  <span className={
                    r.abandonmentRate >= 0.1 ? 'text-[var(--status-danger)]'
                    : r.abandonmentRate >= 0.03 ? 'text-[var(--status-warning)]'
                    : 'text-foreground/85'
                  }>
                    {Math.round(r.abandonmentRate * 100)}%
                  </span>
                </td>
                <td className="text-right py-1.5 px-1.5 text-foreground/85">
                  {Math.round(r.throughputPerHour)}
                </td>
                <td className="text-right py-1.5 px-1.5">
                  <span className={
                    r.congestionMinutes >= 10 ? 'text-[var(--status-danger)]'
                    : r.congestionMinutes >= 3 ? 'text-[var(--status-warning)]'
                    : 'text-foreground/85'
                  }>
                    {r.congestionMinutes.toFixed(1)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[9px] text-muted-foreground/60 mt-1.5 leading-snug">
        cap = entryPolicy.maxConcurrent · peak = 관측 동시 인원 최댓값 · 완주율 = exited / spawned ·
        이탈 = abandoned / arrived · 처리/h = exited per sim hour · 정체분 = bottleneck score 0.7 초과 누적 (snapshots 30s 간격 근사)
      </p>
    </div>
  );
}

function NumberTile({
  label, value, unit, accent, sub,
}: {
  label: string;
  value: number | null;
  unit: string;
  accent: 'good' | 'warn' | 'bad' | 'unknown';
  sub: string;
}) {
  const display = value === null ? '—' : String(value);
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-0.5">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-data tabular-nums text-lg font-semibold leading-none px-1.5 py-0.5 rounded ${STATUS_BG[accent]}`}
        >
          {display}
        </span>
        {value !== null && (
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        )}
      </div>
      <div className="text-[9px] text-muted-foreground/70 mt-1 leading-tight truncate" title={sub}>
        {sub}
      </div>
    </div>
  );
}
