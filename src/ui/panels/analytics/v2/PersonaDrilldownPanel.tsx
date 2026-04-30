import { Users, AlertTriangle, Scale, MapPin, Eye } from 'lucide-react';
import type { PersonaBreakdown } from '@/analytics/breakdown/personaBreakdown';
import { NORMS, evaluateNorm, type NormStatus } from '@/analytics/norms';
import {
  STATUS_BG,
  DrilldownHeader, SubCard, MetricRow,
} from './DrilldownShared';

interface Props {
  breakdown: PersonaBreakdown;
  onClose: () => void;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function formatDelta(v: number | null, kind: 'pct' | 'count' | 'sec'): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  if (kind === 'pct') return `${sign}${Math.round(v * 100)}%p`;
  if (kind === 'count') return `${sign}${v.toFixed(1)}`;
  return `${sign}${Math.round(v)}s`;
}

function deltaStatus(v: number | null, isHigherWorse: boolean, threshold: number): NormStatus {
  if (v === null || !Number.isFinite(v)) return 'unknown';
  if (isHigherWorse ? v >= threshold : v <= -threshold) return 'warn';
  if (isHigherWorse ? v <= -threshold : v >= threshold) return 'good';
  return 'unknown';
}

export function PersonaDrilldownPanel({ breakdown, onClose }: Props) {
  const {
    profileLabel, sampleCount,
    avgDwellSec, avgZones, avgMedia, fullCompletion, fatigueMean,
    dwellVsAvg, zonesVsAvg, mediaVsAvg, completionVsAvg, fatigueVsAvg,
    underVisitedZones, underVisitedMedia, hasRawVisitors, reading,
  } = breakdown;

  const completionStatus = evaluateNorm(NORMS.completion_rate, fullCompletion);
  const fatigueStatus = evaluateNorm(NORMS.fatigue_mean, fatigueMean);
  const lowSample = sampleCount < 3;

  return (
    <section className="rounded-xl border border-primary/30 bg-[var(--surface)] p-4 space-y-3 shadow-md">
      <DrilldownHeader
        Icon={Users}
        title={profileLabel}
        kicker={`n=${sampleCount} · 왜 이 그룹인가`}
        reading={reading}
        onClose={onClose}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 정량 지표 */}
        <SubCard Icon={AlertTriangle} title="정량 지표">
          <MetricRow
            label="평균 체류"
            value={`${(avgDwellSec / 60).toFixed(1)}m`}
            status={lowSample ? 'unknown' : 'unknown'}
            sub={`${Math.round(avgDwellSec)}s`}
          />
          <MetricRow
            label="평균 zone"
            value={avgZones.toFixed(1)}
            status="unknown"
          />
          <MetricRow
            label="완주율"
            value={pct(fullCompletion)}
            status={lowSample ? 'unknown' : completionStatus}
          />
          <MetricRow
            label="평균 피로도"
            value={pct(fatigueMean)}
            status={lowSample ? 'unknown' : fatigueStatus}
          />
        </SubCard>

        {/* 다른 그룹 대비 편차 */}
        <SubCard Icon={Scale} title="다른 그룹 대비">
          <MetricRow
            label="체류"
            value={formatDelta(dwellVsAvg, 'sec')}
            status={deltaStatus(dwellVsAvg, false, 60)}
          />
          <MetricRow
            label="zone 수"
            value={formatDelta(zonesVsAvg, 'count')}
            status={deltaStatus(zonesVsAvg, false, 0.5)}
          />
          <MetricRow
            label="작품 수"
            value={formatDelta(mediaVsAvg, 'count')}
            status={deltaStatus(mediaVsAvg, false, 0.5)}
          />
          <MetricRow
            label="완주율"
            value={formatDelta(completionVsAvg, 'pct')}
            status={deltaStatus(completionVsAvg, false, 0.15)}
          />
          <MetricRow
            label="피로도"
            value={formatDelta(fatigueVsAvg, 'pct')}
            status={deltaStatus(fatigueVsAvg, true, 0.10)}
          />
        </SubCard>

        {/* under-visited zones */}
        <SubCard Icon={MapPin} title="덜 가는 zone">
          {!hasRawVisitors ? (
            <p className="text-[11px] text-muted-foreground italic">
              raw 방문자 데이터 없음 (저장된 run)
            </p>
          ) : underVisitedZones.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              다른 그룹 대비 차이 없음
            </p>
          ) : (
            <ul className="space-y-1.5">
              {underVisitedZones.map((z) => {
                const gap = z.avgRate - z.visitRate;
                const status: NormStatus = gap >= 0.3 ? 'bad' : gap >= 0.15 ? 'warn' : 'unknown';
                return (
                  <li key={z.zoneId} className="text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-foreground/85" title={z.zoneName}>
                        {z.zoneName}
                      </span>
                      <span
                        className={`font-data tabular-nums px-1.5 py-0.5 rounded ${STATUS_BG[status]}`}
                      >
                        {pct(z.visitRate)}
                      </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground/70 font-data tabular-nums mt-0.5">
                      others {pct(z.avgRate)} · 격차 {Math.round(gap * 100)}%p
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SubCard>

        {/* under-visited media */}
        <SubCard Icon={Eye} title="덜 보는 작품">
          {!hasRawVisitors ? (
            <p className="text-[11px] text-muted-foreground italic">
              raw 방문자 데이터 없음 (저장된 run)
            </p>
          ) : underVisitedMedia.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              다른 그룹 대비 차이 없음
            </p>
          ) : (
            <ul className="space-y-1.5">
              {underVisitedMedia.map((m) => {
                const gap = m.avgRate - m.visitRate;
                const status: NormStatus = gap >= 0.3 ? 'bad' : gap >= 0.15 ? 'warn' : 'unknown';
                return (
                  <li key={m.mediaId} className="text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-foreground/85" title={m.name}>
                        {m.name}
                      </span>
                      <span
                        className={`font-data tabular-nums px-1.5 py-0.5 rounded ${STATUS_BG[status]}`}
                      >
                        {pct(m.visitRate)}
                      </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground/70 font-data tabular-nums mt-0.5">
                      others {pct(m.avgRate)} · 격차 {Math.round(gap * 100)}%p
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
