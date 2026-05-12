import { useEffect } from 'react';
import { useStore } from '@/stores';
import type { OverlayMode } from '@/stores';
import type { LayoutSnapshot } from '@/stores/slices/undoSlice';
import type { ZoneConfig, Gate, MediaPlacement, MediaId } from '@/domain';
import { MEDIA_SCALE } from '@/domain';
import { pinCurrentMoment } from '@/analytics';

declare global {
  interface Window {
    __vela_clipboard_zone?: ZoneConfig;
    __vela_clipboard_media?: MediaPlacement;
  }
}

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
            store.setPhase('paused');
          } else if (store.phase === 'paused') {
            store.setPhase('running');
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
        case 'p':
        case 'P': {
          const totalS = Math.max(0, Math.round(store.timeState.elapsed / 1000));
          const mm = Math.floor(totalS / 60);
          const ss = totalS % 60;
          const label = `Pin @ ${mm}:${String(ss).padStart(2, '0')}`;
          pinCurrentMoment(store, label);
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
            const applySnapshot = (snapshot: LayoutSnapshot | null) => {
              if (!snapshot || !store.scenario) return;
              // Snapshot carries floors/shafts too — restore them as-is so
              // floor↔zone and shaft↔portal links stay consistent after undo.
              const snapFloors = snapshot.floors && snapshot.floors.length > 0
                ? snapshot.floors
                : store.scenario.floors;
              const snapShafts = snapshot.shafts ?? store.scenario.shafts ?? [];
              store.setScenario({
                ...store.scenario,
                zones: snapshot.zones,
                media: snapshot.media,
                floors: snapFloors,
                shafts: snapShafts,
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
          // Copy selected media OR zone (Cmd/Ctrl+C). Media takes priority when
          // both are selected. Sets only one clipboard slot so paste is unambiguous.
          if ((e.metaKey || e.ctrlKey) && store.phase === 'idle') {
            if (store.selectedMediaId) {
              e.preventDefault();
              const m = store.media.find((mm) => (mm.id as string) === store.selectedMediaId);
              if (m) {
                window.__vela_clipboard_media = JSON.parse(JSON.stringify(m));
                window.__vela_clipboard_zone = undefined;
              }
            } else if (store.selectedZoneId) {
              e.preventDefault();
              const zone = store.zones.find((z) => (z.id as string) === store.selectedZoneId);
              if (zone) {
                window.__vela_clipboard_zone = JSON.parse(JSON.stringify(zone));
                window.__vela_clipboard_media = undefined;
              }
            }
          }
          break;
        }
        case 'v':
        case 'V': {
          // Paste from clipboard (Cmd/Ctrl+V). Whichever was last copied — media
          // or zone — is pasted at horizontal offset from original.
          if ((e.metaKey || e.ctrlKey) && store.phase === 'idle') {
            e.preventDefault();
            const clipMedia = window.__vela_clipboard_media;
            if (clipMedia) {
              // Pick unique `_dupN` id (matches MediaEditor Duplicate button).
              let n = 1;
              while (store.media.some((mm) => (mm.id as string) === `${clipMedia.id as string}_dup${n}`)) n++;
              const newId = `${clipMedia.id as string}_dup${n}` as MediaId;
              const offsetPx = Math.max(20, clipMedia.size.width * MEDIA_SCALE * 1.2);
              const pasted: MediaPlacement = {
                ...clipMedia,
                id: newId,
                position: { x: clipMedia.position.x + offsetPx, y: clipMedia.position.y },
              };
              store.addMedia(pasted);
              store.selectMedia(newId);
              break;
            }
            const clipZone = window.__vela_clipboard_zone;
            if (clipZone) {
              // suffix 로 random — 빠른 연속 paste 에서 Date.now() 가 동일 ms
              // 일 때 ID 충돌하던 것 방지.
              const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const newId = `z_paste_${suffix}`;
              // 카운터 방식은 재복사 시 리셋되어 또 겹침. 대신 우측으로 한 칸씩
              // 걸어가며 비어 있는 첫 자리에 놓는다 (zone width+gap step).
              const step = Math.max(60, clipZone.bounds.w + 20);
              const overlaps = (x: number, y: number) => {
                const w = clipZone.bounds.w, h = clipZone.bounds.h;
                return store.zones.some((z) => {
                  const b = z.bounds;
                  return !(x + w <= b.x || b.x + b.w <= x || y + h <= b.y || b.y + b.h <= y);
                });
              };
              let tx = clipZone.bounds.x + step;
              const ty = clipZone.bounds.y;
              for (let i = 0; i < 200 && overlaps(tx, ty); i++) tx += step;
              const pasted = {
                ...clipZone,
                id: newId,
                name: clipZone.name + ' (Copy)',
                bounds: { ...clipZone.bounds, x: tx, y: ty },
                gates: clipZone.gates.map((g: Gate, i: number): Gate => ({
                  ...g,
                  id: `g_paste_${suffix}_${i}` as Gate['id'],
                  zoneId: newId as Gate['zoneId'],
                  connectedGateId: null,
                })),
              };
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              store.addZone(pasted as any);
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
