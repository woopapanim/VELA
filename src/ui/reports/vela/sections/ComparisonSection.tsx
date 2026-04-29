/**
 * ComparisonSection — Phase 1 UX [F1] (2026-04-26)
 *
 * 검증 tier 모드 의 핵심 use case ("변형 A/B/C 어느게 좋은가?") 를 _리포트 한 장_
 * 에 답하는 overlay. 본문 11 섹션은 그대로 두고 ModePerspective 바로 아래에
 * 1 카드 형식으로 삽입.
 *
 * 데이터: `buildVariantComparison()` 의 ReportComparison.
 *   - 변형 2-3 개 (현재 + sibling 1-2)
 *   - KPI 4종 (completion / peak / skip / fatigue) 가로 매트릭스
 *   - KPI 별 winner highlight + 종합 winner (모드 가중)
 *
 * 운영 tier 에서는 호출 측이 sibling 대신 [F2] sweep 결과를 보여주므로
 * 이 컴포넌트는 검증 tier 전용으로 가정 (비호출 = 미렌더).
 */

import type { ReportComparison } from '@/analytics/reporting';
import { useT } from '@/i18n';

const TONE_FG = {
  ok: '#15803d',
  warn: '#a16207',
  bad: '#b91c1c',
} as const;

const TONE_BORDER = {
  ok: '#86efac',
  warn: '#fcd34d',
  bad: '#fca5a5',
} as const;

const WINNER_GLOW = {
  bg: '#fefce8',
  border: '#fde047',
  accent: '#a16207',
} as const;

export function ComparisonSection({ comparison }: { comparison: ReportComparison }) {
  const t = useT();

  const winnerId = comparison.weightedWinnerScenarioId ?? comparison.overallWinnerScenarioId;
  const winnerName = winnerId
    ? (comparison.variants.find((v) => v.scenarioId === winnerId)?.name ?? '—')
    : null;

  return (
    <section className="comparison" style={{ padding: '24px 0' }}>
      <header className="sec-head">
        <div className="num">03</div>
        <div className="title-block">
          <h2>{t('vela.compare.title')}</h2>
        </div>
        <div className="meta">
          {t('vela.compare.variantCount', { count: comparison.variants.length })}
        </div>
      </header>

      {/* ── Verdict 라인 (winner 한 줄) ─────────────────────────── */}
      {winnerName ? (
        <div style={{
          background: WINNER_GLOW.bg,
          border: `1px solid ${WINNER_GLOW.border}`,
          borderLeft: `3px solid ${WINNER_GLOW.accent}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 12,
          fontSize: 13,
          color: '#0f172a',
          lineHeight: 1.5,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: WINNER_GLOW.accent,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginRight: 8,
          }}>
            {t('vela.compare.recommended')}
          </span>
          <span style={{ fontWeight: 600 }}>{winnerName}</span>
          <span style={{ color: '#64748b', marginLeft: 8 }}>
            {t('vela.compare.recommendedHint')}
          </span>
        </div>
      ) : (
        <div style={{
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 12,
          fontSize: 12,
          color: '#475569',
          lineHeight: 1.5,
        }}>
          {t('vela.compare.tied')}
        </div>
      )}

      {/* ── 매트릭스 (변형 = 컬럼, KPI = 행) ─────────────────────── */}
      <div style={{
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12,
          tableLayout: 'fixed',
        }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{
                textAlign: 'left',
                padding: '10px 12px',
                fontSize: 10,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderBottom: '1px solid #e2e8f0',
                width: '24%',
              }}>
                {t('vela.compare.col.metric')}
              </th>
              {comparison.variants.map((v) => (
                <th
                  key={v.scenarioId}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#0f172a',
                    borderBottom: '1px solid #e2e8f0',
                    borderLeft: '1px solid #e2e8f0',
                    background: v.scenarioId === winnerId ? WINNER_GLOW.bg : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      maxWidth: 140,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {v.name}
                    </span>
                    {v.isCurrent && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#fff',
                        background: '#0f172a',
                        padding: '1px 5px',
                        borderRadius: 3,
                      }}>
                        {t('vela.compare.currentBadge')}
                      </span>
                    )}
                  </div>
                  {!v.hasResult && (
                    <div style={{ fontSize: 9, color: '#a16207', marginTop: 2 }}>
                      {t('vela.compare.unrunBadge')}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.metrics.map((m) => (
              <tr key={m.key}>
                <td style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid #f1f5f9',
                  color: '#475569',
                  fontWeight: 500,
                }}>
                  {m.label}
                  <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                    {m.higherBetter ? t('vela.compare.higherBetter') : t('vela.compare.lowerBetter')}
                  </div>
                </td>
                {m.values.map((cell) => {
                  const isWinner = cell.scenarioId === m.winnerScenarioId;
                  return (
                    <td
                      key={cell.scenarioId}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid #f1f5f9',
                        borderLeft: '1px solid #f1f5f9',
                        background: isWinner ? '#f0fdf4' : undefined,
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: TONE_FG[cell.tone],
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {cell.display}
                        </span>
                        {isWinner && (
                          <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: '#15803d',
                            background: '#dcfce7',
                            padding: '1px 4px',
                            borderRadius: 3,
                            border: `1px solid ${TONE_BORDER.ok}`,
                          }}>
                            ★
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comparison.note && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: '#64748b',
          fontStyle: 'italic',
        }}>
          {comparison.note}
        </div>
      )}
    </section>
  );
}
