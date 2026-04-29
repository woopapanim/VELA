/**
 * GlobalHeader — 모든 step 에서 고정 노출되는 상단 헤더 (2026-04-28 IA 재구성)
 *
 * 좌: VELA 로고 + (시나리오 있을 때) 시나리오명
 * 우: (sim 진행 중일 때만) ProgressRing + 경과 시간 / Help / Language / Theme
 *
 * 단계 무관하게 언어·다크모드·도움말 등 시스템 컨트롤은 항상 접근 가능해야 함.
 * Welcome / Setup / Build / Simulate / Analyze 모든 step 에서 동일하게 표시.
 *
 * 진입 문서: docs/plans/ux-ia-restructure.md §3 IA 원칙
 */

import { useStore } from '@/stores';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { ProgressRing } from '../components/ProgressRing';
import { HelpButton } from '../components/HelpOverlay';
import { WorkflowStepIndicator, type WorkflowStep, type WorkflowStepStatus } from './WorkflowStepIndicator';

interface Props {
  /** 현재 워크플로우 step (1 Setup / 2 Build / 3 Simulate / 4 Analyze). 미지정 시 stepper 숨김. */
  workflowStep?: WorkflowStep;
  /** stepper 칸 클릭 시 호출. 미지정이면 stepper 클릭 불가. */
  onNavigateStep?: (step: WorkflowStep) => void;
  /** 4 step 의 reachable + lockReason. App.tsx 가 계산해 전달. */
  stepStatus?: ReadonlyArray<WorkflowStepStatus>;
}

export function GlobalHeader({ workflowStep, onNavigateStep, stepStatus }: Props = {}) {
  const scenario = useStore((s) => s.scenario);
  const phase = useStore((s) => s.phase);
  const timeState = useStore((s) => s.timeState);

  const simProgress = scenario
    ? Math.min(1, timeState.elapsed / scenario.simulationConfig.duration)
    : 0;
  const elapsed = timeState.elapsed;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-[var(--surface)] flex-shrink-0">
      <div className="flex items-center gap-3 flex-shrink-0">
        <h1 className="text-sm font-semibold tracking-tight">VELA</h1>
        {scenario && (
          <span className="text-xs text-muted-foreground italic truncate max-w-48">
            {scenario.meta.name}
          </span>
        )}
      </div>
      {workflowStep && (
        <div className="flex-1 flex justify-center px-4">
          <WorkflowStepIndicator current={workflowStep} variant="horizontal" onNavigate={onNavigateStep} status={stepStatus} />
        </div>
      )}
      <div className="flex items-center gap-3 flex-shrink-0">
        {phase !== 'idle' && (
          <div className="flex items-center gap-3 text-xs font-data">
            <ProgressRing progress={simProgress} size={18} />
            <span className="text-muted-foreground">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        )}
        <HelpButton />
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
