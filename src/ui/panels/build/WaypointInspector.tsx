import { Trash2 } from 'lucide-react';
import { useStore } from '@/stores';
import type { WaypointType, ShaftId, FloorId, ElevatorShaft } from '@/domain';
import { getShaftFloorIds } from '@/domain/shaftMembership';
import { useT } from '@/i18n';
import { InfoTooltip } from '@/ui/components/InfoTooltip';

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

const NODE_TYPE_COLOR: Record<WaypointType, string> = {
  entry:     '#22c55e',
  exit:      '#ef4444',
  zone:      '#3b82f6',
  attractor: '#f59e0b',
  hub:       '#8b5cf6',
  rest:      '#f59e0b',
  bend:      '#94a3b8',
  portal:    '#06b6d4',
};

const EDGE_DIR_OPTIONS = [
  { value: 'directed', label: 'Directed →' },
  { value: 'bidirectional', label: 'Bidirectional ↔' },
];

// Field visibility per node type (see CLAUDE.md for semantics):
// - attraction/capacity: used by Score formula, irrelevant for entry/exit/bend
// - dwell: first-visit pause, only rest/attractor trigger it in SimEngine
// - spawnWeight: entry only
const SHOW_ATTRACTION: Record<WaypointType, boolean> = {
  entry: false, exit: false, bend: false, portal: false,
  zone: true, attractor: true, hub: true, rest: true,
};
const SHOW_DWELL: Record<WaypointType, boolean> = {
  entry: false, exit: false, bend: false, zone: false, hub: false, portal: false,
  attractor: true, rest: true,
};
const SHOW_CAPACITY: Record<WaypointType, boolean> = {
  entry: false, exit: false, bend: false, portal: false,
  zone: true, attractor: true, hub: true, rest: true,
};

let _shaftCounter = 1;
function nextShaftId(existing: readonly ElevatorShaft[]): ShaftId {
  let maxN = 0;
  for (const sh of existing) {
    const m = (sh.id as string).match(/^shaft_(\d+)$/);
    if (m) maxN = Math.max(maxN, parseInt(m[1]));
  }
  _shaftCounter = Math.max(_shaftCounter, maxN + 1);
  return `shaft_${_shaftCounter++}` as ShaftId;
}

