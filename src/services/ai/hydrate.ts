import type {
  Scenario, FloorConfig, ZoneConfig, Gate, MediaPlacement,
  HexColor, MediaInteractionType,
} from '@/domain';
import {
  DEFAULT_PHYSICS, DEFAULT_SKIP_THRESHOLD, MEDIA_PRESETS,
  ZoneId, MediaId, GateId, FloorId, ScenarioId,
} from '@/domain';
import type { DraftScenario, DraftZone, DraftGate, HydrationWarning } from './types';

export interface HydrationResult {
  readonly scenario: Scenario;
  readonly warnings: readonly HydrationWarning[];
}

/** Default px-per-meter. Matches VELA's canvas.scale = 0.025 (i.e. 1 px = 0.025 m → 40 px/m). */
const PX_PER_METER = 40;
/** Canvas margin around the floor plan so gates/media near edges don't clip. */
const CANVAS_MARGIN_PX = 80;

const ZONE_PALETTE: readonly HexColor[] = [
  '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15',
  '#4ade80', '#22d3ee', '#f87171', '#c084fc', '#34d399',
];

/**
 * Hydrate a DraftScenario (from Claude Vision) into a runnable VELA Scenario.
 *
 * Responsibilities:
 *   - Scale conversion: meters → pixels at the default VELA scale.
 *   - ID minting: plain strings → branded IDs.
 *   - Gate snapping: clamp gate positions onto their zone's boundary.
 *   - Gate pairing: match `connectsTo` references into connectedGateId pairs.
 *   - Defaults: visitorDistribution, simulationConfig, flowType, capacity, color.
 *   - Permissive: never throws — drops invalid entries with warnings.
 */
