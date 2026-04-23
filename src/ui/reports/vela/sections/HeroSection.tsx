import type { ReportMeta } from '@/analytics/reporting';
import { useT } from '@/i18n';

export function HeroSection({ meta }: { meta: ReportMeta }) {
  const t = useT();
  return (
    <section className="hero">
      <div className="topline">
        <span className="brand">{t('vela.hero.brand')}</span>
        <span>{t('vela.hero.line', { runId: meta.runId, date: meta.generated.slice(0, 10) })}</span>
      </div>
      <div className="supra">{t('vela.hero.titleA')} {t('vela.hero.titleB')}</div>
      <h1 className="title">{meta.projectName}</h1>
      <p className="subtitle">
        {t('vela.hero.subtitleA')}<em>{t('vela.hero.subtitleEm')}</em>{t('vela.hero.subtitleB')}
      </p>
      <div className="meta">
        <div className="cell"><div className="k">{t('vela.hero.kGenerated')}</div><div className="v num">{meta.generated}</div></div>
        <div className="cell"><div className="k">{t('vela.hero.kDuration')}</div><div className="v num">{meta.duration}</div></div>
        <div className="cell"><div className="k">{t('vela.hero.kVisitors')}</div><div className="v num">{t('vela.hero.visitorsFmt', { count: meta.visitors.toLocaleString() })}</div></div>
        <div className="cell" title={meta.runId}>
          <div className="k">{t('vela.hero.kRunId')}</div>
          <div className="v num" style={{ fontSize: '0.8em', letterSpacing: '-0.02em' }}>{meta.runId}</div>
        </div>
      </div>
    </section>
  );
}
