/**
 * MainLayout — Simulate 단계 (App step === 'ready') 전용 (2026-04-28 IA 재구성, nav 통일 v2).
 *
 * 역할: "관제실" — 시뮬 실행 + 라이브 모니터링만. 회고/분석은 AnalyzeLayout 이 담당.
 *
 *   좌(288): SimulationControls + Replay + (운영 tier) Spawn/Visitors + Project
 *   중앙   : Canvas (heatmap/pin 토글 가능)
 *   우(320): LivePulse — phase 무관 항상.
 *
 * 시뮬 완료 시 App.tsx 가 자동으로 'analyze' step 으로 전환 (toast 알림). 화면 내
 * "분석으로 이동" 버튼 제거 — stepper 가 단일 navigation control.
 *
 * 진입 문서: docs/plans/ux-ia-restructure.md §4 (mode×section), §6 Stage B.
 */

import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { SimulationControls } from '../panels/build/SimulationControls';
import { ProjectManager } from '../panels/build/ProjectManager';
import { VisitorConfig } from '../panels/build/VisitorConfig';
import { SpawnConfig } from '../panels/build/SpawnConfig';
import { ReplayScrubber } from '../panels/canvas/ReplayScrubber';
import { LivePulse } from '../panels/analytics/LivePulse';
import { StatsFooter } from '../components/StatsFooter';
import { InfoTooltip } from '../components/InfoTooltip';
import { useStore } from '@/stores';
import { experienceModeTier } from '@/domain';
import { useRef } from 'react';
import { useT } from '@/i18n';

export function MainLayout() {
  const visitors = useStore((s) => s.visitors);
  const phase = useStore((s) => s.phase);
  const visitorHistory = useRef<number[]>([]);
  const scenario = useStore((s) => s.scenario);
  const t = useT();

  const activeCount = visitors.filter((v) => v.isActive).length;

  if (phase !== 'idle' && (visitorHistory.current.length === 0 || visitorHistory.current[visitorHistory.current.length - 1] !== activeCount)) {
    visitorHistory.current = [...visitorHistory.current.slice(-30), activeCount];
  }
  if (phase === 'idle') visitorHistory.current = [];

  const mode = scenario?.experienceMode;
  const tier = mode ? experienceModeTier(mode) : 'operations';
  const isOperations = tier === 'operations';

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="bento-box p-4">
              <h2 className="panel-section mb-3 flex items-center gap-1.5">
                Simulation
                <InfoTooltip text={t('tooltip.simulation')} />
              </h2>
              <SimulationControls />
            </div>

            <ReplayScrubber />

            {isOperations && (
              <>
                <div className="bento-box p-4">
                  <h2 className="panel-section mb-3 flex items-center gap-1.5">
                    Spawn
                    <InfoTooltip text={t('tooltip.spawn')} />
                  </h2>
                  <SpawnConfig />
                </div>

                <div className="bento-box p-4">
                  <h2 className="panel-section mb-3 flex items-center gap-1.5">
                    Visitors
                    <InfoTooltip text={t('tooltip.visitors')} />
                  </h2>
                  <VisitorConfig />
                </div>
              </>
            )}
          </div>

          <div className="border-t border-border p-3">
            <ProjectManager />
          </div>
        </aside>

        <main className="flex-1 bg-background overflow-hidden relative flex flex-col">
          <div className="flex-1 relative">
            <CanvasPanel />
          </div>
        </main>

        <aside className="w-80 border-l border-border bg-[var(--surface)] overflow-y-auto">
          <LivePulse />
        </aside>
      </div>

      <StatsFooter />
    </div>
  );
}
