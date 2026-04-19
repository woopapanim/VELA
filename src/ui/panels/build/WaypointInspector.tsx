import { Trash2 } from 'lucide-react';
import { useStore } from '@/stores';
import type { WaypointType } from '@/domain';
import { useT } from '@/i18n';

const NODE_TYPE_OPTIONS: { value: WaypointType; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'exit', label: 'Exit' },
  { value: 'zone', label: 'Zone' },
  { value: 'attractor', label: 'Attractor' },
  { value: 'hub', label: 'Hub' },
  { value: 'rest', label: 'Rest' },
  { value: 'bend', label: 'Bend' },
];

const EDGE_DIR_OPTIONS = [
  { value: 'directed', label: 'Directed →' },
  { value: 'bidirectional', label: 'Bidirectional ↔' },
];

export function WaypointInspector() {
  const selectedWaypointId = useStore((s) => s.selectedWaypointId);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);
  const graph = useStore((s) => s.waypointGraph);
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="panel-section">
            Node Inspector
          </h3>
          <button
            onClick={() => { removeWaypoint(selectedWaypointId); selectWaypoint(null); }}
            className="p-1 rounded hover:bg-destructive/20 text-destructive"
            title="Delete node"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Type */}
        <Field label="Type">
          <select
            value={node.type}
            onChange={(e) => updateWaypoint(selectedWaypointId, { type: e.target.value as WaypointType })}
            className="w-full text-[11px] px-2 py-1 rounded bg-secondary border border-border"
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
            className="w-full text-[11px] px-2 py-1 rounded bg-secondary border border-border"
            placeholder={t('waypoint.namePlaceholder')}
          />
        </Field>

        {/* Attraction */}
        <Field label={`Attraction: ${node.attraction.toFixed(2)}`}>
          <input
            type="range"
            min={0} max={1} step={0.05}
            value={node.attraction}
            onChange={(e) => updateWaypoint(selectedWaypointId, { attraction: parseFloat(e.target.value) })}
            className="w-full"
          />
        </Field>

        {/* Dwell Time */}
        <Field label={`Dwell: ${(node.dwellTimeMs / 1000).toFixed(0)}s`}>
          <input
            type="range"
            min={0} max={120000} step={1000}
            value={node.dwellTimeMs}
            onChange={(e) => updateWaypoint(selectedWaypointId, { dwellTimeMs: parseInt(e.target.value) })}
            className="w-full"
          />
        </Field>

        {/* Capacity */}
        <Field label={`Capacity: ${node.capacity}`}>
          <input
            type="number"
            min={1} max={500}
            value={node.capacity}
            onChange={(e) => updateWaypoint(selectedWaypointId, { capacity: parseInt(e.target.value) || 1 })}
            className="w-20 text-[11px] px-2 py-1 rounded bg-secondary border border-border"
          />
        </Field>

        {/* Spawn Weight (ENTRY only) */}
        {node.type === 'entry' && (
          <Field label={`Spawn Weight: ${node.spawnWeight.toFixed(1)}`}>
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
    );
  }

  // ── Edge Inspector ──
  if (selectedEdgeId) {
    const edge = graph.edges.find(e => (e.id as string) === selectedEdgeId);
    if (!edge) return null;

    const fromNode = graph.nodes.find(n => n.id === edge.fromId);
    const toNode = graph.nodes.find(n => n.id === edge.toId);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="panel-section">
            Edge Inspector
          </h3>
          <button
            onClick={() => { removeEdge(selectedEdgeId); selectEdge(null); }}
            className="p-1 rounded hover:bg-destructive/20 text-destructive"
            title="Delete edge"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Direction */}
        <Field label="Direction">
          <select
            value={edge.direction}
            onChange={(e) => updateEdge(selectedEdgeId, { direction: e.target.value as any })}
            className="w-full text-[11px] px-2 py-1 rounded bg-secondary border border-border"
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
            className="w-20 text-[11px] px-2 py-1 rounded bg-secondary border border-border"
          />
        </Field>

        {/* From/To labels */}
        <div className="text-[9px] text-muted-foreground mt-1">
          {fromNode?.label || fromNode?.type || '?'} → {toNode?.label || toNode?.type || '?'}
        </div>
      </div>
    );
  }

  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="panel-label block mb-0.5">{label}</label>
      {children}
    </div>
  );
}
