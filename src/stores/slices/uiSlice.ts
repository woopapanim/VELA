import type { StateCreator } from 'zustand';

export type ActivePanel = 'build' | 'simulation' | 'scenario';
export type OverlayMode = 'none' | 'heatmap' | 'flow' | 'density';
export type Language = 'en' | 'ko';

const LANGUAGE_STORAGE_KEY = 'vela.language';

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'ko' ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

function writeStoredLanguage(lang: Language) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

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
  /** Analyze action card → Build 진입 시 카메라가 향할 world 좌표. CanvasPanel 이 mount 후 적용·소비. */
  focusTarget: { x: number; y: number; zoom?: number } | null;
  isPanelCollapsed: { left: boolean; right: boolean };
  polygonEditMode: boolean;
  mediaPolygonEditMode: boolean;
  language: Language;

  // Actions
  selectZone: (zoneId: string | null) => void;
  selectMedia: (mediaId: string | null) => void;
  setFocusTarget: (target: { x: number; y: number; zoom?: number } | null) => void;
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
  setLanguage: (lang: Language) => void;
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
  focusTarget: null,
  isPanelCollapsed: { left: false, right: false },
  polygonEditMode: false,
  mediaPolygonEditMode: false,
  language: readStoredLanguage(),

  selectZone: (zoneId) => set({ selectedZoneId: zoneId, selectedMediaId: null }),
  selectMedia: (mediaId) => set({ selectedMediaId: mediaId, selectedZoneId: null }),
  setFocusTarget: (target) => set({ focusTarget: target }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setOverlayMode: (mode) => set({ overlayMode: mode }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleGates: () => set((s) => ({ showGates: !s.showGates })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleBackground: () => set((s) => ({ showBackground: !s.showBackground })),
  setCamera: (camera) => set((s) => ({ camera: { ...s.camera, ...camera } })),
  setPolygonEditMode: (on) => set({ polygonEditMode: on }),
  setMediaPolygonEditMode: (on) => set({ mediaPolygonEditMode: on }),
  setLanguage: (lang) => {
    writeStoredLanguage(lang);
    set({ language: lang });
  },
  togglePanel: (side) =>
    set((s) => ({
      isPanelCollapsed: {
        ...s.isPanelCollapsed,
        [side]: !s.isPanelCollapsed[side],
      },
    })),
});
