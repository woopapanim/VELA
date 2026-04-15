import type { StateCreator } from 'zustand';
import type { Vector2D } from '@/domain';
import type { WaypointType } from '@/domain';

export type EditorMode = 'select' | 'create-zone' | 'place-gate' | 'place-media' | 'connect-gate' | 'place-waypoint' | 'connect-waypoint';
export type DragAction = 'none' | 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw';

export interface EditorSlice {
  editorMode: EditorMode;
  dragAction: DragAction;
  dragStartWorld: Vector2D | null;
  dragCurrentWorld: Vector2D | null;
  dragTargetZoneId: string | null;
  pendingGateSourceId: string | null; // for gate connection
  pendingMediaType: string | null;    // for media placement
  // Waypoint graph editor
  pendingWaypointType: WaypointType | null;
  pendingEdgeSourceId: string | null; // for edge connection
  selectedWaypointId: string | null;
  selectedEdgeId: string | null;

  setEditorMode: (mode: EditorMode) => void;
  startDrag: (action: DragAction, worldPos: Vector2D, targetZoneId?: string) => void;
  updateDrag: (worldPos: Vector2D) => void;
  endDrag: () => void;
  setPendingGateSource: (gateId: string | null) => void;
  setPendingMediaType: (mediaType: string | null) => void;
  setPendingWaypointType: (type: WaypointType | null) => void;
  setPendingEdgeSource: (nodeId: string | null) => void;
  selectWaypoint: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
}

export const createEditorSlice: StateCreator<EditorSlice, [], [], EditorSlice> = (set) => ({
  editorMode: 'select',
  dragAction: 'none',
  dragStartWorld: null,
  dragCurrentWorld: null,
  dragTargetZoneId: null,
  pendingGateSourceId: null,
  pendingMediaType: null,
  pendingWaypointType: null,
  pendingEdgeSourceId: null,
  selectedWaypointId: null,
  selectedEdgeId: null,

  setEditorMode: (mode) => set({ editorMode: mode, dragAction: 'none', dragStartWorld: null, dragCurrentWorld: null }),
  startDrag: (action, worldPos, targetZoneId) => set({ dragAction: action, dragStartWorld: worldPos, dragCurrentWorld: worldPos, dragTargetZoneId: targetZoneId ?? null }),
  updateDrag: (worldPos) => set({ dragCurrentWorld: worldPos }),
  endDrag: () => set({ dragAction: 'none', dragStartWorld: null, dragCurrentWorld: null, dragTargetZoneId: null }),
  setPendingGateSource: (gateId) => set({ pendingGateSourceId: gateId }),
  setPendingMediaType: (mediaType) => set({ pendingMediaType: mediaType }),
  setPendingWaypointType: (type) => set({ pendingWaypointType: type }),
  setPendingEdgeSource: (nodeId) => set({ pendingEdgeSourceId: nodeId }),
  selectWaypoint: (id) => set({ selectedWaypointId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedWaypointId: null }),
});
