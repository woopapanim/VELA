import { useState, useCallback, useEffect } from 'react';

export interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  zoneId: string | null;
}

// Lives outside ContextMenu.tsx so React Fast Refresh can hot-reload the
// CanvasContextMenu component without invalidating the hook.
export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, worldX: 0, worldY: 0, zoneId: null });

  const show = useCallback((x: number, y: number, worldX: number, worldY: number, zoneId: string | null) => {
    setMenu({ visible: true, x, y, worldX, worldY, zoneId });
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
