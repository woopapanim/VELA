import { useEffect, useRef, useState as __useState } from 'react';
import { Trash2, X, Plus } from 'lucide-react';
import { useStore } from '@/stores';
import type { WaypointType, WaypointNode, MediaPlacement, MediaId, Vector2D, ShaftId, ElevatorShaft } from '@/domain';
import { MEDIA_PRESETS, MEDIA_SCALE, MEDIA_SQMETER_PER_PERSON } from '@/domain';
import { getShaftFloorIds } from '@/domain/shaftMembership';
import { getZonePolygon } from '@/simulation/engine/transit';
import { useToast } from '@/ui/components/Toast';
import { useT } from '@/i18n';

const NODE_TYPE_OPTIONS: { value: WaypointType; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'exit', label: 'Exit' },
  { value: 'zone', label: 'Zone' },
  { value: 'attractor', label: 'Attractor' },
  { value: 'hub', label: 'Hub' },
  { value: 'rest', label: 'Rest' },
  { value: 'bend', label: 'Bend' },
  { value: 'portal', label: 'Portal' },
];

const NODE_COLORS: Record<string, string> = {
  entry: '#22c55e', exit: '#ef4444', zone: '#3b82f6', attractor: '#f59e0b', hub: '#8b5cf6', rest: '#9ca3af', portal: '#06b6d4',
};

let _popoverShaftCounter = 1;
function nextPopoverShaftId(existing: readonly ElevatorShaft[]): ShaftId {
  let maxN = 0;
  for (const sh of existing) {
    const m = (sh.id as string).match(/^shaft_(\d+)$/);
    if (m) maxN = Math.max(maxN, parseInt(m[1]));
  }
  _popoverShaftCounter = Math.max(_popoverShaftCounter, maxN + 1);
  return `shaft_${_popoverShaftCounter++}` as ShaftId;
}

const ZONE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'lobby', label: 'Lobby' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'corridor', label: 'Corridor' },
  { value: 'rest', label: 'Rest' },
  { value: 'stage', label: 'Stage' },
];

const ZONE_COLORS: Record<string, string> = {
  lobby: '#14b8a6', exhibition: '#3b82f6', corridor: '#6b7280', rest: '#f59e0b', stage: '#a855f7',
};

const SHAPE_OPTIONS = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'l_top_left', label: 'L (Top-Left)' },
  { value: 'l_top_right', label: 'L (Top-Right)' },
  { value: 'l_bottom_left', label: 'L (Bottom-Left)' },
  { value: 'l_bottom_right', label: 'L (Bottom-Right)' },
  { value: 'o_ring', label: 'O-Ring' },
  { value: 'custom', label: 'Polygon' },
];

interface PopoverState {
  visible: boolean;
  x: number;
  y: number;
  targetType: 'node' | 'edge' | 'media' | 'zone' | null;
  targetId: string | null;
}

export function usePropertyPopover() {
  const [state, setState] = __import_useState<PopoverState>({ visible: false, x: 0, y: 0, targetType: null, targetId: null });

  const show = (x: number, y: number, targetType: PopoverState['targetType'], targetId: string) => {
    setState({ visible: true, x, y, targetType, targetId });
  };

  const hide = () => setState(s => ({ ...s, visible: false }));

  return { popover: state, showPopover: show, hidePopover: hide };
}

// Avoid React import issue — inline useState
import { useState as __import_useState } from 'react';

