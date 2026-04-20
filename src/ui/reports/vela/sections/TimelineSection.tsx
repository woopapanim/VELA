import type { ReportTimelinePoint } from '@/analytics/reporting';
import { useT } from '@/i18n';

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TimelineSection({
  timeline, peakMoment, peakMomentMs, peakZoneLabel, peakUtilPct,
}: {
  timeline: readonly ReportTimelinePoint[];
  peakMoment: string | null;
  peakMomentMs: number | null;
  peakZoneLabel: string;
  peakUtilPct: number;
}) {
  const t = useT();
  if (timeline.length === 0) return null;

  const W = 960, H = 260;
  const P = { t: 20, r: 50, b: 28, l: 48 };
  const t0 = timeline[0].t;
  const tMax = timeline[timeline.length - 1].t;
  const tSpan = Math.max(1, tMax - t0);
  const xScale = (tv: number) => P.l + ((tv - t0) / tSpan) * (W - P.l - P.r);
  const yPct = (v: number) => P.t + (1 - Math.min(150, v) / 150) * (H - P.t - P.b);
  const activeMax = Math.max(10, ...timeline.map((p) => p.active));
  const yAct = (v: number) => P.t + (1 - v / activeMax) * (H - P.t - P.b);

  const pathFor = (acc: (p: ReportTimelinePoint) => number) =>
    timeline.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.t)} ${acc(p)}`).join(' ');

  const areaD = `${pathFor((p) => yAct(p.active))} L ${xScale(tMax)} ${H - P.b} L ${xScale(t0)} ${H - P.b} Z`;

  const peakSec = peakMomentMs != null ? Math.round(peakMomentMs / 1000) : null;
  const peakX = peakSec != null && peakSec >= t0 && peakSec <= tMax ? xScale(peakSec) : null;

  const tickCount = 6;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round(t0 + (tSpan * i) / tickCount),
  );

  const endMoment = fmtClock(tMax);
  const startMoment = fmtClock(t0);
  const metaLabel = peakMoment
    ? t('vela.tl.metaPeak', { start: startMoment, end: endMoment, peak: peakMoment })
    : t('vela.tl.metaRange', { start: startMoment, end: endMoment });

  const peakSnapshot = peakSec != null
    ? timeline.reduce((best, p) => Math.abs(p.t - peakSec) < Math.abs(best.t - peakSec) ? p : best, timeline[0])
    : null;

  return (
    <section>
      <header className="sec-head">
        <div className="num">03</div>
        <div className="title-block">
          <div className="eyebrow">{t('vela.tl.eyebrow')}</div>
          <h2>{t('vela.tl.titleA')} <em>{t('vela.tl.titleEm')}</em></h2>
        </div>
        <div className="meta">{metaLabel}</div>
      </header>
      <p className="sec-intro">
        {t('vela.tl.intro')}
      </p>

      <div className="chart-card">
        <div className="chart-head">
          <div className="t">{t('vela.tl.chartTitle')}</div>
          <div className="legend">
            <span className="l-danger"><span className="dot" />{t('vela.tl.l.peak')}</span>
            <span className="l-warn"><span className="dot" />{t('vela.tl.l.fatigue')}</span>
            <span className="l-brand"><span className="dot" />{t('vela.tl.l.active')}</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto', maxHeight: 320 }}>
          {[0, 25, 50, 75, 100, 125, 150].map((y) => (
            <g key={`g-${y}`}>
              <line x1={P.l} x2={W - P.r} y1={yPct(y)} y2={yPct(y)} stroke="#e7e7ec" strokeWidth={1} />
              <text x={P.l - 8} y={yPct(y) + 4} textAnchor="end" fill="#9a9ca4" fontSize={10} fontFamily="JetBrains Mono, ui-monospace, monospace">{y}</text>
            </g>
          ))}
          {[0, Math.round(activeMax / 2), activeMax].map((v, i) => (
            <text key={`r-${i}`} x={W - P.r + 8} y={yAct(v) + 4} fill="#9a9ca4" fontSize={10} fontFamily="JetBrains Mono, ui-monospace, monospace">{v}</text>
          ))}
          {ticks.map((tv, i) => (
            <text key={`x-${i}`} x={xScale(tv)} y={H - 10} textAnchor="middle" fill="#9a9ca4" fontSize={10} fontFamily="JetBrains Mono, ui-monospace, monospace">{fmtClock(tv)}</text>
          ))}
          {peakX != null && (
            <>
              <line x1={peakX} x2={peakX} y1={P.t} y2={H - P.b} stroke="#c2362b" strokeWidth={1} strokeDasharray="3 3" />
              <text x={peakX + 6} y={P.t + 12} fill="#c2362b" fontSize={10} fontFamily="JetBrains Mono, monospace">{`PEAK ${peakMoment ?? ''}`}</text>
            </>
          )}
          <path d={areaD} fill="#2f66f6" fillOpacity={0.08} />
          <path d={pathFor((p) => yAct(p.active))} fill="none" stroke="#2f66f6" strokeWidth={1.6} />
          <path d={pathFor((p) => yPct(p.fatiguePct))} fill="none" stroke="#b7791f" strokeWidth={1.8} />
          <path d={pathFor((p) => yPct(p.crowdPct))} fill="none" stroke="#c2362b" strokeWidth={1.8} />
          <text x={P.l - 8} y={P.t - 6} textAnchor="end" fill="#6b6e77" fontSize={10} fontFamily="JetBrains Mono, monospace">%</text>
          <text x={W - P.r + 8} y={P.t - 6} fill="#6b6e77" fontSize={10} fontFamily="JetBrains Mono, monospace">n</text>
        </svg>
      </div>

      {peakMoment && peakUtilPct > 0 && (
        <div className="peak-callout">
          <div className="label">{t('vela.tl.callout.label', { moment: peakMoment })}</div>
          <div className="body">
            {t('vela.tl.callout.reached', { zone: peakZoneLabel, pct: peakUtilPct })}
            {peakUtilPct > 100 ? t('vela.tl.callout.structural') : t('vela.tl.callout.dot')}
          </div>
          {peakSnapshot && (
            <div className="supp">
              {t('vela.tl.callout.supp', {
                active: peakSnapshot.active,
                fatigue: peakSnapshot.fatiguePct,
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
