import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { SimulationControls } from '../../panels/build/SimulationControls';

// Floating control dock — 좌하단 glass card. SimulationControls 그대로 호스팅.
// 콜랩스 가능. 캔버스 영구 점유 X — 필요할 때만 펼침.
export function CockpitDock() {
  const [open, setOpen] = useState(true);

  return (
    <div className="absolute bottom-4 left-4 z-10 w-64">
      <div className="rounded-2xl bg-[var(--surface)]/90 backdrop-blur-md border border-border shadow-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 h-8 border-b border-border/60 hover:bg-secondary/40 transition-colors"
          title={open ? 'Collapse controls' : 'Expand controls'}
        >
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
            Controls
          </span>
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
        {open && (
          <div className="p-3">
            <SimulationControls />
          </div>
        )}
      </div>
    </div>
  );
}
