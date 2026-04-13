import type { StateCreator } from 'zustand';
import type { ZoneConfig, MediaPlacement } from '@/domain';

interface LayoutSnapshot {
  zones: ZoneConfig[];
  media: MediaPlacement[];
}

export interface UndoSlice {
  undoStack: LayoutSnapshot[];
  redoStack: LayoutSnapshot[];
  pushUndo: (zones: ZoneConfig[], media: MediaPlacement[]) => void;
  undo: (currentZones?: ZoneConfig[], currentMedia?: MediaPlacement[]) => LayoutSnapshot | null;
  redo: (currentZones?: ZoneConfig[], currentMedia?: MediaPlacement[]) => LayoutSnapshot | null;
  clearUndo: () => void;
}

const MAX_UNDO = 30;

export const createUndoSlice: StateCreator<UndoSlice, [], [], UndoSlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  pushUndo: (zones, media) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), { zones: [...zones], media: [...media] }],
      redoStack: [],
    })),

  undo: (currentZones?: ZoneConfig[], currentMedia?: MediaPlacement[]) => {
    const state = get();
    if (state.undoStack.length === 0) return null;
    const snapshot = state.undoStack[state.undoStack.length - 1];
    set({
      undoStack: state.undoStack.slice(0, -1),
      // Save CURRENT state to redo (not the popped snapshot)
      redoStack: currentZones && currentMedia
        ? [...state.redoStack, { zones: [...currentZones], media: [...currentMedia] }]
        : [...state.redoStack, snapshot],
    });
    return snapshot;
  },

  redo: (currentZones?: ZoneConfig[], currentMedia?: MediaPlacement[]) => {
    const state = get();
    if (state.redoStack.length === 0) return null;
    const snapshot = state.redoStack[state.redoStack.length - 1];
    set({
      redoStack: state.redoStack.slice(0, -1),
      // Save CURRENT state to undo
      undoStack: currentZones && currentMedia
        ? [...state.undoStack, { zones: [...currentZones], media: [...currentMedia] }]
        : [...state.undoStack, snapshot],
    });
    return snapshot;
  },

  clearUndo: () => set({ undoStack: [], redoStack: [] }),
});
