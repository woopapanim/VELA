import { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '@/stores';
import { CanvasManager } from '@/visualization';
import { useTheme } from '@/ui/components/ThemeProvider';
import { CanvasToolbar } from './CanvasToolbar';
import { TimelineBar } from './TimelineBar';
import { CanvasContextMenu, useContextMenu } from './ContextMenu';
import { VisitorPopover } from './VisitorPopover';
import { SpeedIndicator } from './SpeedIndicator';
import { useKeyboardShortcuts } from '@/ui/hooks/useKeyboardShortcuts';
import { zonesOverlap } from '@/domain/zoneGeometry';

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

export function CanvasPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<CanvasManager | null>(null);
  const { resolvedTheme } = useTheme();
  const { menu, show: showMenu, hide: hideMenu } = useContextMenu();
  useKeyboardShortcuts();

  // Store selectors (used by event handlers, not render loop)
  const zones = useStore((s) => s.zones);
  const setCamera = useStore((s) => s.setCamera);

  // Initialize canvas manager
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const manager = new CanvasManager(canvas);
    managerRef.current = manager;

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
  const prevZoneCount = useRef(0);
  useEffect(() => {
    if (zones.length > 0 && prevZoneCount.current === 0 && managerRef.current) {
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
          const fl = store.floors.find((f: any) => (f.id as string) === store.activeFloorId);
          const gridSz = fl?.canvas.gridSize ?? 40;
          const floorZoneIds = fl && fl.zoneIds.length > 0
            ? new Set(fl.zoneIds.map((z: any) => z as string))
            : null;

          manager.render({
            zones: floorZoneIds ? store.zones.filter((z: any) => floorZoneIds.has(z.id as string)) : store.zones,
            media: floorZoneIds ? store.media.filter((m: any) => floorZoneIds.has(m.zoneId as string)) : store.media,
            visitors: floorZoneIds ? store.visitors.filter((v: any) => (v.currentFloorId as string) === store.activeFloorId) : store.visitors,
            groups: store.groups,
            selectedZoneId: store.selectedZoneId,
            selectedMediaId: store.selectedMediaId,
            followAgentId: store.followAgentId,
            overlayMode: store.overlayMode,
            showGrid: store.showGrid,
            showGates: store.showGates,
            showLabels: store.showLabels,
            showBackground: store.showBackground,
            isDark: resolvedTheme === 'dark',
            canvasWidth: rect.width,
            canvasHeight: rect.height,
            gridSize: gridSz,
            pixelToMeterScale: fl?.canvas.scale ?? 0.025,
            backgroundImage: fl?.canvas.backgroundImage ?? null,
            bgOffsetX: fl?.canvas.bgOffsetX ?? 0,
            bgOffsetY: fl?.canvas.bgOffsetY ?? 0,
            bgScale: fl?.canvas.bgScale ?? 1,
            bgLocked: fl?.canvas.bgLocked ?? false,
            simPhase: store.phase,
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

  type DragMode = 'none' | 'pan' | 'move' | 'resize' | 'gate' | 'l-handle' | 'media-move' | 'media-rotate' | 'media-resize' | 'vertex' | 'bg-move' | 'bg-resize';
  const dragMode = useRef<DragMode>('none');
  const dragZoneId = useRef<string | null>(null);
  const dragGateId = useRef<string | null>(null);
  const dragMediaId = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeCorner = useRef<'nw' | 'ne' | 'sw' | 'se'>('se');
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

  function hitTestCorner(world: { x: number; y: number }, zone: { bounds: { x: number; y: number; w: number; h: number } }): 'nw' | 'ne' | 'sw' | 'se' | null {
    const b = zone.bounds;
    const r = 12; // hit radius
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

    // Handle zone editing in ANY editor mode (not just 'select')
    if (e.button === 0) {
      if (!world) return;
      const store = useStore.getState();
      // During active simulation: no zone editing (paused = editable)
      if (store.phase === 'running') return;

      // Check resize handle on selected zone first (skip for custom polygon editing)
      if (store.selectedZoneId) {
        const selZone = store.zones.find((z) => (z.id as string) === store.selectedZoneId);
        const isPolyEditing = selZone?.shape === 'custom' && (!selZone.gates || selZone.gates.length === 0);

        if (selZone && !isPolyEditing) {
          const corner = hitTestCorner(world, selZone);
          if (corner) {
            store.pushUndo(store.zones, store.media); // save before drag
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
            store.pushUndo(store.zones, store.media); // save before drag
            dragMode.current = 'l-handle';
            dragZoneId.current = store.selectedZoneId;
            e.preventDefault();
            return;
          }
        }

        // Check custom polygon vertex/edge click (only when no gates = editing mode)
        const polyEditing = selZone && selZone.shape === 'custom' && selZone.polygon && selZone.polygon.length > 2 && (!selZone.gates || selZone.gates.length === 0);
        if (polyEditing) {
          const vts = selZone.polygon as {x:number;y:number}[];
          // ① Vertex drag
          for (let vi = 0; vi < vts.length; vi++) {
            const vx = vts[vi].x - world.x;
            const vy = vts[vi].y - world.y;
            if (vx * vx + vy * vy < 64) { // 8px
              store.pushUndo(store.zones, store.media);
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
            store.pushUndo(store.zones, store.media);
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
              store.pushUndo(store.zones, store.media);
              dragMode.current = 'gate';
              dragZoneId.current = selZone.id as string;
              dragGateId.current = gate.id as string;
              e.preventDefault();
              return;
            }
          }
        }
      }

      // Check selected media resize handles first
      const MEDIA_SCALE_VAL = 20;
      if (store.selectedMediaId) {
        const selMedia = store.media.find((m: any) => (m.id as string) === store.selectedMediaId);
        if (selMedia) {
          const pw = selMedia.size.width * MEDIA_SCALE_VAL, ph = selMedia.size.height * MEDIA_SCALE_VAL;
          const corners = [
            { corner: 'nw' as const, cx: selMedia.position.x - pw/2, cy: selMedia.position.y - ph/2 },
            { corner: 'ne' as const, cx: selMedia.position.x + pw/2, cy: selMedia.position.y - ph/2 },
            { corner: 'se' as const, cx: selMedia.position.x + pw/2, cy: selMedia.position.y + ph/2 },
            { corner: 'sw' as const, cx: selMedia.position.x - pw/2, cy: selMedia.position.y + ph/2 },
          ];
          for (const { corner, cx, cy } of corners) {
            if (Math.abs(world.x - cx) < 8 && Math.abs(world.y - cy) < 8) {
              store.pushUndo(store.zones, store.media);
              dragMode.current = 'media-resize';
              dragMediaId.current = store.selectedMediaId;
              resizeCorner.current = corner;
              e.preventDefault();
              return;
            }
          }
        }
      }

      // Check media click for move/rotate (before zone click)
      for (const m of store.media) {
        const pw = m.size.width * MEDIA_SCALE_VAL;
        const ph = m.size.height * MEDIA_SCALE_VAL;
        const mx = m.position.x - pw / 2;
        const my = m.position.y - ph / 2;
        if (world.x >= mx && world.x <= mx + pw && world.y >= my && world.y <= my + ph) {
          store.pushUndo(store.zones, store.media);

          // Check if near front arrow (rotation handle) — top edge center of media
          const rad = (m.orientation * Math.PI) / 180;
          const arrowX = m.position.x + Math.sin(rad) * (ph / 2 + 8);
          const arrowY = m.position.y - Math.cos(rad) * (ph / 2 + 8);
          const adx = world.x - arrowX, ady = world.y - arrowY;
          if (adx * adx + ady * ady < 200) {
            dragMode.current = 'media-rotate';
            dragMediaId.current = m.id as string;
            (store as any).selectMedia(m.id as string);
            e.preventDefault();
            return;
          }

          dragMode.current = 'media-move';
          dragMediaId.current = m.id as string;
          dragOffset.current = { x: world.x - m.position.x, y: world.y - m.position.y };
          (store as any).selectMedia(m.id as string);
          e.preventDefault();
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
          store.pushUndo(store.zones, store.media);
          dragMode.current = 'move';
          dragZoneId.current = clicked.id as string;
          dragOffset.current = { x: world.x - clicked.bounds.x, y: world.y - clicked.bounds.y };
          selectZone(clicked.id as string);
          e.preventDefault();
        }
      } else {
        // Nothing clicked — check background image for drag/resize
        const manager = managerRef.current;
        if (manager && store.showBackground && store.phase !== 'running') {
          const fl = store.floors.find((f: any) => (f.id as string) === store.activeFloorId);
          if (fl?.canvas.backgroundImage && !(fl.canvas.bgLocked ?? false)) {
            const bgBounds = manager.getBgImageBounds(
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
  }, [editorMode, selectZone, setEditorMode]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (didDrag.current) return;
    const world = getWorldPos(e);
    if (!world) return;
    const store = useStore.getState();

    // Check media click first
    const MS = 20;
    for (const m of store.media) {
      const pw = m.size.width * MS, ph = m.size.height * MS;
      if (world.x >= m.position.x - pw/2 && world.x <= m.position.x + pw/2 &&
          world.y >= m.position.y - ph/2 && world.y <= m.position.y + ph/2) {
        (store as any).selectMedia(m.id as string);
        return;
      }
    }

    const clicked = store.zones.find((z) => {
      const b = z.bounds;
      return world.x >= b.x && world.x <= b.x + b.w && world.y >= b.y && world.y <= b.y + b.h;
    });
    selectZone(clicked ? (clicked.id as string) : null);
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

    const world = getWorldPos(e);

    // Hover cursor: change cursor based on what's under mouse
    if (mode === 'none' && world && containerRef.current) {
      const store = useStore.getState();
      const el = containerRef.current;
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
            const polyEditHover = !hitLHandle && sel.shape === 'custom' && sel.polygon && sel.polygon.length > 2 && (!sel.gates || sel.gates.length === 0);
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
            if (fl?.canvas.backgroundImage && !(fl.canvas.bgLocked ?? false)) {
              const bgB = manager.getBgImageBounds(fl.canvas.bgOffsetX ?? 0, fl.canvas.bgOffsetY ?? 0, fl.canvas.bgScale ?? 1);
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
      const scenario = store.scenario;
      if (scenario && store.activeFloorId) {
        const fl = scenario.floors.find((f: any) => (f.id as string) === store.activeFloorId);
        if (fl) {
          if (mode === 'bg-move') {
            const newX = world.x - dragOffset.current.x;
            const newY = world.y - dragOffset.current.y;
            store.setScenario({
              ...scenario,
              floors: scenario.floors.map((f: any) =>
                (f.id as string) === store.activeFloorId
                  ? { ...f, canvas: { ...f.canvas, bgOffsetX: newX, bgOffsetY: newY } }
                  : f,
              ),
            });
          } else {
            // bg-resize: proportional scaling based on diagonal distance from anchor
            const dx = world.x - bgDragAnchor.current.x;
            const dy = world.y - bgDragAnchor.current.y;
            const newDiag = Math.sqrt(dx * dx + dy * dy);
            if (bgDragInitDiag.current > 0) {
              const ratio = newDiag / bgDragInitDiag.current;
              const newScale = Math.max(0.05, bgDragInitScale.current * ratio);
              // Recompute offset so anchor corner stays fixed
              const manager = managerRef.current;
              if (manager) {
                const img = manager.getBgImageBounds(0, 0, newScale);
                if (img) {
                  const anchor = bgDragAnchor.current;
                  const c = resizeCorner.current; // the dragged corner
                  // anchor is the opposite corner, so:
                  // if dragging SE, anchor is NW (top-left) → offset = anchor
                  // if dragging NE, anchor is SW → offsetX = anchor.x - w, offsetY = anchor.y - h...
                  // Actually: anchor = opposite corner position. We want that corner to remain at the same world position.
                  let newOffX = fl.canvas.bgOffsetX ?? 0;
                  let newOffY = fl.canvas.bgOffsetY ?? 0;
                  if (c === 'se') { newOffX = anchor.x; newOffY = anchor.y; }
                  else if (c === 'sw') { newOffX = anchor.x - img.w; newOffY = anchor.y; }
                  else if (c === 'ne') { newOffX = anchor.x; newOffY = anchor.y - img.h; }
                  else { newOffX = anchor.x - img.w; newOffY = anchor.y - img.h; }
                  store.setScenario({
                    ...scenario,
                    floors: scenario.floors.map((f: any) =>
                      (f.id as string) === store.activeFloorId
                        ? { ...f, canvas: { ...f.canvas, bgScale: newScale, bgOffsetX: newOffX, bgOffsetY: newOffY } }
                        : f,
                    ),
                  });
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
      updateZone(dragZoneId.current, {
        bounds: newBounds,
        gates: movedGates,
        ...(movedPolygon ? { polygon: movedPolygon } : {}),
      } as any);
      // Move media with zone
      const currentMedia = useStore.getState().media;
      for (const m of currentMedia) {
        if ((m.zoneId as string) === dragZoneId.current) {
          updateMedia(m.id as string, { position: { x: m.position.x + dx, y: m.position.y + dy } });
        }
      }
      didDrag.current = true;
    } else if (mode === 'resize' && zone) {
      const ob = zone.bounds; // old bounds
      let { x, y, w, h } = ob;
      const smallTypes = new Set(['corridor', 'rest']);
      const MIN = smallTypes.has(zone.type as string) ? 30 : 60;
      const c = resizeCorner.current;
      const wx = snap(world.x);
      const wy = snap(world.y);

      if (c === 'se') { w = Math.max(MIN, wx - x); h = Math.max(MIN, wy - y); }
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
      updateZone(dragZoneId.current, { bounds: { x, y, w, h }, gates: resizedGates } as any);
      // Proportionally reposition media
      const currentMedia2 = useStore.getState().media;
      for (const m of currentMedia2) {
        if ((m.zoneId as string) === dragZoneId.current) {
          updateMedia(m.id as string, {
            position: {
              x: x + (m.position.x - ob.x) * scaleX,
              y: y + (m.position.y - ob.y) * scaleY,
            },
          });
        }
      }
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
        const snappedX = snap(world.x);
        const snappedY = snap(world.y);
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
    } else if (mode === 'media-resize' && dragMediaId.current) {
      const m = useStore.getState().media.find((m: any) => (m.id as string) === dragMediaId.current);
      if (m) {
        const c = resizeCorner.current;
        const MS = 20;
        const minSize = 0.5; // min 0.5m
        let newW = m.size.width, newH = m.size.height;
        const pos = m.position;
        if (c === 'se') {
          newW = Math.max(minSize, (world.x - (pos.x - m.size.width * MS / 2)) / MS);
          newH = Math.max(minSize, (world.y - (pos.y - m.size.height * MS / 2)) / MS);
        } else if (c === 'nw') {
          newW = Math.max(minSize, ((pos.x + m.size.width * MS / 2) - world.x) / MS);
          newH = Math.max(minSize, ((pos.y + m.size.height * MS / 2) - world.y) / MS);
        } else if (c === 'ne') {
          newW = Math.max(minSize, (world.x - (pos.x - m.size.width * MS / 2)) / MS);
          newH = Math.max(minSize, ((pos.y + m.size.height * MS / 2) - world.y) / MS);
        } else if (c === 'sw') {
          newW = Math.max(minSize, ((pos.x + m.size.width * MS / 2) - world.x) / MS);
          newH = Math.max(minSize, (world.y - (pos.y - m.size.height * MS / 2)) / MS);
        }
        // Round to 0.5
        newW = Math.round(newW * 2) / 2;
        newH = Math.round(newH * 2) / 2;
        updateMedia(dragMediaId.current, { size: { width: newW, height: newH } });
      }
      didDrag.current = true;
    } else if (mode === 'media-move' && dragMediaId.current) {
      const m = useStore.getState().media.find((m: any) => (m.id as string) === dragMediaId.current);
      const parentZone = m ? useStore.getState().zones.find((z: any) => (z.id as string) === (m.zoneId as string)) : null;
      let newX = snap(world.x - dragOffset.current.x);
      let newY = snap(world.y - dragOffset.current.y);
      // Clamp inside parent zone
      if (m && parentZone) {
        const pw = m.size.width * 20, ph = m.size.height * 20, mg = 5;
        const b = parentZone.bounds;
        newX = Math.max(b.x + pw/2 + mg, Math.min(b.x + b.w - pw/2 - mg, newX));
        newY = Math.max(b.y + ph/2 + mg, Math.min(b.y + b.h - ph/2 - mg, newY));
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
    dragMode.current = 'none';
    dragZoneId.current = null;
    dragGateId.current = null;
    dragMediaId.current = null;
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
    // Find closest active visitor within 15px
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
  }, [setFollowAgent, editorMode, setEditorMode]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const world = getWorldPos(e);
    if (!world) return;
    const store = useStore.getState();
    const clicked = store.zones.find((z) => {
      const b = z.bounds;
      return world.x >= b.x && world.x <= b.x + b.w && world.y >= b.y && world.y <= b.y + b.h;
    });
    showMenu(e.clientX, e.clientY, clicked ? (clicked.id as string) : null);
  }, [showMenu]);

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
      <CanvasToolbar />
      <TimelineBar />
      <CanvasContextMenu menu={menu} onClose={hideMenu} />
      <VisitorPopover canvasRef={canvasRef} managerRef={managerRef} />
    </div>
  );
}
