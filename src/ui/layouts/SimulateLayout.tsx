import { useEffect } from 'react';
import { useStore } from '@/stores';
import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { StatsFooter } from '../components/StatsFooter';
import { ProgressRing } from '../components/ProgressRing';
import { AppShell, StageRail, UnifiedHeader } from './shell';
import { RunConfigColumn } from './simulate/RunConfigColumn';
import { MonitoringPanel } from './simulate/MonitoringPanel';
import { ControlBar } from './simulate/ControlBar';

interface Props {
  onBackToBuild: () => void;
  onAnalyze?: () => void;
}

export function SimulateLayout({ onBackToBuild, onAnalyze }: Props) {
  const phase = useStore((s) => s.phase);
  const elapsed = useStore((s) => s.timeState.elapsed);
  const duration = useStore((s) => s.scenario?.simulationConfig.duration ?? 0);
  const simProgress = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  useEffect(() => {
    return () => {
      const s = useStore.getState();
      if (s.phase === 'running' || s.phase === 'paused') {
        s.resetSim();
        s.clearHistory?.();
        s.clearReplay?.();
        s.clearPins?.();
      }
    };
  }, []);

  return (
    <AppShell
      header={
        <UnifiedHeader
          current="simulate"
          nav={{
            build: onBackToBuild,
            analyze: phase === 'completed' && onAnalyze ? onAnalyze : undefined,
          }}
          rightSlot={
            phase !== 'idle' ? (
              <div className="flex items-center gap-2 text-xs font-data text-muted-foreground">
                <ProgressRing progress={simProgress} size={18} />
                <span>
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>
            ) : undefined
          }
        />
      }
      rail={
        <StageRail
          current="simulate"
          nav={{
            build: onBackToBuild,
            analyze: phase === 'completed' && onAnalyze ? onAnalyze : undefined,
          }}
        />
      }
      left={<RunConfigColumn />}
      main={<CanvasPanel readOnly />}
      right={<MonitoringPanel />}
      footer={<ControlBar />}
      statsFooter={<StatsFooter />}
    />
  );
}
