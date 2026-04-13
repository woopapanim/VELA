import { useState, useEffect, useCallback } from 'react';
import { Trash2, Eye, EyeOff } from 'lucide-react';
import { useStore } from '@/stores';

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  zoneId: string | null;
}

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, zoneId: null });

  const show = useCallback((x: number, y: number, zoneId: string | null) => {
    setMenu({ visible: true, x, y, zoneId });
  }, []);

  const hide = useCallback(() => {
    setMenu((m) => ({ ...m, visible: false }));
  }, []);

  useEffect(() => {
    if (menu.visible) {
      const handler = () => hide();
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [menu.visible, hide]);

  return { menu, show, hide };
}

export function CanvasContextMenu({ menu, onClose }: {
  menu: { visible: boolean; x: number; y: number; zoneId: string | null };
  onClose: () => void;
}) {
  const removeZone = useStore((s) => s.removeZone);
  const selectZone = useStore((s) => s.selectZone);
  const phase = useStore((s) => s.phase);
  const zones = useStore((s) => s.zones);
  const overlayMode = useStore((s) => s.overlayMode);
  const setOverlayMode = useStore((s) => s.setOverlayMode);

  if (!menu.visible) return null;

  const isIdle = phase === 'idle';
  const zone = menu.zoneId ? zones.find((z) => (z.id as string) === menu.zoneId) : null;

  return (
    <div
      className="fixed z-50 min-w-40 py-1 glass rounded-xl border border-border shadow-lg"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {zone && (
        <>
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground font-data border-b border-border">
            {zone.name}
          </div>
          <MenuItem
            label="Select Zone"
            onClick={() => { selectZone(zone.id as string); onClose(); }}
          />
          {isIdle && (
            <MenuItem
              label="Delete Zone"
              icon={Trash2}
              danger
              onClick={() => { removeZone(zone.id as string); selectZone(null); onClose(); }}
            />
          )}
          <div className="border-t border-border my-0.5" />
        </>
      )}
      <MenuItem
        label={overlayMode === 'heatmap' ? 'Hide Heatmap' : 'Show Heatmap'}
        icon={overlayMode === 'heatmap' ? EyeOff : Eye}
        shortcut="H"
        onClick={() => { setOverlayMode(overlayMode === 'heatmap' ? 'none' : 'heatmap'); onClose(); }}
      />
      <MenuItem
        label={overlayMode === 'flow' ? 'Hide Flow' : 'Show Flow'}
        icon={overlayMode === 'flow' ? EyeOff : Eye}
        shortcut="F"
        onClick={() => { setOverlayMode(overlayMode === 'flow' ? 'none' : 'flow'); onClose(); }}
      />
    </div>
  );
}

function MenuItem({ label, icon: Icon, shortcut, danger, onClick }: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-left hover:bg-secondary/50 transition-colors ${
        danger ? 'text-[var(--status-danger)]' : ''
      }`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[8px] text-muted-foreground font-data">{shortcut}</span>}
    </button>
  );
}
