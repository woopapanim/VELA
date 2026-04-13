import type { StateCreator } from 'zustand';
import type { Vector2D } from '@/domain';

export type EditorMode = 'select' | 'create-zone' | 'place-gate' | 'place-media' | 'connect-gate';
export type DragAction = 'none' | 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw';

export interface EditorSlice {
  editorMode: EditorMode;
  dragAction: DragAction;
  dragStartWorld: Vector2D | null;
  dragCurrentWorld: Vector2D | null;
  dragTargetZoneId: string | null;
  pendingGateSourceId: string | null; // for gate connection
  pendingMediaType: string | null;    // for media placement

  setEditorMode: (mode: EditorMode) => void;
  startDrag: (action: DragAction, worldPos: Vector2D, targetZoneId?: string) => void;
  updateDrag: (worldPos: Vector2D) => void;
  endDrag: () => void;
  setPendingGateSource: (gateId: string | null) => void;
  setPendingMediaType: (mediaType: string | null) => void;
}

export const createEditorSlice: StateCreator<EditorSlice, [], [], EditorSlice> = (set) => ({
  editorMode: 'select',
  dragAction: 'none',
  dragStartWorld: null,
  dragCurrentWorld: null,
  dragTargetZoneId: null,
  pendingGateSourceId: null,
  pendingMediaType: null,

  setEditorMode: (mode) => set({ editorMode: mode, dragAction: 'none', dragStartWorld: null, dragCurrentWorld: null }),
  startDrag: (action, worldPos, targetZoneId) => set({ dragAction: action, dragStartWorld: worldPos, dragCurrentWorld: worldPos, dragTargetZoneId: targetZoneId ?? null }),
  updateDrag: (worldPos) => set({ dragCurrentWorld: worldPos }),
  endDrag: () => set({ dragAction: 'none', dragStartWorld: null, dragCurrentWorld: null, dragTargetZoneId: null }),
  setPendingGateSource: (gateId) => set({ pendingGateSourceId: gateId }),
  setPendingMediaType: (mediaType) => set({ pendingMediaType: mediaType }),
});
