import type { ReportGlossaryEntry } from '@/analytics/reporting';
import { useT } from '@/i18n';

export function AppendixSection({ glossary }: { glossary: readonly ReportGlossaryEntry[] }) {
  const t = useT();
  return (
    <section>
      <header className="sec-head">
        <div className="num">A</div>
        <div className="title-block">
          <div className="eyebrow">{t('vela.appendix.eyebrow')}</div>
          <h2>{t('vela.appendix.title')}</h2>
        </div>
        <div className="meta">{t('vela.appendix.meta')}</div>
      </header>

      <dl className="defn">
        {glossary.map((g) => (
          <div key={g.term}>
            <dt>{g.term}</dt>
            <dd>{g.def}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