export function PropertyPopover({ popover, onClose }: {
  popover: PopoverState;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const graph = useStore((s) => s.waypointGraph);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const floors = useStore((s) => s.floors);
  const updateWaypoint = useStore((s) => s.updateWaypoint);
  const removeWaypoint = useStore((s) => s.removeWaypoint);
  const shafts = useStore((s) => s.shafts);
  const addShaft = useStore((s) => s.addShaft);
  const updateShaft = useStore((s) => s.updateShaft);
  const updateEdge = useStore((s) => s.updateEdge);
  const removeEdge = useStore((s) => s.removeEdge);
  const updateZone = useStore((s) => s.updateZone);
  const removeZone = useStore((s) => s.removeZone);
  const updateMedia = useStore((s) => s.updateMedia);
  const removeMedia = useStore((s) => s.removeMedia);
  const selectWaypoint = useStore((s) => s.selectWaypoint);
  const selectEdge = useStore((s) => s.selectEdge);
  const selectZone = useStore((s) => s.selectZone);
  const t = useT();

  // Close on outside click
  useEffect(() => {
    if (!popover.visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => window.removeEventListener('mousedown', handler);
  }, [popover.visible, onClose]);

  // Auto-flip when close to viewport edges
  const [flipped, setFlipped] = __import_useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    if (!popover.visible) return;
    // Measure actual popover size after paint, then record for next-frame adjustment
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      if (r.width !== flipped.w || r.height !== flipped.h) {
        setFlipped({ w: r.width, h: r.height });
      }
    }
  });

  const popoverStyle = (): React.CSSProperties => {
    // Estimate until measured
    const w = flipped.w || 240;
    const h = flipped.h || 380;
    const flipX = popover.x + w > window.innerWidth - 8;
    const flipY = popover.y + h > window.innerHeight - 8;
    return {
      left: flipX ? Math.max(8, popover.x - w) : popover.x,
      top: flipY ? Math.max(8, popover.y - h) : popover.y,
    };
  };

  if (!popover.visible || !popover.targetId) return null;

  // ── Node popover ──
  if (popover.targetType === 'node' && graph) {
    const node = graph.nodes.find(n => (n.id as string) === popover.targetId);
    if (!node) return null;

    // Legacy migration: nodes saved with type='elevator' rewrite to 'portal'.
    const effectiveType: WaypointType = ((node.type as string) === 'elevator' ? 'portal' : node.type) as WaypointType;
    if ((node.type as string) === 'elevator') {
      queueMicrotask(() => updateWaypoint(popover.targetId!, { type: 'portal' }));
    }

    const isPortal = effectiveType === 'portal';
    const currentShaftId = (node.shaftId as string | null | undefined) ?? null;
    const currentShaft = shafts.find(sh => (sh.id as string) === currentShaftId);

    // Which floors does each shaft serve? Derived from the set of portals pointing at it.
    const shaftFloorsLabel = (sh: ElevatorShaft) => {
      const fids = getShaftFloorIds(sh.id, graph);
      if (!fids.length) return '—';
      const names = fids
        .map(fid => floors.find(f => (f.id as string) === (fid as string))?.name)
        .filter((n): n is string => !!n);
      return names.length ? names.join('+') : `${fids.length}F`;
    };

    return (
      <div ref={ref} className="fixed z-50 w-56 max-h-[80vh] overflow-y-auto overscroll-contain glass rounded-xl border border-border shadow-2xl p-3 space-y-2"
        style={popoverStyle()}
        onContextMenu={e => e.preventDefault()}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[effectiveType] ?? '#888' }} />
            <span className="text-[11px] font-medium">{effectiveType.toUpperCase()}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { removeWaypoint(popover.targetId!); selectWaypoint(null); onClose(); }}
              className="p-0.5 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={11} /></button>
            <button onClick={onClose} className="p-0.5 rounded hover:bg-secondary"><X size={11} /></button>
          </div>
        </div>

        {/* Type */}
        <Row label="Type">
          <select value={effectiveType} onChange={e => {
            const newType = e.target.value as WaypointType;
            let patch: Partial<WaypointNode> = { type: newType };
            // If the label is still the auto-generated "<Type> <n>" form, re-generate it
            // for the new type so the displayed name doesn't lie.
            const autoPattern = /^(Entry|Exit|Zone|Attractor|Hub|Rest|Bend|Portal)\s+\d+$/;
            if (autoPattern.test(node.label ?? '')) {
              const sameTypeCount = graph!.nodes.filter(n => n.type === newType && (n.id as string) !== (node.id as string)).length;
              const typeLabel = newType.charAt(0).toUpperCase() + newType.slice(1);
              patch = { ...patch, label: `${typeLabel} ${sameTypeCount + 1}` };
            }
            updateWaypoint(popover.targetId!, patch);
          }}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
            {NODE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>

        {/* Label */}
        <Row label="Label">
          <input type="text" value={node.label} placeholder={t('popover.waypoint.namePlaceholder')}
            onChange={e => updateWaypoint(popover.targetId!, { label: e.target.value })}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
        </Row>

        {/* Non-portal: Attr, Cap, Dwell */}
        {!isPortal && (
          <>
            <Row label={`Attr ${node.attraction.toFixed(2)}`}>
              <input type="range" min={0} max={1} step={0.05} value={node.attraction}
                onChange={e => updateWaypoint(popover.targetId!, { attraction: parseFloat(e.target.value) })}
                className="flex-1" />
            </Row>

            <Row label="Cap">
              <input type="number" min={1} max={500} value={node.capacity}
                onChange={e => updateWaypoint(popover.targetId!, { capacity: parseInt(e.target.value) || 1 })}
                className="w-14 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
            </Row>

            <Row label={`Dwell ${(node.dwellTimeMs/1000).toFixed(0)}s`}>
              <input type="range" min={0} max={120000} step={1000} value={node.dwellTimeMs}
                onChange={e => updateWaypoint(popover.targetId!, { dwellTimeMs: parseInt(e.target.value) })}
                className="flex-1" />
            </Row>
          </>
        )}

        {/* Spawn Weight (ENTRY) */}
        {effectiveType === 'entry' && (
          <Row label={`Weight ${node.spawnWeight.toFixed(1)}`}>
            <input type="range" min={0} max={5} step={0.1} value={node.spawnWeight}
              onChange={e => updateWaypoint(popover.targetId!, { spawnWeight: parseFloat(e.target.value) })}
              className="flex-1" />
          </Row>
        )}

        {/* Portal: Shaft selector + shaft params */}
        {isPortal && (
          <>
            <Row label="Shaft">
              <select
                value={currentShaftId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__new__') {
                    // Reuse an existing orphan shaft (no portal members) before minting a new one
                    // so repeatedly clicking "+ New shaft" doesn't accumulate empties.
                    const graph = useStore.getState().waypointGraph;
                    const usedShaftIds = new Set(
                      (graph?.nodes ?? [])
                        .filter((n) => n.type === 'portal' && n.shaftId)
                        .map((n) => n.shaftId as string),
                    );
                    const orphan = shafts.find((sh) => !usedShaftIds.has(sh.id as string));
                    if (orphan) {
                      updateWaypoint(popover.targetId!, { shaftId: orphan.id });
                      return;
                    }
                    const id = nextPopoverShaftId(shafts);
                    addShaft({
                      id,
                      name: `Shaft ${(id as string).replace('shaft_', '')}`,
                      capacity: 8,
                      waitTimeMs: 5000,
                      travelTimePerFloorMs: 3000,
                    });
                    updateWaypoint(popover.targetId!, { shaftId: id });
                    return;
                  }
                  updateWaypoint(popover.targetId!, { shaftId: (val || null) as any });
                }}
                className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
                <option value="">— None —</option>
                {shafts.map(sh => (
                  <option key={sh.id as string} value={sh.id as string}>
                    {sh.name} · {shaftFloorsLabel(sh)}
                  </option>
                ))}
                <option value="__new__">+ New shaft</option>
              </select>
            </Row>
            {currentShaft && (
              <>
                <Row label="Name">
                  <input type="text" value={currentShaft.name}
                    onChange={(e) => updateShaft(currentShaft.id as string, { name: e.target.value })}
                    className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
                </Row>
                <Row label={`Cap ${currentShaft.capacity}`}>
                  <input type="range" min={1} max={30} step={1} value={currentShaft.capacity}
                    onChange={(e) => updateShaft(currentShaft.id as string, { capacity: parseInt(e.target.value) })}
                    className="flex-1" />
                </Row>
                <Row label={`Wait ${(currentShaft.waitTimeMs/1000).toFixed(0)}s`}>
                  <input type="range" min={0} max={30000} step={1000} value={currentShaft.waitTimeMs}
                    onChange={(e) => updateShaft(currentShaft.id as string, { waitTimeMs: parseInt(e.target.value) })}
                    className="flex-1" />
                </Row>
                <Row label={`Travel ${(currentShaft.travelTimePerFloorMs/1000).toFixed(0)}s/F`}>
                  <input type="range" min={500} max={15000} step={500} value={currentShaft.travelTimePerFloorMs}
                    onChange={(e) => updateShaft(currentShaft.id as string, { travelTimePerFloorMs: parseInt(e.target.value) })}
                    className="flex-1" />
                </Row>
              </>
            )}
            {!currentShaft && (
              <div className="text-[8px] text-amber-500">⚠ Assign a shaft to enable teleport.</div>
            )}
          </>
        )}

        <div className="text-[8px] text-muted-foreground">
          ({Math.round(node.position.x)}, {Math.round(node.position.y)})
          {node.zoneId && ` · ${(node.zoneId as string).slice(0, 10)}`}
        </div>
      </div>
    );
  }

  // ── Edge popover ──
  if (popover.targetType === 'edge' && graph) {
    const edge = graph.edges.find(e => (e.id as string) === popover.targetId);
    if (!edge) return null;
    const fromNode = graph.nodes.find(n => n.id === edge.fromId);
    const toNode = graph.nodes.find(n => n.id === edge.toId);

    return (
      <div ref={ref} className="fixed z-50 w-52 glass rounded-xl border border-border shadow-2xl p-3 space-y-2"
        style={popoverStyle()}
        onContextMenu={e => e.preventDefault()}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium">EDGE</span>
          <div className="flex gap-1">
            <button onClick={() => { removeEdge(popover.targetId!); selectEdge(null); onClose(); }}
              className="p-0.5 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={11} /></button>
            <button onClick={onClose} className="p-0.5 rounded hover:bg-secondary"><X size={11} /></button>
          </div>
        </div>

        {/* Direction + Flip */}
        <Row label="Dir">
          <select value={edge.direction} onChange={e => updateEdge(popover.targetId!, { direction: e.target.value as any })}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
            <option value="directed">Directed →</option>
            <option value="bidirectional">Bidir ↔</option>
          </select>
          {edge.direction === 'directed' && (
            <button
              title="Flip Direction"
              onClick={() => updateEdge(popover.targetId!, { fromId: edge.toId, toId: edge.fromId } as any)}
              className="px-1.5 py-0.5 rounded bg-secondary hover:bg-accent text-[10px] border border-border"
            >⇄</button>
          )}
        </Row>

        <Row label={`Weight ${edge.passWeight.toFixed(2)}`}>
          <input type="range" min={0} max={2} step={0.05} value={edge.passWeight}
            onChange={e => updateEdge(popover.targetId!, { passWeight: parseFloat(e.target.value) })}
            className="flex-1" />
        </Row>

        <div className="text-[8px] text-muted-foreground">
          {fromNode?.label || fromNode?.type || '?'} {edge.direction === 'bidirectional' ? '↔' : '→'} {toNode?.label || toNode?.type || '?'}
          {' · '}{Math.round(edge.cost)}px
        </div>
      </div>
    );
  }

  // ── Zone popover ──
  if (popover.targetType === 'zone') {
    const zone = zones.find(z => (z.id as string) === popover.targetId);
    if (!zone) return null;

    return (
      <div ref={ref} className="fixed z-50 w-56 glass rounded-xl border border-border shadow-2xl p-3 space-y-2"
        style={popoverStyle()}
        onContextMenu={e => e.preventDefault()}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: ZONE_COLORS[zone.type] ?? '#888' }} />
            <span className="text-[11px] font-medium">ZONE</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { removeZone(popover.targetId!); selectZone(null); onClose(); }}
              className="p-0.5 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={11} /></button>
            <button onClick={onClose} className="p-0.5 rounded hover:bg-secondary"><X size={11} /></button>
          </div>
        </div>

        <Row label="Name">
          <input type="text" value={zone.name}
            onChange={e => updateZone(popover.targetId!, { name: e.target.value })}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
        </Row>

        <Row label="Type">
          <select value={zone.type} onChange={e => {
            const newType = e.target.value;
            updateZone(popover.targetId!, { type: newType as any, color: (ZONE_COLORS[newType] ?? zone.color) as `#${string}` });
          }}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
            {ZONE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>

        <Row label="Shape">
          <select value={zone.shape} onChange={e => {
            const v = e.target.value;
            if (v === 'custom') {
              updateZone(popover.targetId!, { shape: 'custom', polygon: [...getZonePolygon(zone as any)], gates: [] } as any);
              useStore.getState().setPolygonEditMode(true);
            } else {
              updateZone(popover.targetId!, { shape: v, polygon: null, gates: [] } as any);
            }
          }}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
            {SHAPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>

        <Row label="Cap">
          <input type="number" min={1} max={500} value={zone.capacity}
            onChange={e => updateZone(popover.targetId!, { capacity: parseInt(e.target.value) || 1 })}
            className="w-14 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
        </Row>

        <Row label={`Attr ${zone.attractiveness.toFixed(2)}`}>
          <input type="range" min={0} max={1} step={0.05} value={zone.attractiveness}
            onChange={e => updateZone(popover.targetId!, { attractiveness: parseFloat(e.target.value) })}
            className="flex-1" />
        </Row>

        <div className="text-[8px] text-muted-foreground">
          {(zone.bounds.w / 20).toFixed(1)}x{(zone.bounds.h / 20).toFixed(1)}m · {zone.area.toFixed(1)}m² · {zone.shape}
        </div>

        {/* Add Media — inline expandable */}
        {zone.type !== 'corridor' && (
          <AddMediaInline
            zoneId={popover.targetId!}
            zoneBounds={zone.bounds}
          />
        )}
      </div>
    );
  }

  // ── Media popover ──
  if (popover.targetType === 'media') {
    const m = media.find(m => (m.id as string) === popover.targetId);
    if (!m) return null;

    const interactionType = (m as any).interactionType ?? 'passive';
    const shape = (m as any).shape ?? 'rect';
    const autoCapacity = Math.max(1, Math.floor(
      (m.size.width * m.size.height) / MEDIA_SQMETER_PER_PERSON,
    ));

    return (
      <div ref={ref} className="fixed z-50 w-60 max-h-[80vh] overflow-y-auto overscroll-contain glass rounded-xl border border-border shadow-2xl p-3 space-y-2"
        style={popoverStyle()}
        onContextMenu={e => e.preventDefault()}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-cyan-500" />
            <span className="text-[11px] font-medium">MEDIA</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { removeMedia(popover.targetId!); onClose(); }}
              className="p-0.5 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={11} /></button>
            <button onClick={onClose} className="p-0.5 rounded hover:bg-secondary"><X size={11} /></button>
          </div>
        </div>

        <Row label="Name">
          <input type="text" value={m.name}
            onChange={e => updateMedia(popover.targetId!, { name: e.target.value })}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
        </Row>

        {/* Size (hidden for custom polygon) */}
        {shape !== 'custom' && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground w-12 shrink-0">Size</span>
            <input type="number" step="0.5" min="0.5" max="20" value={m.size.width}
              onChange={e => updateMedia(popover.targetId!, { size: { ...m.size, width: parseFloat(e.target.value) || 1 } })}
              className="w-12 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
            <span className="text-[9px] text-muted-foreground">×</span>
            <input type="number" step="0.5" min="0.5" max="20" value={m.size.height}
              onChange={e => updateMedia(popover.targetId!, { size: { ...m.size, height: parseFloat(e.target.value) || 1 } })}
              className="w-12 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
            <span className="text-[9px] text-muted-foreground">m</span>
          </div>
        )}

        <Row label={`Rot ${m.orientation}°`}>
          <input type="range" min={0} max={315} step={45} value={m.orientation}
            onChange={e => updateMedia(popover.targetId!, { orientation: parseInt(e.target.value) })}
            className="flex-1" />
        </Row>

        <Row label="Shape">
          <select value={shape} onChange={e => {
            const newShape = e.target.value;
            if (newShape === 'custom' && shape !== 'custom') {
              const pw = m.size.width * MEDIA_SCALE;
              const ph = m.size.height * MEDIA_SCALE;
              const poly: Vector2D[] = [
                { x: -pw / 2, y: -ph / 2 },
                { x:  pw / 2, y: -ph / 2 },
                { x:  pw / 2, y:  ph / 2 },
                { x: -pw / 2, y:  ph / 2 },
              ];
              updateMedia(popover.targetId!, { shape: 'custom', polygon: poly } as any);
              useStore.getState().setMediaPolygonEditMode(true);
            } else if (newShape !== 'custom' && shape === 'custom') {
              const poly = (m as any).polygon;
              if (poly && poly.length > 2) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const p of poly) {
                  if (p.x < minX) minX = p.x;
                  if (p.y < minY) minY = p.y;
                  if (p.x > maxX) maxX = p.x;
                  if (p.y > maxY) maxY = p.y;
                }
                const w = Math.max(0.5, (maxX - minX) / MEDIA_SCALE);
                const h = Math.max(0.5, (maxY - minY) / MEDIA_SCALE);
                updateMedia(popover.targetId!, { shape: newShape, polygon: undefined, size: { width: w, height: h } } as any);
              } else {
                updateMedia(popover.targetId!, { shape: newShape, polygon: undefined } as any);
              }
              useStore.getState().setMediaPolygonEditMode(false);
            } else {
              updateMedia(popover.targetId!, { shape: newShape } as any);
            }
          }}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
            <option value="rect">Rectangle</option>
            <option value="circle">Circle</option>
            <option value="ellipse">Ellipse</option>
            <option value="custom">Polygon</option>
          </select>
        </Row>

        <Row label="Mode">
          <select value={interactionType}
            onChange={e => updateMedia(popover.targetId!, { interactionType: e.target.value as any })}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
            <option value="passive">Passive</option>
            <option value="active">Active</option>
            <option value="staged">Staged</option>
            <option value="analog">Analog</option>
          </select>
        </Row>

        {/* Omnidirectional */}
        <Row label="Omni">
          <button
            onClick={() => updateMedia(popover.targetId!, { omnidirectional: !(m as any).omnidirectional } as any)}
            className={`flex-1 px-2 py-0.5 text-[9px] rounded transition-colors ${
              (m as any).omnidirectional ? 'bg-violet-500/20 text-violet-400' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {(m as any).omnidirectional ? '360°' : 'Front'}
          </button>
        </Row>

        {/* Stage Interval (staged only) */}
        {interactionType === 'staged' && (
          <Row label="Session">
            <input type="number" step="10" min="10"
              value={Math.round(((m as any).stageIntervalMs ?? 60000) / 1000)}
              onChange={e => updateMedia(popover.targetId!, { stageIntervalMs: (parseInt(e.target.value) || 60) * 1000 } as any)}
              className="w-14 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
            <span className="text-[9px] text-muted-foreground">s</span>
          </Row>
        )}

        {/* Capacity (not for analog) */}
        {interactionType !== 'analog' && (
          <Row label="Cap">
            <input type="number" min={1} max={200} value={m.capacity}
              onChange={e => updateMedia(popover.targetId!, { capacity: parseInt(e.target.value) || 1 })}
              className="w-14 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
            <button
              onClick={() => updateMedia(popover.targetId!, { capacity: autoCapacity })}
              className="text-[8px] text-primary hover:underline"
              title={t('popover.capacity.autoCalc', { count: autoCapacity })}
            >Auto({autoCapacity})</button>
          </Row>
        )}

        <Row label={`Engage ${(m.avgEngagementTimeMs / 1000).toFixed(0)}s`}>
          <input type="range" min={5000} max={300000} step={5000} value={m.avgEngagementTimeMs}
            onChange={e => updateMedia(popover.targetId!, { avgEngagementTimeMs: parseInt(e.target.value) })}
            className="flex-1" />
        </Row>

        {/* View Distance (passive only) */}
        {interactionType === 'passive' && (
          <Row label={`View ${((m as any).viewDistance ?? 2.0).toFixed(1)}m`}>
            <input type="range" min={0.5} max={10} step={0.5}
              value={(m as any).viewDistance ?? 2.0}
              onChange={e => updateMedia(popover.targetId!, { viewDistance: parseFloat(e.target.value) } as any)}
              className="flex-1" />
          </Row>
        )}

        <Row label={`Attr ${m.attractiveness.toFixed(2)}`}>
          <input type="range" min={0} max={1} step={0.05} value={m.attractiveness}
            onChange={e => updateMedia(popover.targetId!, { attractiveness: parseFloat(e.target.value) })}
            className="flex-1" />
        </Row>

        {/* Queue (not for analog) */}
        {interactionType !== 'analog' && (
          <Row label="Queue">
            <select value={(m as any).queueBehavior || 'none'}
              onChange={e => updateMedia(popover.targetId!, { queueBehavior: e.target.value } as any)}
              className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
              <option value="none">None</option>
              <option value="linear">Linear</option>
              <option value="area">Area</option>
            </select>
          </Row>
        )}

        <Row label="Group">
          <button
            onClick={() => updateMedia(popover.targetId!, { groupFriendly: !(m as any).groupFriendly } as any)}
            className={`flex-1 px-2 py-0.5 text-[9px] rounded transition-colors ${
              (m as any).groupFriendly ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {(m as any).groupFriendly ? 'Yes' : 'No'}
          </button>
        </Row>

        <div className="text-[8px] text-muted-foreground">
          {m.type.replace(/_/g, ' ')} · {m.size.width}x{m.size.height}m
        </div>
      </div>
    );
  }

  return null;
}

