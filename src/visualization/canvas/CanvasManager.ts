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
  /** 도면 5m 캘리브레이션 자 (활성 시 두 끝점 — world coords). */
  bgCalRuler?: { a: { x: number; y: number }; b: { x: number; y: number } } | null;
}

export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  camera: Camera;
  private heatmapRenderer: HeatmapRenderer;
  private initialized = false;
  // Per-floor background image cache. Keyed by floorId; each entry holds
  // the loaded <img> plus the src it was loaded from so we can detect replacements.
  private bgImages: Map<string, { img: HTMLImageElement; src: string }> = new Map();

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
        const rotDeg = fl.canvas.bgRotation ?? 0;
        const cx = bx + w / 2;
        const cy = by + h / 2;

        const isActiveBg = floorId === (state.activeFloorId ?? null);
        ctx.save();
        // Inactive floors fade so the active floor's plan is visually dominant.
        const baseAlpha = isDark ? 0.45 : 0.35;
        ctx.globalAlpha = isActiveBg ? baseAlpha : baseAlpha * 0.45;
        if (isDark) ctx.filter = 'invert(1) brightness(0.6)';
        if (rotDeg !== 0) {
          ctx.translate(cx, cy);
          ctx.rotate((rotDeg * Math.PI) / 180);
          ctx.drawImage(entry.img, -w / 2, -h / 2, w, h);
        } else {
          ctx.drawImage(entry.img, bx, by, w, h);
        }
        ctx.restore();

        if (isActiveBg && !fl.canvas.bgLocked && state.simPhase !== 'running') {
          // Local-frame corners; rotated into world-frame around (cx, cy).
          const localCorners = [
            { x: -w / 2, y: -h / 2 },
            { x:  w / 2, y: -h / 2 },
            { x: -w / 2, y:  h / 2 },
            { x:  w / 2, y:  h / 2 },
          ];
          const r = (rotDeg * Math.PI) / 180;
          const cos = Math.cos(r), sin = Math.sin(r);
          const corners = localCorners.map((p) => ({
            x: cx + p.x * cos - p.y * sin,
            y: cy + p.x * sin + p.y * cos,
          }));

          // ZoneRenderer 와 동일한 핸들 스타일 — 줌과 무관한 화면 픽셀 크기 유지.
          const px = 1 / Math.max(this.camera.zoom, 0.3);
          const handleSq = 6 * px;
          const handleStroke = 1 * px;
          const handleColor = isDark ? '#60a5fa' : '#2563eb';

          ctx.save();
          // Dashed outline (rotated rect) — px-scaled like ZoneRenderer.
          ctx.setLineDash([8 * px, 4 * px]);
          ctx.strokeStyle = isDark ? 'rgba(96,165,250,0.55)' : 'rgba(37,99,235,0.5)';
          ctx.lineWidth = 1 * px;
          ctx.beginPath();
          ctx.moveTo(corners[0].x, corners[0].y);
          ctx.lineTo(corners[1].x, corners[1].y);
          ctx.lineTo(corners[3].x, corners[3].y);
          ctx.lineTo(corners[2].x, corners[2].y);
          ctx.closePath();
          ctx.stroke();
          ctx.setLineDash([]);

          // Corner handles — square (matches ZoneRenderer rect handles).
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = handleColor;
          ctx.lineWidth = handleStroke;
          for (const c of corners) {
            ctx.fillRect(c.x - handleSq / 2, c.y - handleSq / 2, handleSq, handleSq);
            ctx.strokeRect(c.x - handleSq / 2, c.y - handleSq / 2, handleSq, handleSq);
          }

          // Rotation handle: top-mid, extended outward (small circle, px-scaled).
          const rotHandleDist = 24 * px;
          const outwardLocal = { x: 0, y: -h / 2 - rotHandleDist };
          const topMidLocal = { x: 0, y: -h / 2 };
          const topMidWorld = {
            x: cx + topMidLocal.x * cos - topMidLocal.y * sin,
            y: cy + topMidLocal.x * sin + topMidLocal.y * cos,
          };
          const rotHandleWorld = {
            x: cx + outwardLocal.x * cos - outwardLocal.y * sin,
            y: cy + outwardLocal.x * sin + outwardLocal.y * cos,
          };
          ctx.strokeStyle = handleColor;
          ctx.lineWidth = handleStroke;
          ctx.beginPath();
          ctx.moveTo(topMidWorld.x, topMidWorld.y);
          ctx.lineTo(rotHandleWorld.x, rotHandleWorld.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(rotHandleWorld.x, rotHandleWorld.y, 4 * px, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = handleColor;
          ctx.lineWidth = handleStroke;
          ctx.stroke();
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

    // 8b. 5m calibration ruler — drawn in world space, above bg & zones, below screen-space ruler.
    if (state.bgCalRuler) {
      this.drawCalRuler(ctx, state.bgCalRuler, isDark, state.pixelToMeterScale);
    }

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

  /**
   * 5m 캘리브레이션 자 — 두 끝점 사이 직선 + 끝점 사각 핸들 + "5m" 라벨.
   * ZoneRenderer 와 동일한 핸들 스타일(px-scaled square handle).
   */
  private drawCalRuler(
    ctx: CanvasRenderingContext2D,
    ruler: { a: { x: number; y: number }; b: { x: number; y: number } },
    isDark: boolean,
    pixelToMeterScale: number,
  ) {
    const px = 1 / Math.max(this.camera.zoom, 0.3);
    const handleSq = 8 * px;
    const handleStroke = 1 * px;
    const color = isDark ? '#fbbf24' : '#d97706'; // amber — 도면 핸들 파랑과 구분
    const a = ruler.a, b = ruler.b;
    ctx.save();
    // Line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // 끝점 마감 줄 (5m 막대 끝의 짧은 가로획)
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len; // perpendicular
    const cap = 10 * px;
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.moveTo(p.x - nx * cap, p.y - ny * cap);
      ctx.lineTo(p.x + nx * cap, p.y + ny * cap);
      ctx.stroke();
    }

    // 끝점 사각 핸들 — ZoneRenderer 와 동일 스타일.
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = color;
    ctx.lineWidth = handleStroke;
    for (const p of [a, b]) {
      ctx.fillRect(p.x - handleSq / 2, p.y - handleSq / 2, handleSq, handleSq);
      ctx.strokeRect(p.x - handleSq / 2, p.y - handleSq / 2, handleSq, handleSq);
    }

    // "5m" 라벨 — 자 중앙 위. 현재 ruler world 길이 / metersPerUnit 으로 실측 표시도 함께.
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const mpu = pixelToMeterScale > 0 ? pixelToMeterScale : 0.025;
    const meters = len * mpu;
    const fs = Math.max(10, 12 * px);
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelText = `5m  •  current ${meters.toFixed(2)}m`;
    const metrics = ctx.measureText(labelText);
    const padX = 6 * px, padY = 3 * px;
    const labelW = metrics.width + padX * 2;
    const labelH = fs + padY * 2;
    // 자 위쪽 (자에서 perpendicular 방향, 핸들과 안 겹치게).
    const labelOffset = 18 * px;
    const lx = cx + nx * labelOffset;
    const ly = cy + ny * labelOffset;
    ctx.fillStyle = isDark ? 'rgba(31,41,55,0.92)' : 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = color;
    ctx.lineWidth = handleStroke;
    ctx.beginPath();
    const r = 4 * px;
    ctx.moveTo(lx - labelW / 2 + r, ly - labelH / 2);
    ctx.lineTo(lx + labelW / 2 - r, ly - labelH / 2);
    ctx.quadraticCurveTo(lx + labelW / 2, ly - labelH / 2, lx + labelW / 2, ly - labelH / 2 + r);
    ctx.lineTo(lx + labelW / 2, ly + labelH / 2 - r);
    ctx.quadraticCurveTo(lx + labelW / 2, ly + labelH / 2, lx + labelW / 2 - r, ly + labelH / 2);
    ctx.lineTo(lx - labelW / 2 + r, ly + labelH / 2);
    ctx.quadraticCurveTo(lx - labelW / 2, ly + labelH / 2, lx - labelW / 2, ly + labelH / 2 - r);
    ctx.lineTo(lx - labelW / 2, ly - labelH / 2 + r);
    ctx.quadraticCurveTo(lx - labelW / 2, ly - labelH / 2, lx - labelW / 2 + r, ly - labelH / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(labelText, lx, ly);
    ctx.restore();
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
