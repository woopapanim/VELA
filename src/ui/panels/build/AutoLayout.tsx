import { useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useStore } from '@/stores';

export function AutoLayout() {
  const zones = useStore((s) => s.zones);
  const updateZone = useStore((s) => s.updateZone);
  const phase = useStore((s) => s.phase);

  const handleAutoLayout = useCallback(() => {
    if (phase !== 'idle' || zones.length === 0) return;

    const count = zones.length;
    const cols = Math.ceil(Math.sqrt(count));
    const padding = 30;
    const maxW = Math.max(...zones.map((z) => z.bounds.w));
    const maxH = Math.max(...zones.map((z) => z.bounds.h));
    const cellW = maxW + padding;
    const cellH = maxH + padding;
    const startX = 80;
    const startY = 80;

    zones.forEach((zone, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      updateZone(zone.id as string, {
        bounds: {
          ...zone.bounds,
          x: startX + col * cellW,
          y: startY + row * cellH,
        },
      } as any);
    });
  }, [zones, updateZone, phase]);

  if (zones.length < 2 || phase !== 'idle') return null;

  return (
    <button
      onClick={handleAutoLayout}
      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[9px] rounded-xl bg-secondary hover:bg-accent transition-colors"
    >
      <LayoutGrid className="w-3 h-3" /> Auto-Layout ({zones.length} zones)
    </button>
  );
}
