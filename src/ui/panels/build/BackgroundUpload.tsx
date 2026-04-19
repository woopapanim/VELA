import { useCallback, useRef } from 'react';
import { Image, X, RotateCcw, Check, Pencil } from 'lucide-react';
import { useStore } from '@/stores';

export function BackgroundUpload() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentFloor = scenario?.floors.find((f) => (f.id as string) === activeFloorId);
  const hasImage = !!currentFloor?.canvas.backgroundImage;
  const isLocked = currentFloor?.canvas.bgLocked ?? false;

  const updateCanvas = useCallback((patch: Record<string, unknown>) => {
    if (!scenario || !activeFloorId) return;
    setScenario({
      ...scenario,
      floors: scenario.floors.map((f) =>
        (f.id as string) === activeFloorId
          ? { ...f, canvas: { ...f.canvas, ...patch } }
          : f,
      ),
    });
  }, [scenario, setScenario, activeFloorId]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scenario || !activeFloorId) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const fl = scenario.floors.find((f) => (f.id as string) === activeFloorId);
        const cw = fl?.canvas.width ?? 1200;
        const ch = fl?.canvas.height ?? 800;
        const fitScale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
        updateCanvas({ backgroundImage: dataUrl, bgOffsetX: 0, bgOffsetY: 0, bgScale: fitScale, bgLocked: false });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [scenario, activeFloorId, updateCanvas]);

  const handleRemove = useCallback(() => {
    updateCanvas({ backgroundImage: null, bgOffsetX: 0, bgOffsetY: 0, bgScale: 1, bgLocked: false });
  }, [updateCanvas]);

  if (!scenario) return null;

  const bgScale = currentFloor?.canvas.bgScale ?? 1;

  return (
    <div>
      <p className="panel-label mb-1.5">Floor Plan Overlay</p>
      {!hasImage ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-xl bg-secondary hover:bg-accent transition-colors"
        >
          <Image className="w-3.5 h-3.5" />
          Upload Image
        </button>
      ) : isLocked ? (
        /* Locked state — compact controls */
        <div className="flex gap-1">
          <button
            onClick={() => updateCanvas({ bgLocked: false })}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-xl bg-secondary hover:bg-accent transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] rounded-xl bg-secondary hover:bg-accent transition-colors text-muted-foreground"
          >
            <Image className="w-3 h-3" />
            Replace
          </button>
          <button
            onClick={handleRemove}
            className="flex items-center justify-center px-2 py-1.5 rounded-xl bg-secondary hover:bg-[var(--status-danger)]/20 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        /* Editing state — full controls */
        <div className="space-y-1.5">
          <div className="flex gap-1">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-xl bg-secondary hover:bg-accent transition-colors"
            >
              <Image className="w-3.5 h-3.5" />
              Replace
            </button>
            <button
              onClick={handleRemove}
              className="flex items-center justify-center px-2 py-1.5 rounded-xl bg-secondary hover:bg-[var(--status-danger)]/20 transition-colors"
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
              onChange={(e) => updateCanvas({ bgScale: Number(e.target.value) })}
              className="flex-1 h-1 accent-primary"
            />
            <span className="text-[9px] text-muted-foreground font-data w-9 text-right">{bgScale.toFixed(2)}x</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateCanvas({ bgOffsetX: 0, bgOffsetY: 0, bgScale: 1 })}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] text-muted-foreground rounded-lg bg-secondary hover:bg-accent transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Reset
            </button>
          </div>
          <button
            onClick={() => updateCanvas({ bgLocked: true })}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
