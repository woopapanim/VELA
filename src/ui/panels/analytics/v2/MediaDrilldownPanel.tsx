import { Eye, AlertTriangle, Users, TrendingUp, MapPin } from 'lucide-react';
import type { MediaBreakdown } from '@/analytics/breakdown/mediaBreakdown';
import type { VisitorProfileType } from '@/domain';
import { NORMS, evaluateNorm } from '@/analytics/norms';
import {
  STATUS_BG, pct,
  DrilldownHeader, SubCard, MetricRow, Sparkline,
} from './DrilldownShared';

interface Props {
  breakdown: MediaBreakdown;
  onClose: () => void;
  onForkToBuild?: () => void;
}

const PROFILE_LABEL: Record<VisitorProfileType, string> = {
  general: '일반',
  vip: 'VIP',
  child: '어린이',
  elderly: '어르신',
  disabled: '장애인',
};

const TYPE_LABEL: Record<string, string> = {
  passive: '관람형',
  active: '체험형',
  staged: '회차형',
  analog: '실물',
};

export function MediaDrilldownPanel({ breakdown, onClose, onForkToBuild }: Props) {
  const {
    mediaName, mediaType, zoneName, attractiveness,
    skipRate, skipCount, totalApproaches, visitFraction,
    perProfile, skipRateOverTime, reading,
  } = breakdown;

  const skipStatus = evaluateNorm(NORMS.skip_rate, skipRate);
  const lowSample = totalApproaches < 3;

  return (
    <section className="rounded-xl border border-primary/30 bg-[var(--surface)] p-4 space-y-3 shadow-md">
      <DrilldownHeader
        Icon={Eye}
        title={mediaName}
        kicker={`${TYPE_LABEL[mediaType] ?? mediaType} · 왜 이 작품이 안 보이나`}
        reading={reading}
        onClose={onClose}
        onForkToBuild={onForkToBuild}
        forkLabel="Build 으로 →"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 정량 지표 */}
        <SubCard Icon={AlertTriangle} title="정량 지표">
          <MetricRow
            label="스킵률"
            value={pct(skipRate)}
            status={lowSample ? 'unknown' : skipStatus}
            sub={lowSample ? '표본 부족' : `skip ${skipCount} / 접근 ${totalApproaches}`}
          />
          <MetricRow
            label="방문률"
            value={pct(visitFraction)}
            status={visitFraction > 0 && visitFraction < 0.2 ? 'warn' : 'unknown'}
            sub={visitFraction > 0 ? '전체 exited 대비' : '방문 데이터 없음'}
          />
          <MetricRow
            label="매력도(설계)"
            value={attractiveness.toFixed(2)}
            status="unknown"
            sub="작품 attractiveness"
          />
        </SubCard>

        {/* 위치 */}
        <SubCard Icon={MapPin} title="위치">
          <MetricRow
            label="소속 zone"
            value={zoneName}
            status="unknown"
          />
          <MetricRow
            label="유형"
            value={TYPE_LABEL[mediaType] ?? mediaType}
            status="unknown"
          />
        </SubCard>

        {/* persona 분해 */}
        <SubCard Icon={Users} title="페르소나 visit률">
          {perProfile.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">방문자 데이터 없음</p>
          ) : (
            <ul className="space-y-1.5">
              {perProfile.map((p) => {
                const lowGroup = p.total < 3;
                return (
                  <li key={p.profile} className="text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-foreground/85">
                        {PROFILE_LABEL[p.profile]}
                      </span>
                      <span
                        className={`font-data tabular-nums px-1.5 py-0.5 rounded ${STATUS_BG[lowGroup ? 'unknown' : (p.visitRate < 0.3 ? 'warn' : 'good')]}`}
                      >
                        {pct(p.visitRate)}
                      </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground/70 font-data tabular-nums mt-0.5">
                      {p.visited}/{p.total} 명
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SubCard>

        {/* skip 추이 sparkline */}
        <SubCard Icon={TrendingUp} title="스킵률 추이">
          {skipRateOverTime.length < 2 ? (
            <p className="text-[11px] text-muted-foreground italic">시계열 데이터 부족</p>
          ) : (
            <Sparkline
              data={skipRateOverTime.map((d) => ({ tMs: d.tMs, ratio: d.rate }))}
              evaluate={(v) => evaluateNorm(NORMS.skip_rate, v)}
            />
          )}
        </SubCard>
      </div>
    </section>
  );
}
