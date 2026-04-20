import type { ReportKpi, ReportFinding } from '@/analytics/reporting';
import { useT } from '@/i18n';

function KpiCell({ k }: { k: ReportKpi }) {
  const t = useT();
  const classes = ['kpi'];
  if (k.hero) classes.push('hero-kpi');
  const vClasses = ['v', 'num'];
  if (k.tone) vClasses.push(k.tone);
  return (
    <div className={classes.join(' ')}>
      <div>
        <div className="k">{k.label}</div>
        <div className={vClasses.join(' ')}>
          {k.value}
          {k.unit && <span className="unit">{k.unit}</span>}
        </div>
        <div className="note">{k.note}</div>
      </div>
      {k.hero && k.bar && (
        <div>
          <div className="kpi-bar">
            <div className={`fill ${k.bar.danger ? 'danger' : ''}`} style={{ width: `${Math.min(100, (k.bar.pct / k.bar.max) * 100)}%` }} />
            <div className="cap" style={{ left: `${(k.bar.cap / k.bar.max) * 100}%` }} />
          </div>
          <div className="caption">
            {t('vela.exec.safeLimit')}<span className={k.bar.danger ? 's-danger' : ''}>{k.bar.pct}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FindingRow({ f }: { f: ReportFinding }) {
  const t = useT();
  const label = f.severity === 'critical' ? t('vela.sev.critical') : f.severity === 'warning' ? t('vela.sev.warning') : t('vela.sev.info');
  const sevClass = f.severity === 'critical' ? 'danger' : f.severity === 'warning' ? 'warn' : 'info';
  return (
    <div className="finding">
      <div className={`sev ${sevClass}`}>{label}</div>
      <div className="body">
        <div className="t">{f.title}</div>
        <div className="d">{f.detail}</div>
      </div>
      <div className="action">→ {f.action}</div>
    </div>
  );
}

export function ExecutiveSection({
  visitors, kpis, findings,
}: {
  visitors: number;
  kpis: readonly ReportKpi[];
  findings: readonly ReportFinding[];
}) {
  const t = useT();
  return (
    <section>
      <header className="sec-head">
        <div className="num">01</div>
        <div className="title-block">
          <h2>{t('vela.exec.titleA')} <span className="accent">{t('vela.exec.titleB')}</span></h2>
        </div>
        <div className="meta">{t('vela.exec.meta', { visitors: visitors.toLocaleString() })}</div>
      </header>

      <div className="kpi-grid">
        {kpis.map((k) => <KpiCell key={k.key} k={k} />)}
      </div>

      {findings.length > 0 && (
        <div className="findings">
          {findings.map((f) => <FindingRow key={f.id} f={f} />)}
        </div>
      )}
    </section>
  );
}
