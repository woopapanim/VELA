import type {
  Scenario, FloorConfig, ZoneConfig,
  HexColor,
} from '@/domain';
import {
  DEFAULT_PHYSICS, DEFAULT_SKIP_THRESHOLD,
  ZoneId, FloorId, ScenarioId,
} from '@/domain';
import type { DraftScenario, HydrationWarning } from './types';

export interface HydrationResult {
  readonly scenario: Scenario;
  readonly warnings: readonly HydrationWarning[];
}

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/** Default px-per-meter. Matches VELA's canvas.scale = 0.025 (i.e. 1 px = 0.025 m → 40 px/m). */
const PX_PER_METER = 40;
/** Canvas margin around the floor plan so zones near edges don't clip. */
const CANVAS_MARGIN_PX = 80;

const ZONE_PALETTE: readonly HexColor[] = [
  '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#facc15',
  '#4ade80', '#22d3ee', '#f87171', '#c084fc', '#34d399',
];

/**
 * Hydrate a DraftScenario (from Claude Vision) into a runnable VELA Scenario.
 *
 * Zones only. Media, waypoint graph, and edges are the user's job in the
 * editor — the floor plan image is kept as a background overlay so they can
 * trace whatever they need on top.
 */
export function hydrateDraft(
  draft: DraftScenario,
  backgroundImage: string,
  imageSize?: ImageSize,
): HydrationResult {
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
  const zones: ZoneConfig[] = [];
  let colorIdx = 0;

  for (const dz of draft.zones ?? []) {
    if (!dz.key || !dz.rect) {
      warnings.push({ severity: 'warning', message: `Zone "${dz.name || '?'}" dropped: missing key or rect.` });
      continue;
    }
    const zoneIdStr = `zone_${dz.key}`;
    const rectPx = {
      x: m2px(dz.rect.x),
      y: m2px(dz.rect.y),
      w: sz2px(Math.max(0.5, dz.rect.w)),
      h: sz2px(Math.max(0.5, dz.rect.h)),
    };
    const areaM2 = dz.rect.w * dz.rect.h;
    const capacity = Math.max(2, Math.floor(areaM2 / 1.2));

    const isCircle = dz.shape === 'circle';
    const polygonPx = !isCircle && dz.polygon && dz.polygon.length >= 3
      ? dz.polygon.map((p) => ({ x: m2px(p.x), y: m2px(p.y) }))
      : null;

    const zone: ZoneConfig = {
      id: ZoneId(zoneIdStr),
      name: dz.name || dz.key,
      type: dz.type,
      shape: isCircle ? 'circle' : polygonPx ? 'custom' : 'rect',
      bounds: rectPx,
      polygon: polygonPx,
      area: Math.round(areaM2),
      capacity,
      flowType: 'free',
      gates: [],
      mediaIds: [],
      color: ZONE_PALETTE[colorIdx++ % ZONE_PALETTE.length],
      attractiveness: 0.5,
      metadata: {},
    };
    zones.push(zone);
  }

  if (zones.length === 0) {
    warnings.push({ severity: 'error', message: 'No valid zones produced — scenario cannot be loaded.' });
  }

  // Overlap check — the analyzer is told zones must not overlap, but flag any
  // that still do so the user can fix them in the editor before loading.
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i].bounds, b = zones[j].bounds;
      const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      const overlapArea = ox * oy;
      const minArea = Math.min(a.w * a.h, b.w * b.h);
      if (minArea > 0 && overlapArea / minArea > 0.15) {
        warnings.push({
          severity: 'warning',
          message: `Zones "${zones[i].name}" and "${zones[j].name}" overlap — adjust in the editor.`,
        });
      }
    }
  }

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
      // Match image natural size to the declared meter span so 1m-on-image = 1m-in-world.
      // Fall back to 1.0 (legacy behavior) if caller didn't measure.
      bgScale: imageSize && imageSize.width > 0
        ? (imageWidthM * PX_PER_METER) / imageSize.width
        : 1,
      bgLocked: false,
    },
    zoneIds: zones.map((z) => z.id),
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
    zones,
    media: [],
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
