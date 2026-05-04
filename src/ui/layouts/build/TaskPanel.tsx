import { RegionsPanel } from '../../panels/build/RegionsPanel';
import { BuildTools } from '../../panels/build/BuildTools';
import { ProjectManager } from '../../panels/build/ProjectManager';
import { VisitorConfig } from '../../panels/build/VisitorConfig';
import type { BuildTask } from './ToolDock';

const TITLES: Record<BuildTask, string> = {
  region: 'Region',
  zones: 'Zones',
  exhibits: 'Exhibits',
  flow: 'Flow',
  visitors: 'Visitors',
};

const HINTS: Record<BuildTask, string> = {
  region: 'Place the floor image and the region you will design within.',
  zones: 'Draw zones — lobby, exhibition halls, rest, exit.',
  exhibits: 'Place artworks and digital media inside zones.',
  flow: 'Connect waypoints to define how visitors move.',
  visitors: 'Who is visiting? Profile, engagement, group categories.',
};

interface Props {
  task: BuildTask;
}

// Task-scoped tool panel (240px). Active task 의 도구 + 안내만.
// BuildTools 는 task prop 으로 분기 — zones=zone 도구, exhibits=media 도구, flow=node/edge.
export function TaskPanel({ task }: Props) {
  return (
    <aside className="w-60 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-border">
        <h2 className="text-xs font-semibold tracking-tight">{TITLES[task]}</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{HINTS[task]}</p>
      </div>
      <div className="flex-1 p-3 space-y-3">
        {task === 'region' && <RegionsPanel />}
        {task === 'visitors' && <VisitorConfig />}
        {(task === 'zones' || task === 'exhibits' || task === 'flow') && <BuildTools task={task} />}
      </div>
      <div className="border-t border-border p-3">
        <ProjectManager />
      </div>
    </aside>
  );
}
