import { Trash2 } from 'lucide-react';
import { useStore } from '@/stores';
import type { WaypointType, ShaftId, FloorId, ElevatorShaft } from '@/domain';
import { getShaftFloorIds } from '@/domain/shaftMembership';
import { useT } from '@/i18n';
import { InfoTooltip } from '@/ui/components/InfoTooltip';

const NODE_TYPE_VALUES: WaypointType[] = ['entry', 'exit', 'zone', 'attractor', 'hub', 'rest', 'bend', 'portal'];
const EDGE_DIR_VALUES = ['directed', 'bidirectional'] as const;

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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="panel-section">
            {t('waypoint.node.title')}
          </h3>
          <button
            onClick={() => { removeWaypoint(selectedWaypointId); selectWaypoint(null); }}
            className="p-1 rounded hover:bg-destructive/20 text-destructive"
            title={t('waypoint.node.delete')}
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Type */}
        <Field label={t('waypoint.node.field.type')}>
          <select
            value={node.type}
            onChange={(e) => updateWaypoint(selectedWaypointId, { type: e.target.value as WaypointType })}
            className="w-full text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border"
          >
            {NODE_TYPE_VALUES.map(v => <option key={v} value={v}>{t(`waypoint.node.type.${v}`)}</option>)}
          </select>
        </Field>

        {/* Label */}
        <Field label={t('waypoint.node.field.label')}>
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
          <Field label={t('waypoint.node.field.attraction', { value: node.attraction.toFixed(2) })} tooltip={t('tooltip.node.attraction')}>
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
          <Field label={t('waypoint.node.field.dwell', { value: (node.dwellTimeMs / 1000).toFixed(0) })} tooltip={t('tooltip.node.dwell')}>
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
          <Field label={t('waypoint.node.field.poiCapacity', { value: node.capacity })} tooltip={t('tooltip.node.capacity')}>
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
              <Field label={t('waypoint.shaft.label')} tooltip={t('waypoint.shaft.tooltip')}>
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
                  <option value="">{t('waypoint.shaft.none')}</option>
                  {shafts.map(sh => {
                    const fids = getShaftFloorIds(sh.id, graph);
                    return (
                      <option key={sh.id as string} value={sh.id as string}>
                        {sh.name} · {fids.length ? fids.length + 'F' : '—'}
                      </option>
                    );
                  })}
                  <option value="__new__">{t('waypoint.shaft.new')}</option>
                </select>
              </Field>
              {currentShaft && (
                <>
                  <Field label={t('waypoint.shaft.name')}>
                    <input
                      type="text"
                      value={currentShaft.name}
                      onChange={(e) => updateShaft(currentShaft.id as string, { name: e.target.value })}
                      className="w-full text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border"
                    />
                  </Field>
                  <Field label={t('waypoint.shaft.capacity', { value: currentShaft.capacity })} tooltip={t('waypoint.shaft.capacity.tooltip')}>
                    <input
                      type="range"
                      min={1} max={30} step={1}
                      value={currentShaft.capacity}
                      onChange={(e) => updateShaft(currentShaft.id as string, { capacity: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </Field>
                  <Field label={t('waypoint.shaft.wait', { value: (currentShaft.waitTimeMs / 1000).toFixed(0) })} tooltip={t('waypoint.shaft.wait.tooltip')}>
                    <input
                      type="range"
                      min={0} max={30000} step={1000}
                      value={currentShaft.waitTimeMs}
                      onChange={(e) => updateShaft(currentShaft.id as string, { waitTimeMs: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </Field>
                  <Field label={t('waypoint.shaft.travel', { value: (currentShaft.travelTimePerFloorMs / 1000).toFixed(0) })} tooltip={t('waypoint.shaft.travel.tooltip')}>
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
          <Field label={t('waypoint.node.field.spawnWeight', { value: node.spawnWeight.toFixed(1) })} tooltip={t('tooltip.node.spawnWeight')}>
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
            {t('waypoint.edge.title')}
          </h3>
          <button
            onClick={() => { removeEdge(selectedEdgeId); selectEdge(null); }}
            className="p-1 rounded hover:bg-destructive/20 text-destructive"
            title={t('waypoint.edge.delete')}
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Direction */}
        <Field label={t('waypoint.edge.direction')}>
          <select
            value={edge.direction}
            onChange={(e) => updateEdge(selectedEdgeId, { direction: e.target.value as any })}
            className="w-full text-[11px] px-2 py-1 rounded-lg bg-secondary border border-border"
          >
            {EDGE_DIR_VALUES.map(v => <option key={v} value={v}>{t(`waypoint.edge.${v}`)}</option>)}
          </select>
        </Field>

        {/* Pass Weight */}
        <Field label={t('waypoint.edge.passWeight', { value: edge.passWeight.toFixed(2) })}>
          <input
            type="range"
            min={0} max={2} step={0.05}
            value={edge.passWeight}
            onChange={(e) => updateEdge(selectedEdgeId, { passWeight: parseFloat(e.target.value) })}
            className="w-full"
          />
        </Field>

        {/* Cost */}
        <Field label={t('waypoint.edge.cost', { value: Math.round(edge.cost) })}>
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
