import { Grid3x3, Locate, Tag } from 'lucide-react';
import { useStore } from '@/stores';

export function CanvasToolbar() {
  const showGrid = useStore((s) => s.showGrid);
  const showGates = useStore((s) => s.showGates);
  const showLabels = useStore((s) => s.showLabels);
  const toggleGrid = useStore((s) => s.toggleGrid);
  const toggleGates = useStore((s) => s.toggleGates);
  const toggleLabels = useStore((s) => s.toggleLabels);
  const camera = useStore((s) => s.camera);

  return (
    <div className="absolute top-3 right-3 flex gap-1 z-10">
      <ToolbarBtn active={showGrid} onClick={toggleGrid} icon={Grid3x3} label="Grid" />
      <ToolbarBtn active={showGates} onClick={toggleGates} icon={Locate} label="Gates" />
      <ToolbarBtn active={showLabels} onClick={toggleLabels} icon={Tag} label="Labels" />
      <div className="flex items-center px-2 text-[9px] font-data text-muted-foreground glass rounded-lg">
        {Math.round(camera.zoom * 100)}%
      </div>
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
        active
          ? 'glass text-primary'
          : 'glass text-muted-foreground opacity-50 hover:opacity-100'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
