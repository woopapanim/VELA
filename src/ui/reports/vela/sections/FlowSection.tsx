import type { ReportFlow } from '@/analytics/reporting';
import { useT } from '@/i18n';

function DwellHistogram({ flow }: { flow: ReportFlow }) {
  const t = useT();
  const W = 460, H = 140;
  const P = { t: 8, r: 8, b: 26, l: 8 };
  const max = Math.max(1, ...flow.dwellHist.map((d) => d.count));
  const colWidth = (W - P.l - P.r) / flow.dwellHist.length;
  const barWidth = Math.max(4, colWidth - 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto', maxHeight: 160 }}>
      {flow.dwellHist.map((d, i) => {
        const h = (d.count / max) * (H - P.t - P.b);
        const x = P.l + i * colWidth;
        const y = H - P.b - h;
        return (
          <g key={d.label}>
            <rect x={x + 3} y={y} width={barWidth} height={h} fill="#2f66f6" fillOpacity={0.82} rx={2} />
            {d.count > 0 && (
              <text x={x + 3 + barWidth / 2} y={y - 3} textAnchor="middle" fill="#0e0f13" fontSize={9} fontFamily="JetBrains Mono, monospace">{d.count}</text>
            )}
            <text x={x + 3 + barWidth / 2} y={H - 10} textAnchor="middle" fill="#6b6e77" fontSize={9} fontFamily="JetBrains Mono, monospace">{d.label}</text>
          </g>
        );
      })}
      <text x={P.l} y={P.t + 6} fill="#9a9ca4" fontSize={9} fontFamily="JetBrains Mono, monospace">
        {t('vela.flow.dwell.axisLabel')}
      </text>
    </svg>
  );
}

export function FlowSection({ flow }: { flow: ReportFlow }) {
  const t = useT();
  const metaLabel = t('vela.flow.meta', {
    completed: flow.completed,
    bottlenecks: flow.bottleneckCount,
  });
  const exitRatePct = Math.round(flow.earlyExitRate * 100);
  const completionPct = Math.round(flow.completionRate * 100);
  const groupPct = Math.round(flow.groupInducedBottleneckPct * 100);

  return (
    <section>
      <header className="sec-head">
        <div className="num">05</div>
        <div className="title-block">
          <div className="eyebrow">{t('vela.flow.eyebrow')}</div>
          <h2>{t('vela.flow.titleA')} <span className="accent">{t('vela.flow.titleB')}</span></h2>
        </div>
        <div className="meta">{metaLabel}</div>
      </header>

      <div className="two-col">
        <div>
          <div className="col-label">{t('vela.flow.col.kpi')}</div>
          <dl className="kv-list">
            <div className="kv-row"><dt>{t('vela.flow.kv.completed')}</dt><dd className="num">{flow.completed}</dd></div>
            <div className="kv-row"><dt>{t('vela.flow.kv.avgTotal')}</dt><dd className="num">{flow.avgTotalMin.toFixed(2)} {t('vela.sys.td.stayUnit')}</dd></div>
            <div className="kv-row"><dt>{t('vela.flow.kv.throughput')}</dt><dd className="num">{flow.throughputPerMin.toFixed(2)} {t('vela.kpi.throughput.unit')}</dd></div>
            <div className="kv-row"><dt>{t('vela.flow.kv.completion')}</dt><dd className="num">{completionPct}%</dd></div>
            <div className="kv-row"><dt>{t('vela.flow.kv.exit')}</dt>
              <dd className={`num ${exitRatePct >= 50 ? 's-danger' : ''}`}>{exitRatePct}%</dd>
            </div>
            <div className="kv-row">
              <dt>
                {t('vela.flow.kv.group')}
                <span className="info" title={t('vela.gl.group.def')} aria-label={t('vela.gl.group.def')}>i</span>
              </dt>
              <dd className="num">{groupPct}%</dd>
            </div>
          </dl>
          <div className="tip-body">{t('vela.flow.groupTip')}</div>
        </div>
        <div>
          <div className="col-label">{t('vela.flow.col.dist')}</div>
          <div className="flowdist">
            {flow.completionDist.map((row) => (
              <div className="row" key={row.label}>
                <span className="l">{row.label}</span>
                <div className="bar">
                  <div className={`fill ${row.tone ?? ''}`} style={{ width: `${row.pct}%` }} />
                </div>
                <span className={`v ${row.count === 0 ? 'muted' : ''}`}>{row.count} · {row.pct}%</span>
              </div>
            ))}
          </div>
          {flow.bottleneckCount === 0 && (
            <div className="inline-note">
              {t('vela.flow.note')}
            </div>
          )}
        </div>
      </div>

      {flow.completed > 0 && (
        <div className="dwell-block">
          <div className="col-label">{t('vela.flow.dwell.title')}</div>
          <p className="routes-hint">{t('vela.flow.dwell.hint', {
            median: flow.dwellStats.medianMin.toFixed(1),
            p90: flow.dwellStats.p90Min.toFixed(1),
            p99: flow.dwellStats.p99Min.toFixed(1),
          })}</p>
          <DwellHistogram flow={flow} />
        </div>
      )}

      {flow.topRoutes.length > 0 && (
        <div className="routes-block">
          <div className="col-label">{t('vela.flow.routes.title')}</div>
          <p className="routes-hint">{t('vela.flow.routes.hint')}</p>
          <ol className="routes">
            {flow.topRoutes.map((r, i) => (
              <li className="route" key={i}>
                <span className="rank">{String(i + 1).padStart(2, '0')}</span>
                <span className="path">{r.path}</span>
                <span className="count">
                  <span className="num">{r.count}</span>
                  <span className="pct">{r.pct}%</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
