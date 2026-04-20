import type { ReportBehavior, ReportFatigueBucket } from '@/analytics/reporting';
import { useT } from '@/i18n';

function FatigueHist({
  hist, stats,
}: {
  hist: readonly ReportFatigueBucket[];
  stats: { avg: number; median: number; p90: number; p99: number };
}) {
  const t = useT();
  const W = 460, H = 160;
  const P = { t: 8, r: 8, b: 28, l: 8 };
  const max = Math.max(1, ...hist.map((d) => d.n));
  const colWidth = (W - P.l - P.r) / hist.length;
  const barWidth = Math.max(2, colWidth - 4);

  const colorFor = (bucketLo: number) => {
    if (bucketLo >= 80) return '#c2362b';
    if (bucketLo >= 60) return '#b7791f';
    if (bucketLo >= 40) return '#ffcb7a';
    return '#84afff';
  };

  const xFor = (pct: number) => P.l + (pct / 100) * (W - P.l - P.r);

  const markers = [
    { v: Math.round(stats.avg * 100), l: t('vela.bhv.h.avg', { pct: Math.round(stats.avg * 100) }), c: '#6b6e77' },
    { v: Math.round(stats.median * 100), l: t('vela.bhv.h.median', { pct: Math.round(stats.median * 100) }), c: '#6b6e77' },
    { v: Math.round(stats.p90 * 100), l: t('vela.bhv.h.p90', { pct: Math.round(stats.p90 * 100) }), c: '#b7791f' },
    { v: Math.round(stats.p99 * 100), l: t('vela.bhv.h.p99'), c: '#c2362b' },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }}>
      {hist.map((d, i) => {
        const h = (d.n / max) * (H - P.t - P.b);
        const x = P.l + i * colWidth;
        const y = H - P.b - h;
        const lo = parseInt(d.bucket.split('-')[0], 10);
        return (
          <rect key={d.bucket} x={x + 2} y={y} width={barWidth} height={h} fill={colorFor(lo)} fillOpacity={0.85} rx={2} />
        );
      })}
      {markers.map((m, i) => (
        <g key={m.l}>
          <line x1={xFor(m.v)} x2={xFor(m.v)} y1={P.t} y2={H - P.b} stroke={m.c} strokeWidth={1} strokeDasharray="2 2" />
          <text x={xFor(m.v) - 4} y={P.t + 10 + (i % 2) * 12} textAnchor="end" fill={m.c} fontSize={9} fontFamily="JetBrains Mono, monospace">{m.l}</text>
        </g>
      ))}
      {[0, 25, 50, 75, 100].map((v) => (
        <text key={`t-${v}`} x={xFor(v)} y={H - 8} textAnchor="middle" fill="#9a9ca4" fontSize={10} fontFamily="JetBrains Mono, monospace">{v}</text>
      ))}
    </svg>
  );
}

export function BehaviorSection({
  behavior, fatigueHist, fatigueStats,
}: {
  behavior: ReportBehavior;
  fatigueHist: readonly ReportFatigueBucket[];
  fatigueStats: { avg: number; median: number; p90: number; p99: number };
}) {
  const t = useT();
  const p90Pct = Math.round(fatigueStats.p90 * 100);
  const p99Pct = Math.round(fatigueStats.p99 * 100);
  const avgPct = Math.round(fatigueStats.avg * 100);
  const medianPct = Math.round(fatigueStats.median * 100);
  const groupPct = Math.round(behavior.groupInducedBottleneckPct * 100);

  return (
    <section>
      <header className="sec-head">
        <div className="num">06</div>
        <div className="title-block">
          <h2>{t('vela.bhv.titleA')} <span className="accent">{t('vela.bhv.titleB')}</span></h2>
        </div>
        <div className="meta">{t('vela.bhv.meta', { p90: p90Pct, p99: p99Pct })}</div>
      </header>

      <div className="two-col">
        <div>
          <div className="col-label">{t('vela.bhv.col.fatigue')}</div>
          <FatigueHist hist={fatigueHist} stats={fatigueStats} />
          <div className="inline-note">
            {t('vela.bhv.note.headline')}
            <br />
            {t('vela.bhv.note.stats', { avg: avgPct, median: medianPct, p99: p99Pct })}
          </div>
        </div>
        <div>
          <div className="col-label">{t('vela.bhv.col.composition')}</div>
          <div className="vcomp">
            {behavior.composition.map((row) => (
              <div className="row" key={row.label}>
                <span>{row.label}</span>
                <div className="bar">
                  <div className="fill" style={{ width: `${row.pct}%` }} />
                </div>
                <span className="v">{row.count} · {row.pct}%</span>
              </div>
            ))}
          </div>
          <div className="soft-note">
            {t('vela.bhv.group', { count: behavior.groupsCount, pct: groupPct })}
          </div>
        </div>
      </div>
    </section>
  );
}
