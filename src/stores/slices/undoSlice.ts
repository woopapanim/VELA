import type { StateCreator } from 'zustand';
import type { ZoneConfig, MediaPlacement, WaypointGraph } from '@/domain';

interface LayoutSnapshot {
  zones: ZoneConfig[];
  media: MediaPlacement[];
  waypointGraph: WaypointGraph | null;
}

export interface UndoSlice {
  undoStack: LayoutSnapshot[];
  redoStack: LayoutSnapshot[];
  pushUndo: (zones: ZoneConfig[], media: MediaPlacement[], waypointGraph?: WaypointGraph | null) => void;
  undo: (currentZones?: ZoneConfig[], currentMedia?: MediaPlacement[], currentGraph?: WaypointGraph | null) => LayoutSnapshot | null;
  redo: (currentZones?: ZoneConfig[], currentMedia?: MediaPlacement[], currentGraph?: WaypointGraph | null) => LayoutSnapshot | null;
  clearUndo: () => void;
}

const MAX_UNDO = 30;

export const createUndoSlice: StateCreator<UndoSlice, [], [], UndoSlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  pushUndo: (zones, media, waypointGraph) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), { zones: [...zones], media: [...media], waypointGraph: waypointGraph ?? null }],
      redoStack: [],
    })),

  undo: (currentZones?, currentMedia?, currentGraph?) => {
    const state = get();
    if (state.undoStack.length === 0) return null;
    const snapshot = state.undoStack[state.undoStack.length - 1];
    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: currentZones && currentMedia
        ? [...state.redoStack, { zones: [...currentZones], media: [...currentMedia], waypointGraph: currentGraph ?? null }]
        : [...state.redoStack, snapshot],
    });
    return snapshot;
  },

  redo: (currentZones?, currentMedia?, currentGraph?) => {
    const state = get();
    if (state.redoStack.length === 0) return null;
    const snapshot = state.redoStack[state.redoStack.length - 1];
    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: currentZones && currentMedia
        ? [...state.undoStack, { zones: [...currentZones], media: [...currentMedia], waypointGraph: currentGraph ?? null }]
        : [...state.undoStack, snapshot],
    });
    return snapshot;
  },

  clearUndo: () => set({ undoStack: [], redoStack: [] }),
});
