import type { ZoneConfig, Visitor, VisitorGroup, MediaPlacement } from '@/domain';
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

    // 0. Background image (CAD/floor plan overlay)
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
    if (this.bgImage?.complete) {
      ctx.save();
      ctx.globalAlpha = isDark ? 0.15 : 0.2;
      if (isDark) ctx.filter = 'invert(1) brightness(0.6)';
      ctx.drawImage(this.bgImage, 0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    }

    // 1. Grid
    if (state.showGrid) {
      renderGrid(ctx, canvasWidth, canvasHeight, state.gridSize, isDark);
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

  destroy() {
    this.initialized = false;
  }
}
