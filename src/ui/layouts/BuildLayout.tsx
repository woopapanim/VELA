import { useState } from 'react';
import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { StatsFooter } from '../components/StatsFooter';
import { TopBar } from './build/TopBar';
import { ToolDock, type BuildTask } from './build/ToolDock';
import { TaskPanel } from './build/TaskPanel';
import { Inspector } from './build/Inspector';

interface Props {
  /** Build 단계에서 시뮬레이션으로 진입. 호출 시 App phase 가 'simulate' 로 전환. */
  onRun: () => void;
}

// Build 단계 — canvas 가 주인공. Top bar (56) + left dock (56) + collapsible
// task panel (240) + flex canvas + 선택 시 슬라이드인 인스펙터 (320, absolute).
// 좌/우 영구 column dump 폐기. 사용자 피드백 (2026-04-29):
//   "좌/우 패널 정해놓고 그것밖에 못쓰는거야? 시멘틱 개념 알아?"
//   → phase 별 형태가 다른 IA. 다음 phase (Simulate/Analyze) 도 별도 layout.
export function BuildLayout({ onRun }: Props) {
  const [task, setTask] = useState<BuildTask>('zones');
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <TopBar onRun={onRun} />
      <div className="flex flex-1 relative overflow-hidden">
        <ToolDock
          active={task}
          onChange={(t) => {
            setTask(t);
            setPanelOpen(true);
          }}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((o) => !o)}
        />
        {panelOpen && <TaskPanel task={task} />}
        <main className="flex-1 relative bg-background overflow-hidden">
          <CanvasPanel />
          <Inspector />
        </main>
      </div>
      <StatsFooter />
    </div>
  );
}
