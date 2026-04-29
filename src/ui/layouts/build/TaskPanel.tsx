import { RegionsPanel } from '../../panels/build/RegionsPanel';
import { BuildTools } from '../../panels/build/BuildTools';
import { ProjectManager } from '../../panels/build/ProjectManager';
import type { BuildTask } from './ToolDock';

const TITLES: Record<BuildTask, string> = {
  region: 'Region',
  zones: 'Zones',
  exhibits: 'Exhibits',
  flow: 'Flow',
};

const HINTS: Record<BuildTask, string> = {
  region: 'Place the floor image and the region you will design within.',
  zones: 'Draw zones — lobby, exhibition halls, rest, exit.',
  exhibits: 'Place artworks and digital media inside zones.',
  flow: 'Connect waypoints to define how visitors move.',
};

interface Props {
  task: BuildTask;
}

// Task-scoped tool panel (240px). Active task 의 도구 + 안내만.
// 기존 BuildTools 는 zones/exhibits/flow 를 통합 — 1차에서는 그대로 재사용,
// 후속 iteration 에서 task 별 분리. 현재는 dock 의 active task 표시가
// 사용자에게 컨텍스트 전달 역할.
export function TaskPanel({ task }: Props) {
  return (
    <aside className="w-60 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-border">
        <h2 className="text-xs font-semibold tracking-tight">{TITLES[task]}</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{HINTS[task]}</p>
      </div>
      <div className="flex-1 p-3 space-y-3">
        {task === 'region' ? <RegionsPanel /> : <BuildTools />}
      </div>
      <div className="border-t border-border p-3">
        <ProjectManager />
      </div>
    </aside>
  );
}
