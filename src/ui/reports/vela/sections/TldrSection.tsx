import type { ReportEvidence, ReportHeadline } from '@/analytics/reporting';
import { useT } from '@/i18n';

export function TldrSection({
  evidence, headline,
}: { evidence: readonly ReportEvidence[]; headline?: ReportHeadline }) {
  const t = useT();
  const h = headline ?? {
    a: t('vela.tldr.headlineA'),
    b: t('vela.tldr.headlineB'),
    tone: 'healthy' as const,
  };
  return (
    <section className={`tldr tone-${h.tone}`}>
      <div className="eyebrow">{t('vela.tldr.eyebrow')}</div>
      <blockquote>
        {h.a}<br />
        <span className="em">{h.b}</span>
      </blockquote>
      <div className="evidence">
        {evidence.map((e) => {
          const parts = e.value.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
          const head = parts ? parts[1] : e.value;
          const tail = parts ? parts[2] : '';
          return (
            <div className="c" key={e.label}>
              <div className="k">{e.label}</div>
              <div className={`v ${e.tone} num`}>
                {head}
                {tail && <span style={{ fontSize: '.6em' }}>{tail}</span>}
              </div>
              <div className="note">{e.note}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
