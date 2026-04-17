import { useState, useCallback, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

const STORAGE_KEY = 'vela-panel-state';

function readState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeState(id: string, open: boolean) {
  try {
    const cur = readState();
    cur[id] = open;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
  } catch {
    // ignore storage errors (quota, private mode, etc.)
  }
}

interface Props {
  id: string;
  title: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  count?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({ id, title, defaultOpen = false, icon, count, children }: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    const s = readState();
    return s[id] !== undefined ? s[id] : defaultOpen;
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      writeState(id, next);
      return next;
    });
  }, [id]);

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-1.5 py-1.5 text-left hover:bg-secondary/40 rounded-md transition-colors -mx-1 px-1"
      >
        <ChevronRight
          className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {icon}
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {count !== undefined && count !== null && (
          <span className="text-[9px] font-data text-muted-foreground">{count}</span>
        )}
      </button>
      {open && <div className="pb-2 pt-1 pl-4">{children}</div>}
    </div>
  );
}
