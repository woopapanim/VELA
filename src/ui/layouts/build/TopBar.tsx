import { Play } from 'lucide-react';
import { useStore } from '@/stores';
import { ThemeToggle } from '../../components/ThemeToggle';
import { LanguageToggle } from '../../components/LanguageToggle';
import { HelpButton } from '../../components/HelpOverlay';

interface Props {
  onRun: () => void;
}

// Build 단계 상단 바 (56px). Identity 좌, phase indicator 중, primary CTA 우.
// 좌/우 패널 chrome 공유 X — Build 만의 가벼운 구조. canvas 가 화면의 주인공.
export function TopBar({ onRun }: Props) {
  const scenario = useStore((s) => s.scenario);
  const zoneCount = useStore((s) => s.zones.length);
  const mediaCount = useStore((s) => s.media.length);
  const canRun = zoneCount > 0 && mediaCount > 0;

  const runBlockedReason = !scenario
    ? 'Load or create a scenario first'
    : zoneCount === 0
    ? 'Add at least one zone'
    : mediaCount === 0
    ? 'Add at least one exhibit'
    : 'Run simulation';

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-[var(--surface)] flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-sm font-semibold tracking-tight">VELA</h1>
        {scenario && (
          <span className="text-xs text-muted-foreground italic truncate max-w-64">
            {scenario.meta.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          1 Build
        </span>
        <span className="text-muted-foreground/60">→</span>
        <span className="text-muted-foreground/80">2 Simulate</span>
        <span className="text-muted-foreground/60">→</span>
        <span className="text-muted-foreground/80">3 Analyze</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          title={runBlockedReason}
          className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Run Simulation
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <HelpButton />
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
