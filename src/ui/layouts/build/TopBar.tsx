import { Play } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { ThemeToggle } from '../../components/ThemeToggle';
import { LanguageToggle } from '../../components/LanguageToggle';
import { HelpButton } from '../../components/HelpOverlay';

interface Props {
  onRun: () => void;
}

export function TopBar({ onRun }: Props) {
  const scenario = useStore((s) => s.scenario);
  const zoneCount = useStore((s) => s.zones.length);
  const mediaCount = useStore((s) => s.media.length);
  const canRun = zoneCount > 0 && mediaCount > 0;
  const t = useT();

  const runBlockedReason = !scenario
    ? t('build.topBar.runReason.noScenario')
    : zoneCount === 0
    ? t('build.topBar.runReason.noZone')
    : mediaCount === 0
    ? t('build.topBar.runReason.noMedia')
    : t('build.topBar.runReason.ready');

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
          1 {t('build.topBar.stage.build')}
        </span>
        <span className="text-muted-foreground/60">→</span>
        <span className="text-muted-foreground/80">2 {t('build.topBar.stage.simulate')}</span>
        <span className="text-muted-foreground/60">→</span>
        <span className="text-muted-foreground/80">3 {t('build.topBar.stage.analyze')}</span>
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
          {t('build.topBar.run')}
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <HelpButton />
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
