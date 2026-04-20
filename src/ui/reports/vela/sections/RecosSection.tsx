import type { ReportFinding } from '@/analytics/reporting';
import { useT } from '@/i18n';

export function RecosSection({ findings }: { findings: readonly ReportFinding[] }) {
  const t = useT();
  if (findings.length === 0) return null;
  return (
    <section>
      <header className="sec-head">
        <div className="num">08</div>
        <div className="title-block">
          <h2>{t('vela.recos.title')}</h2>
        </div>
        <div className="meta">{t('vela.recos.meta', { count: findings.length })}</div>
      </header>

      <div className="recos">
        {findings.map((r) => {
          const tagCls = r.severity === 'critical' ? 'danger' : r.severity === 'info' ? 'info' : '';
          const sevLabel = r.severity === 'critical' ? t('vela.sev.critical') : r.severity === 'warning' ? t('vela.sev.warning') : t('vela.sev.info');
          return (
            <div className="reco" key={r.id}>
              <div className="idx">{r.id}</div>
              <div className="prob">
                <div className={`tag ${tagCls}`}>{sevLabel}</div>
                <div className="t">{r.title}</div>
                <div className="cause">{r.detail}</div>
                <div className="evi">
                  {t('vela.recos.evidence', {
                    metric: r.evidence.metric,
                    value: r.evidence.value,
                    threshold: r.evidence.threshold,
                  })}
                </div>
              </div>
              <div className="act">
                <div className="h">{t('vela.recos.actionH')}</div>
                {r.action}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