export function hydrateDraft(draft: DraftScenario, backgroundImage: string): HydrationResult {
  const warnings: HydrationWarning[] = [];

  // ── Canvas dimensions ──────────────────────────────────────────────────
  const imageWidthM = Number.isFinite(draft.scale?.widthMeters) && draft.scale.widthMeters > 0
    ? draft.scale.widthMeters : 20;
  const imageHeightM = Number.isFinite(draft.scale?.heightMeters) && draft.scale.heightMeters > 0
    ? draft.scale.heightMeters : 15;
  if (!draft.scale || !Number.isFinite(draft.scale.widthMeters)) {
    warnings.push({ severity: 'warning', message: 'Scale not detected — assumed 20m × 15m. Rescale via background tools if wrong.' });
  }

  const canvasWidthPx = Math.round(imageWidthM * PX_PER_METER + CANVAS_MARGIN_PX * 2);
  const canvasHeightPx = Math.round(imageHeightM * PX_PER_METER + CANVAS_MARGIN_PX * 2);

  const floorId = FloorId('floor_1f');
  const m2px = (m: number) => Math.round(m * PX_PER_METER + CANVAS_MARGIN_PX);
  const sz2px = (m: number) => Math.round(m * PX_PER_METER);

  // ── Zones ──────────────────────────────────────────────────────────────
  const zoneKeyToId = new Map<string, string>();
  const zones: ZoneConfig[] = [];
  let colorIdx = 0;

  for (const dz of draft.zones ?? []) {
    if (!dz.key || !dz.rect) {
      warnings.push({ severity: 'warning', message: `Zone "${dz.name || '?'}" dropped: missing key or rect.` });
      continue;
    }
    const zoneIdStr = `zone_${dz.key}`;
    zoneKeyToId.set(dz.key, zoneIdStr);

    const rectPx = {
      x: m2px(dz.rect.x),
      y: m2px(dz.rect.y),
      w: sz2px(Math.max(0.5, dz.rect.w)),
      h: sz2px(Math.max(0.5, dz.rect.h)),
    };
    const areaM2 = dz.rect.w * dz.rect.h;
    const capacity = Math.max(2, Math.floor(areaM2 / 1.2)); // ~1.2 m² per person comfortable

    const zone: ZoneConfig = {
      id: ZoneId(zoneIdStr),
      name: dz.name || dz.key,
      type: dz.type,
      shape: 'rect',
      bounds: rectPx,
      polygon: null,
      area: Math.round(areaM2),
      capacity,
      flowType: dz.flowType ?? 'free',
      gates: [], // filled after second pass
      mediaIds: [],
      color: ZONE_PALETTE[colorIdx++ % ZONE_PALETTE.length],
      attractiveness: clamp01(dz.attractiveness ?? 0.5),
      metadata: {},
    };
    zones.push(zone);
  }

  if (zones.length === 0) {
    warnings.push({ severity: 'error', message: 'No valid zones produced — scenario cannot be loaded.' });
  }

  // ── Gates (second pass: need zoneKeyToId populated) ────────────────────
  // First build all gates, then wire connectedGateId pairs.
  const gatesByZone = new Map<string, Gate[]>();
  const gateRefs: Array<{ gate: Gate; connectsTo?: string }> = [];

  for (const dz of draft.zones ?? []) {
    const zoneIdStr = zoneKeyToId.get(dz.key);
    if (!zoneIdStr) continue;
    const zone = zones.find((z) => z.id === zoneIdStr)!;
    const zoneGates: Gate[] = [];

    const draftGates = dz.gates ?? [];
    const effectiveGates = draftGates.length > 0 ? draftGates : [autoGate(dz)];

    for (const dg of effectiveGates) {
      if (!dg.position) continue;
      const snapped = snapToRectEdge(
        { x: m2px(dg.position.x), y: m2px(dg.position.y) },
        zone.bounds,
      );
      const gateId = GateId(`gate_${dz.key}_${zoneGates.length}`);
      const gate: Gate = {
        id: gateId,
        zoneId: ZoneId(zoneIdStr),
        floorId,
        type: dg.type ?? 'bidirectional',
        position: snapped,
        width: sz2px(Math.max(0.8, dg.width ?? 1.0)),
        connectedGateId: null,
      };
      zoneGates.push(gate);
      gateRefs.push({ gate, connectsTo: dg.connectsTo });
    }

    gatesByZone.set(zoneIdStr, zoneGates);
  }

  // Wire pairs: for each gate with connectsTo, find the closest gate in the target zone.
  for (const { gate, connectsTo } of gateRefs) {
    if (!connectsTo) continue;
    const targetZoneIdStr = zoneKeyToId.get(connectsTo);
    if (!targetZoneIdStr) continue;
    const candidates = gatesByZone.get(targetZoneIdStr) ?? [];
    if (candidates.length === 0) continue;
    const best = candidates.reduce((a, b) =>
      distSq(a.position, gate.position) < distSq(b.position, gate.position) ? a : b,
    );
    // Mutate through a fresh object (Gate is readonly, but it's still in our local array)
    const pairedGate: Gate = { ...gate, connectedGateId: best.id };
    const pairedBest: Gate = { ...best, connectedGateId: gate.id };
    replaceGate(gatesByZone, gate.zoneId as string, gate.id as string, pairedGate);
    replaceGate(gatesByZone, best.zoneId as string, best.id as string, pairedBest);
  }

  // Attach gates back onto zones
  const zonesWithGates: ZoneConfig[] = zones.map((z) => ({
    ...z,
    gates: gatesByZone.get(z.id as string) ?? [],
  }));

  for (const z of zonesWithGates) {
    if (z.gates.length === 0) {
      warnings.push({ severity: 'warning', message: `Zone "${z.name}" has no gates — auto-generated one.` });
    }
  }

  // ── Media placements ───────────────────────────────────────────────────
  const mediaList: MediaPlacement[] = [];
  const zoneMediaMap = new Map<string, string[]>();

  for (const dm of draft.media ?? []) {
    const zoneIdStr = zoneKeyToId.get(dm.zoneKey);
    if (!zoneIdStr) {
      warnings.push({ severity: 'warning', message: `Media "${dm.name}" dropped: unknown zoneKey "${dm.zoneKey}".` });
      continue;
    }
    const preset = MEDIA_PRESETS[dm.type];
    if (!preset) {
      warnings.push({ severity: 'warning', message: `Media "${dm.name}" dropped: unknown type "${dm.type}".` });
      continue;
    }
    const mediaIdStr = `media_${mediaList.length + 1}`;
    const size = dm.size
      ? { width: sz2px(dm.size.width), height: sz2px(dm.size.height) }
      : { width: sz2px(preset.defaultSize.width), height: sz2px(preset.defaultSize.height) };

    const interactionType: MediaInteractionType =
      preset.category === 'analog' ? 'analog'
      : preset.category === 'passive_media' ? 'passive'
      : preset.category === 'immersive' ? 'staged'
      : 'active';

    const placement: MediaPlacement = {
      id: MediaId(mediaIdStr),
      name: dm.name || dm.type,
      type: dm.type,
      category: preset.category,
      zoneId: ZoneId(zoneIdStr),
      position: { x: m2px(dm.position.x), y: m2px(dm.position.y) },
      size,
      orientation: dm.orientation ?? 0,
      capacity: preset.defaultCapacity,
      avgEngagementTimeMs: preset.avgEngagementTimeMs,
      attractiveness: preset.attractionPower,
      attractionRadius: preset.attractionRadius,
      interactionType,
      omnidirectional: preset.omnidirectional,
      queueBehavior: preset.queueBehavior,
      groupFriendly: preset.groupFriendly,
      shape: 'rect',
    };
    mediaList.push(placement);

    const arr = zoneMediaMap.get(zoneIdStr) ?? [];
    arr.push(mediaIdStr);
    zoneMediaMap.set(zoneIdStr, arr);
  }

  // Attach mediaIds to zones
  const finalZones: ZoneConfig[] = zonesWithGates.map((z) => ({
    ...z,
    mediaIds: (zoneMediaMap.get(z.id as string) ?? []).map((s) => MediaId(s)),
  }));

  // ── Floor ──────────────────────────────────────────────────────────────
  const floor: FloorConfig = {
    id: floorId,
    name: '1F',
    level: 0,
    canvas: {
      width: canvasWidthPx,
      height: canvasHeightPx,
      gridSize: PX_PER_METER,
      backgroundImage,
      scale: 1 / PX_PER_METER,
      bgOffsetX: CANVAS_MARGIN_PX,
      bgOffsetY: CANVAS_MARGIN_PX,
      bgScale: 1,
      bgLocked: false,
    },
    zoneIds: finalZones.map((z) => z.id),
    metadata: {},
  };

  // ── Scenario ───────────────────────────────────────────────────────────
  const now = Date.now();
  const scenario: Scenario = {
    meta: {
      id: ScenarioId(`project_${now}`),
      name: draft.name || 'AI-generated layout',
      description: draft.notes ?? '',
      version: 1,
      parentId: null,
      tags: ['ai-generated'],
      createdAt: now,
      updatedAt: now,
    },
    floors: [floor],
    zones: finalZones,
    media: mediaList,
    visitorDistribution: {
      totalCount: 200,
      profileWeights: { general: 60, vip: 15, child: 10, elderly: 10, disabled: 5 },
      engagementWeights: { quick: 30, explorer: 40, immersive: 30 },
      groupRatio: 0.3,
      spawnRatePerSecond: 0.2,
    },
    simulationConfig: {
      fixedDeltaTime: 1000 / 60,
      duration: 3_600_000,
      timeScale: 3,
      maxVisitors: 500,
      seed: Math.floor(Math.random() * 99999),
      physics: DEFAULT_PHYSICS,
      skipThreshold: DEFAULT_SKIP_THRESHOLD,
      timeSlots: [{
        startTimeMs: 0, endTimeMs: 3_600_000, spawnRatePerSecond: 0.2,
        profileDistribution: { general: 60, vip: 15, child: 10, elderly: 10, disabled: 5 },
        engagementDistribution: { quick: 30, explorer: 40, immersive: 30 },
        groupRatio: 0.3,
      }],
    },
  };

  return { scenario, warnings };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function distSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x; const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function replaceGate(
  map: Map<string, Gate[]>, zoneId: string, gateId: string, next: Gate,
): void {
  const arr = map.get(zoneId);
  if (!arr) return;
  const i = arr.findIndex((g) => (g.id as string) === gateId);
  if (i >= 0) arr[i] = next;
}

/**
 * Snap a point onto the nearest edge of a rect, clamped to the perimeter.
 * If the point is inside the rect, push it out to the closest edge.
 */
function snapToRectEdge(
  p: { x: number; y: number },
  rect: { x: number; y: number; w: number; h: number },
): { x: number; y: number } {
  const left = rect.x, right = rect.x + rect.w, top = rect.y, bottom = rect.y + rect.h;
  const dL = Math.abs(p.x - left);
  const dR = Math.abs(p.x - right);
  const dT = Math.abs(p.y - top);
  const dB = Math.abs(p.y - bottom);
  const min = Math.min(dL, dR, dT, dB);
  if (min === dL) return { x: left, y: clamp(p.y, top, bottom) };
  if (min === dR) return { x: right, y: clamp(p.y, top, bottom) };
  if (min === dT) return { x: clamp(p.x, left, right), y: top };
  return { x: clamp(p.x, left, right), y: bottom };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Fallback gate on the longest wall when the AI didn't provide any. */
function autoGate(dz: DraftZone): DraftGate {
  const { x, y, w, h } = dz.rect;
  return w >= h
    ? { position: { x: x + w / 2, y: y + h }, width: 1.2, type: 'bidirectional' }
    : { position: { x: x + w, y: y + h / 2 }, width: 1.2, type: 'bidirectional' };
}
