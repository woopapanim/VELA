/**
 * AnalyzeLayout — Analyze 단계 (App step === 'analyze') 전용 (2026-04-28).
 *
 * 역할: "정비창" — 시뮬 결과 회고 + 변형 비교 + 리포트 출력. 시뮬 실행은 MainLayout 이 담당.
 *
 *   좌(288): Summary KPI 6 + ReplayScrubber + (있으면) ProjectManager
 *   중앙   : Canvas — heatmap 기본, replay 인터랙션
 *   우(384): AnalyticsPanel — Action / Pin / Report 탭 (post-only)
 *
 * 시뮬 데이터 보존: phase 가 completed 인 채로 진입 → store 데이터 그대로 활용.
 * 사용자가 다시 시뮬 돌리려면 헤더 stepper "Simulate" 클릭 → MainLayout 으로 이동.
 *
 * 진입 문서: docs/plans/ux-ia-restructure.md §6 Stage B.
 */

import { useEffect } from 'react';
import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { ReplayScrubber } from '../panels/canvas/ReplayScrubber';
import { ProjectManager } from '../panels/build/ProjectManager';
import { AnalyticsPanel } from '../panels/analytics/AnalyticsPanel';
import { StatsFooter } from '../components/StatsFooter';
import { useStore } from '@/stores';
import { useT } from '@/i18n';

interface Props {
  /** 시나리오 fork + Build 단계 이동 (검증 tier Action 탭 CTA). */
  onForkToBuild?: () => void;
}

export function AnalyzeLayout({ onForkToBuild }: Props) {
  const t = useT();
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const visitors = useStore((s) => s.visitors);
  const totalExited = useStore((s) => s.totalExited);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const timeState = useStore((s) => s.timeState);
  const overlayMode = useStore((s) => s.overlayMode);
  const setOverlayMode = useStore((s) => s.setOverlayMode);

  // 진입 시 heatmap 자동 활성화 — 분석 화면의 기본 시각화. 사용자가 끄면 그대로 둠.
  useEffect(() => {
    if (overlayMode === 'none') setOverlayMode('heatmap');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Summary KPI 계산 (CompletionReport summary 와 동일 공식) ──
  const exited = visitors.filter((v) => !v.isActive);
  const completionRate = exited.length > 0
    ? exited.filter((v) => v.visitedZoneIds.length >= 3).length / exited.length
    : 0;
  const avgDwellMs = exited.length > 0
    ? exited.reduce((s, v) => s + ((v.exitedAt ?? timeState.elapsed) - v.enteredAt), 0) / exited.length
    : 0;
  const peakUtil = latestSnapshot
    ? Math.max(0, ...latestSnapshot.zoneUtilizations.map((u) => u.ratio))
    : 0;
  const bottleneckCount = latestSnapshot
    ? latestSnapshot.bottlenecks.filter((b) => b.score > 0.5).length
    : 0;
  const skipPct = Math.round((latestSnapshot?.skipRate.globalSkipRate ?? 0) * 100);
  const fatiguePct = Math.round((latestSnapshot?.fatigueDistribution.mean ?? 0) * 100);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* ── 좌: 시뮬 요약 + Replay ─────────────────────── */}
        <aside className="w-72 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="bento-box p-4 space-y-3">
              <h2 className="panel-section">{t('analyze.summary.title')}</h2>
              <div className="grid grid-cols-2 gap-2">
                <SummaryTile
                  label={t('analyze.summary.visitors')}
                  value={`${totalExited}/${totalSpawned}`}
                />
                <SummaryTile
                  label={t('analyze.summary.completion')}
                  value={`${Math.round(completionRate * 100)}%`}
                  tone={completionRate < 0.6 ? 'danger' : completionRate < 0.8 ? 'warning' : 'good'}
                />
                <SummaryTile
                  label={t('analyze.summary.avgDwell')}
                  value={formatDwell(avgDwellMs)}
                />
                <SummaryTile
                  label={t('analyze.summary.peak')}
                  value={`${Math.round(peakUtil * 100)}%`}
                  tone={peakUtil > 0.9 ? 'danger' : peakUtil > 0.7 ? 'warning' : 'good'}
                />
                <SummaryTile
                  label={t('analyze.summary.fatigue')}
                  value={`${fatiguePct}%`}
                  tone={fatiguePct > 60 ? 'danger' : fatiguePct > 40 ? 'warning' : 'good'}
                />
                <SummaryTile
                  label={t('analyze.summary.skip')}
                  value={`${skipPct}%`}
                  tone={skipPct > 30 ? 'danger' : skipPct > 15 ? 'warning' : 'good'}
                />
              </div>
              {bottleneckCount > 0 && (
                <div className="text-[10px] text-[var(--status-danger)] leading-snug pt-1 border-t border-border">
                  {t('analyze.summary.bottleneck', { n: bottleneckCount })}
                </div>
              )}
            </div>

            <ReplayScrubber />
          </div>

          <div className="border-t border-border p-3">
            <ProjectManager />
          </div>
        </aside>

        {/* ── 중앙: Canvas (heatmap + replay) ─────────────── */}
        <main className="flex-1 bg-background overflow-hidden relative flex flex-col">
          <div className="flex-1 relative">
            <CanvasPanel />
          </div>
        </main>

        {/* ── 우: AnalyticsPanel (post tabs) ───────────────── */}
        <aside className="w-96 border-l border-border bg-[var(--surface)] overflow-y-auto">
          <AnalyticsPanel onForkToBuild={onForkToBuild} />
        </aside>
      </div>

      <StatsFooter />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warning' | 'danger' | 'neutral';
}) {
  const valColor =
    tone === 'danger' ? 'text-[var(--status-danger)]'
    : tone === 'warning' ? 'text-[var(--status-warning)]'
    : tone === 'good' ? 'text-[var(--status-success)]'
    : 'text-foreground';
  return (
    <div className="bento-box-elevated px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80 font-medium leading-tight">
        {label}
      </div>
      <div className={`text-lg font-semibold font-data leading-tight mt-0.5 ${valColor}`}>{value}</div>
    </div>
  );
}

function formatDwell(ms: number): string {
  const totalS = Math.round(ms / 1000);
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}
