import { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '@/stores';
import { CanvasManager } from '@/visualization';
import { useTheme } from '@/ui/components/ThemeProvider';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasContextMenu, useContextMenu } from './ContextMenu';
import { PropertyPopover, usePropertyPopover } from './PropertyPopover';
import { VisitorPopover } from './VisitorPopover';
import { SpeedIndicator } from './SpeedIndicator';
import { useKeyboardShortcuts } from '@/ui/hooks/useKeyboardShortcuts';
import { zonesOverlap, getZoneVertices } from '@/domain/zoneGeometry';
import { findFloorAtPoint, getFloorFrameBounds } from '@/domain/floorLayout';
import type { FloorConfig, ZoneConfig } from '@/domain';

// Get edge segments for a zone shape (rx, ry = L bend ratios, default 0.5)
function getZoneEdges(b: { x: number; y: number; w: number; h: number }, shape: string, rx = 0.5, ry = 0.5): Array<[{x:number;y:number},{x:number;y:number}]> {
  const { x, y, w, h } = b;
  const bx = w * rx, by = h * ry;
  if (shape === 'rect' || !shape.startsWith('l_')) {
    return [
      [{ x, y }, { x: x + w, y }], [{ x: x + w, y }, { x: x + w, y: y + h }],
      [{ x: x + w, y: y + h }, { x, y: y + h }], [{ x, y: y + h }, { x, y }],
    ];
  }
  let pts: {x:number;y:number}[];
  if (shape === 'l_top_right') pts = [{x,y},{x:x+bx,y},{x:x+bx,y:y+by},{x:x+w,y:y+by},{x:x+w,y:y+h},{x,y:y+h}];
  else if (shape === 'l_top_left') pts = [{x:x+bx,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h},{x,y:y+by},{x:x+bx,y:y+by}];
  else if (shape === 'l_bottom_right') pts = [{x,y},{x:x+w,y},{x:x+w,y:y+by},{x:x+bx,y:y+by},{x:x+bx,y:y+h},{x,y:y+h}];
  else pts = [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x:x+bx,y:y+h},{x:x+bx,y:y+by},{x,y:y+by}];
  return pts.map((p, i) => [p, pts[(i + 1) % pts.length]] as [{x:number;y:number},{x:number;y:number}]);
}

function ptInPoly(pts: {x:number;y:number}[], px: number, py: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Get zone polygon vertices (L-shapes get actual vertices, rects get 4 corners) */
function getZonePolygon(zone: { bounds: { x: number; y: number; w: number; h: number }; shape: string; lRatioX?: number; lRatioY?: number; polygon?: readonly {x:number;y:number}[] | null }): {x:number;y:number}[] {
  if (zone.shape === 'custom' && zone.polygon && zone.polygon.length > 2) {
    return zone.polygon.map(v => ({ x: v.x, y: v.y }));
  }
  const edges = getZoneEdges(zone.bounds, zone.shape as string, (zone as any).lRatioX ?? 0.5, (zone as any).lRatioY ?? 0.5);
  return edges.map(([a]) => a);
}

/** Check if two line segments intersect */
function segmentsIntersect(a1: {x:number;y:number}, a2: {x:number;y:number}, b1: {x:number;y:number}, b2: {x:number;y:number}): boolean {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x, d2y = b2.y - b1.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / cross;
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / cross;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

/** Check if two zone polygons overlap (vertex-in-polygon + edge intersection) */
function polygonsOverlap(polyA: {x:number;y:number}[], polyB: {x:number;y:number}[]): boolean {
  // Check if any vertex of A is inside B
  for (const p of polyA) if (ptInPoly(polyB, p.x, p.y)) return true;
  // Check if any vertex of B is inside A
  for (const p of polyB) if (ptInPoly(polyA, p.x, p.y)) return true;
  // Check edge intersections
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i], a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j], b2 = polyB[(j + 1) % polyB.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function closestPointOnSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + t * dx, y: ay + t * dy };
}

interface CanvasPanelProps {
  /**
   * When true, all scenario-mutating mouse interactions (move/resize/rotate
   * zones, media, waypoints, gates, floors, polygon edits, edge bend insert)
   * are disabled. Pan, zoom, click-to-select for inspection, and agent-follow
   * via double-click remain active. Used by Simulate/Analyze to prevent the
   * canvas from being treated as an editor while a run is loaded.
   */
  readOnly?: boolean;
}

