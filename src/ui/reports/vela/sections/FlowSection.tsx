import type { ReportFlow, ReportNodeDistRow, ReportTransitionCell } from '@/analytics/reporting';
import { useT } from '@/i18n';

function NodeDistList({ rows, empty }: { rows: readonly ReportNodeDistRow[]; empty: string }) {
  if (rows.length === 0) return <div className="inline-note muted">{empty}</div>;
  return (
    <ol className="node-dist">
      {rows.map((r, i) => (
        <li key={r.nodeId}>
          <span className="rank">{String(i + 1).padStart(2, '0')}</span>
          <span className="label">{r.label}</span>
          <div className="bar"><div className="fill" style={{ width: `${r.pct}%` }} /></div>
          <span className="v">{r.count} · {r.pct}%</span>
        </li>
      ))}
    </ol>
  );
}

function TransitionMatrix({
  zones, cells,
}: {
  zones: readonly { readonly id: string; readonly name: string }[];
  cells: readonly ReportTransitionCell[];
}) {
  if (zones.length < 2 || cells.length === 0) return null;
  const byFromTo = new Map<string, ReportTransitionCell>();
  for (const c of cells) byFromTo.set(`${c.fromId}|${c.toId}`, c);
  const colorFor = (pct: number) => {
    if (pct >= 60) return '#c2362b';
    if (pct >= 40) return '#ed7b59';
    if (pct >= 20) return '#ffcb7a';
    if (pct >= 5) return '#d7e4ff';
    return '#f6f6f8';
  };
  return (
    <div className="trans-matrix-wrap">
      <table className="trans-matrix">
        <thead>
          <tr>
            <th className="corner">↓ From / To →</th>
            {zones.map((z) => (
              <th key={z.id} title={z.name}>{z.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zones.map((fz) => (
            <tr key={fz.id}>
              <th className="row-head" title={fz.name}>{fz.name}</th>
              {zones.map((tz) => {
                const c = byFromTo.get(`${fz.id}|${tz.id}`);
                if (!c) return <td key={tz.id} className="empty">—</td>;
                const bg = colorFor(c.pct);
                return (
                  <td key={tz.id} style={{ background: bg, color: c.pct >= 40 ? '#fff' : 'var(--ink-800)' }}>
                    <div className="pct">{c.pct}%</div>
                    <div className="cnt">{c.count}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

      {(flow.entryDist.length > 0 || flow.exitDist.length > 0) && (
        <div className="nodedist-block">
          <div className="two-col">
            <div>
              <div className="col-label">{t('vela.flow.entry.title')}</div>
              <p className="routes-hint">{t('vela.flow.entry.hint')}</p>
              <NodeDistList rows={flow.entryDist} empty={t('vela.flow.entry.empty')} />
            </div>
            <div>
              <div className="col-label">{t('vela.flow.exit.title')}</div>
              <p className="routes-hint">{t('vela.flow.exit.hint')}</p>
              <NodeDistList rows={flow.exitDist} empty={t('vela.flow.exit.empty')} />
            </div>
          </div>
        </div>
      )}

      {flow.transitionMatrix.cells.length > 0 && (
        <div className="trans-block">
          <div className="col-label">{t('vela.flow.trans.title')}</div>
          <p className="routes-hint">{t('vela.flow.trans.hint')}</p>
          <TransitionMatrix
            zones={flow.transitionMatrix.zones}
            cells={flow.transitionMatrix.cells}
          />
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
