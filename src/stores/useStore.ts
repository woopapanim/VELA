import { create } from 'zustand';
import { createWorldSlice, type WorldSlice } from './slices/worldSlice';
import { createSimSlice, type SimSlice } from './slices/simSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';
import { createAnalyticsSlice, type AnalyticsSlice } from './slices/analyticsSlice';
import { createEditorSlice, type EditorSlice } from './slices/editorSlice';
import { createReplaySlice, type ReplaySlice } from './slices/replaySlice';
import { createUndoSlice, type UndoSlice } from './slices/undoSlice';
import { createPinpointSlice, type PinpointSlice } from './slices/pinpointSlice';

export type StoreState = WorldSlice & SimSlice & UiSlice & AnalyticsSlice & EditorSlice & ReplaySlice & UndoSlice & PinpointSlice;

export const useStore = create<StoreState>()((...a) => ({
  ...createWorldSlice(...a),
  ...createSimSlice(...a),
  ...createUiSlice(...a),
  ...createAnalyticsSlice(...a),
  ...createEditorSlice(...a),
  ...createReplaySlice(...a),
  ...createUndoSlice(...a),
  ...createPinpointSlice(...a),
}));
if (typeof window !== 'undefined') (window as any).__store = useStore;