export function WaypointInspector() {
  const selectedWaypointId = useStore((s) => s.selectedWaypointId);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);
  const graph = useStore((s) => s.waypointGraph);
  const shafts = useStore((s) => s.shafts);
  const addShaft = useStore((s) => s.addShaft);
  const updateShaft = useStore((s) => s.updateShaft);
  const updateWaypoint = useStore((s) => s.updateWaypoint);
  const removeWaypoint = useStore((s) => s.removeWaypoint);
  const updateEdge = useStore((s) => s.updateEdge);
  const removeEdge = useStore((s) => s.removeEdge);
  const selectWaypoint = useStore((s) => s.selectWaypoint);
  const selectEdge = useStore((s) => s.selectEdge);
  const t = useT();

  if (!graph) return null;

  // ── Node Inspector ──
  if (selectedWaypointId) {
    const node = graph.nodes.find(n => (n.id as string) === selectedWaypointId);
    if (!node) return null;

    return (
      <div data-editor="waypoint" className="bento-box p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: NODE_TYPE_COLOR[node.type] }} />
            <h2 className="panel-title">Edit Node</h2>
          </div>
          <button
            onClick={() => { removeWaypoint(selectedWaypointId); selectWaypoint(null); }}
            className="p-1 rounded hover:bg-[var(--status-danger)]/20 text-muted-foreground hover:text-[var(--status-danger)]"
            title="Delete node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
        {/* Type */}
        <Field label="Type">
          <select
            value={node.type}
            onChange={(e) => updateWaypoint(selectedWaypointId, { type: e.target.value as WaypointType })}
            className="w-full text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border"
          >
            {NODE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        {/* Label */}
        <Field label="Label">
          <input
            type="text"
            value={node.label}
            onChange={(e) => updateWaypoint(selectedWaypointId, { label: e.target.value })}
            className="w-full text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border"
            placeholder={t('waypoint.namePlaceholder')}
          />
        </Field>

        {/* Attraction (Score formula weight — not shown for entry/exit/bend) */}
        {SHOW_ATTRACTION[node.type] && (
          <Field label={`Attraction: ${node.attraction.toFixed(2)}`} tooltip={t('tooltip.node.attraction')}>
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={node.attraction}
              onChange={(e) => updateWaypoint(selectedWaypointId, { attraction: parseFloat(e.target.value) })}
              className="w-full"
            />
          </Field>
        )}

        {/* Dwell Time (rest/attractor only) */}
        {SHOW_DWELL[node.type] && (
          <Field label={`Dwell: ${(node.dwellTimeMs / 1000).toFixed(0)}s`} tooltip={t('tooltip.node.dwell')}>
            <input
              type="range"
              min={0} max={120000} step={1000}
              value={node.dwellTimeMs}
              onChange={(e) => updateWaypoint(selectedWaypointId, { dwellTimeMs: parseInt(e.target.value) })}
              className="w-full"
            />
          </Field>
        )}

        {/* Capacity — POI crowd cap, distinct from zone spatial capacity */}
        {SHOW_CAPACITY[node.type] && (
          <Field label={`POI Capacity: ${node.capacity}`} tooltip={t('tooltip.node.capacity')}>
            <input
              type="number"
              min={1} max={500}
              value={node.capacity}
              onChange={(e) => updateWaypoint(selectedWaypointId, { capacity: parseInt(e.target.value) || 1 })}
              className="w-20 text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border"
            />
          </Field>
        )}

        {/* Portal Shaft + timing (PORTAL only) */}
        {node.type === 'portal' && (() => {
          const currentShaftId = (node.shaftId as string | null | undefined) ?? null;
          const currentShaft = shafts.find(sh => (sh.id as string) === currentShaftId);
          return (
            <>
              <Field label="Shaft" tooltip="Portal shaft group. All nodes sharing a shaft connect to each other across floors/buildings. Agents wait + travel before teleporting.">
                <select
                  value={currentShaftId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__new__') {
                      const id = nextShaftId(shafts);
                      addShaft({
                        id,
                        name: `Shaft ${(id as string).replace('shaft_', '')}`,
                        capacity: 8,
                        waitTimeMs: 5000,
                        travelTimePerFloorMs: 3000,
                      });
                      updateWaypoint(selectedWaypointId, { shaftId: id });
                      return;
                    }
                    updateWaypoint(selectedWaypointId, { shaftId: (val || null) as any });
                  }}
                  className="w-full text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border"
                >
                  <option value="">— None —</option>
                  {shafts.map(sh => {
                    const fids = getShaftFloorIds(sh.id, graph);
                    return (
                      <option key={sh.id as string} value={sh.id as string}>
                        {sh.name} · {fids.length ? fids.length + 'F' : '—'}
                      </option>
                    );
                  })}
                  <option value="__new__">+ New shaft</option>
                </select>
              </Field>
              {currentShaft && (
                <>
                  <Field label="Shaft name">
                    <input
                      type="text"
                      value={currentShaft.name}
                      onChange={(e) => updateShaft(currentShaft.id as string, { name: e.target.value })}
                      className="w-full text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border"
                    />
                  </Field>
                  <Field label={`Capacity: ${currentShaft.capacity}`} tooltip="Max agents inside the cabin per trip.">
                    <input
                      type="range"
                      min={1} max={30} step={1}
                      value={currentShaft.capacity}
                      onChange={(e) => updateShaft(currentShaft.id as string, { capacity: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </Field>
                  <Field label={`Wait: ${(currentShaft.waitTimeMs / 1000).toFixed(0)}s`} tooltip="Time spent waiting for the cabin to arrive + board.">
                    <input
                      type="range"
                      min={0} max={30000} step={1000}
                      value={currentShaft.waitTimeMs}
                      onChange={(e) => updateShaft(currentShaft.id as string, { waitTimeMs: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </Field>
                  <Field label={`Travel / floor: ${(currentShaft.travelTimePerFloorMs / 1000).toFixed(0)}s`} tooltip="Per-floor travel time. Total = wait + |floors| × this.">
                    <input
                      type="range"
                      min={500} max={15000} step={500}
                      value={currentShaft.travelTimePerFloorMs}
                      onChange={(e) => updateShaft(currentShaft.id as string, { travelTimePerFloorMs: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </Field>
                </>
              )}
            </>
          );
        })()}

        {/* Spawn Weight (ENTRY only) */}
        {node.type === 'entry' && (
          <Field label={`Spawn Weight: ${node.spawnWeight.toFixed(1)}`} tooltip={t('tooltip.node.spawnWeight')}>
            <input
              type="range"
              min={0} max={5} step={0.1}
              value={node.spawnWeight}
              onChange={(e) => updateWaypoint(selectedWaypointId, { spawnWeight: parseFloat(e.target.value) })}
              className="w-full"
            />
          </Field>
        )}

        {/* Position (read-only) */}
        <div className="text-[9px] text-muted-foreground mt-1">
          pos: ({Math.round(node.position.x)}, {Math.round(node.position.y)})
          {node.zoneId && ` · zone: ${(node.zoneId as string).slice(0, 8)}`}
        </div>
        </div>
      </div>
    );
  }

  // ── Edge Inspector ──
  if (selectedEdgeId) {
    const edge = graph.edges.find(e => (e.id as string) === selectedEdgeId);
    if (!edge) return null;

    const fromNode = graph.nodes.find(n => n.id === edge.fromId);
    const toNode = graph.nodes.find(n => n.id === edge.toId);

    return (
      <div data-editor="edge" className="bento-box p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#6366f1' }} />
            <h2 className="panel-title">Edit Edge</h2>
          </div>
          <button
            onClick={() => { removeEdge(selectedEdgeId); selectEdge(null); }}
            className="p-1 rounded hover:bg-[var(--status-danger)]/20 text-muted-foreground hover:text-[var(--status-danger)]"
            title="Delete edge"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
        {/* Direction */}
        <Field label="Direction">
          <select
            value={edge.direction}
            onChange={(e) => updateEdge(selectedEdgeId, { direction: e.target.value as any })}
            className="w-full text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border"
          >
            {EDGE_DIR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        {/* Pass Weight */}
        <Field label={`Pass Weight: ${edge.passWeight.toFixed(2)}`}>
          <input
            type="range"
            min={0} max={2} step={0.05}
            value={edge.passWeight}
            onChange={(e) => updateEdge(selectedEdgeId, { passWeight: parseFloat(e.target.value) })}
            className="w-full"
          />
        </Field>

        {/* Cost */}
        <Field label={`Cost: ${Math.round(edge.cost)}px`}>
          <input
            type="number"
            min={1} max={5000}
            value={Math.round(edge.cost)}
            onChange={(e) => updateEdge(selectedEdgeId, { cost: parseInt(e.target.value) || 1 })}
            className="w-20 text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border"
          />
        </Field>

        {/* From/To labels */}
        <div className="text-[9px] text-muted-foreground mt-1">
          {fromNode?.label || fromNode?.type || '?'} → {toNode?.label || toNode?.type || '?'}
        </div>
        </div>
      </div>
    );
  }

  return null;
}

function Field({ label, children, tooltip }: { label: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        <label className="panel-label">{label}</label>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      {children}
    </div>
  );
}
