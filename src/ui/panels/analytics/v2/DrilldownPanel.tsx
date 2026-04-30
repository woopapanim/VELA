import { MapPin, Users, Eye, AlertTriangle, TrendingUp } from 'lucide-react';
import type { ZoneBreakdown } from '@/analytics/breakdown/zoneBreakdown';
import { NORMS, evaluateNorm } from '@/analytics/norms';
import {
  STATUS_BG, pct, formatMs,
  DrilldownHeader, SubCard, MetricRow, Sparkline,
} from './DrilldownShared';

interface Props {
  breakdown: ZoneBreakdown;
  onClose: () => void;
  onForkToBuild?: () => void;
}

export function DrilldownPanel({ breakdown, onClose, onForkToBuild }: Props) {
  const {
    zoneName, areaM2, capacity, peakOccupancy, peakRatio,
    cumulativeCongestedMs, congestionRatio, bottleneckScore,
    bottleneckAvgQueueTimeMs, bottleneckFlowIn, bottleneckFlowOut,
    visitCount, avgDwellMs, visitFraction,
    mediaCount, mediaSkips, congestionOverTime, reading,
  } = breakdown;

  const congStatus = evaluateNorm(NORMS.congestion_time_ratio, congestionRatio);
  const peakStatus = evaluateNorm(NORMS.peak_ratio, peakRatio);
  const bnStatus = evaluateNorm(NORMS.bottleneck_score, bottleneckScore);

  return (
    <section className="rounded-xl border border-primary/30 bg-[var(--surface)] p-4 space-y-3 shadow-md">
      <DrilldownHeader
        Icon={MapPin}
        title={zoneName}
        kicker="왜 이 zone 인가"
        reading={reading}
        onClose={onClose}
        onForkToBuild={onForkToBuild}
      />

      {/* 4-column dense grid: 정량 / 방문 / 미디어 / 시간 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 정량 지표 */}
        <SubCard Icon={AlertTriangle} title="정량 지표">
          <MetricRow
            label="정체 시간"
            value={pct(congestionRatio)}
            status={congStatus}
            sub={formatMs(cumulativeCongestedMs)}
          />
          <MetricRow
            label="피크 점유"
            value={pct(peakRatio)}
            status={peakStatus}
            sub={`${peakOccupancy}/${capacity}`}
          />
          <MetricRow
            label="병목 score"
            value={bottleneckScore.toFixed(2)}
            status={bnStatus}
            sub={bottleneckScore > 0
              ? `대기 ${formatMs(bottleneckAvgQueueTimeMs)} · in ${bottleneckFlowIn.toFixed(1)} · out ${bottleneckFlowOut.toFixed(1)}`
              : undefined}
          />
          <MetricRow
            label="면적"
            value={`${areaM2.toFixed(1)}m²`}
            status="unknown"
            sub={capacity > 0 ? `정원 ${capacity}` : undefined}
          />
        </SubCard>

        {/* 방문 통계 */}
        <SubCard Icon={Users} title="방문 통계">
          <MetricRow
            label="방문자"
            value={`${visitCount}명`}
            status="unknown"
            sub={visitFraction > 0 ? `전체 대비 ${pct(visitFraction)}` : '데이터 없음'}
          />
          <MetricRow
            label="평균 체류"
            value={formatMs(avgDwellMs)}
            status="unknown"
          />
          {visitFraction > 0 && visitFraction < 0.3 && (
            <p className="text-[10px] text-[var(--status-warning)] mt-1 leading-snug">
              방문률 {pct(visitFraction)} — dead zone 의심.
            </p>
          )}
        </SubCard>

        {/* 미디어 분해 */}
        <SubCard Icon={Eye} title={`미디어 (${mediaCount})`}>
          {mediaCount === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">미디어 없음</p>
          ) : mediaSkips.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">관람 데이터 없음</p>
          ) : (
            <ul className="space-y-1.5">
              {mediaSkips.slice(0, 5).map((m) => {
                const status = evaluateNorm(NORMS.skip_rate, m.skipRate);
                return (
                  <li key={m.mediaId} className="text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-foreground/85" title={m.name}>
                        {m.name}
                      </span>
                      <span
                        className={`font-data tabular-nums px-1.5 py-0.5 rounded ${STATUS_BG[status]}`}
                      >
                        {pct(m.skipRate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted-foreground/70 font-data tabular-nums">
                      <span>skip {m.skipCount}</span>
                      <span>/</span>
                      <span>접근 {m.totalApproaches}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SubCard>

        {/* 시간 추이 — sparkline */}
        <SubCard Icon={TrendingUp} title="정체 추이">
          {congestionOverTime.length < 2 ? (
            <p className="text-[11px] text-muted-foreground italic">시계열 데이터 부족</p>
          ) : (
            <Sparkline
              data={congestionOverTime.map((d) => ({ tMs: d.tMs, ratio: d.ratio }))}
              evaluate={(v) => evaluateNorm(NORMS.congestion_time_ratio, v)}
            />
          )}
        </SubCard>
      </div>
    </section>
  );
}
