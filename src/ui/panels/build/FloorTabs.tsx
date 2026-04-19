import { useState } from 'react';
import { Plus, X, Pencil, Check } from 'lucide-react';
import { useStore } from '@/stores';

export function FloorTabs() {
  const floors = useStore((s) => s.floors);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const setActiveFloor = useStore((s) => s.setActiveFloor);
  const addFloor = useStore((s) => s.addFloor);
  const removeFloor = useStore((s) => s.removeFloor);
  const renameFloor = useStore((s) => s.renameFloor);
  const phase = useStore((s) => s.phase);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const isSimRunning = phase === 'running';

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-[var(--surface-secondary)]">
      {floors
        .slice()
        .sort((a, b) => a.level - b.level)
        .map((floor) => {
          const id = floor.id as string;
          const isActive = id === activeFloorId;
          const isEditing = id === editingId;

          if (isEditing) {
            return (
              <div key={id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary">
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (draftName.trim()) renameFloor(id, draftName.trim());
                      setEditingId(null);
                    } else if (e.key === 'Escape') {
                      setEditingId(null);
                    }
                  }}
                  className="w-16 text-[11px] bg-background border border-border rounded px-1 py-0.5"
                />
                <button
                  onClick={() => {
                    if (draftName.trim()) renameFloor(id, draftName.trim());
                    setEditingId(null);
                  }}
                  className="text-[var(--status-success)] hover:opacity-80"
                  title="Save"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={id}
              className={`group flex items-center gap-1 rounded-lg transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <button
                onClick={() => setActiveFloor(id)}
                onDoubleClick={() => {
                  if (isSimRunning) return;
                  setDraftName(floor.name);
                  setEditingId(id);
                }}
                className="px-3 py-1 text-[11px] font-medium"
                title="Click to activate, double-click to rename"
              >
                {floor.name}
              </button>
              {!isSimRunning && floors.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete floor "${floor.name}"? All zones, media, and waypoints on this floor will be removed.`)) {
                      removeFloor(id);
                    }
                  }}
                  className={`pr-2 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity ${
                    isActive ? 'text-primary-foreground' : 'text-destructive'
                  }`}
                  title="Delete floor"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {!isSimRunning && !isActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDraftName(floor.name);
                    setEditingId(id);
                  }}
                  className="pr-2 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity"
                  title="Rename floor"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

      {!isSimRunning && (
        <button
          onClick={addFloor}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent hover:border-solid transition-colors"
          title="Add floor"
        >
          <Plus className="w-3 h-3" />
          Add Floor
        </button>
      )}
    </div>
  );
}
