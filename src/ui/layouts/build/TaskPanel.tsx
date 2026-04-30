import { RegionsPanel } from '../../panels/build/RegionsPanel';
import { BuildTools } from '../../panels/build/BuildTools';
import { ProjectManager } from '../../panels/build/ProjectManager';
import { VisitorConfig } from '../../panels/build/VisitorConfig';
import { ZoneTemplates } from '../../panels/build/ZoneTemplates';
import { useT } from '@/i18n';
import type { BuildTask } from './ToolDock';

interface Props {
  task: BuildTask;
}

export function TaskPanel({ task }: Props) {
  const t = useT();
  return (
    <aside className="w-60 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-border">
        <h2 className="text-xs font-semibold tracking-tight">{t(`build.task.${task}`)}</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{t(`build.taskHint.${task}`)}</p>
      </div>
      <div className="flex-1 p-3 space-y-3">
        {task === 'region' && <RegionsPanel />}
        {task === 'visitors' && <VisitorConfig />}
        {(task === 'zones' || task === 'exhibits' || task === 'flow') && <BuildTools task={task} />}
        {task === 'zones' && <ZoneTemplates />}
      </div>
      <div className="border-t border-border p-3">
        <ProjectManager />
      </div>
    </aside>
  );
}
