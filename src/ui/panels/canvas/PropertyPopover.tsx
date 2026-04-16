import { useEffect, useRef, useState as __useState } from 'react';
import { Trash2, X, Plus } from 'lucide-react';
import { useStore } from '@/stores';
import type { WaypointType, ZoneType, MediaPlacement, MediaId } from '@/domain';
import { MEDIA_PRESETS } from '@/domain';
import { getZoneVertices } from '@/domain/zoneGeometry';
import { getZonePolygon } from '@/simulation/engine/transit';

const NODE_TYPE_OPTIONS: { value: WaypointType; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'exit', label: 'Exit' },
  { value: 'zone', label: 'Zone' },
  { value: 'attractor', label: 'Attractor' },
  { value: 'hub', label: 'Hub' },
  { value: 'rest', label: 'Rest' },
  { value: 'bend', label: 'Bend' },
];

const NODE_COLORS: Record<string, string> = {
  entry: '#22c55e', exit: '#ef4444', zone: '#3b82f6', attractor: '#f59e0b', hub: '#8b5cf6', rest: '#9ca3af',
};

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
  const updateWaypoint = useStore((s) => s.updateWaypoint);
  const removeWaypoint = useStore((s) => s.removeWaypoint);
  const updateEdge = useStore((s) => s.updateEdge);
  const removeEdge = useStore((s) => s.removeEdge);
  const updateZone = useStore((s) => s.updateZone);
  const removeZone = useStore((s) => s.removeZone);
  const updateMedia = useStore((s) => s.updateMedia);
  const removeMedia = useStore((s) => s.removeMedia);
  const selectWaypoint = useStore((s) => s.selectWaypoint);
  const selectEdge = useStore((s) => s.selectEdge);
  const selectZone = useStore((s) => s.selectZone);
  const selectMedia = useStore((s) => (s as any).selectMedia);

  // Close on outside click
  useEffect(() => {
    if (!popover.visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => window.removeEventListener('mousedown', handler);
  }, [popover.visible, onClose]);

  if (!popover.visible || !popover.targetId) return null;

  // ── Node popover ──
  if (popover.targetType === 'node' && graph) {
    const node = graph.nodes.find(n => (n.id as string) === popover.targetId);
    if (!node) return null;

    return (
      <div ref={ref} className="fixed z-50 w-56 glass rounded-xl border border-border shadow-2xl p-3 space-y-2"
        style={{ left: popover.x, top: popover.y }}
        onContextMenu={e => e.preventDefault()}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[node.type] ?? '#888' }} />
            <span className="text-[11px] font-medium">{node.type.toUpperCase()}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => { removeWaypoint(popover.targetId!); selectWaypoint(null); onClose(); }}
              className="p-0.5 rounded hover:bg-destructive/20 text-destructive"><Trash2 size={11} /></button>
            <button onClick={onClose} className="p-0.5 rounded hover:bg-secondary"><X size={11} /></button>
          </div>
        </div>

        {/* Type */}
        <Row label="Type">
          <select value={node.type} onChange={e => updateWaypoint(popover.targetId!, { type: e.target.value as WaypointType })}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
            {NODE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>

        {/* Label */}
        <Row label="Label">
          <input type="text" value={node.label} placeholder="이름"
            onChange={e => updateWaypoint(popover.targetId!, { label: e.target.value })}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
        </Row>

        {/* Attraction */}
        <Row label={`Attr ${node.attraction.toFixed(2)}`}>
          <input type="range" min={0} max={1} step={0.05} value={node.attraction}
            onChange={e => updateWaypoint(popover.targetId!, { attraction: parseFloat(e.target.value) })}
            className="flex-1" />
        </Row>

        {/* Capacity */}
        <Row label="Cap">
          <input type="number" min={1} max={500} value={node.capacity}
            onChange={e => updateWaypoint(popover.targetId!, { capacity: parseInt(e.target.value) || 1 })}
            className="w-14 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
        </Row>

        {/* Spawn Weight (ENTRY) */}
        {node.type === 'entry' && (
          <Row label={`Weight ${node.spawnWeight.toFixed(1)}`}>
            <input type="range" min={0} max={5} step={0.1} value={node.spawnWeight}
              onChange={e => updateWaypoint(popover.targetId!, { spawnWeight: parseFloat(e.target.value) })}
              className="flex-1" />
          </Row>
        )}

        {/* Dwell */}
        <Row label={`Dwell ${(node.dwellTimeMs/1000).toFixed(0)}s`}>
          <input type="range" min={0} max={120000} step={1000} value={node.dwellTimeMs}
            onChange={e => updateWaypoint(popover.targetId!, { dwellTimeMs: parseInt(e.target.value) })}
            className="flex-1" />
        </Row>

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
        style={{ left: popover.x, top: popover.y }}
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
              title="방향 전환"
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
        style={{ left: popover.x, top: popover.y }}
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
            updateZone(popover.targetId!, { type: newType as any, color: ZONE_COLORS[newType] ?? zone.color });
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
          {zone.bounds.w}x{zone.bounds.h}px · {zone.shape}
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

    return (
      <div ref={ref} className="fixed z-50 w-56 glass rounded-xl border border-border shadow-2xl p-3 space-y-2"
        style={{ left: popover.x, top: popover.y }}
        onContextMenu={e => e.preventDefault()}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
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

        <Row label="Cap">
          <input type="number" min={1} max={200} value={m.capacity}
            onChange={e => updateMedia(popover.targetId!, { capacity: parseInt(e.target.value) || 1 })}
            className="w-14 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border" />
        </Row>

        <Row label={`Attr ${m.attractiveness.toFixed(2)}`}>
          <input type="range" min={0} max={1} step={0.05} value={m.attractiveness}
            onChange={e => updateMedia(popover.targetId!, { attractiveness: parseFloat(e.target.value) })}
            className="flex-1" />
        </Row>

        <Row label={`Time ${(m.avgEngagementTimeMs / 1000).toFixed(0)}s`}>
          <input type="range" min={5000} max={300000} step={5000} value={m.avgEngagementTimeMs}
            onChange={e => updateMedia(popover.targetId!, { avgEngagementTimeMs: parseInt(e.target.value) })}
            className="flex-1" />
        </Row>

        <Row label="Mode">
          <select value={(m as any).interactionType ?? 'passive'}
            onChange={e => updateMedia(popover.targetId!, { interactionType: e.target.value as any })}
            className="flex-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border">
            <option value="passive">Passive</option>
            <option value="active">Active</option>
            <option value="staged">Staged</option>
          </select>
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

function AddMediaInline({ zoneId, zoneBounds }: {
  zoneId: string;
  zoneBounds: { x: number; y: number; w: number; h: number };
}) {
  const [open, setOpen] = __useState(false);
  const addMedia = useStore((s) => s.addMedia);

  const handleAdd = (mediaType: string) => {
    const preset = (MEDIA_PRESETS as Record<string, any>)[mediaType];
    if (!preset) return;

    const SCALE = 20;
    const pw = preset.defaultSize.width * SCALE;
    const ph = preset.defaultSize.height * SCALE;
    const interactionType = preset.category === 'immersive' ? 'staged'
      : preset.isInteractive ? 'active' : 'passive';

    const media: MediaPlacement = {
      id: `m_pop_${_popoverMediaId++}` as MediaId,
      name: preset.type.replace(/_/g, ' '),
      type: mediaType as any,
      category: preset.category,
      zoneId: zoneId as any,
      position: {
        x: zoneBounds.x + zoneBounds.w / 2 + (Math.random() - 0.5) * Math.max(0, zoneBounds.w - pw - 40),
        y: zoneBounds.y + zoneBounds.h / 2 + (Math.random() - 0.5) * Math.max(0, zoneBounds.h - ph - 40),
      },
      size: preset.defaultSize,
      orientation: 0,
      capacity: preset.defaultCapacity,
      avgEngagementTimeMs: preset.avgEngagementTimeMs,
      attractiveness: 0.7,
      attractionRadius: preset.attractionRadius,
      interactionType: interactionType as any,
      queueBehavior: preset.queueBehavior,
      groupFriendly: preset.groupFriendly,
    };

    addMedia(media);
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
                <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{label}</span>
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
