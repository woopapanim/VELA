import { useStore } from '@/stores';

export function FloorTabs() {
  const floors = useStore((s) => s.floors);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const setActiveFloor = useStore((s) => s.setActiveFloor);

  if (floors.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-[var(--surface-secondary)]">
      {floors
        .slice()
        .sort((a, b) => a.level - b.level)
        .map((floor) => {
          const isActive = (floor.id as string) === activeFloorId;
          return (
            <button
              key={floor.id as string}
              onClick={() => setActiveFloor(floor.id as string)}
              className={`px-3 py-1 text-[10px] font-data rounded-lg transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {floor.name}
            </button>
          );
        })}
    </div>
  );
}
