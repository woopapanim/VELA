import { ChevronLeft } from 'lucide-react';
import { useStore } from '@/stores';
import { ProgressRing } from '../../components/ProgressRing';
import { ThemeToggle } from '../../components/ThemeToggle';
import { LanguageToggle } from '../../components/LanguageToggle';
import { HelpButton } from '../../components/HelpOverlay';

interface Props {
  onBackToBuild: () => void;
  onAnalyze?: () => void;
}

// Simulate 단계 상단 바 (56px). 좌측: ← Build · VELA · 시나리오. 가운데: stepper.
// 우측: 진행률 ring + 시간만 — 중복 (KPI strip/Insights Summary 의 ELAPSED) 제거.
// Insights 토글 폐기 — 분석 패널은 Analyze 단계로 이전.
export function CockpitTopBar({ onBackToBuild, onAnalyze }: Props) {
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
    <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-[var(--surface)] flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onBackToBuild}
          className="flex items-center gap-1 px-2 h-7 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Back to Build"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Build
        </button>
        <h1 className="text-sm font-semibold tracking-tight">VELA</h1>
        {scenario && (
          <span className="text-xs text-muted-foreground italic truncate max-w-64">
            {scenario.meta.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="text-muted-foreground/80">1 Build ✓</span>
        <span className="text-muted-foreground/60">→</span>
        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          2 Simulate
        </span>
        <span className="text-muted-foreground/60">→</span>
        {phase === 'completed' && onAnalyze ? (
          <button
            type="button"
            onClick={onAnalyze}
            className="px-2 py-0.5 rounded-full bg-[var(--status-success)]/15 text-[var(--status-success)] font-medium hover:bg-[var(--status-success)]/25 transition-colors"
          >
            3 Analyze →
          </button>
        ) : (
          <span className="text-muted-foreground/80">3 Analyze</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {phase !== 'idle' && (
          <div className="flex items-center gap-2 text-xs font-data text-muted-foreground mr-1">
            <ProgressRing progress={simProgress} size={18} />
            <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
          </div>
        )}
        <HelpButton />
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
