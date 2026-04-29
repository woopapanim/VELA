import { X } from 'lucide-react';
import { AnalyticsPanel } from '../../panels/analytics/AnalyticsPanel';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Insights slide-in drawer (우측 384px). 영구 column 점유 X — 토글로 ON/OFF.
// AnalyticsPanel 통째로 호스팅 — 6 tabs (Flow/Behavior/Experience/Action/Pin/Report).
export function InsightsDrawer({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <aside className="absolute top-0 right-0 bottom-0 w-96 bg-[var(--surface)]/95 backdrop-blur-sm border-l border-border shadow-2xl flex flex-col z-20 animate-in slide-in-from-right-4 duration-150">
      <div className="flex items-center justify-between px-3 h-9 border-b border-border flex-shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium">
          Insights
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AnalyticsPanel />
      </div>
    </aside>
  );
}
