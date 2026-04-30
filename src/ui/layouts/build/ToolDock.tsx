import { LayoutGrid, Square, Sparkles, Spline, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/stores';

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
  label: string;
}> = [
  { id: 'region', icon: LayoutGrid, label: 'Region' },
  { id: 'zones', icon: Square, label: 'Zones' },
  { id: 'exhibits', icon: Sparkles, label: 'Exhibits' },
  { id: 'flow', icon: Spline, label: 'Flow' },
  { id: 'visitors', icon: Users, label: 'Visitors' },
];

// Build 단계 task 도구 buttons. StageRail 의 bottom slot 으로 들어감.
// 자체 aside 래퍼는 폐기 — shell 의 rail 에 포함됨.
export function ToolDock({ active, onChange, panelOpen, onTogglePanel }: Props) {
  const floors = useStore((s) => s.floors);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const waypointGraph = useStore((s) => s.waypointGraph);

  const done: Record<BuildTask, boolean> = {
    region: floors.length > 0,
    zones: zones.length > 0,
    exhibits: media.length > 0,
    flow: !!waypointGraph && Object.keys(waypointGraph.nodes ?? {}).length > 0,
    visitors: false,
  };

  return (
    <>
      {TASKS.map(({ id, icon: Icon, label }) => {
        const isActive = active === id;
        const isDone = done[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            title={label}
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
          title={panelOpen ? 'Collapse' : 'Expand'}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {panelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </>
  );
}
