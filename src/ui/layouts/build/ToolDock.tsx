import { LayoutGrid, Square, Sparkles, Spline, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';

export type BuildTask = 'region' | 'zones' | 'exhibits' | 'flow' | 'visitors';

interface Props {
  active: BuildTask;
  onChange: (task: BuildTask) => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}

const TASKS: ReadonlyArray<{
  id: BuildTask;
  icon: typeof LayoutGrid;
}> = [
  { id: 'region', icon: LayoutGrid },
  { id: 'zones', icon: Square },
  { id: 'exhibits', icon: Sparkles },
  { id: 'flow', icon: Spline },
  { id: 'visitors', icon: Users },
];

export function ToolDock({ active, onChange, panelOpen, onTogglePanel }: Props) {
  const floors = useStore((s) => s.floors);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const waypointGraph = useStore((s) => s.waypointGraph);
  const t = useT();

  const done: Record<BuildTask, boolean> = {
    region: floors.length > 0,
    zones: zones.length > 0,
    exhibits: media.length > 0,
    flow: !!waypointGraph && Object.keys(waypointGraph.nodes ?? {}).length > 0,
    visitors: false,
  };

  return (
    <>
      {TASKS.map(({ id, icon: Icon }) => {
        const isActive = active === id;
        const isDone = done[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            title={t(`build.task.${id}`)}
            className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors
              ${isActive
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
          >
            <Icon className="w-4 h-4" />
            {isDone && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--status-success)]" />
            )}
          </button>
        );
      })}
      <div className="mt-auto pt-1 border-t border-border w-10 flex justify-center">
        <button
          type="button"
          onClick={onTogglePanel}
          title={panelOpen ? t('build.toolDock.collapse') : t('build.toolDock.expand')}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {panelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </>
  );
}
