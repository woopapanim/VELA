import type { ReportFloor } from '@/analytics/reporting';
import { useT } from '@/i18n';

function densityColor(pct: number): string {
  if (pct > 100) return '#c2362b';
  if (pct >= 85) return '#ff9b8c';
  if (pct >= 60) return '#ffcb7a';
  if (pct >= 30) return '#fff0b3';
  return '#dbe8ff';
}

export function DensitySection({
  floors, peakMoment, fatigueP90Pct,
}: {
  floors: readonly ReportFloor[];
  peakMoment: string | null;
  fatigueP90Pct: number;
}) {
  const t = useT();
  if (floors.length === 0) return null;
  const metaLabel = peakMoment
    ? t('vela.density.metaWithPeak', { moment: peakMoment, p90: fatigueP90Pct })
    : t('vela.density.metaNoPeak', { p90: fatigueP90Pct });
  const introMoment = peakMoment ? t('vela.density.introWithMoment', { moment: peakMoment }) : '';

  return (
    <section>
      <header className="sec-head">
        <div className="num">02</div>
        <div className="title-block">
          <h2>{t('vela.density.titleA')} <span className="accent">{t('vela.density.titleB')}</span>{t('vela.density.titleC')}</h2>
        </div>
        <div className="meta">{metaLabel}</div>
      </header>
      <p className="sec-intro">
        {t('vela.density.intro', { introMoment })}
      </p>

      <div className="floors">
        {floors.map((floor) => {
          const totalOcc = floor.rooms.reduce((s, r) => s + r.occ, 0);
          return (
            <div className="floor-card" key={floor.name}>
              <div className="fhead">
                <span className="name">{floor.name}</span>
                <span>{totalOcc}/{floor.cap}</span>
              </div>
              <div className="plan">
                {floor.rooms.map((rm, idx) => {
                  const pct = rm.cap ? Math.round((100 * rm.occ) / rm.cap) : 0;
                  const color = densityColor(pct);
                  return (
                    <div
                      className="room"
                      key={`${floor.name}-${rm.label}-${idx}`}
                      style={{
                        left: `${rm.x * 100}%`,
                        top: `${rm.y * 100}%`,
                        width: `${rm.w * 100}%`,
                        height: `${rm.h * 100}%`,
                        background: color,
                        color: pct > 85 ? '#fff' : 'var(--ink-800)',
                      }}
                    >
                      {pct}%
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="floors-legend">
        <span><span className="sw" style={{ background: '#dbe8ff' }} />{t('vela.density.lg.lt30')}</span>
        <span><span className="sw" style={{ background: '#fff0b3' }} />{t('vela.density.lg.range1')}</span>
        <span><span className="sw" style={{ background: '#ffcb7a' }} />{t('vela.density.lg.range2')}</span>
        <span><span className="sw" style={{ background: '#ff9b8c' }} />{t('vela.density.lg.range3')}</span>
        <span><span className="sw" style={{ background: '#c2362b' }} />{t('vela.density.lg.over')}</span>
      </div>
    </section>
  );
}
