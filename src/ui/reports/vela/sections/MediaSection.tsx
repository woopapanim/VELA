import type { ReportMediaRow, ReportMediaTotals } from '@/analytics/reporting';
import { useT } from '@/i18n';

function MediaRow({ m }: { m: ReportMediaRow }) {
  const engCls = m.engagement == null ? '' : m.engagement >= 80 ? 'ok' : m.engagement >= 60 ? '' : 'danger';
  const utilCls = m.utilPct >= 85 ? 'danger' : m.utilPct < 30 ? 'muted' : '';
  return (
    <div className="media-row">
      <div>
        <div className="name">{m.name}</div>
        <div className="kind">{m.kind}</div>
      </div>
      <div className="zone">
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginRight: 8, verticalAlign: 2 }} />
        {m.zone}
      </div>
      <div className="r-num">
        {m.peakViewers}/{m.capacity}
        <div className={`util ${utilCls}`}>{m.utilPct}%</div>
      </div>
      <div className="r-num">{m.watches}/{m.skips}</div>
      <div className="engagement">
        <div className="bar">
          <div className={`fill ${engCls}`} style={{ width: `${m.engagement ?? 0}%` }} />
        </div>
        <div className="num">{m.engagement == null ? '—' : `${m.engagement}%`}</div>
      </div>
    </div>
  );
}

function Pick({ m, variant }: { m: ReportMediaRow; variant: 'top' | 'low' }) {
  const t = useT();
  return (
    <div className={`pick ${variant}`}>
      <div>
        <div className="n">{m.name}</div>
        <div className="d">{m.zone} · {m.kind} · {m.watches} {t('vela.media.u.views')} / {m.skips} {t('vela.media.u.skips')}</div>
      </div>
      <div className="v">{m.engagement}%</div>
    </div>
  );
}

export function MediaSection({
  media, topMedia, bottomMedia, totals,
}: {
  media: readonly ReportMediaRow[];
  topMedia: readonly ReportMediaRow[];
  bottomMedia: readonly ReportMediaRow[];
  totals: ReportMediaTotals;
}) {
  const t = useT();
  if (media.length === 0) return null;

  const activationCls = totals.activationPct >= 80 ? 'ok' : totals.activationPct >= 50 ? '' : 'warn';

  return (
    <section>
      <header className="sec-head">
        <div className="num">07</div>
        <div className="title-block">
          <h2>{t('vela.media.titleA')} <span className="accent">{t('vela.media.titleB')}</span></h2>
        </div>
        <div className="meta">{t('vela.media.meta', { count: media.length, activation: totals.activationPct })}</div>
      </header>

      <div className="col-label">{t('vela.media.perf')}</div>
      <div className="media-list">
        <div className="media-row head">
          <div>{t('vela.media.th.media')}</div>
          <div>{t('vela.media.th.zone')}</div>
          <div style={{ textAlign: 'right' }}>{t('vela.media.th.peakCap')}</div>
          <div style={{ textAlign: 'right' }}>{t('vela.media.th.viewsSkip')}</div>
          <div style={{ textAlign: 'right' }}>{t('vela.media.th.engagement')}</div>
        </div>
        {media.map((m) => <MediaRow key={m.id} m={m} />)}
      </div>

      {(topMedia.length > 0 || bottomMedia.length > 0) && (
        <div className="picks">
          <div className="col top">
            <div className="h"><span>{t('vela.media.pick.topTitle')}</span><span className="mono">{t('vela.media.pick.topNote')}</span></div>
            {topMedia.map((m) => <Pick key={m.id} m={m} variant="top" />)}
          </div>
          <div className="col low">
            <div className="h"><span>{t('vela.media.pick.lowTitle')}</span><span className="mono">{t('vela.media.pick.lowNote')}</span></div>
            {bottomMedia.map((m) => <Pick key={m.id} m={m} variant="low" />)}
          </div>
        </div>
      )}

      <div className="media-totals">
        <div className="cell">
          <div className="k">{t('vela.media.tot.views')}</div>
          <div className="v num">{totals.totalViews}<span className="u">{t('vela.media.u.views')}</span></div>
        </div>
        <div className="cell">
          <div className="k">{t('vela.media.tot.skips')}</div>
          <div className="v num warn">{totals.totalSkips}<span className="u">{t('vela.media.u.skips')}</span></div>
        </div>
        <div className="cell">
          <div className="k">{t('vela.media.tot.time')}</div>
          <div className="v num">{totals.totalWatchMin}<span className="u">{t('vela.media.u.min')}</span></div>
        </div>
        <div className="cell">
          <div className="k">{t('vela.media.tot.activation')}</div>
          <div className={`v num ${activationCls}`}>{totals.activationPct}<span className="u">% · {totals.activationRatio}</span></div>
        </div>
      </div>
    </section>
  );
}
