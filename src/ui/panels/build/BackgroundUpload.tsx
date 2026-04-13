import { useCallback, useRef } from 'react';
import { Image, X } from 'lucide-react';
import { useStore } from '@/stores';

export function BackgroundUpload() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentFloor = scenario?.floors.find((f) => (f.id as string) === activeFloorId);
  const hasImage = !!currentFloor?.canvas.backgroundImage;

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scenario || !activeFloorId) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setScenario({
        ...scenario,
        floors: scenario.floors.map((f) =>
          (f.id as string) === activeFloorId
            ? { ...f, canvas: { ...f.canvas, backgroundImage: dataUrl } }
            : f,
        ),
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [scenario, setScenario, activeFloorId]);

  const handleRemove = useCallback(() => {
    if (!scenario || !activeFloorId) return;
    setScenario({
      ...scenario,
      floors: scenario.floors.map((f) =>
        (f.id as string) === activeFloorId
          ? { ...f, canvas: { ...f.canvas, backgroundImage: null } }
          : f,
      ),
    });
  }, [scenario, setScenario, activeFloorId]);

  if (!scenario) return null;

  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Floor Plan Overlay</p>
      <div className="flex gap-1">
        <button
          onClick={() => inputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-xl bg-secondary hover:bg-accent transition-colors"
        >
          <Image className="w-3.5 h-3.5" />
          {hasImage ? 'Replace' : 'Upload CAD/Image'}
        </button>
        {hasImage && (
          <button
            onClick={handleRemove}
            className="flex items-center justify-center px-2 py-1.5 rounded-xl bg-secondary hover:bg-[var(--status-danger)]/20 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleUpload}
        className="hidden"
      />
      {hasImage && (
        <p className="text-[8px] text-muted-foreground mt-1">Image loaded for {currentFloor?.name}</p>
      )}
    </div>
  );
}
