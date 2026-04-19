import { useState } from 'react';
import { Plus, X, Pencil, Check, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { useStore } from '@/stores';
import { InfoTooltip } from '@/ui/components/InfoTooltip';

export function RegionsPanel() {
  const floors = useStore((s) => s.floors);
  const zones = useStore((s) => s.zones);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const setActiveFloor = useStore((s) => s.setActiveFloor);
  const addFloor = useStore((s) => s.addFloor);
  const removeFloor = useStore((s) => s.removeFloor);
  const renameFloor = useStore((s) => s.renameFloor);
  const setFloorHidden = useStore((s) => s.setFloorHidden);
  const moveFloorLevel = useStore((s) => s.moveFloorLevel);
  const phase = useStore((s) => s.phase);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const isSimRunning = phase === 'running';
  const ordered = [...floors].sort((a, b) => b.level - a.level); // top floor first in list

  return (
    <div className="bento-box p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="panel-section flex items-center gap-1.5">
          Regions ({floors.length})
          <InfoTooltip text="각 층(region)을 관리합니다. 활성 층 = 새 zone/waypoint 배치 기본 대상. 눈 아이콘으로 층을 숨겨 편집 집중." />
        </h2>
        {!isSimRunning && (
          <button
            onClick={addFloor}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent hover:border-solid transition-colors"
            title="Add floor"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      <div className="space-y-1">
        {ordered.map((floor, listIdx) => {
          const id = floor.id as string;
          const isActive = id === activeFloorId;
          const isEditing = id === editingId;
          const zoneCount = floor.zoneIds.length;
          const isHidden = floor.hidden === true;
          const isTop = listIdx === 0;
          const isBottom = listIdx === ordered.length - 1;

          return (
            <div
              key={id}
              onClick={() => setActiveFloor(id)}
              className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                isActive
                  ? 'bg-primary/10 ring-1 ring-primary/30'
                  : 'hover:bg-secondary/50'
              } ${isHidden ? 'opacity-50' : ''}`}
            >
              {/* Level badge */}
              <span className="font-data text-[9px] text-muted-foreground w-6 text-center shrink-0">
                {floor.level >= 0 ? `L${floor.level + 1}` : `B${-floor.level}`}
              </span>

              {/* Name (editable) */}
              {isEditing ? (
                <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                    className="flex-1 text-[11px] bg-background border border-border rounded px-1 py-0.5"
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
              ) : (
                <>
                  <span className={`flex-1 truncate ${isActive ? 'font-medium' : ''}`}>
                    {floor.name}
                  </span>
                  <span className="text-muted-foreground font-data text-[9px]">
                    {zoneCount} {zoneCount === 1 ? 'zone' : 'zones'}
                  </span>

                  {/* Visibility toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFloorHidden(id, !isHidden);
                    }}
                    className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity text-muted-foreground"
                    title={isHidden ? 'Show floor' : 'Hide floor (editor view)'}
                  >
                    {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>

                  {/* Move up */}
                  {!isSimRunning && !isTop && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveFloorLevel(id, 'up');
                      }}
                      className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity text-muted-foreground"
                      title="Move level up"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  )}

                  {/* Move down */}
                  {!isSimRunning && !isBottom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveFloorLevel(id, 'down');
                      }}
                      className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity text-muted-foreground"
                      title="Move level down"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  )}

                  {/* Rename */}
                  {!isSimRunning && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraftName(floor.name);
                        setEditingId(id);
                      }}
                      className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity text-muted-foreground"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}

                  {/* Delete */}
                  {!isSimRunning && floors.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete floor "${floor.name}"? All zones, media, and waypoints on this floor will be removed.`)) {
                          removeFloor(id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity text-destructive"
                      title="Delete floor"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}

        {floors.length === 0 && (
          <p className="text-xs text-muted-foreground">Load a scenario or add a floor</p>
        )}
      </div>
    </div>
  );
}
