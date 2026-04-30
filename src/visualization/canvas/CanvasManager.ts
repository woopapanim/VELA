import type { ZoneConfig, Visitor, VisitorGroup, MediaPlacement, WaypointGraph, FloorConfig, DensityGrid } from '@/domain';
import type { OverlayMode, ShaftQueueSnapshot, EntryQueueState } from '@/stores';
import { Camera } from './Camera';
import { renderGrid } from '../renderers/GridRenderer';
import { renderZones } from '../renderers/ZoneRenderer';
import { renderFloorFrames } from '../renderers/FloorFrameRenderer';
import { renderGates } from '../renderers/GateRenderer';
import { renderMedia } from '../renderers/MediaRenderer';
import { renderVisitors } from '../renderers/VisitorRenderer';
import { renderFlowLines } from '../renderers/FlowLineRenderer';
import { renderGateConnections } from '../renderers/GateConnectionRenderer';
import { renderRuler } from '../renderers/RulerRenderer';
import { renderFlowArrows } from '../renderers/FlowArrowRenderer';
import { renderPathTrails, updateTrails } from '../renderers/PathTrailRenderer';
import { renderWaypoints } from '../renderers/WaypointRenderer';
import { renderOutsideQueue } from '../renderers/OutsideQueueRenderer';
// minimap removed
import { HeatmapRenderer } from '../renderers/HeatmapRenderer';

export interface RenderState {
  zones: readonly ZoneConfig[];
  media: readonly MediaPlacement[];
  visitors: readonly Visitor[];
  groups: readonly VisitorGroup[];
  selectedZoneId: string | null;
  selectedMediaId: string | null;
  overlayMode: OverlayMode;
  showGrid: boolean;
  showGates: boolean;
  showLabels: boolean;
  isDark: boolean;
  followAgentId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
  pixelToMeterScale: number;
  showBackground: boolean;
  simPhase?: string;
  waypointGraph?: WaypointGraph | null;
  selectedWaypointId?: string | null;
  selectedEdgeId?: string | null;
  // Ghost node preview (place-waypoint mode)
  ghostNode?: { position: { x: number; y: number }; type: string } | null;
  floors?: readonly FloorConfig[];
  activeFloorId?: string | null;
  shaftQueues?: ReadonlyMap<string, ShaftQueueSnapshot>;
  densityGrids?: ReadonlyMap<string, DensityGrid>;
  /** Phase 1: 외부 입장 대기 큐 (entry node 별 인원 + oldestWait). */
  entryQueue?: EntryQueueState;
}

