import { useCallback, useState } from 'react';
import { useStore } from '@/stores';
import { selectScenarioDirty } from '@/stores/selectors';
import { useT } from '@/i18n';
import { useToast } from '@/ui/components/Toast';
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
  const { toast } = useToast();
  const [task, setTask] = useState<BuildTask>('zones');
  const [panelOpen, setPanelOpen] = useState(true);

  const scenario = useStore((s) => s.scenario);
  const zoneCount = useStore((s) => s.zones.length);
  const mediaCount = useStore((s) => s.media.length);
  const waypointGraph = useStore((s) => s.waypointGraph);
  const entryNodes = waypointGraph?.nodes.filter((n) => n.type === 'entry') ?? [];
  const exitNodes = waypointGraph?.nodes.filter((n) => n.type === 'exit') ?? [];
  const edges = waypointGraph?.edges ?? [];
  const hasEntryNode = entryNodes.length > 0;
  const hasExitNode = exitNodes.length > 0;
  // Entry needs an outgoing edge (or bidirectional touching it); exit needs an incoming edge.
  // Without these the visitor can't actually leave/reach the node — sim would deadlock.
  const allEntriesConnected = hasEntryNode && entryNodes.every((n) =>
    edges.some((e) => e.fromId === n.id || (e.direction === 'bidirectional' && e.toId === n.id)),
  );
  const allExitsConnected = hasExitNode && exitNodes.every((n) =>
    edges.some((e) => e.toId === n.id || (e.direction === 'bidirectional' && e.fromId === n.id)),
  );
  const isDirty = useStore(selectScenarioDirty);
  const canRun =
    !!scenario && zoneCount > 0 && mediaCount > 0 &&
    hasEntryNode && hasExitNode && allEntriesConnected && allExitsConnected;
  const runHint = !scenario
    ? 'Load or create a scenario first'
    : zoneCount === 0
    ? 'Add at least one zone'
    : mediaCount === 0
    ? 'Add at least one exhibit'
    : !hasEntryNode
    ? 'Add an entry node (Flow tool)'
    : !hasExitNode
    ? 'Add an exit node (Flow tool)'
    : !allEntriesConnected
    ? 'Connect entry node with an edge (Flow tool)'
    : !allExitsConnected
    ? 'Connect exit node with an edge (Flow tool)'
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

  // disabled stage 클릭 시 hint 를 toast 로 노출 — 단순 cursor:help 만으로는 사용자가
  // "왜 못 가는지" 모르고 멈춘다는 피드백 (2026-04-30).
  const onNavDisabledClick = useCallback((_stage: 'build' | 'simulate' | 'analyze', hint: string) => {
    toast('warning', hint);
  }, [toast]);

  return (
    <AppShell
      header={
        <UnifiedHeader
          current="build"
          nav={{ simulate: canRun ? guardedRun : undefined, analyze: onAnalyze }}
          navDisabledHints={{ simulate: !canRun ? runHint : undefined }}
          onNavDisabledClick={onNavDisabledClick}
        />
      }
      rail={
        <StageRail
          current="build"
          nav={{ simulate: canRun ? guardedRun : undefined, analyze: onAnalyze }}
          navDisabledHints={{ simulate: !canRun ? runHint : undefined }}
          onNavDisabledClick={onNavDisabledClick}
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
