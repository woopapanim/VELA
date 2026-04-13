import { useEffect } from 'react';
import { useStore } from '@/stores';
import type { OverlayMode } from '@/stores';

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const store = useStore.getState();

      switch (e.key) {
        case ' ':
        case 'Space': {
          e.preventDefault();
          if (store.phase === 'running') {
            store.setPhase('paused' as any);
          } else if (store.phase === 'paused') {
            store.setPhase('running' as any);
          }
          break;
        }
        case 'h':
        case 'H': {
          const next: OverlayMode = store.overlayMode === 'heatmap' ? 'none' : 'heatmap';
          store.setOverlayMode(next);
          break;
        }
        case 'f':
        case 'F': {
          const next: OverlayMode = store.overlayMode === 'flow' ? 'none' : 'flow';
          store.setOverlayMode(next);
          break;
        }
        case 'g':
        case 'G': {
          store.toggleGrid();
          break;
        }
        case 'l':
        case 'L': {
          store.toggleLabels();
          break;
        }
        case 'Escape': {
          store.selectZone(null);
          store.selectMedia(null);
          store.setEditorMode('select');
          break;
        }
        case 'Delete':
        case 'Backspace': {
          if (store.selectedZoneId && store.phase === 'idle') {
            store.removeZone(store.selectedZoneId);
            store.selectZone(null);
          }
          break;
        }
        case '1': store.setEditorMode('select'); break;
        case '2': store.setEditorMode('create-zone'); break;
        case '3': store.setEditorMode('place-gate'); break;
        case '4': store.setEditorMode('place-media'); break;
        case 'z':
        case 'Z': {
          if ((e.metaKey || e.ctrlKey) && store.phase === 'idle') {
            e.preventDefault();
            if (e.shiftKey) {
              // Redo: save current → restore from redo stack
              const snapshot = store.redo(store.zones, store.media);
              if (snapshot && store.scenario) {
                store.setScenario({ ...store.scenario, zones: snapshot.zones, media: snapshot.media });
              }
            } else {
              // Undo: save current to redo → restore from undo stack
              const snapshot = store.undo(store.zones, store.media);
              if (snapshot && store.scenario) {
                store.setScenario({ ...store.scenario, zones: snapshot.zones, media: snapshot.media });
              }
            }
          }
          break;
        }
        case 'c':
        case 'C': {
          // Copy selected zone (Cmd/Ctrl+C)
          if ((e.metaKey || e.ctrlKey) && store.selectedZoneId && store.phase === 'idle') {
            e.preventDefault();
            const zone = store.zones.find((z) => (z.id as string) === store.selectedZoneId);
            if (zone) {
              (window as any).__aion_clipboard_zone = JSON.parse(JSON.stringify(zone));
            }
          }
          break;
        }
        case 'v':
        case 'V': {
          // Paste zone (Cmd/Ctrl+V)
          if ((e.metaKey || e.ctrlKey) && store.phase === 'idle') {
            e.preventDefault();
            const clipZone = (window as any).__aion_clipboard_zone;
            if (clipZone) {
              const newId = `z_paste_${Date.now()}`;
              const pasted = {
                ...clipZone,
                id: newId,
                name: clipZone.name + ' (Copy)',
                bounds: { ...clipZone.bounds, x: clipZone.bounds.x + 30, y: clipZone.bounds.y + 30 },
                gates: clipZone.gates.map((g: any, i: number) => ({
                  ...g,
                  id: `g_paste_${Date.now()}_${i}`,
                  zoneId: newId,
                  connectedGateId: null,
                })),
              };
              store.addZone(pasted);
              store.selectZone(newId);
            }
          }
          break;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
