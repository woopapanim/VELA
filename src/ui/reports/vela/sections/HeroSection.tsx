import type { ReportMeta } from '@/analytics/reporting';
import { useT } from '@/i18n';

export function HeroSection({ meta }: { meta: ReportMeta }) {
  const t = useT();
  const modeLabel = meta.mode === 'person' ? t('vela.hero.modePerson') : t('vela.hero.modeTime');
  const modeHint = meta.mode === 'person' ? t('vela.hero.modePersonHint') : t('vela.hero.modeTimeHint');
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
      <div className="mode-badge" title={modeHint} style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5em',
        padding: '0.25em 0.75em',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        fontSize: '0.75em',
        marginTop: '0.75em',
      }}>
        <span>{modeLabel}</span>
        <span style={{ opacity: 0.7 }}>·</span>
        <span style={{ opacity: 0.8 }}>{modeHint}</span>
      </div>
      {meta.trimmed && (
        <div style={{
          marginTop: '0.75em',
          padding: '0.5em 0.75em',
          borderRadius: '0.5em',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          color: '#fbbf24',
          fontSize: '0.8em',
          lineHeight: 1.4,
        }}>
          {t(meta.mode === 'person' ? 'vela.hero.trimWarnPerson' : 'vela.hero.trimWarn', { active: meta.active })}
        </div>
      )}
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
