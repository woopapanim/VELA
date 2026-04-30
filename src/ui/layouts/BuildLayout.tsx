import { useCallback, useState } from 'react';
import { useStore } from '@/stores';
import { selectScenarioDirty } from '@/stores/selectors';
import { useT } from '@/i18n';
import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { StatsFooter } from '../components/StatsFooter';
import { AppShell, StageRail, UnifiedHeader } from './shell';
import { ToolDock, type BuildTask } from './build/ToolDock';
import { TaskPanel } from './build/TaskPanel';
import { Inspector } from './build/Inspector';
import { BuildActionBar } from './build/BuildActionBar';

interface Props {
  onRun: () => void;
  onAnalyze?: () => void;
}

export function BuildLayout({ onRun, onAnalyze }: Props) {
  const t = useT();
  const [task, setTask] = useState<BuildTask>('zones');
  const [panelOpen, setPanelOpen] = useState(true);

  const scenario = useStore((s) => s.scenario);
  const zoneCount = useStore((s) => s.zones.length);
  const mediaCount = useStore((s) => s.media.length);
  const isDirty = useStore(selectScenarioDirty);
  const canRun = !!scenario && zoneCount > 0 && mediaCount > 0;
  const runHint = !scenario
    ? 'Load or create a scenario first'
    : zoneCount === 0
    ? 'Add at least one zone'
    : mediaCount === 0
    ? 'Add at least one exhibit'
    : isDirty
    ? t('project.dirty.title')
    : 'Run simulation';

  const guardedRun = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm(t('project.dirty.runConfirm'));
      if (!ok) return;
    }
    onRun();
  }, [isDirty, onRun, t]);

  return (
    <AppShell
      header={
        <UnifiedHeader
          current="build"
          nav={{ simulate: canRun ? guardedRun : undefined, analyze: onAnalyze }}
        />
      }
      rail={
        <StageRail
          current="build"
          nav={{ simulate: canRun ? guardedRun : undefined, analyze: onAnalyze }}
          bottom={
            <ToolDock
              active={task}
              onChange={(t) => {
                setTask(t);
                setPanelOpen(true);
              }}
              panelOpen={panelOpen}
              onTogglePanel={() => setPanelOpen((o) => !o)}
            />
          }
        />
      }
      left={panelOpen ? <TaskPanel task={task} /> : undefined}
      main={
        <>
          <CanvasPanel />
          <Inspector />
        </>
      }
      footer={
        <BuildActionBar
          canRun={canRun}
          isDirty={isDirty}
          onRun={guardedRun}
          hint={runHint}
        />
      }
      statsFooter={<StatsFooter />}
    />
  );
}
