import { Clock, AlertTriangle, MapPin, Eye, Scale } from 'lucide-react';
import type { TimeBreakdown } from '@/analytics/breakdown/timeBreakdown';
import { NORMS, evaluateNorm, type NormStatus } from '@/analytics/norms';
import {
  STATUS_BG, pct, formatMs,
  DrilldownHeader, SubCard, MetricRow,
} from './DrilldownShared';

interface Props {
  breakdown: TimeBreakdown;
  onClose: () => void;
}

function formatDelta(v: number | null, asPct: boolean): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  if (asPct) return `${sign}${Math.round(v * 100)}%p`;
  return `${sign}${v.toFixed(0)}`;
}

function deltaStatus(v: number | null, isHigherWorse: boolean, threshold = 0.1): NormStatus {
  if (v === null || !Number.isFinite(v)) return 'unknown';
  if (isHigherWorse ? v >= threshold : v <= -threshold) return 'warn';
  if (isHigherWorse ? v <= -threshold : v >= threshold) return 'good';
  return 'unknown';
}

function safe(v: number | null): number | null {
  return v === null || !Number.isFinite(v) ? null : v;
}

export function TimeDrilldownPanel({ breakdown, onClose }: Props) {
  const {
    label, startMs, endMs, sliceDurationMs,
    congestionRatio, skipRate, throughputPerHour, fatigueMean,
    congestionVsAvg, skipVsAvg, throughputVsAvg, fatigueVsAvg,
    zoneRows, mediaRows, reading,
  } = breakdown;

  const congSafe = safe(congestionRatio);
  const skipSafe = safe(skipRate);
  const throughputSafe = safe(throughputPerHour);
  const fatigueSafe = safe(fatigueMean);

  const congStatus: NormStatus = congSafe === null ? 'unknown' : evaluateNorm(NORMS.congestion_time_ratio, congSafe);
  const skipStatus: NormStatus = skipSafe === null ? 'unknown' : evaluateNorm(NORMS.skip_rate, skipSafe);
  const fatigueStatus: NormStatus = fatigueSafe === null ? 'unknown' : evaluateNorm(NORMS.fatigue_mean, fatigueSafe);

  return (
    <section className="rounded-xl border border-primary/30 bg-[var(--surface)] p-4 space-y-3 shadow-md">
      <DrilldownHeader
        Icon={Clock}
        title={`${label} 구간`}
        kicker={`${formatMs(startMs)}–${formatMs(endMs)} · 왜 이 시간대인가`}
        reading={reading}
        onClose={onClose}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 정량 지표 (slice-local) */}
        <SubCard Icon={AlertTriangle} title="정량 지표">
          <MetricRow
            label="정체 시간"
            value={congSafe === null ? '—' : pct(congSafe)}
            status={congStatus}
            sub={`${formatMs(sliceDurationMs)} 동안`}
          />
          <MetricRow
            label="스킵률 (누적)"
            value={skipSafe === null ? '—' : pct(skipSafe)}
            status={skipStatus}
            sub="end-of-slice"
          />
          <MetricRow
            label="시간당 처리"
            value={throughputSafe === null ? '—' : `${Math.round(throughputSafe)}/h`}
            status="unknown"
          />
          <MetricRow
            label="평균 피로도"
            value={fatigueSafe === null ? '—' : pct(fatigueSafe)}
            status={fatigueStatus}
          />
        </SubCard>

        {/* 다른 슬라이스 평균 대비 편차 */}
        <SubCard Icon={Scale} title="평균 대비 편차">
          <MetricRow
            label="정체"
            value={formatDelta(congestionVsAvg, true)}
            status={deltaStatus(congestionVsAvg, true)}
          />
          <MetricRow
            label="스킵률"
            value={formatDelta(skipVsAvg, true)}
            status={deltaStatus(skipVsAvg, true)}
          />
          <MetricRow
            label="피로도"
            value={formatDelta(fatigueVsAvg, true)}
            status={deltaStatus(fatigueVsAvg, true)}
          />
          <MetricRow
            label="처리량"
            value={throughputVsAvg === null
              ? '—'
              : `${throughputVsAvg >= 0 ? '+' : ''}${Math.round(throughputVsAvg)}/h`}
            status={deltaStatus(throughputVsAvg, false, 5)}
          />
        </SubCard>

        {/* 정체 zone top */}
        <SubCard Icon={MapPin} title="정체 zone">
          {zoneRows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              이 구간에 정체된 zone 없음
            </p>
          ) : (
            <ul className="space-y-1.5">
              {zoneRows.map((z) => {
                const status = evaluateNorm(NORMS.congestion_time_ratio, z.congestionRatio);
                return (
                  <li key={z.zoneId} className="text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-foreground/85" title={z.zoneName}>
                        {z.zoneName}
                      </span>
                      <span
                        className={`font-data tabular-nums px-1.5 py-0.5 rounded ${STATUS_BG[status]}`}
                      >
                        {pct(z.congestionRatio)}
                      </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground/70 font-data tabular-nums mt-0.5">
                      {formatMs(z.congestedMs)} congested
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SubCard>

        {/* skip 미디어 top */}
        <SubCard Icon={Eye} title="skip 미디어">
          {mediaRows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              이 구간에 skip 미디어 없음
            </p>
          ) : (
            <ul className="space-y-1.5">
              {mediaRows.map((m) => {
                const status = evaluateNorm(NORMS.skip_rate, m.sliceSkipRate);
                return (
                  <li key={m.mediaId} className="text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-foreground/85" title={m.name}>
                        {m.name}
                      </span>
                      <span
                        className={`font-data tabular-nums px-1.5 py-0.5 rounded ${STATUS_BG[status]}`}
                      >
                        {pct(m.sliceSkipRate)}
                      </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground/70 font-data tabular-nums mt-0.5">
                      skip +{m.skipCountDelta} / 접근 +{m.approachesDelta}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SubCard>
      </div>
    </section>
  );
}