export function CanvasPanel({ readOnly = false }: CanvasPanelProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<CanvasManager | null>(null);
  const { resolvedTheme } = useTheme();
  const { menu, show: showMenu, hide: hideMenu } = useContextMenu();
  const { popover, showPopover, hidePopover } = usePropertyPopover();
  useKeyboardShortcuts();

  // Store selectors (used by event handlers, not render loop)
  const zones = useStore((s) => s.zones);
  const setCamera = useStore((s) => s.setCamera);
  const focusTarget = useStore((s) => s.focusTarget);
  const setFocusTarget = useStore((s) => s.setFocusTarget);

  // Initialize canvas manager
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const manager = new CanvasManager(canvas);
    managerRef.current = manager;

    // Restore camera from store so Build ⇄ Simulate remount does not reset pan/zoom.
    const storedCamera = useStore.getState().camera;
    manager.camera.x = storedCamera.x;
    manager.camera.y = storedCamera.y;
    manager.camera.zoom = storedCamera.zoom;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      manager.init(rect.width, rect.height);
    };

    // Delay first init to ensure layout is settled
    resize();
    requestAnimationFrame(resize);
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  // Auto zoom-to-fit when scenario loads
  // 시나리오 JSON 로드 시 한 번에 다수 zone 이 들어옴 → 화면 맞춤.
  // 사용자가 빈 캔버스에 zone 을 하나씩 추가하는 경우는 스킵 (현재 viewport/zoom 유지).
  // Build ⇄ Simulate 이동 시 remount 되어도 store 에 카메라가 남아있으면 그걸 신뢰 — 재맞춤 금지.
  const prevZoneCount = useRef(0);
  useEffect(() => {
    const cam = useStore.getState().camera;
    const cameraIsDefault = cam.x === 0 && cam.y === 0 && cam.zoom === 1;
    const isScenarioLoad = zones.length >= 2 && prevZoneCount.current === 0 && cameraIsDefault;
    if (isScenarioLoad && managerRef.current) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const z of zones) {
        minX = Math.min(minX, z.bounds.x);
        minY = Math.min(minY, z.bounds.y);
        maxX = Math.max(maxX, z.bounds.x + z.bounds.w);
        maxY = Math.max(maxY, z.bounds.y + z.bounds.h);
      }
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        managerRef.current.camera.zoomToFit({ minX, minY, maxX, maxY }, rect.width, rect.height);
        setCamera({
          x: managerRef.current.camera.x,
          y: managerRef.current.camera.y,
          zoom: managerRef.current.camera.zoom,
        });
      }
    }
    prevZoneCount.current = zones.length;
  }, [zones.length, setCamera]);

  // Analyze action card 등이 setFocusTarget(world center) 으로 요청한 위치로 카메라 이동.
  // mount 직후·target 변경 시 모두 동작. 적용 후 target 은 소비.
  useEffect(() => {
    if (!focusTarget) return;
    const container = containerRef.current;
    const manager = managerRef.current;
    if (!container || !manager) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const zoom = focusTarget.zoom ?? Math.max(1, manager.camera.zoom);
    manager.camera.zoom = Math.max(0.2, Math.min(5, zoom));
    manager.camera.x = focusTarget.x - rect.width / 2;
    manager.camera.y = focusTarget.y - rect.height / 2;
    setCamera({ x: manager.camera.x, y: manager.camera.y, zoom: manager.camera.zoom });
    setFocusTarget(null);
  }, [focusTarget, setCamera, setFocusTarget]);

  // Continuous render loop — always draws current state
  useEffect(() => {
    let rafId: number;
    const loop = () => {
      const manager = managerRef.current;
      const container = containerRef.current;
      if (manager && container) {
        const rect = container.getBoundingClientRect();
        lastCanvasRect.current = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        if (rect.width > 0 && rect.height > 0) {
          const store = useStore.getState();
          // Shared-canvas mode: all floors render together on one world plane.
          // activeFloorId is kept only as a UX hint (which region tools currently target).
          const fl = store.floors.find((f: any) => (f.id as string) === store.activeFloorId);
          const gridSz = fl?.canvas.gridSize ?? 40;

          manager.render({
            zones: store.zones,
            media: store.media,
            visitors: store.visitors,
            groups: store.groups,
            selectedZoneId: store.selectedZoneId,
            selectedMediaId: store.selectedMediaId,
            followAgentId: store.followAgentId,
            overlayMode: store.overlayMode,
            showGrid: store.showGrid,
            showGates: store.showGates,
            showLabels: store.showLabels,
            showBackground: store.showBackground,
            showWaypointNodes: store.showWaypointNodes,
            showWaypointEdges: store.showWaypointEdges,
            isDark: resolvedTheme === 'dark',
            canvasWidth: rect.width,
            canvasHeight: rect.height,
            gridSize: gridSz,
            pixelToMeterScale: fl?.canvas.scale ?? 0.025,
            simPhase: store.phase,
            waypointGraph: store.waypointGraph,
            selectedWaypointId: store.selectedWaypointId ?? null,
            selectedEdgeId: store.selectedEdgeId ?? null,
            ghostNode: store.editorMode === 'place-waypoint' && store.pendingWaypointType && mouseWorldPos.current
              ? { position: mouseWorldPos.current, type: store.pendingWaypointType }
              : null,
            floors: store.floors,
            activeFloorId: store.activeFloorId,
            shaftQueues: store.shaftQueues,
            densityGrids: store.densityGrids,
            entryQueue: store.entryQueue,
          });
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [resolvedTheme]);

  // Pan & zoom handlers
  const lastMouse = useRef({ x: 0, y: 0 });

  const selectZone = useStore((s) => s.selectZone);
  const updateZone = useStore((s) => s.updateZone);
  const updateMedia = useStore((s) => s.updateMedia);
  const editorMode = useStore((s) => s.editorMode);

  // Cache last render dimensions for consistent screenToWorld conversion
  const lastCanvasRect = useRef({ left: 0, top: 0, width: 0, height: 0 });
  // Mouse world position for ghost node preview
  const mouseWorldPos = useRef<{ x: number; y: number } | null>(null);

  type DragMode = 'none' | 'pan' | 'move' | 'resize' | 'gate' | 'l-handle' | 'media-move' | 'media-rotate' | 'media-resize' | 'media-vertex' | 'vertex' | 'bg-move' | 'bg-resize' | 'waypoint-move' | 'floor-drag' | 'floor-resize';
  const dragMode = useRef<DragMode>('none');
  const dragZoneId = useRef<string | null>(null);
  const dragGateId = useRef<string | null>(null);
  const dragMediaId = useRef<string | null>(null);
  const dragWaypointId = useRef<string | null>(null);
  const dragFloorId = useRef<string | null>(null);
  const floorDragLast = useRef({ x: 0, y: 0 });
  const floorResizeCorner = useRef<'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const floorResizeAnchor = useRef({ x: 0, y: 0 }); // opposite corner, held fixed
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeCorner = useRef<'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w'>('se');
  const didDrag = useRef(false);
  const bgDragAnchor = useRef({ x: 0, y: 0 }); // for bg-resize: opposite corner
  const bgDragInitScale = useRef(1); // initial bgScale at drag start
  const bgDragInitDiag = useRef(1); // initial diagonal distance at drag start

  // Vertex drag state (for custom polygon editing via ZoneEditor)
  const dragVertexIdx = useRef<number | null>(null);
  const vertexOriginal = useRef<{x: number; y: number} | null>(null);

  const setEditorMode = useStore((s) => s.setEditorMode);

  function getWorldPos(e: React.MouseEvent) {
    if (!managerRef.current || !containerRef.current) return null;
    // Use fresh rect for position but cached dimensions for transform consistency
    const rect = containerRef.current.getBoundingClientRect();
    const cached = lastCanvasRect.current;
    const w = cached.width || rect.width;
    const h = cached.height || rect.height;
    return managerRef.current.camera.screenToWorld(
      e.clientX - rect.left, e.clientY - rect.top, w, h,
    );
  }

  // Hit-test floor label badge (top-left of frame) — matches FloorFrameRenderer layout.
  function hitTestFloorLabel(
    world: { x: number; y: number },
    floors: readonly FloorConfig[],
    zones: readonly ZoneConfig[],
  ): FloorConfig | null {
    if (floors.length <= 1) return null;
    const zoom = Math.max(managerRef.current?.camera.zoom ?? 1, 0.3);
    const px = 1 / zoom;
    const fs = (basePx: number) => Math.max(6, basePx / zoom);
    const LABEL_OFFSET_PX = 12;
    for (const floor of floors) {
      const frame = getFloorFrameBounds(floor, zones);
      if (!frame) continue;
      const labelH = fs(18);
      const approxW = Math.max(6, floor.name.length) * fs(13) * 0.6 + 16 * px;
      const pad = 4 * px;
      const labelX = frame.x - pad;
      const labelY = frame.y - labelH - LABEL_OFFSET_PX * px - pad;
      if (world.x >= labelX && world.x <= labelX + approxW + pad * 2 &&
          world.y >= labelY && world.y <= labelY + labelH + pad * 2) {
        return floor;
      }
    }
    return null;
  }

  // Hit-test the frame outline (dashed border). Click has to land within a
  // small margin on either side of an edge — not deep inside the frame —
  // so clicks in the empty interior don't steal focus from zone work.
  function hitTestFloorOutline(
    world: { x: number; y: number },
    floors: readonly FloorConfig[],
    zones: readonly ZoneConfig[],
  ): FloorConfig | null {
    if (floors.length <= 1) return null;
    const zoom = Math.max(managerRef.current?.camera.zoom ?? 1, 0.3);
    const m = 6 / zoom; // ~6 screen px on either side of the border
    for (const floor of floors) {
      const frame = getFloorFrameBounds(floor, zones);
      if (!frame) continue;
      const { x, y, w, h } = frame;
      const inOuter =
        world.x >= x - m && world.x <= x + w + m &&
        world.y >= y - m && world.y <= y + h + m;
      const inInner =
        world.x >= x + m && world.x <= x + w - m &&
        world.y >= y + m && world.y <= y + h - m;
      if (inOuter && !inInner) return floor;
    }
    return null;
  }

  // Hit-test corner resize handle on the selected active floor's frame.
  function hitTestFloorCorner(
    world: { x: number; y: number },
    floors: readonly FloorConfig[],
    zones: readonly ZoneConfig[],
    activeFloorId: string | null,
  ): { floor: FloorConfig; corner: 'nw' | 'ne' | 'sw' | 'se'; frame: { x: number; y: number; w: number; h: number } } | null {
    if (floors.length <= 1 || !activeFloorId) return null;
    const floor = floors.find(f => (f.id as string) === activeFloorId);
    if (!floor) return null;
    const frame = getFloorFrameBounds(floor, zones);
    if (!frame) return null;
    const zoom = Math.max(managerRef.current?.camera.zoom ?? 1, 0.1);
    const r = 12 / zoom;
    const { x, y, w, h } = frame;
    const corners: Array<{ corner: 'nw' | 'ne' | 'sw' | 'se'; cx: number; cy: number }> = [
      { corner: 'nw', cx: x, cy: y },
      { corner: 'ne', cx: x + w, cy: y },
      { corner: 'sw', cx: x, cy: y + h },
      { corner: 'se', cx: x + w, cy: y + h },
    ];
    for (const { corner, cx, cy } of corners) {
      if (Math.abs(world.x - cx) < r && Math.abs(world.y - cy) < r) {
        return { floor, corner, frame };
      }
    }
    return null;
  }

function hitTestCorner(world: { x: number; y: number }, zone: { bounds: { x: number; y: number; w: number; h: number }; shape?: string }): 'nw' | 'ne' | 'sw' | 'se' | null {
    const b = zone.bounds;
    // Hit radius in world units — scales with inverse zoom so it's ~14 screen px at any zoom.
    const zoom = Math.max(managerRef.current?.camera.zoom ?? 1, 0.1);
    const r = 14 / zoom;

    // Circle: cardinal handles on circle edge
    if (zone.shape === 'circle' || zone.shape === 'o_ring') {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const cr = Math.min(b.w, b.h) / 2;
      const cardinals: Array<{ corner: 'nw' | 'ne' | 'sw' | 'se'; cx: number; cy: number }> = [
        { corner: 'nw', cx: cx, cy: cy - cr },     // N → nw handle
        { corner: 'ne', cx: cx + cr, cy: cy },     // E → ne handle
        { corner: 'sw', cx: cx - cr, cy: cy },     // W → sw handle
        { corner: 'se', cx: cx, cy: cy + cr },     // S → se handle
      ];
      for (const { corner, cx: hx, cy: hy } of cardinals) {
        if (Math.abs(world.x - hx) < r && Math.abs(world.y - hy) < r) return corner;
      }
      return null;
    }

    const corners: Array<{ corner: 'nw' | 'ne' | 'sw' | 'se'; cx: number; cy: number }> = [
      { corner: 'nw', cx: b.x, cy: b.y },
      { corner: 'ne', cx: b.x + b.w, cy: b.y },
      { corner: 'sw', cx: b.x, cy: b.y + b.h },
      { corner: 'se', cx: b.x + b.w, cy: b.y + b.h },
    ];
    for (const { corner, cx, cy } of corners) {
      if (Math.abs(world.x - cx) < r && Math.abs(world.y - cy) < r) return corner;
    }
    return null;
  }

  const spacePressed = useRef(false);
  const [isPanMode, setIsPanMode] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement)?.matches('input,textarea,select')) {
        e.preventDefault();
        spacePressed.current = true;
        setIsPanMode(true);
      }
      // Escape: 폴리곤 편집 모드 종료
      if (e.code === 'Escape') {
        const store = useStore.getState();
        if (store.mediaPolygonEditMode) {
          store.setMediaPolygonEditMode(false);
          return;
        }
        if (store.polygonEditMode) {
          store.setPolygonEditMode(false);
          return;
        }
      }
      // Delete selected zone or media
      if ((e.code === 'Delete' || e.code === 'Backspace') && !(e.target as HTMLElement)?.matches('input,textarea,select')) {
        const store = useStore.getState();
        if (store.phase === 'running' || store.phase === 'paused') return;
        if (store.selectedMediaId) {
          store.removeMedia(store.selectedMediaId);
          (store as any).selectMedia(null);
        } else if (store.selectedZoneId) {
          store.removeZone(store.selectedZoneId);
          store.selectZone(null);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed.current = false;
        setIsPanMode(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    didDrag.current = false;
    const world = getWorldPos(e);

    // Space+Left click OR Middle button OR Alt+click = pan
    if (e.button === 1 || (e.button === 0 && (e.altKey || spacePressed.current))) {
      dragMode.current = 'pan';
      lastMouse.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    // Read-only viewport (Simulate / Analyze): block all drag-arming for
    // editing. Click-to-select still works via the click handler since
    // dragMode stays 'none' and didDrag stays false on mouseup.
    if (readOnly) return;

    // Floor corner resize (selected floor only) OR label drag — sim not running.
    if (e.button === 0 && world) {
      const storeInit = useStore.getState();
      if (storeInit.phase !== 'running') {
        // Corners take priority over label (both are outside zone hit areas).
        const hitCorner = hitTestFloorCorner(world, storeInit.floors, storeInit.zones, storeInit.activeFloorId);
        if (hitCorner) {
          const b = hitCorner.frame;
          const opp =
            hitCorner.corner === 'nw' ? { x: b.x + b.w, y: b.y + b.h }
            : hitCorner.corner === 'ne' ? { x: b.x, y: b.y + b.h }
            : hitCorner.corner === 'sw' ? { x: b.x + b.w, y: b.y }
            : { x: b.x, y: b.y };
          storeInit.pushUndo(storeInit.zones, storeInit.media, storeInit.waypointGraph);
          dragMode.current = 'floor-resize';
          dragFloorId.current = hitCorner.floor.id as string;
          floorResizeCorner.current = hitCorner.corner;
          floorResizeAnchor.current = opp;
          e.preventDefault();
          return;
        }
        const hitFloor =
          hitTestFloorLabel(world, storeInit.floors, storeInit.zones) ??
          hitTestFloorOutline(world, storeInit.floors, storeInit.zones);
        if (hitFloor) {
          // Selection is handled by the click handler (so a pure click toggles cleanly);
          // mousedown only arms floor-drag in case the user drags.
          storeInit.pushUndo(storeInit.zones, storeInit.media, storeInit.waypointGraph);
          dragMode.current = 'floor-drag';
          dragFloorId.current = hitFloor.id as string;
          floorDragLast.current = { x: world.x, y: world.y };
          e.preventDefault();
          return;
        }
      }
    }

    // Gate connection mode: click near a gate to select first, then click second to link
    if (e.button === 0 && editorMode === 'place-gate') {
      const world = getWorldPos(e);
      if (!world) return;
      const store = useStore.getState();
      // Find nearest gate
      let nearestGate: { zoneId: string; gateId: string; dist: number } | null = null;
      for (const zone of store.zones) {
        for (const gate of zone.gates) {
          const dx = gate.position.x - world.x;
          const dy = gate.position.y - world.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 25 && (!nearestGate || dist < nearestGate.dist)) {
            nearestGate = { zoneId: zone.id as string, gateId: gate.id as string, dist };
          }
        }
      }
      if (nearestGate) {
        const pending = store.pendingGateSourceId;
        if (!pending) {
          store.setPendingGateSource(nearestGate.gateId);
        } else if (pending !== nearestGate.gateId) {
          // Connect the two gates
          const allZones = store.zones.map((z) => {
            const updatedGates = z.gates.map((g) => {
              if ((g.id as string) === pending) return { ...g, connectedGateId: nearestGate!.gateId as any };
              if ((g.id as string) === nearestGate!.gateId) return { ...g, connectedGateId: pending as any };
              return g;
            });
            return { ...z, gates: updatedGates };
          });
          // Batch update all zones
          for (const z of allZones) {
            store.updateZone(z.id as string, { gates: z.gates } as any);
          }
          store.setPendingGateSource(null);
        }
        return; // 게이트 클릭은 처리 완료, 존 선택 로직으로 넘어가지 않음
      }
      // 게이트가 없는 곳 클릭 → 아래 존 선택 로직으로 fall-through
    }

    // ── Waypoint placement mode ──
    if (e.button === 0 && editorMode === 'place-waypoint') {
      const world = getWorldPos(e);
      if (!world) return;
      const store = useStore.getState();
      const wpType = store.pendingWaypointType;
      if (!wpType) return;

      // 기존 노드 근처면 배치하지 않고 선택으로 처리
      const graph = store.waypointGraph;
      if (graph) {
        for (const node of graph.nodes) {
          const dx = node.position.x - world.x, dy = node.position.y - world.y;
          if (dx * dx + dy * dy < 400) { // 20px
            store.selectWaypoint(node.id as string);
            return;
          }
        }
      }

      // Auto-detect which zone this point is inside (simple bounds check)
      let hitZoneId: string | null = null;
      for (const zone of store.zones) {
        const b = zone.bounds;
        if (world.x >= b.x && world.x <= b.x + b.w && world.y >= b.y && world.y <= b.y + b.h) {
          hitZoneId = zone.id as string;
          break;
        }
      }

      const id = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      // On the shared canvas, the click can land inside any floor's frame —
      // derive floorId from the point, falling back to activeFloor only when
      // no frame contains it (e.g. fresh scenario with no content yet).
      const hitFloor = findFloorAtPoint(world, store.floors, store.zones);
      const floorId = (hitFloor?.id as string | undefined) ?? store.activeFloorId ?? '';
      // Auto-label: count existing nodes of same type → "Hub 1", "Entry 2", etc.
      const sameTypeCount = graph ? graph.nodes.filter(n => n.type === wpType).length : 0;
      const typeLabel = wpType.charAt(0).toUpperCase() + wpType.slice(1);
      const autoLabel = `${typeLabel} ${sameTypeCount + 1}`;

      // Auto-assign portal to a shaft: first shaft with no portal on this floor yet,
      // else create a new shaft. Shaft membership is purely derived from portal.shaftId
      // — the shaft object no longer stores floorIds.
      let portalShaftId: string | null = null;
      if (wpType === 'portal') {
        const shafts = store.shafts;
        const targetShaft = shafts.find(sh =>
          !graph?.nodes.some(n =>
            n.type === 'portal'
            && (n.shaftId as string | null | undefined) === (sh.id as string)
            && (n.floorId as string) === floorId,
          ),
        );
        if (targetShaft) {
          portalShaftId = targetShaft.id as string;
        } else {
          let maxN = 0;
          for (const sh of shafts) {
            const m = (sh.id as string).match(/^shaft_(\d+)$/);
            if (m) maxN = Math.max(maxN, parseInt(m[1]));
          }
          const newId = `shaft_${maxN + 1}`;
          store.addShaft({
            id: newId as any,
            name: `Shaft ${maxN + 1}`,
            capacity: 8,
            waitTimeMs: 5000,
            travelTimePerFloorMs: 3000,
          });
          portalShaftId = newId;
        }
      }

      store.addWaypoint({
        id: id as any,
        type: wpType,
        position: { x: world.x, y: world.y },
        floorId: floorId as any,
        label: autoLabel,
        attraction: wpType === 'attractor' ? 0.9 : wpType === 'rest' ? 0.2 : 0.5,
        dwellTimeMs: wpType === 'rest' ? 30000 : 0,
        capacity: 20,
        spawnWeight: wpType === 'entry' ? 1.0 : 0,
        lookAt: 0,
        zoneId: hitZoneId as any ?? null,
        mediaId: null,
        ...(wpType === 'portal'
          ? { shaftId: portalShaftId as any }
          : {}),
      });
      store.selectWaypoint(id);
      return;
    }

    // ── Waypoint edge connection mode ──
    if (e.button === 0 && editorMode === 'connect-waypoint') {
      const world = getWorldPos(e);
      if (!world) return;
      const store = useStore.getState();
      const graph = store.waypointGraph;
      if (!graph) return;

      // Find nearest node
      let nearestNode: { id: string; dist: number } | null = null;
      for (const node of graph.nodes) {
        const dx = node.position.x - world.x;
        const dy = node.position.y - world.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 25 && (!nearestNode || dist < nearestNode.dist)) {
          nearestNode = { id: node.id as string, dist };
        }
      }
      if (nearestNode) {
        const pending = store.pendingEdgeSourceId;
        if (!pending) {
          store.setPendingEdgeSource(nearestNode.id);
          store.selectWaypoint(nearestNode.id);
        } else if (pending !== nearestNode.id) {
          // Create edge (skip if duplicate)
          const fromNode = graph.nodes.find(n => (n.id as string) === pending);
          const toNode = graph.nodes.find(n => (n.id as string) === nearestNode!.id);
          const isDuplicate = graph.edges.some(e =>
            ((e.fromId as string) === pending && (e.toId as string) === nearestNode!.id) ||
            ((e.fromId as string) === nearestNode!.id && (e.toId as string) === pending)
          );
          if (fromNode && toNode && !isDuplicate) {
            const dx = toNode.position.x - fromNode.position.x;
            const dy = toNode.position.y - fromNode.position.y;
            const cost = Math.sqrt(dx * dx + dy * dy);
            const edgeId = `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            store.addEdge({
              id: edgeId as any,
              fromId: fromNode.id,
              toId: toNode.id,
              direction: 'bidirectional',
              passWeight: 1.0,
              cost,
            });
          }
          // 연속 생성: 두 번째 노드를 다음 에지의 시작점으로
          store.setPendingEdgeSource(nearestNode.id);
          store.selectWaypoint(nearestNode.id);
        }
        return;
      }
    }

    // ── Node drag: in Node or Select mode, start dragging an existing node ──
    if (e.button === 0 && (editorMode === 'place-waypoint' || editorMode === 'select')) {
      const store = useStore.getState();
      const graph = store.waypointGraph;
      if (graph && world) {
        for (const node of graph.nodes) {
          const dx = node.position.x - world.x;
          const dy = node.position.y - world.y;
          if (dx * dx + dy * dy < 400) { // 20px radius
            // In place-waypoint mode, only drag if no pending type (already placed)
            if (editorMode === 'place-waypoint' && store.pendingWaypointType) break;
            dragMode.current = 'waypoint-move';
            dragWaypointId.current = node.id as string;
            store.selectWaypoint(node.id as string);
            store.pushUndo(store.zones, store.media, store.waypointGraph);
            e.preventDefault();
            return;
          }
        }
      }
    }

    // Handle zone editing in ANY editor mode (not just 'select')
    if (e.button === 0) {
      if (!world) return;
      const store = useStore.getState();
      // During active simulation: no zone editing (paused = editable)
      if (store.phase === 'running') return;

      // Check resize handle on selected zone first (skip for custom polygon editing)
      if (store.selectedZoneId) {
        const selZone = store.zones.find((z) => (z.id as string) === store.selectedZoneId);
        const isPolyEditing = selZone?.shape === 'custom' && store.polygonEditMode;

        if (selZone && !isPolyEditing) {
          const corner = hitTestCorner(world, selZone);
          if (corner) {
            store.pushUndo(store.zones, store.media, store.waypointGraph); // save before drag
            dragMode.current = 'resize';
            dragZoneId.current = store.selectedZoneId;
            resizeCorner.current = corner;
            e.preventDefault();
            return;
          }
        }

        // Check L-handle
        if (selZone && !isPolyEditing && (selZone.shape as string).startsWith('l_')) {
          const rx = (selZone as any).lRatioX ?? 0.5;
          const ry = (selZone as any).lRatioY ?? 0.5;
          const lx = selZone.bounds.x + selZone.bounds.w * rx;
          const ly = selZone.bounds.y + selZone.bounds.h * ry;
          const ldx = world.x - lx;
          const ldy = world.y - ly;
          if (ldx * ldx + ldy * ldy < 150) {
            store.pushUndo(store.zones, store.media, store.waypointGraph); // save before drag
            dragMode.current = 'l-handle';
            dragZoneId.current = store.selectedZoneId;
            e.preventDefault();
            return;
          }
        }

        // Check custom polygon vertex/edge click (only in polygon edit mode)
        const polyEditing = selZone && selZone.shape === 'custom' && selZone.polygon && selZone.polygon.length > 2 && store.polygonEditMode;
        if (polyEditing) {
          const vts = selZone.polygon as {x:number;y:number}[];
          // ① Vertex drag
          for (let vi = 0; vi < vts.length; vi++) {
            const vx = vts[vi].x - world.x;
            const vy = vts[vi].y - world.y;
            if (vx * vx + vy * vy < 64) { // 8px
              store.pushUndo(store.zones, store.media, store.waypointGraph);
              dragMode.current = 'vertex';
              dragZoneId.current = store.selectedZoneId;
              dragVertexIdx.current = vi;
              vertexOriginal.current = { x: vts[vi].x, y: vts[vi].y };
              e.preventDefault();
              return;
            }
          }
          // ② Edge click → insert vertex + start drag
          let bestEdge = { dist: Infinity, idx: -1, pt: { x: 0, y: 0 } };
          for (let vi = 0; vi < vts.length; vi++) {
            const a = vts[vi], b = vts[(vi + 1) % vts.length];
            const cp = closestPointOnSeg(world.x, world.y, a.x, a.y, b.x, b.y);
            const dx = cp.x - world.x, dy = cp.y - world.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < bestEdge.dist) bestEdge = { dist: d, idx: vi, pt: cp };
          }
          if (bestEdge.dist <= 6) {
            store.pushUndo(store.zones, store.media, store.waypointGraph);
            const newVerts = [...vts];
            newVerts.splice(bestEdge.idx + 1, 0, { x: bestEdge.pt.x, y: bestEdge.pt.y });
            const xs = newVerts.map(v => v.x), ys = newVerts.map(v => v.y);
            const minX = Math.min(...xs), minY = Math.min(...ys);
            updateZone(store.selectedZoneId!, {
              polygon: newVerts,
              bounds: { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY },
            } as any);
            dragMode.current = 'vertex';
            dragZoneId.current = store.selectedZoneId;
            dragVertexIdx.current = bestEdge.idx + 1;
            vertexOriginal.current = { x: bestEdge.pt.x, y: bestEdge.pt.y };
            e.preventDefault();
            return;
          }
        }
      }

      // Check gate click for drag (skip for custom polygon in select mode — gates edited in Flow mode)
      const selZoneForGate = store.selectedZoneId ? store.zones.find((z) => (z.id as string) === store.selectedZoneId) : null;
      const skipGateDrag = editorMode === 'select' && selZoneForGate?.shape === 'custom';
      if (store.selectedZoneId && !skipGateDrag) {
        const selZone = store.zones.find((z) => (z.id as string) === store.selectedZoneId);
        if (selZone) {
          for (const gate of selZone.gates) {
            const dx = (gate.position as any).x - world.x;
            const dy = (gate.position as any).y - world.y;
            if (dx * dx + dy * dy < 225) { // 15px hit radius for easier gate selection
              store.pushUndo(store.zones, store.media, store.waypointGraph);
              dragMode.current = 'gate';
              dragZoneId.current = selZone.id as string;
              dragGateId.current = gate.id as string;
              e.preventDefault();
              return;
            }
          }
        }
      }

      // Check media polygon vertex/edge (only in mediaPolygonEditMode)
      const MEDIA_SCALE_VAL = 20;
      if (store.selectedMediaId && store.mediaPolygonEditMode) {
        const selMedia = store.media.find((m: any) => (m.id as string) === store.selectedMediaId);
        if (selMedia && (selMedia as any).shape === 'custom' && selMedia.polygon && selMedia.polygon.length > 2) {
          const mRad = (selMedia.orientation * Math.PI) / 180;
          const mCos = Math.cos(mRad), mSin = Math.sin(mRad);
          // Transform world→local (center-relative, pre-rotation)
          const dx = world.x - selMedia.position.x;
          const dy = world.y - selMedia.position.y;
          const localX = dx * Math.cos(-mRad) - dy * Math.sin(-mRad);
          const localY = dx * Math.sin(-mRad) + dy * Math.cos(-mRad);
          const vts = selMedia.polygon as {x:number;y:number}[];

          // ① Vertex drag (8px hit radius in world space)
          for (let vi = 0; vi < vts.length; vi++) {
            const vdx = vts[vi].x - localX, vdy = vts[vi].y - localY;
            if (vdx * vdx + vdy * vdy < 64) {
              store.pushUndo(store.zones, store.media, store.waypointGraph);
              dragMode.current = 'media-vertex';
              dragMediaId.current = store.selectedMediaId;
              dragVertexIdx.current = vi;
              vertexOriginal.current = { x: vts[vi].x, y: vts[vi].y };
              e.preventDefault();
              return;
            }
          }
          // ② Edge click → insert vertex + start drag
          let bestEdge = { dist: Infinity, idx: -1, pt: { x: 0, y: 0 } };
          for (let vi = 0; vi < vts.length; vi++) {
            const a = vts[vi], b = vts[(vi + 1) % vts.length];
            const cp = closestPointOnSeg(localX, localY, a.x, a.y, b.x, b.y);
            const edx = cp.x - localX, edy = cp.y - localY;
            const d = Math.sqrt(edx * edx + edy * edy);
            if (d < bestEdge.dist) bestEdge = { dist: d, idx: vi, pt: cp };
          }
          if (bestEdge.dist <= 6) {
            store.pushUndo(store.zones, store.media, store.waypointGraph);
            const newVerts = [...vts];
            newVerts.splice(bestEdge.idx + 1, 0, { x: bestEdge.pt.x, y: bestEdge.pt.y });
            updateMedia(store.selectedMediaId, { polygon: newVerts } as any);
            dragMode.current = 'media-vertex';
            dragMediaId.current = store.selectedMediaId;
            dragVertexIdx.current = bestEdge.idx + 1;
            vertexOriginal.current = { x: bestEdge.pt.x, y: bestEdge.pt.y };
            e.preventDefault();
            return;
          }
        }
      }

      // Check selected media resize handles first (rotated coordinates, skip for custom polygon)
      if (store.selectedMediaId) {
        const selMedia = store.media.find((m: any) => (m.id as string) === store.selectedMediaId);
        const selShape = (selMedia as any)?.shape;
        if (selMedia && selShape !== 'custom') {
          const pw = selMedia.size.width * MEDIA_SCALE_VAL, ph = selMedia.size.height * MEDIA_SCALE_VAL;
          const mRad = (selMedia.orientation * Math.PI) / 180;
          const mCos = Math.cos(mRad), mSin = Math.sin(mRad);
          const r = Math.max(pw, ph) / 2;
          const localCorners: { corner: 'nw'|'ne'|'sw'|'se'|'n'|'e'|'s'|'w'; lx: number; ly: number }[] =
            selShape === 'circle'
              ? [
                  { corner: 'n', lx: 0,  ly: -r },
                  { corner: 'e', lx: r,  ly: 0  },
                  { corner: 's', lx: 0,  ly: r  },
                  { corner: 'w', lx: -r, ly: 0  },
                ]
              : selShape === 'ellipse'
              ? [
                  { corner: 'n', lx: 0,     ly: -ph/2 },
                  { corner: 'e', lx: pw/2,  ly: 0     },
                  { corner: 's', lx: 0,     ly: ph/2  },
                  { corner: 'w', lx: -pw/2, ly: 0     },
                ]
              : [
                  { corner: 'nw', lx: -pw/2, ly: -ph/2 },
                  { corner: 'ne', lx:  pw/2, ly: -ph/2 },
                  { corner: 'se', lx:  pw/2, ly:  ph/2 },
                  { corner: 'sw', lx: -pw/2, ly:  ph/2 },
                ];
          for (const { corner, lx, ly } of localCorners) {
            const cx = selMedia.position.x + lx * mCos - ly * mSin;
            const cy = selMedia.position.y + lx * mSin + ly * mCos;
            if (Math.abs(world.x - cx) < 8 && Math.abs(world.y - cy) < 8) {
              store.pushUndo(store.zones, store.media, store.waypointGraph);
              dragMode.current = 'media-resize';
              dragMediaId.current = store.selectedMediaId;
              resizeCorner.current = corner;
              e.preventDefault();
              return;
            }
          }
        }
      }

      // Check ALL zone corners before media — even if zone isn't selected
      // This prevents media from capturing zone resize handle clicks
      for (const z of store.zones) {
        const corner = hitTestCorner(world, z);
        if (corner) {
          store.pushUndo(store.zones, store.media, store.waypointGraph);
          selectZone(z.id as string);
          (store as any).selectMedia(null);
          dragMode.current = 'resize';
          dragZoneId.current = z.id as string;
          resizeCorner.current = corner;
          e.preventDefault();
          return;
        }
      }

      // Check media rotation handle FIRST (handle is outside media rect)
      if (store.selectedMediaId) {
        const selM = store.media.find((m: any) => (m.id as string) === store.selectedMediaId);
        if (selM) {
          const pw2 = selM.size.width * MEDIA_SCALE_VAL;
          const ph2 = selM.size.height * MEDIA_SCALE_VAL;
          const mShape2 = (selM as any).shape;
          let edgeDist2: number;
          if (mShape2 === 'custom' && selM.polygon && selM.polygon.length > 2) {
            let maxNegY = 0;
            for (const p of selM.polygon) if (-p.y > maxNegY) maxNegY = -p.y;
            edgeDist2 = maxNegY || ph2 / 2;
          } else if (mShape2 === 'circle') {
            edgeDist2 = Math.max(pw2, ph2) / 2;
          } else {
            edgeDist2 = ph2 / 2;
          }
          const rad2 = (selM.orientation * Math.PI) / 180;
          const handleDist2 = edgeDist2 + 15;
          const hx = selM.position.x + Math.sin(rad2) * handleDist2;
          const hy = selM.position.y - Math.cos(rad2) * handleDist2;
          const hdx = world.x - hx, hdy = world.y - hy;
          if (hdx * hdx + hdy * hdy < 150) {
            store.pushUndo(store.zones, store.media, store.waypointGraph);
            dragMode.current = 'media-rotate';
            dragMediaId.current = store.selectedMediaId;
            e.preventDefault();
            return;
          }
        }
      }

      // Check media click for move (before zone click)
      for (const m of store.media) {
        let mediaHit = false;
        const mShape = (m as any).shape;
        if (mShape === 'custom' && m.polygon && m.polygon.length > 2) {
          // Transform world to local, then point-in-polygon
          const mRad = (m.orientation * Math.PI) / 180;
          const ddx = world.x - m.position.x, ddy = world.y - m.position.y;
          const lx = ddx * Math.cos(-mRad) - ddy * Math.sin(-mRad);
          const ly = ddx * Math.sin(-mRad) + ddy * Math.cos(-mRad);
          mediaHit = ptInPoly(m.polygon as {x:number;y:number}[], lx, ly);
        } else if (mShape === 'circle') {
          const r = Math.max(m.size.width, m.size.height) * MEDIA_SCALE_VAL / 2;
          const ddx = world.x - m.position.x, ddy = world.y - m.position.y;
          mediaHit = ddx * ddx + ddy * ddy <= r * r;
        } else if (mShape === 'ellipse') {
          const a = m.size.width * MEDIA_SCALE_VAL / 2;
          const b = m.size.height * MEDIA_SCALE_VAL / 2;
          const mRad = (m.orientation * Math.PI) / 180;
          const ddx = world.x - m.position.x, ddy = world.y - m.position.y;
          const lx = ddx * Math.cos(-mRad) - ddy * Math.sin(-mRad);
          const ly = ddx * Math.sin(-mRad) + ddy * Math.cos(-mRad);
          mediaHit = (lx * lx) / (a * a) + (ly * ly) / (b * b) <= 1;
        } else {
          // Rect (respects orientation)
          const pw = m.size.width * MEDIA_SCALE_VAL;
          const ph = m.size.height * MEDIA_SCALE_VAL;
          const mRad = (m.orientation * Math.PI) / 180;
          const ddx = world.x - m.position.x, ddy = world.y - m.position.y;
          const lx = ddx * Math.cos(-mRad) - ddy * Math.sin(-mRad);
          const ly = ddx * Math.sin(-mRad) + ddy * Math.cos(-mRad);
          mediaHit = Math.abs(lx) <= pw / 2 && Math.abs(ly) <= ph / 2;
        }
        if (mediaHit) {
          store.pushUndo(store.zones, store.media, store.waypointGraph);
          dragMode.current = 'media-move';
          dragMediaId.current = m.id as string;
          dragOffset.current = { x: world.x - m.position.x, y: world.y - m.position.y };
          selectZone(null);
          store.selectWaypoint(null);
          (store as any).selectMedia(m.id as string);
          e.preventDefault();
          return;
        }
      }

      // 폴리곤 편집 중이면 zone body 클릭으로 다른 존 선택되는 것 방지
      if (store.polygonEditMode && store.selectedZoneId) {
        const editingZone = store.zones.find(z => (z.id as string) === store.selectedZoneId);
        if (editingZone?.shape === 'custom') {
          // 현재 존 내부 클릭이면 move 드래그 (편집 모드 유지)
          if (editingZone.polygon && ptInPoly(editingZone.polygon as {x:number;y:number}[], world.x, world.y)) {
            store.pushUndo(store.zones, store.media, store.waypointGraph);
            dragMode.current = 'move';
            dragZoneId.current = editingZone.id as string;
            dragOffset.current = { x: world.x - editingZone.bounds.x, y: world.y - editingZone.bounds.y };
            e.preventDefault();
          }
          // 밖 클릭이면 아무것도 안 함 (편집 모드 유지, 다른 존 선택 안 함)
          return;
        }
      }

      // Check zone body click for move (use polygon hit-test for custom shapes)
      const clicked = store.zones.find((z) => {
        if (z.shape === 'custom' && z.polygon && z.polygon.length > 2) {
          return ptInPoly(z.polygon as {x:number;y:number}[], world.x, world.y);
        }
        const b = z.bounds;
        return world.x >= b.x && world.x <= b.x + b.w && world.y >= b.y && world.y <= b.y + b.h;
      });
      if (clicked) {
        const isNewSelection = (clicked.id as string) !== store.selectedZoneId;
        if (isNewSelection && clicked.shape === 'custom') {
          // Custom polygon: first click = select only (no move drag)
          selectZone(clicked.id as string);
          e.preventDefault();
        } else {
          store.pushUndo(store.zones, store.media, store.waypointGraph);
          dragMode.current = 'move';
          dragZoneId.current = clicked.id as string;
          dragOffset.current = { x: world.x - clicked.bounds.x, y: world.y - clicked.bounds.y };
          selectZone(clicked.id as string);
          e.preventDefault();
        }
      } else {
        // Nothing clicked — check background image for drag/resize
        const manager = managerRef.current;
        if (manager && store.showBackground) {
          const fl = store.floors.find((f: any) => (f.id as string) === store.activeFloorId);
          if (fl?.canvas.backgroundImage && !(fl.canvas.bgLocked ?? false) && !fl.canvas.bgHidden) {
            const bgBounds = manager.getBgImageBounds(
              fl.id as string,
              fl.canvas.bgOffsetX ?? 0,
              fl.canvas.bgOffsetY ?? 0,
              fl.canvas.bgScale ?? 1,
            );
            if (bgBounds) {
              // Check corner handles first (12px hit radius)
              const corners: Array<{ corner: 'nw' | 'ne' | 'sw' | 'se'; cx: number; cy: number }> = [
                { corner: 'nw', cx: bgBounds.x, cy: bgBounds.y },
                { corner: 'ne', cx: bgBounds.x + bgBounds.w, cy: bgBounds.y },
                { corner: 'sw', cx: bgBounds.x, cy: bgBounds.y + bgBounds.h },
                { corner: 'se', cx: bgBounds.x + bgBounds.w, cy: bgBounds.y + bgBounds.h },
              ];
              let hitCorner: 'nw' | 'ne' | 'sw' | 'se' | null = null;
              for (const { corner, cx, cy } of corners) {
                if (Math.abs(world.x - cx) < 12 && Math.abs(world.y - cy) < 12) {
                  hitCorner = corner;
                  break;
                }
              }
              if (hitCorner) {
                dragMode.current = 'bg-resize';
                resizeCorner.current = hitCorner;
                // Anchor = opposite corner
                const opp = hitCorner === 'nw' ? 'se' : hitCorner === 'ne' ? 'sw' : hitCorner === 'sw' ? 'ne' : 'nw';
                const oppC = corners.find((c) => c.corner === opp)!;
                bgDragAnchor.current = { x: oppC.cx, y: oppC.cy };
                bgDragInitScale.current = fl.canvas.bgScale ?? 1;
                const dx = corners.find((c) => c.corner === hitCorner)!.cx - oppC.cx;
                const dy = corners.find((c) => c.corner === hitCorner)!.cy - oppC.cy;
                bgDragInitDiag.current = Math.sqrt(dx * dx + dy * dy);
                e.preventDefault();
                selectZone(null);
                return;
              }
              // Check if inside bg image bounds → bg-move
              if (world.x >= bgBounds.x && world.x <= bgBounds.x + bgBounds.w &&
                  world.y >= bgBounds.y && world.y <= bgBounds.y + bgBounds.h) {
                dragMode.current = 'bg-move';
                dragOffset.current = { x: world.x - bgBounds.x, y: world.y - bgBounds.y };
                e.preventDefault();
                selectZone(null);
                return;
              }
            }
          }
        }
        selectZone(null);
      }
    }
  }, [editorMode, selectZone, setEditorMode, readOnly]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (didDrag.current) return;
    // Read-only viewport (Simulate / Analyze): no zone/region/media/node selection.
    // Toolbar shift + Inspector overlay only make sense in Build.
    if (readOnly) return;
    const world = getWorldPos(e);
    if (!world) return;
    const store = useStore.getState();
    const graph = store.waypointGraph;
    const mode = store.editorMode;

    // Helper: hit-test nearest waypoint node
    const hitNode = () => {
      if (!graph) return null;
      let best: { id: string; dist: number } | null = null;
      for (const node of graph.nodes) {
        const dx = node.position.x - world.x, dy = node.position.y - world.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20 && (!best || dist < best.dist)) best = { id: node.id as string, dist };
      }
      return best;
    };

    // Helper: hit-test nearest edge
    const hitEdge = () => {
      if (!graph) return null;
      for (const edge of graph.edges) {
        const from = graph.nodes.find(n => n.id === edge.fromId);
        const to = graph.nodes.find(n => n.id === edge.toId);
        if (!from || !to) continue;
        const cp = closestPointOnSeg(world.x, world.y, from.position.x, from.position.y, to.position.x, to.position.y);
        const dx = cp.x - world.x, dy = cp.y - world.y;
        if (Math.sqrt(dx * dx + dy * dy) < 8) return edge.id as string;
      }
      return null;
    };

    // Helper: hit-test media
    const hitMedia = () => {
      const MS = 20;
      for (const m of store.media) {
        const pw = m.size.width * MS, ph = m.size.height * MS;
        if (world.x >= m.position.x - pw/2 && world.x <= m.position.x + pw/2 &&
            world.y >= m.position.y - ph/2 && world.y <= m.position.y + ph/2) return m.id as string;
      }
      return null;
    };

    // Helper: hit-test zone
    const hitZone = () => {
      const z = store.zones.find((z) => {
        const b = z.bounds;
        return world.x >= b.x && world.x <= b.x + b.w && world.y >= b.y && world.y <= b.y + b.h;
      });
      return z ? (z.id as string) : null;
    };

    // ── 공통: 빈 공간 감지 ──
    const anyNode = hitNode();
    const anyEdge = hitEdge();
    const anyMedia = hitMedia();
    const anyZone = hitZone();
    const hitNothing = !anyNode && !anyEdge && !anyMedia && !anyZone;

    // Floor label/outline click → toggle active floor (no interior click — that's
    // reserved for zone work). Does not deselect zones/media/nodes.
    const hitFloorHandle = store.phase !== 'running'
      ? (hitTestFloorLabel(world, store.floors, store.zones) ??
         hitTestFloorOutline(world, store.floors, store.zones))
      : null;
    if (hitFloorHandle) {
      const fid = hitFloorHandle.id as string;
      store.setActiveFloor(store.activeFloorId === fid ? null : fid);
      return;
    }

    // 빈 공간 클릭 → 전체 선택 해제 + Select 모드
    if (hitNothing) {
      selectZone(null);
      store.selectWaypoint(null);
      (store as any).selectMedia?.(null);
      store.setPendingEdgeSource(null);
      store.setActiveFloor(null);
      if (mode !== 'select') store.setEditorMode('select');
      return;
    }

    // ── Layer-based selection by editor mode ──
    if (mode === 'place-waypoint') {
      if (anyNode) { store.selectWaypoint(anyNode.id); return; }
      return; // 노드 배치는 mouseDown에서 처리
    }

    if (mode === 'connect-waypoint') {
      if (anyEdge) { store.selectEdge(anyEdge); return; }
      return; // 연결은 mouseDown에서 처리
    }

    if (mode === 'place-media') {
      if (anyMedia) { (store as any).selectMedia(anyMedia); selectZone(null); store.selectWaypoint(null); return; }
      return;
    }

    if (mode === 'create-zone') {
      if (anyMedia) { (store as any).selectMedia(anyMedia); selectZone(null); store.selectWaypoint(null); return; }
      selectZone(anyZone);
      store.selectWaypoint(null);
      return;
    }

    // ── Select 모드: 전체 레이어 우선순위 ──
    if (anyNode) { store.selectWaypoint(anyNode.id); selectZone(null); return; }
    if (anyEdge) { store.selectEdge(anyEdge); selectZone(null); return; }
    if (anyMedia) { selectZone(null); store.selectWaypoint(null); (store as any).selectMedia(anyMedia); return; }
    if (anyZone) { selectZone(anyZone); store.selectWaypoint(null); return; }
  }, [selectZone]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const mode = dragMode.current;

    if (mode === 'pan' && managerRef.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      managerRef.current.camera.pan(dx, dy);
      setCamera({ x: managerRef.current.camera.x, y: managerRef.current.camera.y, zoom: managerRef.current.camera.zoom });
      didDrag.current = true;
      return;
    }

    // Floor frame dragging — shift entire floor + children by incremental delta
    if (mode === 'floor-drag' && dragFloorId.current) {
      const world = getWorldPos(e);
      if (world) {
        const dx = world.x - floorDragLast.current.x;
        const dy = world.y - floorDragLast.current.y;
        if (dx !== 0 || dy !== 0) {
          useStore.getState().shiftFloor(dragFloorId.current, dx, dy);
          floorDragLast.current = { x: world.x, y: world.y };
          didDrag.current = true;
        }
      }
      return;
    }

    // Floor frame resizing — anchor opposite corner, drag live corner to cursor
    if (mode === 'floor-resize' && dragFloorId.current && floorResizeCorner.current) {
      const world = getWorldPos(e);
      if (world) {
        const anchor = floorResizeAnchor.current;
        const minX = Math.min(anchor.x, world.x);
        const minY = Math.min(anchor.y, world.y);
        const maxX = Math.max(anchor.x, world.x);
        const maxY = Math.max(anchor.y, world.y);
        useStore.getState().resizeFloor(dragFloorId.current, {
          x: minX, y: minY, w: maxX - minX, h: maxY - minY,
        });
        didDrag.current = true;
      }
      return;
    }

// Waypoint node dragging
    if (mode === 'waypoint-move' && dragWaypointId.current) {
      const world = getWorldPos(e);
      if (world) {
        const store = useStore.getState();
        store.updateWaypoint(dragWaypointId.current, { position: { x: world.x, y: world.y } });
        didDrag.current = true;
        // Update zoneId based on new position
        let hitZoneId: string | null = null;
        for (const zone of store.zones) {
          const b = zone.bounds;
          if (world.x >= b.x && world.x <= b.x + b.w && world.y >= b.y && world.y <= b.y + b.h) {
            hitZoneId = zone.id as string;
            break;
          }
        }
        // Reassign floorId when the node crosses into another floor's frame.
        const hitFloor = findFloorAtPoint(world, store.floors, store.zones);
        const patch: any = { zoneId: hitZoneId as any ?? null };
        if (hitFloor) patch.floorId = hitFloor.id;
        store.updateWaypoint(dragWaypointId.current, patch);
      }
      return;
    }

    const world = getWorldPos(e);

    // Track mouse world position for ghost node preview
    mouseWorldPos.current = world;

    // Node/Edge placement: crosshair cursor
    if (mode === 'none' && world && containerRef.current) {
      const store = useStore.getState();
      if (store.editorMode === 'place-waypoint' && store.pendingWaypointType) {
        containerRef.current.style.cursor = 'crosshair';
        return;
      }
      if (store.editorMode === 'connect-waypoint') {
        containerRef.current.style.cursor = 'crosshair';
        return;
      }
    }

    // Hover cursor: change cursor based on what's under mouse
    if (mode === 'none' && world && containerRef.current) {
      const store = useStore.getState();
      const el = containerRef.current;
      // Floor corner hover (selected floor only) — resize cursor
      if (!spacePressed.current && store.phase !== 'running') {
        const hitCorner = hitTestFloorCorner(world, store.floors, store.zones, store.activeFloorId);
        if (hitCorner) {
          el.style.cursor = hitCorner.corner === 'nw' || hitCorner.corner === 'se' ? 'nwse-resize' : 'nesw-resize';
          return;
        }
      }
      // Floor label/outline hover takes priority (visible only when >1 floors)
      if (!spacePressed.current && store.phase !== 'running' &&
          (hitTestFloorLabel(world, store.floors, store.zones) ||
           hitTestFloorOutline(world, store.floors, store.zones))) {
        el.style.cursor = 'move';
        return;
      }
      if (spacePressed.current) {
        el.style.cursor = 'grab';
      } else if (store.selectedZoneId) {
        const sel = store.zones.find((z) => (z.id as string) === store.selectedZoneId);
        if (sel) {
          const corner = hitTestCorner(world, sel);
          if (corner) {
            el.style.cursor = corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';
          } else {
            // L-handle check
            let hitLHandle = false;
            if ((sel.shape as string).startsWith('l_')) {
              const lrx = (sel as any).lRatioX ?? 0.5;
              const lry = (sel as any).lRatioY ?? 0.5;
              const lhx = sel.bounds.x + sel.bounds.w * lrx;
              const lhy = sel.bounds.y + sel.bounds.h * lry;
              const lhdx = world.x - lhx, lhdy = world.y - lhy;
              if (lhdx * lhdx + lhdy * lhdy < 150) { el.style.cursor = 'crosshair'; hitLHandle = true; }
            }
            // Custom polygon vertex/edge hover (only in editing mode — no gates)
            let hitVertex = false;
            let hitEdge = false;
            const polyEditHover = !hitLHandle && sel.shape === 'custom' && sel.polygon && sel.polygon.length > 2 && useStore.getState().polygonEditMode;
            if (polyEditHover) {
              const vts = sel.polygon as {x:number;y:number}[];
              for (const pv of vts) {
                const pvdx = world.x - pv.x, pvdy = world.y - pv.y;
                if (pvdx * pvdx + pvdy * pvdy < 64) { el.style.cursor = 'crosshair'; hitVertex = true; break; }
              }
              if (!hitVertex) {
                for (let vi = 0; vi < vts.length; vi++) {
                  const a = vts[vi], b = vts[(vi + 1) % vts.length];
                  const cp = closestPointOnSeg(world.x, world.y, a.x, a.y, b.x, b.y);
                  const dx = cp.x - world.x, dy = cp.y - world.y;
                  if (Math.sqrt(dx * dx + dy * dy) <= 6) { el.style.cursor = 'cell'; hitEdge = true; break; }
                }
              }
            }
            if (!hitLHandle && !hitVertex && !hitEdge) {
              // Gate hover
              let onGate = false;
              for (const g of sel.gates) {
                const gdx = (g.position as any).x - world.x;
                const gdy = (g.position as any).y - world.y;
                if (gdx * gdx + gdy * gdy < 225) { onGate = true; break; }
              }
              if (onGate) { el.style.cursor = 'move'; }
              else {
                const sb = sel.bounds;
                el.style.cursor = (world.x >= sb.x && world.x <= sb.x + sb.w && world.y >= sb.y && world.y <= sb.y + sb.h) ? 'move' : 'default';
              }
            }
          }
        } else {
          el.style.cursor = 'default';
        }
      } else {
        // Check if hovering any zone
        const hovered = store.zones.find((z) => {
          const b = z.bounds;
          return world.x >= b.x && world.x <= b.x + b.w && world.y >= b.y && world.y <= b.y + b.h;
        });
        if (hovered) {
          el.style.cursor = 'pointer';
        } else {
          // Check bg image hover
          let bgCursor = 'default';
          const manager = managerRef.current;
          if (manager && store.showBackground && store.phase !== 'running') {
            const fl = store.floors.find((f: any) => (f.id as string) === store.activeFloorId);
            if (fl?.canvas.backgroundImage && !(fl.canvas.bgLocked ?? false) && !fl.canvas.bgHidden) {
              const bgB = manager.getBgImageBounds(fl.id as string, fl.canvas.bgOffsetX ?? 0, fl.canvas.bgOffsetY ?? 0, fl.canvas.bgScale ?? 1);
              if (bgB) {
                const bgCorners: Array<{ corner: string; cx: number; cy: number }> = [
                  { corner: 'nw', cx: bgB.x, cy: bgB.y },
                  { corner: 'ne', cx: bgB.x + bgB.w, cy: bgB.y },
                  { corner: 'sw', cx: bgB.x, cy: bgB.y + bgB.h },
                  { corner: 'se', cx: bgB.x + bgB.w, cy: bgB.y + bgB.h },
                ];
                for (const { corner, cx, cy } of bgCorners) {
                  if (Math.abs(world.x - cx) < 12 && Math.abs(world.y - cy) < 12) {
                    bgCursor = (corner === 'nw' || corner === 'se') ? 'nwse-resize' : 'nesw-resize';
                    break;
                  }
                }
                if (bgCursor === 'default' && world.x >= bgB.x && world.x <= bgB.x + bgB.w && world.y >= bgB.y && world.y <= bgB.y + bgB.h) {
                  bgCursor = 'move';
                }
              }
            }
          }
          el.style.cursor = bgCursor;
        }
      }
    }

    // Background image drag
    if (world && (mode === 'bg-move' || mode === 'bg-resize')) {
      const store = useStore.getState();
      if (store.activeFloorId) {
        const fl = store.floors.find((f: any) => (f.id as string) === store.activeFloorId);
        if (fl) {
          if (mode === 'bg-move') {
            const newX = world.x - dragOffset.current.x;
            const newY = world.y - dragOffset.current.y;
            store.updateFloorCanvas(fl.id as string, { bgOffsetX: newX, bgOffsetY: newY });
          } else {
            // bg-resize: proportional scaling based on diagonal distance from anchor
            const dx = world.x - bgDragAnchor.current.x;
            const dy = world.y - bgDragAnchor.current.y;
            const newDiag = Math.sqrt(dx * dx + dy * dy);
            if (bgDragInitDiag.current > 0) {
              const ratio = newDiag / bgDragInitDiag.current;
              const newScale = Math.max(0.05, bgDragInitScale.current * ratio);
              const manager = managerRef.current;
              if (manager) {
                const img = manager.getBgImageBounds(fl.id as string, 0, 0, newScale);
                if (img) {
                  const anchor = bgDragAnchor.current;
                  const c = resizeCorner.current;
                  let newOffX = fl.canvas.bgOffsetX ?? 0;
                  let newOffY = fl.canvas.bgOffsetY ?? 0;
                  if (c === 'se') { newOffX = anchor.x; newOffY = anchor.y; }
                  else if (c === 'sw') { newOffX = anchor.x - img.w; newOffY = anchor.y; }
                  else if (c === 'ne') { newOffX = anchor.x; newOffY = anchor.y - img.h; }
                  else { newOffX = anchor.x - img.w; newOffY = anchor.y - img.h; }
                  store.updateFloorCanvas(fl.id as string, { bgScale: newScale, bgOffsetX: newOffX, bgOffsetY: newOffY });
                }
              }
            }
          }
          didDrag.current = true;
        }
      }
      return;
    }

    if (!world) return;

    // Zone-specific drag modes
    if (!dragZoneId.current && !dragMediaId.current) return;
    const store = useStore.getState();
    const zone = dragZoneId.current ? store.zones.find((z) => (z.id as string) === dragZoneId.current) : null;

    const snap = (v: number) => Math.round(v / 10) * 10;

    // Check if a zone (with shape) overlaps any other zone (polygon-aware for L-shapes)
    const overlapsOtherZone = (rect: { x: number; y: number; w: number; h: number }, excludeId: string, draggedZone?: any) => {
      const store = useStore.getState();
      const zA = {
        bounds: rect,
        shape: (draggedZone?.shape ?? 'rect') as string,
        lRatioX: (draggedZone as any)?.lRatioX ?? 0.5,
        lRatioY: (draggedZone as any)?.lRatioY ?? 0.5,
        polygon: draggedZone?.polygon,
      };
      return store.zones.some((z) => {
        if ((z.id as string) === excludeId) return false;
        return zonesOverlap(zA, {
          bounds: z.bounds, shape: (z.shape ?? 'rect') as string,
          lRatioX: (z as any).lRatioX ?? 0.5, lRatioY: (z as any).lRatioY ?? 0.5,
          polygon: z.polygon,
        });
      });
    };

    if (mode === 'move' && zone) {
      const newX = snap(world.x - dragOffset.current.x);
      const newY = snap(world.y - dragOffset.current.y);
      const newBounds = { ...zone.bounds, x: newX, y: newY };
      // Block if overlapping another zone
      if (overlapsOtherZone(newBounds, dragZoneId.current!, zone)) return;
      const dx = newX - zone.bounds.x;
      const dy = newY - zone.bounds.y;
      // Move gates with zone
      const movedGates = zone.gates.map((g: any) => ({
        ...g,
        position: { x: g.position.x + dx, y: g.position.y + dy },
      }));
      // Move polygon vertices with zone
      const movedPolygon = zone.polygon
        ? (zone.polygon as {x:number;y:number}[]).map(v => ({ x: v.x + dx, y: v.y + dy }))
        : null;
      // Batch update zone + media positions together (avoid clamp/overlap race)
      const currentMedia = useStore.getState().media;
      const movedMedia = currentMedia.map(m => {
        if ((m.zoneId as string) !== dragZoneId.current) return m;
        return { ...m, position: { x: m.position.x + dx, y: m.position.y + dy } };
      });
      useStore.setState((s) => {
        const updatedZones = s.zones.map(z => (z.id as string) !== dragZoneId.current ? z : {
          ...z, bounds: newBounds, gates: movedGates,
          ...(movedPolygon ? { polygon: movedPolygon } : {}),
        });
        // Reassign floor membership if zone center crossed into another floor's frame
        const center = { x: newBounds.x + newBounds.w / 2, y: newBounds.y + newBounds.h / 2 };
        const hitFloor = findFloorAtPoint(center, s.floors, updatedZones);
        let updatedFloors = s.floors;
        if (hitFloor) {
          const currentHolder = s.floors.find(f => f.zoneIds.some(id => (id as string) === dragZoneId.current));
          if (currentHolder && (currentHolder.id as string) !== (hitFloor.id as string)) {
            updatedFloors = s.floors.map(f => {
              if ((f.id as string) === (currentHolder.id as string)) {
                return { ...f, zoneIds: f.zoneIds.filter(id => (id as string) !== dragZoneId.current) };
              }
              if ((f.id as string) === (hitFloor.id as string)) {
                return { ...f, zoneIds: [...f.zoneIds, dragZoneId.current as any] };
              }
              return f;
            });
          }
        }
        return {
          zones: updatedZones,
          media: movedMedia,
          floors: updatedFloors,
          scenario: s.scenario ? {
            ...s.scenario,
            zones: updatedZones,
            media: movedMedia,
            floors: updatedFloors,
          } : s.scenario,
        };
      });
      didDrag.current = true;
    } else if (mode === 'resize' && zone) {
      const ob = zone.bounds; // old bounds
      let { x, y, w, h } = ob;
      const smallTypes = new Set(['corridor', 'rest']);
      const MIN = smallTypes.has(zone.type as string) ? 30 : 60;
      const c = resizeCorner.current;
      const wx = snap(world.x);
      const wy = snap(world.y);

      // Circle: 반지름 기반 균일 리사이즈
      if (zone.shape === 'circle' || zone.shape === 'o_ring') {
        const cx = ob.x + ob.w / 2;
        const cy = ob.y + ob.h / 2;
        const dx = world.x - cx, dy = world.y - cy;
        const newR = Math.max(MIN / 2, Math.round(Math.sqrt(dx * dx + dy * dy) / 10) * 10);
        const d = newR * 2;
        x = cx - newR; y = cy - newR; w = d; h = d;
      } else if (c === 'se') { w = Math.max(MIN, wx - x); h = Math.max(MIN, wy - y); }
      else if (c === 'sw') { const newX = Math.min(x + w - MIN, wx); w = w + (x - newX); x = newX; h = Math.max(MIN, wy - y); }
      else if (c === 'ne') { w = Math.max(MIN, wx - x); const newY = Math.min(y + h - MIN, wy); h = h + (y - newY); y = newY; }
      else if (c === 'nw') { const newX = Math.min(x + w - MIN, wx); w = w + (x - newX); x = newX; const newY = Math.min(y + h - MIN, wy); h = h + (y - newY); y = newY; }

      // Block if overlapping another zone
      if (overlapsOtherZone({ x, y, w, h }, dragZoneId.current!, zone)) return;

      // Proportionally reposition gates
      const scaleX = ob.w > 0 ? w / ob.w : 1;
      const scaleY = ob.h > 0 ? h / ob.h : 1;
      const resizedGates = zone.gates.map((g: any) => ({
        ...g,
        position: {
          x: x + (g.position.x - ob.x) * scaleX,
          y: y + (g.position.y - ob.y) * scaleY,
        },
      }));
      const pxToM = 1 / 20; // MEDIA_SCALE = 20
      const newArea = Math.round(w * pxToM * h * pxToM * 100) / 100;
      const zMedia = useStore.getState().media.filter(m => (m.zoneId as string) === dragZoneId.current);
      const mediaArea = zMedia.reduce((s, m) => s + m.size.width * m.size.height, 0);
      const effectiveArea = Math.max(1, newArea - mediaArea);
      const newCap = Math.max(1, Math.floor(effectiveArea / 2.5));
      updateZone(dragZoneId.current!, { bounds: { x, y, w, h }, gates: resizedGates, area: newArea, capacity: newCap } as any);
      didDrag.current = true;
    } else if (mode === 'gate' && dragGateId.current && dragZoneId.current && zone) {
      const b = zone.bounds;
      let gx: number, gy: number;
      const sh = zone.shape as string;

      if (sh === 'circle' || sh === 'o_ring') {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const r = Math.min(b.w, b.h) / 2;
        const angle = Math.atan2(world.y - cy, world.x - cx);
        gx = cx + Math.cos(angle) * r;
        gy = cy + Math.sin(angle) * r;
      } else if (sh === 'custom' && zone.polygon && zone.polygon.length > 2) {
        // Custom polygon: snap gate to polygon edges
        const vts = zone.polygon as {x:number;y:number}[];
        let bestDist = Infinity;
        gx = world.x; gy = world.y;
        for (let vi = 0; vi < vts.length; vi++) {
          const a = vts[vi], b2 = vts[(vi + 1) % vts.length];
          const cp = closestPointOnSeg(world.x, world.y, a.x, a.y, b2.x, b2.y);
          const d = (cp.x - world.x) ** 2 + (cp.y - world.y) ** 2;
          if (d < bestDist) { bestDist = d; gx = cp.x; gy = cp.y; }
        }
      } else {
        // Build edge segments for the shape
        const edges = getZoneEdges(b, sh, (zone as any).lRatioX ?? 0.5, (zone as any).lRatioY ?? 0.5);
        // Find closest point on any edge
        let bestDist = Infinity;
        gx = world.x; gy = world.y;
        for (const [a, e] of edges) {
          const cp = closestPointOnSeg(world.x, world.y, a.x, a.y, e.x, e.y);
          const d = (cp.x - world.x) ** 2 + (cp.y - world.y) ** 2;
          if (d < bestDist) { bestDist = d; gx = cp.x; gy = cp.y; }
        }
      }
      gx = snap(gx); gy = snap(gy);

      const updatedGates = zone.gates.map((g: any) =>
        (g.id as string) === dragGateId.current
          ? { ...g, position: { x: gx, y: gy } }
          : g,
      );
      updateZone(dragZoneId.current, { gates: updatedGates } as any);
      didDrag.current = true;
    } else if (mode === 'l-handle' && dragZoneId.current && zone) {
      // Drag L-shape inner corner ratio
      const b = zone.bounds;
      const rx = Math.max(0.15, Math.min(0.85, (world.x - b.x) / b.w));
      const ry = Math.max(0.15, Math.min(0.85, (world.y - b.y) / b.h));
      // Reposition gates when L-handle changes
      const shape = zone.shape as string;
      const bx = b.w * rx, by = b.h * ry;
      let leftMid = { x: b.x, y: b.y + b.h / 2 };
      let rightMid = { x: b.x + b.w, y: b.y + b.h / 2 };
      if (shape === 'l_top_right') { leftMid = { x: b.x, y: b.y + b.h / 2 }; rightMid = { x: b.x + b.w, y: b.y + by + (b.h - by) / 2 }; }
      else if (shape === 'l_top_left') { leftMid = { x: b.x, y: b.y + by + (b.h - by) / 2 }; rightMid = { x: b.x + b.w, y: b.y + b.h / 2 }; }
      else if (shape === 'l_bottom_right') { leftMid = { x: b.x, y: b.y + b.h / 2 }; rightMid = { x: b.x + b.w, y: b.y + by / 2 }; }
      else if (shape === 'l_bottom_left') { leftMid = { x: b.x, y: b.y + by / 2 }; rightMid = { x: b.x + b.w, y: b.y + b.h / 2 }; }
      const updatedGates = zone.gates.map((g: any, i: number) => ({ ...g, position: i === 0 ? leftMid : rightMid }));
      updateZone(dragZoneId.current, { lRatioX: rx, lRatioY: ry, gates: updatedGates } as any);
      didDrag.current = true;
    } else if (mode === 'vertex' && dragZoneId.current && zone && dragVertexIdx.current !== null) {
      const vIdx = dragVertexIdx.current;
      const poly = zone.polygon;
      if (poly && vIdx < poly.length) {
        let snappedX = snap(world.x);
        let snappedY = snap(world.y);

        // 자석 스냅: 다른 존 경계에 가까우면 붙기
        const SNAP_DIST = 15;
        let bestDist = SNAP_DIST * SNAP_DIST;
        const otherZones = useStore.getState().zones.filter(z => (z.id as string) !== dragZoneId.current);
        for (const oz of otherZones) {
          // 원형 존: 원 둘레에 가장 가까운 점으로 스냅
          if (oz.shape === 'circle' || oz.shape === 'o_ring') {
            const cx = oz.bounds.x + oz.bounds.w / 2;
            const cy = oz.bounds.y + oz.bounds.h / 2;
            const r = Math.min(oz.bounds.w, oz.bounds.h) / 2;
            const ddx = snappedX - cx, ddy = snappedY - cy;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist > 0) {
              const nearX = cx + (ddx / dist) * r;
              const nearY = cy + (ddy / dist) * r;
              const sdx = nearX - snappedX, sdy = nearY - snappedY;
              const sd2 = sdx * sdx + sdy * sdy;
              if (sd2 < bestDist) {
                bestDist = sd2;
                snappedX = Math.round(nearX);
                snappedY = Math.round(nearY);
              }
            }
            continue;
          }

          const verts = getZoneVertices(oz.bounds, oz.shape, (oz as any).lRatioX ?? 0.5, (oz as any).lRatioY ?? 0.5, oz.polygon);
          for (let ei = 0; ei < verts.length; ei++) {
            const a = verts[ei], b = verts[(ei + 1) % verts.length];
            const cp = closestPointOnSeg(snappedX, snappedY, a.x, a.y, b.x, b.y);
            const dx = cp.x - snappedX, dy = cp.y - snappedY;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist) {
              bestDist = d2;
              snappedX = Math.round(cp.x);
              snappedY = Math.round(cp.y);
            }
            // 꼭짓점 스냅 (더 강하게)
            const vdx = a.x - snap(world.x), vdy = a.y - snap(world.y);
            const vd2 = vdx * vdx + vdy * vdy;
            if (vd2 < bestDist) {
              bestDist = vd2;
              snappedX = Math.round(a.x);
              snappedY = Math.round(a.y);
            }
          }
        }

        const newPoly = poly.map((v, i) =>
          i === vIdx ? { x: snappedX, y: snappedY } : { x: v.x, y: v.y }
        );
        // Recompute bounds
        let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
        for (const v of newPoly) {
          if (v.x < mnX) mnX = v.x;
          if (v.y < mnY) mnY = v.y;
          if (v.x > mxX) mxX = v.x;
          if (v.y > mxY) mxY = v.y;
        }
        updateZone(dragZoneId.current, {
          polygon: newPoly,
          bounds: { x: mnX, y: mnY, w: mxX - mnX, h: mxY - mnY },
        } as any);
      }
      didDrag.current = true;
    } else if (mode === 'media-vertex' && dragMediaId.current && dragVertexIdx.current !== null) {
      const m = useStore.getState().media.find((m: any) => (m.id as string) === dragMediaId.current);
      if (m && m.polygon && dragVertexIdx.current < m.polygon.length) {
        const mRad = (m.orientation * Math.PI) / 180;
        // Transform world to local coords
        const dx = world.x - m.position.x;
        const dy = world.y - m.position.y;
        const localX = dx * Math.cos(-mRad) - dy * Math.sin(-mRad);
        const localY = dx * Math.sin(-mRad) + dy * Math.cos(-mRad);
        // Snap to grid in local coords
        const snappedX = Math.round(localX / 5) * 5;
        const snappedY = Math.round(localY / 5) * 5;
        const vIdx = dragVertexIdx.current;
        const newPoly = m.polygon.map((v: any, i: number) =>
          i === vIdx ? { x: snappedX, y: snappedY } : { x: v.x, y: v.y }
        );
        // Recompute size from AABB of polygon
        let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
        for (const v of newPoly) {
          if (v.x < mnX) mnX = v.x;
          if (v.y < mnY) mnY = v.y;
          if (v.x > mxX) mxX = v.x;
          if (v.y > mxY) mxY = v.y;
        }
        updateMedia(dragMediaId.current, {
          polygon: newPoly,
          size: { width: (mxX - mnX) / 20, height: (mxY - mnY) / 20 },
        } as any);
      }
      didDrag.current = true;
    } else if (mode === 'media-resize' && dragMediaId.current) {
      const m = useStore.getState().media.find((m: any) => (m.id as string) === dragMediaId.current);
      if (m) {
        const c = resizeCorner.current;
        const MS = 20;
        const minSize = 0.5; // min 0.5m
        // Transform world mouse position to media's local coordinate system
        const dx = world.x - m.position.x;
        const dy = world.y - m.position.y;
        const rad = (m.orientation * Math.PI) / 180;
        const cosR = Math.cos(-rad), sinR = Math.sin(-rad);
        const localX = dx * cosR - dy * sinR;
        const localY = dx * sinR + dy * cosR;
        const halfW = m.size.width * MS / 2;
        const halfH = m.size.height * MS / 2;
        if (c === 'n' || c === 'e' || c === 's' || c === 'w') {
          const shape = (m as any).shape;
          if (shape === 'ellipse') {
            // Ellipse: e/w → width, n/s → height (independent)
            let newW = m.size.width, newH = m.size.height;
            if (c === 'e' || c === 'w') {
              newW = Math.max(minSize, Math.abs(localX) * 2 / MS);
              newW = Math.round(newW * 2) / 2;
            } else {
              newH = Math.max(minSize, Math.abs(localY) * 2 / MS);
              newH = Math.round(newH * 2) / 2;
            }
            updateMedia(dragMediaId.current, { size: { width: newW, height: newH } });
          } else {
            // Circle: radius = distance from center in local space
            const newR = Math.max(minSize * MS / 2, Math.sqrt(localX * localX + localY * localY));
            const newD = Math.round((newR * 2 / MS) * 2) / 2;
            updateMedia(dragMediaId.current, { size: { width: newD, height: newD } });
          }
        } else {
          let newW = m.size.width, newH = m.size.height;
          if (c === 'se') {
            newW = Math.max(minSize, (localX + halfW) / MS);
            newH = Math.max(minSize, (localY + halfH) / MS);
          } else if (c === 'nw') {
            newW = Math.max(minSize, (halfW - localX) / MS);
            newH = Math.max(minSize, (halfH - localY) / MS);
          } else if (c === 'ne') {
            newW = Math.max(minSize, (localX + halfW) / MS);
            newH = Math.max(minSize, (halfH - localY) / MS);
          } else if (c === 'sw') {
            newW = Math.max(minSize, (halfW - localX) / MS);
            newH = Math.max(minSize, (localY + halfH) / MS);
          }
          newW = Math.round(newW * 2) / 2;
          newH = Math.round(newH * 2) / 2;
          updateMedia(dragMediaId.current, { size: { width: newW, height: newH } });
        }
      }
      didDrag.current = true;
    } else if (mode === 'media-move' && dragMediaId.current) {
      const m = useStore.getState().media.find((m: any) => (m.id as string) === dragMediaId.current);
      const parentZone = m ? useStore.getState().zones.find((z: any) => (z.id as string) === (m.zoneId as string)) : null;
      let newX = snap(world.x - dragOffset.current.x);
      let newY = snap(world.y - dragOffset.current.y);
      // Clamp inside parent zone
      if (m && parentZone) {
        const pw = m.size.width * 20, ph = m.size.height * 20;
        const rad = (m.orientation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
        const hx = (pw * cos + ph * sin) / 2, hy = (pw * sin + ph * cos) / 2;
        const b = parentZone.bounds;
        newX = Math.max(b.x + hx, Math.min(b.x + b.w - hx, newX));
        newY = Math.max(b.y + hy, Math.min(b.y + b.h - hy, newY));
      }
      updateMedia(dragMediaId.current, { position: { x: newX, y: newY } });
      didDrag.current = true;
    } else if (mode === 'media-rotate' && dragMediaId.current) {
      const m = useStore.getState().media.find((m: any) => (m.id as string) === dragMediaId.current);
      if (m) {
        const angle = Math.atan2(world.x - m.position.x, -(world.y - m.position.y));
        const deg = ((angle * 180) / Math.PI + 360) % 360;
        // Snap to 45-degree increments
        const snapped = Math.round(deg / 45) * 45;
        updateMedia(dragMediaId.current, { orientation: snapped });
      }
      didDrag.current = true;
    }
  }, [setCamera, updateZone, editorMode]);

  const handleMouseUp = useCallback(() => {
    // Update edge costs if a waypoint was moved
    if (dragMode.current === 'waypoint-move' && dragWaypointId.current) {
      const store = useStore.getState();
      const graph = store.waypointGraph;
      if (graph) {
        const movedId = dragWaypointId.current;
        const movedNode = graph.nodes.find(n => (n.id as string) === movedId);
        if (movedNode) {
          for (const edge of graph.edges) {
            if ((edge.fromId as string) === movedId || (edge.toId as string) === movedId) {
              const from = graph.nodes.find(n => n.id === edge.fromId);
              const to = graph.nodes.find(n => n.id === edge.toId);
              if (from && to) {
                const dx = to.position.x - from.position.x;
                const dy = to.position.y - from.position.y;
                store.updateEdge(edge.id as string, { cost: Math.sqrt(dx * dx + dy * dy) });
              }
            }
          }
        }
      }
    }
    dragMode.current = 'none';
    dragZoneId.current = null;
    dragGateId.current = null;
    dragMediaId.current = null;
    dragWaypointId.current = null;
    dragFloorId.current = null;
    floorResizeCorner.current = null;
    dragVertexIdx.current = null;
    vertexOriginal.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!managerRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    managerRef.current.camera.zoomAt(e.deltaY, mouseX, mouseY, rect.width, rect.height);
    setCamera({ x: managerRef.current.camera.x, y: managerRef.current.camera.y, zoom: managerRef.current.camera.zoom });
  }, [setCamera]);

  const setFollowAgent = useStore((s) => s.setFollowAgent);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const world = getWorldPos(e);
    if (!world) return;
    const store = useStore.getState();
    const graph = store.waypointGraph;

    // ── 엣지 더블클릭: 중간에 bend 노드 삽입하여 엣지 분할 (단순 꺾기) ──
    // Read-only viewport (Simulate / Analyze) skips bend insertion entirely —
    // double-click in those stages is reserved for agent follow.
    if (!readOnly && graph && store.phase === 'idle') {
      for (const edge of graph.edges) {
        const from = graph.nodes.find(n => n.id === edge.fromId);
        const to = graph.nodes.find(n => n.id === edge.toId);
        if (!from || !to) continue;
        const cp = closestPointOnSeg(world.x, world.y, from.position.x, from.position.y, to.position.x, to.position.y);
        const dx = cp.x - world.x, dy = cp.y - world.y;
        if (Math.sqrt(dx * dx + dy * dy) < 10) {
          store.pushUndo(store.zones, store.media, store.waypointGraph);
          // 중간 bend 노드 생성 (경유점 — 경로 탐색에서 투명)
          const midId = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
          const sameTypeCount = graph.nodes.filter(n => n.type === 'bend').length;
          const midNode = {
            id: midId as any,
            type: 'bend' as const,
            position: { x: Math.round(cp.x), y: Math.round(cp.y) },
            floorId: from.floorId,
            label: `Bend ${sameTypeCount + 1}`,
            attraction: 0,
            dwellTimeMs: 0,
            capacity: 20,
            spawnWeight: 0,
            lookAt: 0,
            zoneId: from.zoneId,
            mediaId: null,
          };
          // 새 엣지 2개: from→mid, mid→to
          const edge1 = {
            id: `e_${Date.now()}_a` as any,
            fromId: edge.fromId,
            toId: midId as any,
            direction: edge.direction,
            cost: Math.sqrt((from.position.x - cp.x) ** 2 + (from.position.y - cp.y) ** 2),
            passWeight: edge.passWeight,
          };
          const edge2 = {
            id: `e_${Date.now()}_b` as any,
            fromId: midId as any,
            toId: edge.toId,
            direction: edge.direction,
            cost: Math.sqrt((to.position.x - cp.x) ** 2 + (to.position.y - cp.y) ** 2),
            passWeight: edge.passWeight,
          };
          // 기존 엣지 제거, 노드+엣지 추가
          store.removeEdge(edge.id as string);
          store.addWaypoint(midNode);
          store.addEdge(edge1);
          store.addEdge(edge2);
          store.selectWaypoint(midId);
          return;
        }
      }
    }

    // ── 에이전트 팔로우 토글 ──
    let closest: { id: string; dist: number } | null = null;
    for (const v of store.visitors) {
      if (!v.isActive) continue;
      const dx = v.position.x - world.x;
      const dy = v.position.y - world.y;
      const dist = dx * dx + dy * dy;
      if (dist < 225 && (!closest || dist < closest.dist)) {
        closest = { id: v.id as string, dist };
      }
    }
    if (closest) {
      const current = store.followAgentId;
      setFollowAgent(current === closest.id ? null : closest.id);
    } else {
      setFollowAgent(null);
    }
  }, [setFollowAgent, editorMode, setEditorMode, readOnly]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const world = getWorldPos(e);
    if (!world) return;
    const store = useStore.getState();
    const graph = store.waypointGraph;

    // Priority: node > edge > zone (show property popover for nodes/edges)
    if (graph) {
      // Hit-test node
      for (const node of graph.nodes) {
        const dx = node.position.x - world.x, dy = node.position.y - world.y;
        if (dx * dx + dy * dy < 400) {
          store.selectWaypoint(node.id as string);
          showPopover(e.clientX, e.clientY, 'node', node.id as string);
          return;
        }
      }
      // Hit-test edge
      for (const edge of graph.edges) {
        const from = graph.nodes.find(n => n.id === edge.fromId);
        const to = graph.nodes.find(n => n.id === edge.toId);
        if (!from || !to) continue;
        const cp = closestPointOnSeg(world.x, world.y, from.position.x, from.position.y, to.position.x, to.position.y);
        const dx = cp.x - world.x, dy = cp.y - world.y;
        if (Math.sqrt(dx * dx + dy * dy) < 10) {
          store.selectEdge(edge.id as string);
          showPopover(e.clientX, e.clientY, 'edge', edge.id as string);
          return;
        }
      }
    }

    // Media polygon vertex right-click → delete vertex
    if (store.mediaPolygonEditMode && store.selectedMediaId) {
      const selM = store.media.find((m: any) => (m.id as string) === store.selectedMediaId);
      if (selM && (selM as any).shape === 'custom' && selM.polygon && selM.polygon.length > 3) {
        const mRad = (selM.orientation * Math.PI) / 180;
        const dx = world.x - selM.position.x, dy = world.y - selM.position.y;
        const localX = dx * Math.cos(-mRad) - dy * Math.sin(-mRad);
        const localY = dx * Math.sin(-mRad) + dy * Math.cos(-mRad);
        for (let vi = 0; vi < selM.polygon.length; vi++) {
          const vdx = selM.polygon[vi].x - localX, vdy = selM.polygon[vi].y - localY;
          if (vdx * vdx + vdy * vdy < 64) {
            store.pushUndo(store.zones, store.media, store.waypointGraph);
            const newPoly = selM.polygon.filter((_: any, i: number) => i !== vi);
            let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
            for (const v of newPoly) {
              if (v.x < mnX) mnX = v.x;
              if (v.y < mnY) mnY = v.y;
              if (v.x > mxX) mxX = v.x;
              if (v.y > mxY) mxY = v.y;
            }
            updateMedia(store.selectedMediaId, {
              polygon: newPoly,
              size: { width: (mxX - mnX) / 20, height: (mxY - mnY) / 20 },
            } as any);
            return;
          }
        }
      }
    }

    // Hit-test media
    const MS = 20;
    for (const m of store.media) {
      let mHit = false;
      if ((m as any).shape === 'custom' && m.polygon && m.polygon.length > 2) {
        const mRad = (m.orientation * Math.PI) / 180;
        const dx2 = world.x - m.position.x, dy2 = world.y - m.position.y;
        const lx2 = dx2 * Math.cos(-mRad) - dy2 * Math.sin(-mRad);
        const ly2 = dx2 * Math.sin(-mRad) + dy2 * Math.cos(-mRad);
        mHit = ptInPoly(m.polygon as {x:number;y:number}[], lx2, ly2);
      } else {
        const pw = m.size.width * MS, ph = m.size.height * MS;
        mHit = world.x >= m.position.x - pw/2 && world.x <= m.position.x + pw/2 &&
               world.y >= m.position.y - ph/2 && world.y <= m.position.y + ph/2;
      }
      if (mHit) {
        (store as any).selectMedia(m.id as string);
        showPopover(e.clientX, e.clientY, 'media', m.id as string);
        return;
      }
    }

    // Hit-test zone
    const clicked = store.zones.find((z) => {
      const b = z.bounds;
      return world.x >= b.x && world.x <= b.x + b.w && world.y >= b.y && world.y <= b.y + b.h;
    });
    if (clicked) {
      selectZone(clicked.id as string);
      showPopover(e.clientX, e.clientY, 'zone', clicked.id as string);
      return;
    }

    // Empty space: show general context menu
    showMenu(e.clientX, e.clientY, world.x, world.y, null);
  }, [showMenu, showPopover, selectZone]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative ${isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <SpeedIndicator />
      <CanvasToolbar readOnly={readOnly} />
      <CanvasContextMenu menu={menu} onClose={hideMenu} />
      <PropertyPopover popover={popover} onClose={hidePopover} />
      <VisitorPopover canvasRef={canvasRef} managerRef={managerRef} />
    </div>
  );
}
