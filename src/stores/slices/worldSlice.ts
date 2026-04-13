import type { StateCreator } from 'zustand';
import type { FloorConfig, ZoneConfig, MediaPlacement, Scenario } from '@/domain';

const MEDIA_SCALE = 20;
const MEDIA_GAP = 8;

/** Check if a media rect overlaps any other media in the same zone */
function mediaOverlapsOthers(m: MediaPlacement, allMedia: readonly MediaPlacement[], excludeId?: string): boolean {
  const pw = m.size.width * MEDIA_SCALE, ph = m.size.height * MEDIA_SCALE;
  const ax = m.position.x - pw / 2, ay = m.position.y - ph / 2;
  for (const other of allMedia) {
    if ((other.id as string) === (excludeId ?? m.id as string)) continue;
    if ((other.zoneId as string) !== (m.zoneId as string)) continue;
    const ow = other.size.width * MEDIA_SCALE, oh = other.size.height * MEDIA_SCALE;
    const bx = other.position.x - ow / 2, by = other.position.y - oh / 2;
    if (ax < bx + ow + MEDIA_GAP && ax + pw + MEDIA_GAP > bx &&
        ay < by + oh + MEDIA_GAP && ay + ph + MEDIA_GAP > by) return true;
  }
  return false;
}

export interface WorldSlice {
  // State
  floors: FloorConfig[];
  zones: ZoneConfig[];
  media: MediaPlacement[];
  activeFloorId: string | null;
  scenario: Scenario | null;

  // Actions
  setScenario: (scenario: Scenario) => void;
  setActiveFloor: (floorId: string) => void;
  addZone: (zone: ZoneConfig) => void;
  updateZone: (zoneId: string, updates: Partial<ZoneConfig>) => void;
  removeZone: (zoneId: string) => void;
  addMedia: (media: MediaPlacement) => void;
  updateMedia: (mediaId: string, updates: Partial<MediaPlacement>) => void;
  removeMedia: (mediaId: string) => void;
  reset: () => void;
}

