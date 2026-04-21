import { useCallback, useRef, useState } from 'react';
import {
  Plus, X, Pencil, Check, Eye, EyeOff, ChevronUp, ChevronDown,
  LayoutGrid, Image as ImageIcon, RotateCcw,
} from 'lucide-react';
import { useStore } from '@/stores';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { useT } from '@/i18n';

export function RegionsPanel() {
  const t = useT();
  const floors = useStore((s) => s.floors);
  const zones = useStore((s) => s.zones);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const setActiveFloor = useStore((s) => s.setActiveFloor);
  const addFloor = useStore((s) => s.addFloor);
  const removeFloor = useStore((s) => s.removeFloor);
  const renameFloor = useStore((s) => s.renameFloor);
  const setFloorHidden = useStore((s) => s.setFloorHidden);
  const moveFloorLevel = useStore((s) => s.moveFloorLevel);
  const relayoutFloors = useStore((s) => s.relayoutFloors);
  const updateFloorCanvas = useStore((s) => s.updateFloorCanvas);
  const phase = useStore((s) => s.phase);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [overlayEditingId, setOverlayEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const isSimRunning = phase === 'running';
  const ordered = [...floors].sort((a, b) => b.level - a.level);

  const openFilePicker = useCallback((floorId: string) => {
    uploadTargetRef.current = floorId;
    fileInputRef.current?.click();
  }, []);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const floorId = uploadTargetRef.current;
    if (!file || !floorId) { e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const fl = useStore.getState().floors.find((f) => (f.id as string) === floorId);
        const bx = fl?.bounds?.x ?? 0;
        const by = fl?.bounds?.y ?? 0;
        const bw = fl?.bounds?.w ?? fl?.canvas.width ?? 1200;
        const bh = fl?.bounds?.h ?? fl?.canvas.height ?? 800;
        const fitScale = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
        updateFloorCanvas(floorId, {
          backgroundImage: dataUrl,
          bgOffsetX: bx, bgOffsetY: by, bgScale: fitScale, bgLocked: false, bgHidden: false,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [updateFloorCanvas]);

  const handleRemoveOverlay = useCallback((floorId: string) => {
    updateFloorCanvas(floorId, {
      backgroundImage: null, bgOffsetX: 0, bgOffsetY: 0, bgScale: 1, bgLocked: false, bgHidden: false,
    });
  }, [updateFloorCanvas]);

  return (
    <div className="bento-box p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="panel-section flex items-center gap-1.5">
          Regions ({floors.length})
          <InfoTooltip text={t('regions.tooltip')} />
        </h2>
        {!isSimRunning && (
          <div className="flex items-center gap-1">
            {floors.length > 1 && (
              <button
                onClick={relayoutFloors}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent hover:border-solid transition-colors"
                title="Auto-arrange regions side-by-side by level"
              >
                <LayoutGrid className="w-3 h-3" />
                Arrange
              </button>
            )}
            <button
              onClick={addFloor}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent hover:border-solid transition-colors"
              title="Add floor"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
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
          const hasOverlay = !!floor.canvas.backgroundImage;
          const isOverlayOpen = id === overlayEditingId;
          const isLocked = floor.canvas.bgLocked ?? false;
          const isBgHidden = floor.canvas.bgHidden === true;
          const bgScale = floor.canvas.bgScale ?? 1;

          return (
            <div key={id}>
              <div
                onClick={() => setActiveFloor(isActive ? null : id)}
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
                    <span className="text-muted-foreground font-data text-[9px] w-14 text-right shrink-0 tabular-nums">
                      {zoneCount} {zoneCount === 1 ? 'zone' : 'zones'}
                    </span>

                    {/* Overlay icon — always visible for discoverability. Opening the
                        editor also activates the region, so the canvas can drag/
                        resize that floor's background without a second click. */}
                    {!isSimRunning && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const willOpen = !isOverlayOpen;
                          setOverlayEditingId(willOpen ? id : null);
                          if (willOpen && !isActive) setActiveFloor(id);
                        }}
                        className={`${
                          hasOverlay
                            ? (isBgHidden
                                ? 'text-primary/40 hover:!text-primary/70'
                                : (isOverlayOpen ? 'text-primary' : 'text-primary/80 hover:!text-primary'))
                            : (isOverlayOpen ? 'text-foreground' : 'text-muted-foreground/60 hover:!text-foreground')
                        } transition-colors`}
                        title={hasOverlay ? (isBgHidden ? 'Floor plan overlay (hidden)' : 'Edit floor plan overlay') : 'Add floor plan overlay'}
                      >
                        <ImageIcon className="w-3 h-3" />
                      </button>
                    )}

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
                    {!isSimRunning && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isTop) moveFloorLevel(id, 'up');
                        }}
                        disabled={isTop}
                        className={`${isTop ? 'invisible pointer-events-none' : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'} transition-opacity text-muted-foreground`}
                        title="Move level up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                    )}

                    {/* Move down */}
                    {!isSimRunning && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isBottom) moveFloorLevel(id, 'down');
                        }}
                        disabled={isBottom}
                        className={`${isBottom ? 'invisible pointer-events-none' : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'} transition-opacity text-muted-foreground`}
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

              {/* Inline overlay editor */}
              {isOverlayOpen && !isSimRunning && !isEditing && (
                <div
                  className="ml-7 mt-1 mb-1 pl-2 border-l border-border space-y-1.5 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!hasOverlay ? (
                    <button
                      onClick={() => openFilePicker(id)}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-xl bg-secondary hover:bg-accent transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      Upload Image
                    </button>
                  ) : isLocked ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          if (!isActive) setActiveFloor(id);
                          updateFloorCanvas(id, { bgLocked: false });
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-xl bg-secondary hover:bg-accent transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => openFilePicker(id)}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] rounded-xl bg-secondary hover:bg-accent transition-colors text-muted-foreground"
                      >
                        <ImageIcon className="w-3 h-3" />
                        Replace
                      </button>
                      <button
                        onClick={() => updateFloorCanvas(id, { bgHidden: !isBgHidden })}
                        className="flex items-center justify-center px-2 py-1.5 rounded-xl bg-secondary hover:bg-accent transition-colors text-muted-foreground"
                        title={isBgHidden ? 'Show overlay' : 'Hide overlay'}
                      >
                        {isBgHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleRemoveOverlay(id)}
                        className="flex items-center justify-center px-2 py-1.5 rounded-xl bg-secondary hover:bg-[var(--status-danger)]/20 transition-colors"
                        title="Remove overlay"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openFilePicker(id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-xl bg-secondary hover:bg-accent transition-colors"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          Replace
                        </button>
                        <button
                          onClick={() => updateFloorCanvas(id, { bgHidden: !isBgHidden })}
                          className="flex items-center justify-center px-2 py-1.5 rounded-xl bg-secondary hover:bg-accent transition-colors text-muted-foreground"
                          title={isBgHidden ? 'Show overlay' : 'Hide overlay'}
                        >
                          {isBgHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleRemoveOverlay(id)}
                          className="flex items-center justify-center px-2 py-1.5 rounded-xl bg-secondary hover:bg-[var(--status-danger)]/20 transition-colors"
                          title="Remove overlay"
                        >
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground w-8">Scale</span>
                        <input
                          type="range"
                          min={0.05}
                          max={5}
                          step={0.01}
                          value={bgScale}
                          onChange={(e) => updateFloorCanvas(id,{ bgScale: Number(e.target.value) })}
                          className="flex-1 h-1 accent-primary"
                        />
                        <span className="text-[9px] text-muted-foreground font-data w-9 text-right">{bgScale.toFixed(2)}x</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateFloorCanvas(id,{ bgOffsetX: floor.bounds?.x ?? 0, bgOffsetY: floor.bounds?.y ?? 0, bgScale: 1 })}
                          className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] text-muted-foreground rounded-lg bg-secondary hover:bg-accent transition-colors"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Reset
                        </button>
                      </div>
                      <button
                        onClick={() => updateFloorCanvas(id,{ bgLocked: true })}
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Done
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {floors.length === 0 && (
          <p className="text-xs text-muted-foreground">Load a scenario or add a floor</p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