export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  camera: Camera;
  private heatmapRenderer: HeatmapRenderer;
  private initialized = false;
  private dpr: number;
  private cssWidth = 0;
  private cssHeight = 0;
  // Per-floor background image cache. Keyed by floorId; each entry holds
  // the loaded <img> plus the src it was loaded from so we can detect replacements.
  private bgImages: Map<string, { img: HTMLImageElement; src: string }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = new Camera();
    this.heatmapRenderer = new HeatmapRenderer();
    this.dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  }

  init(cssWidth: number, cssHeight: number) {
    // Re-read DPR each init in case the user dragged across monitors with
    // different pixel ratios; ResizeObserver fires on layout changes either way.
    this.dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    // Backing buffer in physical pixels; CSS size keeps layout in CSS pixels.
    this.canvas.width = Math.max(1, Math.round(cssWidth * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssHeight * this.dpr));
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.heatmapRenderer.init(cssWidth, cssHeight);
    this.initialized = true;
  }

  render(state: RenderState) {
    const { ctx } = this;
    const { canvasWidth, canvasHeight, isDark } = state;
    const liveDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    // Auto-init if size or DPR changed
    if (!this.initialized || this.cssWidth !== canvasWidth || this.cssHeight !== canvasHeight || this.dpr !== liveDpr) {
      this.init(canvasWidth, canvasHeight);
    }

    // Clear in physical pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply camera transform — Camera.apply prepends DPR scaling so all
    // subsequent draws use CSS-pixel coords on the high-DPI backing buffer.
    this.camera.apply(ctx, canvasWidth, canvasHeight, this.dpr);

    // 0. Background image (floor plan overlay) — shared canvas: render every
    // visible floor's overlay at its own offset/scale. Handles are drawn only
    // for the active, unlocked floor (the one the user is currently editing).
    if (state.showBackground && state.floors) {
      // Evict cached images whose floor no longer has a backgroundImage, or whose
      // src has changed (i.e. Replace / Remove). Keeps memory bounded.
      const liveIds = new Set<string>();
      for (const fl of state.floors) {
        if (fl.canvas.backgroundImage) liveIds.add(fl.id as string);
      }
      for (const id of [...this.bgImages.keys()]) {
        if (!liveIds.has(id)) this.bgImages.delete(id);
      }

      for (const fl of state.floors) {
        if (fl.hidden) continue;
        if (fl.canvas.bgHidden) continue;
        const src = fl.canvas.backgroundImage;
        if (!src) continue;
        const floorId = fl.id as string;

        let entry = this.bgImages.get(floorId);
        if (!entry || entry.src !== src) {
          const img = new window.Image();
          img.src = src;
          entry = { img, src };
          this.bgImages.set(floorId, entry);
        }
        if (!entry.img.complete) continue;

        const bx = fl.canvas.bgOffsetX;
        const by = fl.canvas.bgOffsetY;
        const w = entry.img.naturalWidth * fl.canvas.bgScale;
        const h = entry.img.naturalHeight * fl.canvas.bgScale;

        ctx.save();
        ctx.globalAlpha = isDark ? 0.45 : 0.35;
        if (isDark) ctx.filter = 'invert(1) brightness(0.6)';
        ctx.drawImage(entry.img, bx, by, w, h);
        ctx.restore();

        const isActive = floorId === (state.activeFloorId ?? null);
        if (isActive && !fl.canvas.bgLocked && state.simPhase !== 'running') {
          const corners = [
            { x: bx, y: by },
            { x: bx + w, y: by },
            { x: bx, y: by + h },
            { x: bx + w, y: by + h },
          ];
          ctx.save();
          for (const c of corners) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.95)';
            ctx.fill();
            ctx.strokeStyle = isDark ? 'rgba(59,130,246,0.8)' : 'rgba(37,99,235,0.8)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = isDark ? 'rgba(59,130,246,0.3)' : 'rgba(37,99,235,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, w, h);
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    }

    // 1. Grid
    if (state.showGrid) {
      renderGrid(ctx, canvasWidth, canvasHeight, state.gridSize, isDark, this.camera.x, this.camera.y, this.camera.zoom);
    }

    // Determine hidden floors (editor-only view filter — sim still ticks them).
    const hiddenFloorIds = new Set<string>();
    const hiddenZoneIds = new Set<string>();
    if (state.floors) {
      for (const f of state.floors) {
        if (f.hidden) {
          hiddenFloorIds.add(f.id as string);
          for (const zid of f.zoneIds) hiddenZoneIds.add(zid as string);
        }
      }
    }
    const visibleFloors = state.floors?.filter(f => !f.hidden);
    const visibleZones = hiddenZoneIds.size === 0
      ? state.zones
      : state.zones.filter(z => !hiddenZoneIds.has(z.id as string));
    const visibleMedia = hiddenZoneIds.size === 0
      ? state.media
      : state.media.filter(m => !hiddenZoneIds.has(m.zoneId as string));
    const visibleGraph = (hiddenFloorIds.size === 0 || !state.waypointGraph)
      ? state.waypointGraph
      : {
          ...state.waypointGraph,
          nodes: state.waypointGraph.nodes.filter(n => !hiddenFloorIds.has(n.floorId as string)),
          edges: state.waypointGraph.edges.filter(e => {
            const from = state.waypointGraph!.nodes.find(n => n.id === e.fromId);
            const to = state.waypointGraph!.nodes.find(n => n.id === e.toId);
            return from && to && !hiddenFloorIds.has(from.floorId as string) && !hiddenFloorIds.has(to.floorId as string);
          }),
        };

    // 2b. Floor frames (below zones, visual grouping for multi-floor/multi-building)
    if (visibleFloors && visibleFloors.length > 1) {
      const showHandles = state.simPhase !== 'running';
      renderFloorFrames(ctx, visibleFloors, visibleZones, isDark, this.camera.zoom, showHandles, state.activeFloorId ?? null);
    }

    // 3. Zones (with occupancy overlay)
    const activeFloor = state.floors?.find(f => f.id === state.activeFloorId) ?? state.floors?.[0];
    const metersPerUnit = (activeFloor as any)?.canvas?.scale ?? 0.025;
    renderZones(ctx, visibleZones, state.selectedZoneId, state.showLabels, isDark, state.visitors, this.camera.zoom, metersPerUnit);

    // 3a. Heatmap — floor-wide cumulative dwell gradient, painted over zone
    // fills so it isn't hidden by their translucent backgrounds. Sits below
    // gates / waypoints / agents so those remain readable.
    if (state.overlayMode === 'heatmap') {
      const grids = state.densityGrids ? [...state.densityGrids.values()] : [];
      this.heatmapRenderer.update(grids);
      this.heatmapRenderer.render(ctx, grids, state.visitors, isDark, canvasWidth, canvasHeight);
    }

    // 4. Gates (rendered relative to zone bounds for wall alignment)
    if (state.showGates) {
      renderGates(ctx, visibleZones, isDark);
    }

    // 3b. Flow direction arrows (guided/one-way zones)
    renderFlowArrows(ctx, visibleZones, isDark);

    // 4b. Gate connections (subtle dashed lines between linked gates)
    if (state.showGates) {
      renderGateConnections(ctx, visibleZones, isDark);
    }

    // 4c. Waypoint graph (nodes + edges + ghost preview)
    if (visibleGraph && visibleGraph.nodes.length > 0) {
      renderWaypoints(ctx, visibleGraph, state.selectedWaypointId ?? null, state.selectedEdgeId ?? null, isDark, state.ghostNode ?? null, this.camera.zoom, state.showLabels, state.shaftQueues);
    } else if (state.ghostNode) {
      renderWaypoints(ctx, { nodes: [], edges: [] }, null, null, isDark, state.ghostNode, this.camera.zoom, state.showLabels);
    }

    // 4d. Outside entry queue — Phase 1 입장 정책으로 throttle 된 대기자 표시.
    // unlimited 모드면 entryQueue.totalQueueLength === 0 이라 즉시 return (no-op).
    if (visibleGraph && state.entryQueue) {
      renderOutsideQueue(ctx, visibleGraph, state.entryQueue, isDark, this.camera.zoom);
    }

    // 5. Flow lines (between zones) — explicit overlay toggle only, so the
    // "Show Flow" switch actually controls visibility instead of being
    // overridden by the presence of live visitors.
    if (state.overlayMode === 'flow') {
      renderFlowLines(ctx, visibleZones, state.visitors, isDark);
    }

    // 6. Media (with queue visualization)
    renderMedia(ctx, visibleMedia, state.selectedMediaId, isDark, state.visitors, false, this.camera.zoom, state.showLabels);

    // 7. Path trails (subtle traces behind visitors)
    if (state.visitors.length > 0) {
      updateTrails(state.visitors);
      renderPathTrails(ctx, isDark);
    }

    // 8. Visitors (topmost)
    renderVisitors(ctx, state.visitors, state.groups, isDark, true, state.followAgentId);

    // Reset transform to CSS-pixel screen-space (with DPR scale baked in so
    // ruler text stays crisp on high-DPI displays).
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 9. Ruler (screen-space)
    if (state.showGrid) {
      renderRuler(ctx, canvasWidth, canvasHeight, state.gridSize, state.pixelToMeterScale, isDark, this.camera.x, this.camera.y, this.camera.zoom);
    }

  }

  getCamera(): Camera {
    return this.camera;
  }

  getBgImageBounds(floorId: string, bgOffsetX: number, bgOffsetY: number, bgScale: number): { x: number; y: number; w: number; h: number } | null {
    const entry = this.bgImages.get(floorId);
    if (!entry?.img.complete) return null;
    return {
      x: bgOffsetX,
      y: bgOffsetY,
      w: entry.img.naturalWidth * bgScale,
      h: entry.img.naturalHeight * bgScale,
    };
  }

  destroy() {
    this.initialized = false;
  }
}
