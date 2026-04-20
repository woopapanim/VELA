import type { StateCreator } from 'zustand';
import type { PinnedTimePoint, PinId } from '@/domain';

export const MAX_COMPARE_PINS = 4;

export interface PinpointSlice {
  // State
  pins: readonly PinnedTimePoint[];           // sorted ascending by simulationTimeMs
  selectedPinId: PinId | null;                // detail panel target
  comparePinIds: readonly PinId[];            // up to MAX_COMPARE_PINS

  // Actions
  addPin: (pin: PinnedTimePoint) => void;
  removePin: (id: PinId) => void;
  updatePinLabel: (id: PinId, label: string) => void;
  selectPin: (id: PinId | null) => void;
  toggleCompare: (id: PinId) => boolean;      // returns false if compare list is full
  clearCompare: () => void;
  clearPins: () => void;
  setPins: (pins: readonly PinnedTimePoint[]) => void;
}

export const createPinpointSlice: StateCreator<PinpointSlice, [], [], PinpointSlice> = (set, get) => ({
  pins: [],
  selectedPinId: null,
  comparePinIds: [],

  addPin: (pin) =>
    set((s) => {
      const next = [...s.pins, pin].sort((a, b) => a.simulationTimeMs - b.simulationTimeMs);
      return { pins: next, selectedPinId: pin.id };
    }),

  removePin: (id) =>
    set((s) => ({
      pins: s.pins.filter((p) => p.id !== id),
      selectedPinId: s.selectedPinId === id ? null : s.selectedPinId,
      comparePinIds: s.comparePinIds.filter((p) => p !== id),
    })),

  updatePinLabel: (id, label) =>
    set((s) => ({
      pins: s.pins.map((p) => (p.id === id ? { ...p, label } : p)),
    })),

  selectPin: (id) => set({ selectedPinId: id }),

  toggleCompare: (id) => {
    const { comparePinIds } = get();
    const exists = comparePinIds.includes(id);
    if (!exists && comparePinIds.length >= MAX_COMPARE_PINS) return false;
    set({
      comparePinIds: exists
        ? comparePinIds.filter((p) => p !== id)
        : [...comparePinIds, id],
    });
    return true;
  },

  clearCompare: () => set({ comparePinIds: [] }),

  clearPins: () => set({ pins: [], selectedPinId: null, comparePinIds: [] }),

  setPins: (pins) =>
    set(() => {
      const sorted = [...pins].sort((a, b) => a.simulationTimeMs - b.simulationTimeMs);
      return { pins: sorted, selectedPinId: null, comparePinIds: [] };
    }),
});
