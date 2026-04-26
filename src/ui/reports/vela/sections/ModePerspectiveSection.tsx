/**
 * ModePerspectiveSection — Phase 1 UX (2026-04-26)
 *
 * 본문 11 섹션 위에 덧대는 _렌즈_. 모드 의도 기준으로 결과를 한 화면에 요약.
 *
 * 구성:
 *   - 모드 배지 (tier + 라벨 + 1줄 hint)
 *   - 총평 2줄 (verdictA/B, tone-aware 색)
 *   - 모드별 핵심 KPI 3-4 카드 (pivots)
 *   - 이 모드 관점의 우선 권고 1-2 건 (priorityFindingIds 와 매칭되는 finding 의 title 만 인용,
 *     본문 RecosSection 에 자세히 표기되므로 여기선 발췌)
 *
 * 본문 (Executive ~ Recos) 에는 _영향 없음_ — 순수 overlay.
 */

import type { ReportPerspective, ReportFinding } from '@/analytics/reporting';
import { useT } from '@/i18n';

const TONE_COLORS = {
  ok: { fg: '#15803d', bg: '#dcfce7', border: '#86efac' },
  warn: { fg: '#a16207', bg: '#fef3c7', border: '#fcd34d' },
  bad: { fg: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
} as const;

const VERDICT_TONE = {
  healthy: { accent: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  warning: { accent: '#a16207', bg: '#fffbeb', border: '#fde68a' },
  critical: { accent: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
} as const;

export function ModePerspectiveSection({
  perspective,
  findings,
}: {
  perspective: ReportPerspective;
  findings: readonly ReportFinding[];
}) {
  const t = useT();
  const tier = perspective.tier;
  const tierLabel = tier === 'validation' ? t('vela.persp.tier.validation') : t('vela.persp.tier.operations');
  const verdictPalette = VERDICT_TONE[perspective.verdictTone];

  const priorityFindings = perspective.priorityFindingIds
    .map((id) => findings.find((f) => f.id === id))
    .filter((f): f is ReportFinding => f != null);

  return (
    <section className="mode-perspective" style={{ padding: '24px 0' }}>
      <header className="sec-head">
        <div className="num">02</div>
        <div className="title-block">
          <h2>{t('vela.persp.title')}</h2>
        </div>
        <div className="meta">{tierLabel}</div>
      </header>

      {/* ── 모드 배지 + 1줄 설명 ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 12px',
          borderRadius: 999,
          background: '#0f172a',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '-0.01em',
        }}>
          {perspective.modeLabel}
        </span>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {t(`vela.persp.modeHint.${perspective.mode}`)}
        </span>
      </div>

      {/* ── Verdict 카드 ── */}
      <div style={{
        background: verdictPalette.bg,
        border: `1px solid ${verdictPalette.border}`,
        borderLeft: `3px solid ${verdictPalette.accent}`,
        borderRadius: 8,
        padding: '14px 18px',
        marginBottom: 16,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: verdictPalette.accent,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 6,
        }}>
          {t('vela.persp.verdict.eyebrow')}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>
          {perspective.verdictA}
        </div>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 1.5 }}>
          {perspective.verdictB}
        </div>
      </div>

      {/* ── Pivot KPIs (3-4 카드 가로 배치) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${perspective.pivots.length}, minmax(0, 1fr))`,
        gap: 8,
        marginBottom: priorityFindings.length > 0 ? 16 : 0,
      }}>
        {perspective.pivots.map((p) => {
          const palette = TONE_COLORS[p.tone];
          return (
            <div key={p.key} style={{
              padding: 12,
              borderRadius: 8,
              background: '#fff',
              border: `1px solid ${palette.border}`,
            }}>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {p.label}
              </div>
              <div style={{
                fontSize: 22,
                fontWeight: 700,
                color: palette.fg,
                marginTop: 4,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {p.value}
              </div>
              {p.note && (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, lineHeight: 1.35 }}>
                  {p.note}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 우선 권고 (모드 의도 매칭, 발췌만 — 자세히는 본문 08 Recos) ── */}
      {priorityFindings.length > 0 && (
        <div style={{
          padding: '12px 14px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 8,
          }}>
            {t('vela.persp.priorityRecos')}
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {priorityFindings.map((f) => (
              <li key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                <span style={{
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  background: f.severity === 'critical' ? '#b91c1c' : f.severity === 'warning' ? '#a16207' : '#475569',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}>
                  #{f.id}
                </span>
                <span style={{ color: '#0f172a', lineHeight: 1.45 }}>
                  {f.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
