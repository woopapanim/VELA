import { Play } from 'lucide-react';
import { useT } from '@/i18n';

// Build 단계 하단 action bar. Simulate ControlBar 와 동일한 height/스타일을 사용해
// 두 stage 간 시각적 연속성을 유지한다 (Run = Start 와 같은 자리, 같은 톤).
interface Props {
  canRun: boolean;
  isDirty: boolean;
  onRun: () => void;
  hint: string;
}

export function BuildActionBar({ canRun, isDirty, onRun, hint }: Props) {
  const t = useT();
  const buttonClass = !canRun
    ? 'bg-secondary text-muted-foreground cursor-not-allowed'
    : isDirty
    ? 'bg-[var(--status-warning)] text-white hover:opacity-90 active:scale-[0.98]'
    : 'bg-[var(--status-success)] text-white hover:opacity-90 active:scale-[0.98]';

  // Suppress hint when it would just echo the button label — only surface
  // hints that actually carry information (disabled reasons, dirty warning).
  const showHint = !canRun || isDirty;

  return (
    <div
      className="border-t border-border bg-[var(--surface)] flex items-center gap-3 px-4 h-14 flex-shrink-0"
      role="toolbar"
      aria-label="Build action bar"
    >
      <button
        type="button"
        onClick={onRun}
        disabled={!canRun}
        title={hint}
        aria-label={t('sim.start') ?? 'Run'}
        className={`flex items-center gap-1 px-2.5 h-8 text-[11px] font-semibold rounded-lg transition-transform focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--status-success)] ${buttonClass}`}
      >
        <Play className="w-3.5 h-3.5" aria-hidden="true" />
        Run
      </button>
      {showHint && (
        <div className="flex-1 min-w-0 flex items-center text-[11px] text-muted-foreground">
          <span className="truncate">{hint}</span>
        </div>
      )}
    </div>
  );
}
