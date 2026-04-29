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

// 좌측 vertical dock (56px). 4 task tools + panel toggle.
// Active task 만 highlight, done task 는 우상단 점.
// canvas 영역을 침범하지 않는 좁은 strip — Figma/Roboflow 스타일.
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
    // 의도적으로 done 표시 안 함 — 디폴트 분포가 들어있어도 사용자가 의도를
    // "정한" 게 아니므로 항상 확인 필요한 task. 다른 task 와 다르게 점 안 켜짐.
    visitors: false,
  };

  return (
    <aside className="w-14 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0">
      <div className="flex-1 flex flex-col items-center gap-1 py-2">
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
      </div>
      <div className="border-t border-border p-1 flex justify-center">
        <button
          type="button"
          onClick={onTogglePanel}
          title={panelOpen ? 'Collapse' : 'Expand'}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {panelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
