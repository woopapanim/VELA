import type { StoreState } from './useStore';

// ---- World selectors ----
export const selectZones = (s: StoreState) => s.zones;
export const selectMedia = (s: StoreState) => s.media;
export const selectFloors = (s: StoreState) => s.floors;
export const selectActiveFloorId = (s: StoreState) => s.activeFloorId;
export const selectScenarioDirty = (s: StoreState) =>
  !!s.scenario && s.scenario !== s.lastSavedScenarioRef;
export const selectActiveFloorZones = (s: StoreState) => {
  if (!s.activeFloorId) return s.zones;
  const floor = s.floors.find((f) => (f.id as string) === s.activeFloorId);
  if (!floor) return s.zones;
  const zoneIdSet = new Set(floor.zoneIds.map((z) => z as string));
  return s.zones.filter((z) => zoneIdSet.has(z.id as string));
};

// ---- Simulation selectors ----
export const selectVisitors = (s: StoreState) => s.visitors;
export const selectActiveVisitors = (s: StoreState) => s.visitors.filter((v) => v.isActive);
export const selectPhase = (s: StoreState) => s.phase;
export const selectTimeState = (s: StoreState) => s.timeState;
export const selectElapsed = (s: StoreState) => s.timeState.elapsed;
export const selectVisitorCount = (s: StoreState) => s.visitors.length;
export const selectActiveVisitorCount = (s: StoreState) => s.visitors.filter((v) => v.isActive).length;

// ---- UI selectors ----
export const selectCamera = (s: StoreState) => s.camera;
export const selectOverlayMode = (s: StoreState) => s.overlayMode;
export const selectSelectedZoneId = (s: StoreState) => s.selectedZoneId;

// ---- Analytics selectors ----
export const selectLatestSnapshot = (s: StoreState) => s.latestSnapshot;
export const selectKpiHistory = (s: StoreState) => s.kpiHistory;
