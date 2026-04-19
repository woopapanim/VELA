import type { StateCreator } from 'zustand';
import type { ZoneConfig, MediaPlacement, WaypointGraph, FloorConfig, ElevatorShaft } from '@/domain';

export interface LayoutSnapshot {
  zones: ZoneConfig[];
  media: MediaPlacement[];
  waypointGraph: WaypointGraph | null;
  // Floors own zone membership, shafts group portal nodes — snapshotting them
  // keeps floor↔zone and shaft↔portal links consistent after undo/redo.
  floors: FloorConfig[];
  shafts: ElevatorShaft[];
}

export interface UndoSlice {
  undoStack: LayoutSnapshot[];
  redoStack: LayoutSnapshot[];
  pushUndo: (
    zones: ZoneConfig[],
    media: MediaPlacement[],
    waypointGraph?: WaypointGraph | null,
  ) => void;
  undo: (
    currentZones?: ZoneConfig[],
    currentMedia?: MediaPlacement[],
    currentGraph?: WaypointGraph | null,
  ) => LayoutSnapshot | null;
  redo: (
    currentZones?: ZoneConfig[],
    currentMedia?: MediaPlacement[],
    currentGraph?: WaypointGraph | null,
  ) => LayoutSnapshot | null;
  clearUndo: () => void;
}

const MAX_UNDO = 30;

// Read floors/shafts from the combined store. undoSlice lives in the same
// Zustand create() call as worldSlice, so get() returns the whole StoreState.
interface WorldBits {
  floors?: FloorConfig[];
  shafts?: ElevatorShaft[];
}

export const createUndoSlice: StateCreator<UndoSlice, [], [], UndoSlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  pushUndo: (zones, media, waypointGraph) => {
    const world = get() as unknown as WorldBits;
    const floors = world.floors ?? [];
    const shafts = world.shafts ?? [];
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), {
        zones: [...zones],
        media: [...media],
        waypointGraph: waypointGraph ?? null,
        floors: [...floors],
        shafts: [...shafts],
      }],
      redoStack: [],
    }));
  },

  undo: (currentZones, currentMedia, currentGraph) => {
    const state = get();
    if (state.undoStack.length === 0) return null;
    const snapshot = state.undoStack[state.undoStack.length - 1];
    const world = get() as unknown as WorldBits;
    const floors = world.floors ?? [];
    const shafts = world.shafts ?? [];
    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: currentZones && currentMedia
        ? [...state.redoStack, {
            zones: [...currentZones],
            media: [...currentMedia],
            waypointGraph: currentGraph ?? null,
            floors: [...floors],
            shafts: [...shafts],
          }]
        : [...state.redoStack, snapshot],
    });
    return snapshot;
  },

  redo: (currentZones, currentMedia, currentGraph) => {
    const state = get();
    if (state.redoStack.length === 0) return null;
    const snapshot = state.redoStack[state.redoStack.length - 1];
    const world = get() as unknown as WorldBits;
    const floors = world.floors ?? [];
    const shafts = world.shafts ?? [];
    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: currentZones && currentMedia
        ? [...state.undoStack, {
            zones: [...currentZones],
            media: [...currentMedia],
            waypointGraph: currentGraph ?? null,
            floors: [...floors],
            shafts: [...shafts],
          }]
        : [...state.undoStack, snapshot],
    });
    return snapshot;
  },

  clearUndo: () => set({ undoStack: [], redoStack: [] }),
});