// ── Media categories for quick-add ──
const MEDIA_CATEGORIES = [
  { key: 'analog', label: 'Analog', color: '#a78bfa', items: ['artifact', 'documents', 'diorama', 'graphic_sign'] },
  { key: 'passive_media', label: 'Passive', color: '#3b82f6', items: ['media_wall', 'video_wall', 'projection_mapping', 'single_display'] },
  { key: 'active', label: 'Active', color: '#f59e0b', items: ['kiosk', 'touch_table', 'interaction_media', 'hands_on_model'] },
  { key: 'immersive', label: 'Immersive', color: '#ec4899', items: ['vr_ar_station', 'immersive_room', 'simulator_4d'] },
] as const;

let _popoverMediaId = 5000;

function ensurePopoverCounter() {
  const state = useStore.getState();
  let max = _popoverMediaId - 1;
  for (const m of state.media) {
    const match = (m.id as string).match(/^m_pop_(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1]));
  }
  _popoverMediaId = max + 1;
}

function AddMediaInline({ zoneId, zoneBounds }: {
  zoneId: string;
  zoneBounds: { x: number; y: number; w: number; h: number };
}) {
  const [open, setOpen] = __useState(false);
  const addMedia = useStore((s) => s.addMedia);
  const { toast } = useToast();
  const t = useT();

  const handleAdd = (mediaType: string) => {
    ensurePopoverCounter();
    const preset = (MEDIA_PRESETS as Record<string, any>)[mediaType];
    if (!preset) return;

    const SCALE = 20;
    const GAP = 10; // matches MEDIA_GAP in worldSlice
    const pw = preset.defaultSize.width * SCALE;
    const ph = preset.defaultSize.height * SCALE;
    const interactionType = preset.category === 'immersive' ? 'staged'
      : preset.category === 'analog' ? 'analog'
      : preset.isInteractive ? 'active' : 'passive';

    // Find a non-overlapping position: random tries first, then grid search fallback
    const existingInZone = useStore.getState().media.filter(
      (m) => (m.zoneId as string) === zoneId,
    );
    const collides = (cx: number, cy: number): boolean => {
      for (const o of existingInZone) {
        const ow = o.size.width * SCALE, oh = o.size.height * SCALE;
        if (Math.abs(cx - o.position.x) < (pw + ow) / 2 + GAP &&
            Math.abs(cy - o.position.y) < (ph + oh) / 2 + GAP) {
          return true;
        }
      }
      return false;
    };

    const minX = zoneBounds.x + pw / 2 + 4;
    const maxX = zoneBounds.x + zoneBounds.w - pw / 2 - 4;
    const minY = zoneBounds.y + ph / 2 + 4;
    const maxY = zoneBounds.y + zoneBounds.h - ph / 2 - 4;

    let px = (minX + maxX) / 2;
    let py = (minY + maxY) / 2;
    let found = !collides(px, py);

    // 20 random attempts
    for (let i = 0; !found && i < 20; i++) {
      const rx = minX + Math.random() * Math.max(0, maxX - minX);
      const ry = minY + Math.random() * Math.max(0, maxY - minY);
      if (!collides(rx, ry)) { px = rx; py = ry; found = true; }
    }

    // Grid search fallback — step by (pw + GAP) / (ph + GAP)
    if (!found) {
      const stepX = pw + GAP;
      const stepY = ph + GAP;
      outer: for (let gy = minY; gy <= maxY; gy += stepY) {
        for (let gx = minX; gx <= maxX; gx += stepX) {
          if (!collides(gx, gy)) { px = gx; py = gy; found = true; break outer; }
        }
      }
    }

    if (!found) {
      toast('error', t('popover.media.outOfSpace'));
      return;
    }

    const media: MediaPlacement = {
      id: `m_pop_${_popoverMediaId++}` as MediaId,
      name: preset.type.replace(/_/g, ' '),
      type: mediaType as any,
      category: preset.category,
      zoneId: zoneId as any,
      position: { x: px, y: py },
      size: preset.defaultSize,
      orientation: 0,
      capacity: preset.defaultCapacity,
      avgEngagementTimeMs: preset.avgEngagementTimeMs,
      attractiveness: 0.7,
      attractionRadius: preset.attractionRadius,
      interactionType: interactionType as any,
      omnidirectional: (preset as any).omnidirectional ?? false,
      queueBehavior: preset.queueBehavior,
      groupFriendly: preset.groupFriendly,
    };

    addMedia(media);
    useStore.getState().selectMedia(media.id as string);
  };

  return (
    <div className="border-t border-border pt-1.5 mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full px-2 py-1.5 text-[10px] rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
      >
        <Plus size={10} />
        Add Media
        <span className="text-[8px] text-muted-foreground ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div
          className="mt-1.5 space-y-1.5 max-h-52 overflow-y-auto overscroll-contain pr-0.5"
          onWheel={e => e.stopPropagation()}
        >
          {MEDIA_CATEGORIES.map(({ key, label, color, items }) => (
            <div key={key}>
              <div className="flex items-center gap-1 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: color }} />
                <span className="panel-label">{label}</span>
              </div>
              <div className="grid grid-cols-2 gap-0.5">
                {items.map(type => (
                  <button
                    key={type}
                    onClick={() => handleAdd(type)}
                    className="px-1.5 py-1 text-[9px] rounded bg-secondary hover:bg-accent text-left truncate transition-colors"
                    style={{ borderLeft: `2px solid ${color}` }}
                  >
                    {type.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-muted-foreground w-12 shrink-0">{label}</span>
      {children}
    </div>
  );
}
