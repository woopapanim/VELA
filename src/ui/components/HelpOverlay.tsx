import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

const SHORTCUTS = [
  { key: 'Space', desc: 'Pause / Resume simulation' },
  { key: 'H', desc: 'Toggle heatmap overlay' },
  { key: 'F', desc: 'Toggle flow lines' },
  { key: 'G', desc: 'Toggle grid' },
  { key: 'L', desc: 'Toggle labels' },
  { key: '1-4', desc: 'Editor mode (Select/Zone/Gate/Media)' },
  { key: 'Esc', desc: 'Deselect / Select mode' },
  { key: 'Del', desc: 'Delete selected zone' },
  { key: 'Cmd+Z', desc: 'Undo zone edit' },
  { key: 'Cmd+Shift+Z', desc: 'Redo zone edit' },
  { key: 'Cmd+C', desc: 'Copy selected zone' },
  { key: 'Cmd+V', desc: 'Paste zone' },
  { key: 'Alt+Drag', desc: 'Pan camera' },
  { key: 'Scroll', desc: 'Zoom in/out' },
  { key: 'Double-click', desc: 'Follow/unfollow agent' },
  { key: 'Right-click', desc: 'Context menu' },
];

export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
        aria-label="Help"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="glass rounded-2xl border border-border shadow-2xl w-96 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {SHORTCUTS.map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{desc}</span>
                  <kbd className="px-2 py-0.5 text-[10px] font-data rounded bg-secondary border border-border">{key}</kbd>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border">
              <p className="text-[10px] text-muted-foreground">
                VELA — Spatial Simulation & Flow Analytics
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