export const createWorldSlice: StateCreator<WorldSlice, [], [], WorldSlice> = (set, get) => ({
  floors: [],
  zones: [],
  media: [],
  activeFloorId: null,
  scenario: null,

  setScenario: (scenario) =>
    set({
      scenario,
      floors: [...scenario.floors],
      zones: [...scenario.zones],
      media: [...scenario.media],
      activeFloorId: scenario.floors[0]?.id as string ?? null,
    }),

  setActiveFloor: (floorId) => set({ activeFloorId: floorId }),

  addZone: (zone) => {
    // Save undo snapshot BEFORE mutation
    const s = get();
    (s as any).pushUndo?.(s.zones, s.media);
    set((s) => {
      const newZones = [...s.zones, zone];
      const newFloors = s.floors.map((f) =>
        (f.id as string) === s.activeFloorId
          ? { ...f, zoneIds: [...f.zoneIds, zone.id] }
          : f,
      );
      return {
        zones: newZones,
        floors: newFloors,
        scenario: s.scenario ? { ...s.scenario, zones: newZones, floors: newFloors } : s.scenario,
      };
    });
  },

  updateZone: (zoneId, updates) =>
    set((s) => {
      // If bounds changed, check overlap with other zones
      if (updates.bounds) {
        const gap = 5;
        const nb = updates.bounds;
        const overlaps = s.zones.some((z) => {
          if ((z.id as string) === zoneId) return false;
          const b = z.bounds;
          return nb.x < b.x + b.w + gap && nb.x + nb.w + gap > b.x &&
                 nb.y < b.y + b.h + gap && nb.y + nb.h + gap > b.y;
        });
        if (overlaps) return {}; // block update

        // Block if zone would be too small for its media
        const SCALE = 20;
        const gm = 25, wm = 10;
        const zoneMedia = s.media.filter((m) => (m.zoneId as string) === zoneId);
        for (const m of zoneMedia) {
          const pw = m.size.width * SCALE, ph = m.size.height * SCALE;
          const minW = pw + gm * 2;
          const minH = ph + wm * 2;
          if (nb.w < minW || nb.h < minH) return {}; // block resize
        }
      }
      const newZones = s.zones.map((z) =>
        (z.id as string) === zoneId ? { ...z, ...updates } : z,
      );
      // Clamp media inside updated zone bounds
      const SCALE = 20;
      const newBounds = updates.bounds;
      const newMedia = newBounds ? s.media.map((m) => {
        if ((m.zoneId as string) !== zoneId) return m;
        const pw = m.size.width * SCALE, ph = m.size.height * SCALE;
        const gm = 25, wm = 10; // gate margin / wall margin
        const b = newBounds;
        return {
          ...m,
          position: {
            x: Math.max(b.x + pw/2 + gm, Math.min(b.x + b.w - pw/2 - gm, m.position.x)),
            y: Math.max(b.y + ph/2 + wm, Math.min(b.y + b.h - ph/2 - wm, m.position.y)),
          },
        };
      }) : s.media;
      return {
        zones: newZones,
        media: newMedia,
        scenario: s.scenario ? { ...s.scenario, zones: newZones, media: newMedia } : s.scenario,
      };
    }),

  removeZone: (zoneId) => {
    // Save undo snapshot BEFORE mutation
    const s = get();
    (s as any).pushUndo?.(s.zones, s.media);
    set((s) => {
      const newZones = s.zones.filter((z) => (z.id as string) !== zoneId);
      const newFloors = s.floors.map((f) => ({
        ...f,
        zoneIds: f.zoneIds.filter((id) => (id as string) !== zoneId),
      }));
      return {
        zones: newZones,
        floors: newFloors,
        scenario: s.scenario ? { ...s.scenario, zones: newZones, floors: newFloors } : s.scenario,
      };
    });
  },

  addMedia: (media) => {
    // Save undo snapshot BEFORE mutation
    const s = get();
    (s as any).pushUndo?.(s.zones, s.media);
    // Clamp position inside parent zone
    const SCALE = 20;
    const zone = s.zones.find((z) => (z.id as string) === (media.zoneId as string));
    let clamped = media;
    if (zone) {
      const pw = media.size.width * SCALE, ph = media.size.height * SCALE;
      const gateMargin = 25; // keep away from gates on left/right walls
      const wallMargin = 10;
      const b = zone.bounds;
      clamped = {
        ...media,
        position: {
          x: Math.max(b.x + pw/2 + gateMargin, Math.min(b.x + b.w - pw/2 - gateMargin, media.position.x)),
          y: Math.max(b.y + ph/2 + wallMargin, Math.min(b.y + b.h - ph/2 - wallMargin, media.position.y)),
        },
      };
    }
    // Block if overlapping another media
    if (mediaOverlapsOthers(clamped, s.media)) return;
    set((s) => ({
      media: [...s.media, clamped],
      scenario: s.scenario ? { ...s.scenario, media: [...s.media, clamped] } : s.scenario,
    }));
  },

  updateMedia: (mediaId, updates) =>
    set((s) => {
      const newMedia = s.media.map((m) => {
        if ((m.id as string) !== mediaId) return m;
        const updated = { ...m, ...updates };
        // Clamp position inside parent zone
        const zone = s.zones.find((z) => (z.id as string) === (updated.zoneId as string));
        if (zone && updated.position && updated.size) {
          const SCALE = 20;
          const pw = updated.size.width * SCALE, ph = updated.size.height * SCALE;
          const gm = 25, wm = 10, b = zone.bounds;
          updated.position = {
            x: Math.max(b.x + pw/2 + gm, Math.min(b.x + b.w - pw/2 - gm, updated.position.x)),
            y: Math.max(b.y + ph/2 + wm, Math.min(b.y + b.h - ph/2 - wm, updated.position.y)),
          };
        }
        // Block if overlapping another media
        if (mediaOverlapsOthers(updated, s.media, mediaId)) return m; // revert to original
        return updated;
      });
      return {
        media: newMedia,
        scenario: s.scenario ? { ...s.scenario, media: newMedia } : s.scenario,
      };
    }),

  removeMedia: (mediaId) => {
    // Save undo snapshot BEFORE mutation
    const s = get();
    (s as any).pushUndo?.(s.zones, s.media);
    set((s) => ({
      media: s.media.filter((m) => (m.id as string) !== mediaId),
    }));
  },

  reset: () =>
    set({
      floors: [],
      zones: [],
      media: [],
      activeFloorId: null,
      scenario: null,
    }),
});
