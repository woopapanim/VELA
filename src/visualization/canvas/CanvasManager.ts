import type { ZoneConfig, Visitor, VisitorGroup, MediaPlacement, WaypointGraph } from '@/domain';
import type { OverlayMode } from '@/stores';
import { Camera } from './Camera';
import { renderGrid } from '../renderers/GridRenderer';
import { renderZones } from '../renderers/ZoneRenderer';
import { renderGates } from '../renderers/GateRenderer';
import { renderMedia } from '../renderers/MediaRenderer';
import { renderVisitors } from '../renderers/VisitorRenderer';
import { renderFlowLines } from '../renderers/FlowLineRenderer';
import { renderGateConnections } from '../renderers/GateConnectionRenderer';
import { renderRuler } from '../renderers/RulerRenderer';
import { renderFlowArrows } from '../renderers/FlowArrowRenderer';
import { renderPathTrails, updateTrails } from '../renderers/PathTrailRenderer';
import { renderWaypoints } from '../renderers/WaypointRenderer';
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
  backgroundImage: string | null;
  showBackground: boolean;
  bgOffsetX: number;
  bgOffsetY: number;
  bgScale: number;
  bgLocked: boolean;
  simPhase?: string;
  waypointGraph?: WaypointGraph | null;
  selectedWaypointId?: string | null;
  selectedEdgeId?: string | null;
  // Ghost node preview (place-waypoint mode)
  ghostNode?: { position: { x: number; y: number }; type: string } | null;
}

export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  camera: Camera;
  private heatmapRenderer: HeatmapRenderer;
  private initialized = false;
  private bgImage: HTMLImageElement | null = null;
  private bgImageSrc: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = new Camera();
    this.heatmapRenderer = new HeatmapRenderer();
  }

  init(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.heatmapRenderer.init(width, height);
    this.initialized = true;
  }

  render(state: RenderState) {
    const { ctx } = this;
    const { canvasWidth, canvasHeight, isDark } = state;

    // Auto-init if needed
    if (!this.initialized || this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.init(canvasWidth, canvasHeight);
    }

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Apply camera transform
    this.camera.apply(ctx, canvasWidth, canvasHeight);

    // 0. Background image (floor plan overlay)
    if (state.backgroundImage && !this.bgImage) {
      this.bgImage = new window.Image();
      this.bgImage.src = state.backgroundImage;
      this.bgImageSrc = state.backgroundImage;
    }
    if (state.backgroundImage !== this.bgImageSrc) {
      this.bgImage = null;
      this.bgImageSrc = null;
      if (state.backgroundImage) {
        this.bgImage = new window.Image();
        this.bgImage.src = state.backgroundImage;
        this.bgImageSrc = state.backgroundImage;
      }
    }
    if (state.showBackground && this.bgImage?.complete) {
      ctx.save();
      ctx.globalAlpha = isDark ? 0.45 : 0.35;
      if (isDark) ctx.filter = 'invert(1) brightness(0.6)';
      const w = this.bgImage.naturalWidth * state.bgScale;
      const h = this.bgImage.naturalHeight * state.bgScale;
      ctx.drawImage(this.bgImage, state.bgOffsetX, state.bgOffsetY, w, h);
      ctx.restore();

      // Draw resize handles (only when not locked and not running sim)
      if (!state.bgLocked && state.simPhase !== 'running') {
        const bx = state.bgOffsetX, by = state.bgOffsetY;
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
        // Dashed border around image
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = isDark ? 'rgba(59,130,246,0.3)' : 'rgba(37,99,235,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, w, h);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // 1. Grid
    if (state.showGrid) {
      renderGrid(ctx, canvasWidth, canvasHeight, state.gridSize, isDark, this.camera.x, this.camera.y, this.camera.zoom);
    }

    // 2. Heatmap (below zones)
    if (state.overlayMode === 'heatmap') {
      this.heatmapRenderer.update(state.visitors, isDark);
      this.heatmapRenderer.render(ctx, isDark);
    }

    // 3. Zones (with occupancy overlay)
    renderZones(ctx, state.zones, state.selectedZoneId, state.showLabels, isDark, state.visitors);

    // 4. Gates (rendered relative to zone bounds for wall alignment)
    if (state.showGates) {
      renderGates(ctx, state.zones, isDark);
    }

    // 3b. Flow direction arrows (guided/one-way zones)
    renderFlowArrows(ctx, state.zones, isDark);

    // 4b. Gate connections (subtle dashed lines between linked gates)
    if (state.showGates) {
      renderGateConnections(ctx, state.zones, isDark);
    }

    // 4c. Waypoint graph (nodes + edges + ghost preview)
    if (state.waypointGraph && state.waypointGraph.nodes.length > 0) {
      renderWaypoints(ctx, state.waypointGraph, state.selectedWaypointId ?? null, state.selectedEdgeId ?? null, isDark, state.ghostNode ?? null);
    } else if (state.ghostNode) {
      // No graph yet but ghost node visible
      renderWaypoints(ctx, { nodes: [], edges: [] }, null, null, isDark, state.ghostNode);
    }

    // 5. Flow lines (between zones)
    if (state.overlayMode === 'flow' || state.visitors.length > 0) {
      renderFlowLines(ctx, state.zones, state.visitors, isDark);
    }

    // 6. Media (with queue visualization)
    renderMedia(ctx, state.media, state.selectedMediaId, isDark, state.visitors);

    // 7. Path trails (subtle traces behind visitors)
    if (state.visitors.length > 0) {
      updateTrails(state.visitors);
      renderPathTrails(ctx, isDark);
    }

    // 8. Visitors (topmost)
    renderVisitors(ctx, state.visitors, state.groups, isDark, true, state.followAgentId);

    // Reset transform to screen-space
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 9. Ruler (screen-space)
    if (state.showGrid) {
      renderRuler(ctx, canvasWidth, canvasHeight, state.gridSize, state.pixelToMeterScale, isDark, this.camera.x, this.camera.y, this.camera.zoom);
    }

  }

  getCamera(): Camera {
    return this.camera;
  }

  getBgImageBounds(bgOffsetX: number, bgOffsetY: number, bgScale: number): { x: number; y: number; w: number; h: number } | null {
    if (!this.bgImage?.complete) return null;
    return {
      x: bgOffsetX,
      y: bgOffsetY,
      w: this.bgImage.naturalWidth * bgScale,
      h: this.bgImage.naturalHeight * bgScale,
    };
  }

  destroy() {
    this.initialized = false;
  }
}
