import type { ReportSystemOverview, ReportZoneRow } from '@/analytics/reporting';
import { useT } from '@/i18n';

const DONUT_COLORS = ['#2f66f6', '#84afff', '#c4d7ff', '#1f4fd8', '#b7d0ff', '#5e85ff'];

function fmtClockShort(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

function Sparkline({ data, overCap }: { data: readonly number[]; overCap?: boolean }) {
  if (data.length === 0) return <span className="muted" style={{ fontSize: 10 }}>—</span>;
  const W = 84, H = 22;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? W / (data.length - 1) : 0;
  const pts = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${(H - (v / max) * (H - 2) - 1).toFixed(1)}`).join(' ');
  const stroke = overCap ? '#c2362b' : '#2f66f6';
  const fill = overCap ? 'rgba(194, 54, 43, 0.12)' : 'rgba(47, 102, 246, 0.12)';
  const areaD = `${pts} L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
      <path d={areaD} fill={fill} />
      <path d={pts} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

function Donut({
  data,
}: {
  data: readonly { readonly id: string; readonly name: string; readonly dwellMin: number; readonly pct: number }[];
}) {
  const t = useT();
  const size = 200;
  const stroke = 28;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const total = data.reduce((s, d) => s + d.dwellMin, 0);
  if (total === 0) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={180} height={180}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#f3f3f5" strokeWidth={stroke} />
        <text x={c} y={c + 4} textAnchor="middle" fill="#9a9ca4" fontSize={14} fontFamily="JetBrains Mono, monospace">{t('vela.sys.donut.noData')}</text>
      </svg>
    );
  }
  let a0 = -Math.PI / 2;
  const paths = data.map((z, i) => {
    const frac = z.dwellMin / total;
    const a1 = a0 + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = c + r * Math.cos(a0);
    const y0 = c + r * Math.sin(a0);
    const x1 = c + r * Math.cos(a1);
    const y1 = c + r * Math.sin(a1);
    const d = `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
    a0 = a1;
    return <path key={z.id} d={d} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth={stroke} strokeLinecap="butt" />;
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={180} height={180}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#f3f3f5" strokeWidth={stroke} />
      {paths}
      <text x={c} y={c - 4} textAnchor="middle" fill="#0e0f13" fontSize={28} fontWeight={700} fontFamily="Inter, sans-serif">{Math.round(total)}</text>
      <text x={c} y={c + 18} textAnchor="middle" fill="#6b6e77" fontSize={10} fontFamily="JetBrains Mono, monospace" letterSpacing="0.14em">{t('vela.sys.donut.dwellMin')}</text>
    </svg>
  );
}

export function SystemOverviewSection({
  system, zones, zoneVisitLegend,
}: {
  system: ReportSystemOverview;
  zones: readonly ReportZoneRow[];
  zoneVisitLegend: readonly { readonly id: string; readonly name: string; readonly dwellMin: number; readonly pct: number }[];
}) {
  const t = useT();
  const metaLabel = t('vela.sys.meta', {
    zones: system.zonesCount,
    media: system.mediaCount,
    area: system.totalAreaM2.toFixed(1),
  });

  return (
    <section>
      <header className="sec-head">
        <div className="num">04</div>
        <div className="title-block">
          <h2>{t('vela.sys.titleA')} <span className="accent">{t('vela.sys.titleB')}</span></h2>
        </div>
        <div className="meta">{metaLabel}</div>
      </header>

      <div className="two-col">
        <div>
          <div className="col-label">{t('vela.sys.col.visitDist')}</div>
          <div className="donut-wrap">
            <Donut data={zoneVisitLegend} />
            <div className="donut-legend">
              {zoneVisitLegend.map((z, i) => (
                <div className="row" key={z.id}>
                  <span className="sw" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="lbl">{z.name}</span>
                  <span className="pct">{z.pct}%</span>
                </div>
              ))}
              <div className="donut-note">
                {t('vela.sys.donut.note', {
                  count: zoneVisitLegend.length,
                  total: Math.round(zoneVisitLegend.reduce((s, z) => s + z.dwellMin, 0)),
                })}
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="col-label">{t('vela.sys.col.composition')}</div>
          <dl className="kv-list">
            <div className="kv-row"><dt>{t('vela.sys.kv.zones')}</dt><dd className="num">{system.zonesCount}</dd></div>
            <div className="kv-row"><dt>{t('vela.sys.kv.media')}</dt><dd className="num">{system.mediaCount}</dd></div>
            <div className="kv-row"><dt>{t('vela.sys.kv.area')}</dt><dd className="num">{system.totalAreaM2.toFixed(1)} m²</dd></div>
            <div className="kv-row"><dt>{t('vela.sys.kv.capacity')}</dt><dd className="num">{system.totalCapacity}</dd></div>
            <div className="kv-row"><dt>{t('vela.sys.kv.mediaCap')}</dt><dd className="num">{system.mediaCapacity}</dd></div>
            <div className="kv-row"><dt>{t('vela.sys.kv.avgCrowd')}</dt><dd className="num">{system.avgCrowdingPct}%</dd></div>
            <div className="kv-row"><dt>{t('vela.sys.kv.avgDwell')}</dt><dd className="num">{system.avgDwellMin.toFixed(1)} {t('vela.sys.td.stayUnit')}</dd></div>
            <div className="kv-row"><dt>{t('vela.sys.kv.throughput')}</dt><dd className="num">{system.throughputPerMin.toFixed(1)} {t('vela.kpi.throughput.unit')}</dd></div>
          </dl>
        </div>
      </div>

      <table className="ztable">
        <thead>
          <tr>
            <th className="l">{t('vela.sys.th.zone')}</th>
            <th>{t('vela.sys.th.areaCap')}</th>
            <th>{t('vela.sys.th.peak')}</th>
            <th>{t('vela.sys.th.util')}</th>
            <th>{t('vela.sys.th.density')}</th>
            <th>{t('vela.sys.th.stay')}</th>
            <th>{t('vela.sys.th.trend')}</th>
            <th>{t('vela.sys.th.bottleneck')}</th>
            <th>{t('vela.sys.th.grade')}</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => {
            const utilCls = z.utilPct > 100 ? 'danger' : z.utilPct >= 85 ? 'warn' : '';
            const utilNumCls = z.utilPct > 100 ? 's-danger' : z.utilPct >= 85 ? 's-warn' : '';
            return (
              <tr key={z.id}>
                <td className="l">
                  <div className="zone">
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                    <div className="label">
                      <div className="name">{z.name}</div>
                      <div className="tag">{z.type}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {z.area.toFixed(1)}m²
                  <div className="mono-sub">{t('vela.sys.td.capPrefix')} {z.cap}</div>
                </td>
                <td>
                  {z.peak}
                  {z.peakAtMs != null && (
                    <div className="mono-sub">@ {fmtClockShort(z.peakAtMs)}</div>
                  )}
                </td>
                <td className="bar-cell">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline' }}>
                    <span className={`num ${utilNumCls}`} style={{ fontWeight: 600 }}>{z.utilPct}%</span>
                  </div>
                  {(() => {
                    const barMax = Math.max(120, z.utilPct + 10);
                    return (
                      <div className="bar">
                        <div className={`fill ${utilCls}`} style={{ width: `${Math.min(100, (z.utilPct / barMax) * 100)}%` }} />
                        <div className="cap" style={{ left: `${(100 / barMax) * 100}%` }} />
                      </div>
                    );
                  })()}
                </td>
                <td>{z.areaPerPerson.toFixed(1)}</td>
                <td>{z.stayMin.toFixed(1)}{t('vela.sys.td.stayUnit')}</td>
                <td className="trend-cell"><Sparkline data={z.sparkline} overCap={z.utilPct > 100} /></td>
                <td className={z.bottleneck == null ? 'muted' : ''}>{z.bottleneck == null ? '—' : z.bottleneck}</td>
                <td><span className={`grade ${z.grade}`}>{z.grade}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {system.interpretation && (
        <div className="interp">
          <div className="label">{t('vela.sys.interpLabel')}</div>
          <div className="body">{system.interpretation}</div>
        </div>
      )}
    </section>
  );
}
