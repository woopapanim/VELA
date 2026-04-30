import { Grid3x3, Tag, Eye, EyeOff } from 'lucide-react';
import { useStore } from '@/stores';

export function CanvasToolbar() {
  const showGrid = useStore((s) => s.showGrid);
  const showLabels = useStore((s) => s.showLabels);
  const showBackground = useStore((s) => s.showBackground);
  const toggleGrid = useStore((s) => s.toggleGrid);
  const toggleLabels = useStore((s) => s.toggleLabels);
  const toggleBackground = useStore((s) => s.toggleBackground);
  const camera = useStore((s) => s.camera);
  const scenario = useStore((s) => s.scenario);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const selectedMediaId = useStore((s) => s.selectedMediaId);
  const selectedWaypointId = useStore((s) => s.selectedWaypointId);
  const inspectorOpen = !!selectedZoneId || !!selectedMediaId || !!selectedWaypointId;
  const hasBackground = !!scenario?.floors.find(
    (f) => (f.id as string) === activeFloorId,
  )?.canvas.backgroundImage;

  return (
    <div
      className="absolute top-3 flex gap-1 z-30 transition-[right] duration-150"
      style={{ right: inspectorOpen ? '332px' : '12px' }}
    >
      <ToolbarBtn active={showGrid} onClick={toggleGrid} icon={Grid3x3} label="Grid" />
      <ToolbarBtn active={showLabels} onClick={toggleLabels} icon={Tag} label="Labels" />
      {hasBackground && (
        <ToolbarBtn active={showBackground} onClick={toggleBackground} icon={showBackground ? Eye : EyeOff} label="Background" />
      )}
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
