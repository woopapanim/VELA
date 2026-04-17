import type { StateCreator } from 'zustand';

export type ActivePanel = 'build' | 'simulation' | 'scenario';
export type OverlayMode = 'none' | 'heatmap' | 'flow' | 'density';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface UiSlice {
  // State
  selectedZoneId: string | null;
  selectedMediaId: string | null;
  activePanel: ActivePanel;
  overlayMode: OverlayMode;
  showGrid: boolean;
  showGates: boolean;
  showLabels: boolean;
  showBackground: boolean;
  camera: CameraState;
  isPanelCollapsed: { left: boolean; right: boolean };
  polygonEditMode: boolean;
  mediaPolygonEditMode: boolean;

  // Actions
  selectZone: (zoneId: string | null) => void;
  selectMedia: (mediaId: string | null) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setOverlayMode: (mode: OverlayMode) => void;
  toggleGrid: () => void;
  toggleGates: () => void;
  toggleLabels: () => void;
  toggleBackground: () => void;
  setCamera: (camera: Partial<CameraState>) => void;
  togglePanel: (side: 'left' | 'right') => void;
  setPolygonEditMode: (on: boolean) => void;
  setMediaPolygonEditMode: (on: boolean) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  selectedZoneId: null,
  selectedMediaId: null,
  activePanel: 'build',
  overlayMode: 'none',
  showGrid: true,
  showGates: true,
  showLabels: true,
  showBackground: true,
  camera: { x: 0, y: 0, zoom: 1 },
  isPanelCollapsed: { left: false, right: false },
  polygonEditMode: false,
  mediaPolygonEditMode: false,

  selectZone: (zoneId) => set({ selectedZoneId: zoneId, selectedMediaId: null }),
  selectMedia: (mediaId) => set({ selectedMediaId: mediaId, selectedZoneId: null }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setOverlayMode: (mode) => set({ overlayMode: mode }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleGates: () => set((s) => ({ showGates: !s.showGates })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleBackground: () => set((s) => ({ showBackground: !s.showBackground })),
  setCamera: (camera) => set((s) => ({ camera: { ...s.camera, ...camera } })),
  setPolygonEditMode: (on) => set({ polygonEditMode: on }),
  setMediaPolygonEditMode: (on) => set({ mediaPolygonEditMode: on }),
  togglePanel: (side) =>
    set((s) => ({
      isPanelCollapsed: {
        ...s.isPanelCollapsed,
        [side]: !s.isPanelCollapsed[side],
      },
    })),
});
