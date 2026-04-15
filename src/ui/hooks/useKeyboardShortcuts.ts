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
          if (store.phase !== 'idle') break;
          // Delete selected waypoint node
          if (store.selectedWaypointId) {
            store.removeWaypoint(store.selectedWaypointId);
            store.selectWaypoint(null);
            break;
          }
          // Delete selected edge
          if (store.selectedEdgeId) {
            store.removeEdge(store.selectedEdgeId);
            store.selectEdge(null);
            break;
          }
          // Delete selected media
          if (store.selectedMediaId) {
            store.removeMedia(store.selectedMediaId);
            store.selectMedia(null);
            break;
          }
          // Delete selected zone
          if (store.selectedZoneId) {
            store.removeZone(store.selectedZoneId);
            store.selectZone(null);
            break;
          }
          break;
        }
        case '1': store.setEditorMode('select'); break;
        case '2': store.setEditorMode('create-zone'); break;
        case '3': store.setEditorMode('place-media'); break;
        case '4': store.setEditorMode('place-waypoint'); break;
        case '5': store.setEditorMode('connect-waypoint'); break;
        case 'z':
        case 'Z': {
          if ((e.metaKey || e.ctrlKey) && store.phase === 'idle') {
            e.preventDefault();
            const applySnapshot = (snapshot: any) => {
              if (!snapshot || !store.scenario) return;
              // Rebuild floor zoneIds from snapshot zones
              const snapshotZoneIds = snapshot.zones.map((z: any) => z.id);
              const fixedFloors = store.scenario.floors.map((f: any) => ({
                ...f,
                zoneIds: snapshotZoneIds.filter((zid: any) =>
                  snapshot.zones.some((z: any) => (z.id as string) === (zid as string))
                ),
              }));
              // If zones were added that aren't in any floor, add them to active floor
              const allFloorZoneIds = new Set(fixedFloors.flatMap((f: any) => f.zoneIds.map((id: any) => id as string)));
              const activeFloor = fixedFloors.find((f: any) => (f.id as string) === store.activeFloorId);
              if (activeFloor) {
                for (const z of snapshot.zones) {
                  if (!allFloorZoneIds.has(z.id as string)) {
                    activeFloor.zoneIds = [...activeFloor.zoneIds, z.id];
                  }
                }
              }
              store.setScenario({
                ...store.scenario,
                zones: snapshot.zones,
                media: snapshot.media,
                floors: fixedFloors,
                waypointGraph: snapshot.waypointGraph ?? undefined,
              });
            };
            if (e.shiftKey) {
              applySnapshot(store.redo(store.zones, store.media, store.waypointGraph));
            } else {
              applySnapshot(store.undo(store.zones, store.media, store.waypointGraph));
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
