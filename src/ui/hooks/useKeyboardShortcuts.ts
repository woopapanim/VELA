import { useEffect } from 'react';
import { useStore } from '@/stores';
import type { OverlayMode } from '@/stores';
import { pinCurrentMoment } from '@/analytics';

/**
 * isBuildScreen — Build 단계(zone/media/waypoint 편집)일 때만 1~5 편집 모드 키 활성.
 *   다른 단계 (welcome/mode/ready/analyze) 에서는 Build 단축키가 silently editorMode 를
 *   바꿔 사용자가 Build 들어가면 의외 모드로 시작하는 사고를 방지.
 *   Space/Esc/H/F/G/L/P 등은 단계 무관 의미가 있으므로 그대로.
 */
export function useKeyboardShortcuts(opts: { isBuildScreen?: boolean } = {}) {
  const { isBuildScreen = false } = opts;
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
          // Esc 는 "현재 진행 중인 임시 편집 상태를 다 끈다" 의미 — 부분 상태에 갇히지 않게.
          // - polygonEditMode / mediaPolygonEditMode: 정점 편집 미완성 상태가 toolbar 안 보일 때
          //   계속 살아있는 사고 방지.
          // - bgCalRuler: 도면 캘리브레이션 ruler 가 다른 화면 갔다 와도 캔버스에 남는 것 방지.
          if (store.polygonEditMode) store.setPolygonEditMode(false);
          if (store.mediaPolygonEditMode) store.setMediaPolygonEditMode(false);
          if (store.bgCalRuler) store.setBgCalRuler(null);
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
        case '1': if (isBuildScreen) store.setEditorMode('select'); break;
        case '2': if (isBuildScreen) store.setEditorMode('create-zone'); break;
        case '3': if (isBuildScreen) store.setEditorMode('place-media'); break;
        case '4': if (isBuildScreen) store.setEditorMode('place-waypoint'); break;
        case '5': if (isBuildScreen) store.setEditorMode('connect-waypoint'); break;
        case 'z':
        case 'Z': {
          if ((e.metaKey || e.ctrlKey) && store.phase === 'idle') {
            e.preventDefault();
            const applySnapshot = (snapshot: any) => {
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
          // Copy selected zone (Cmd/Ctrl+C)
          if ((e.metaKey || e.ctrlKey) && store.selectedZoneId && store.phase === 'idle') {
            e.preventDefault();
            const zone = store.zones.find((z) => (z.id as string) === store.selectedZoneId);
            if (zone) {
              (window as any).__vela_clipboard_zone = JSON.parse(JSON.stringify(zone));
            }
          }
          break;
        }
        case 'v':
        case 'V': {
          // Paste zone (Cmd/Ctrl+V)
          if ((e.metaKey || e.ctrlKey) && store.phase === 'idle') {
            e.preventDefault();
            const clipZone = (window as any).__vela_clipboard_zone;
            if (clipZone) {
              const newId = `z_paste_${Date.now()}`;
              // 기존 zone 의 width + 20px 만큼 우측으로 이동 — 겹치지 않게.
              const offsetX = clipZone.bounds.w + 20;
              // 이름 중복 시 (Copy), (Copy 2), (Copy 3)... 자동 증가.
              const baseName = clipZone.name.replace(/ \(Copy(?: \d+)?\)$/, '');
              const existingNames = new Set(store.zones.map((z: any) => z.name));
              let copyName = `${baseName} (Copy)`;
              let n = 2;
              while (existingNames.has(copyName)) {
                copyName = `${baseName} (Copy ${n})`;
                n += 1;
              }
              const pasted = {
                ...clipZone,
                id: newId,
                name: copyName,
                bounds: { ...clipZone.bounds, x: clipZone.bounds.x + offsetX, y: clipZone.bounds.y },
                gates: clipZone.gates.map((g: any, i: number) => ({
                  ...g,
                  id: `g_paste_${Date.now()}_${i}`,
                  zoneId: newId,
                  connectedGateId: null,
                })),
              };
              store.addZone(pasted);
              store.selectZone(newId);
              // 다음 paste 가 또 우측으로 cascade 되도록 clipboard 위치 갱신.
              (window as any).__vela_clipboard_zone = { ...clipZone, bounds: pasted.bounds };
            }
          }
          break;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isBuildScreen]);
}
