import { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/stores';
import { getZonePolygon } from '@/simulation/engine/transit';
import { ZONE_COLORS } from '@/domain';

/** Reposition gates to valid wall positions for the given shape */
function repositionGatesForShape(
  gates: any[],
  bounds: { x: number; y: number; w: number; h: number },
  shape: string,
  lRatioX: number,
  lRatioY: number,
): any[] {
  const { x, y, w, h } = bounds;

  // For rect/circle: entrance=left center, exit=right center
  if (!shape.startsWith('l_')) {
    return gates.map((g, i) => ({
      ...g,
      position: i === 0
        ? { x, y: y + h / 2 }
        : { x: x + w, y: y + h / 2 },
    }));
  }

  // For L-shapes: find the midpoint of the left edge and right edge of the polygon
  const bx = w * lRatioX, by = h * lRatioY;

  let leftMid: { x: number; y: number };
  let rightMid: { x: number; y: number };

  switch (shape) {
    case 'l_top_right':
      // Left edge goes full height, right edge: top at bx, bottom full
      leftMid = { x, y: y + h / 2 };
      rightMid = { x: x + w, y: y + by + (h - by) / 2 };
      break;
    case 'l_top_left':
      leftMid = { x, y: y + by + (h - by) / 2 };
      rightMid = { x: x + w, y: y + h / 2 };
      break;
    case 'l_bottom_right':
      leftMid = { x, y: y + h / 2 };
      rightMid = { x: x + w, y: y + by / 2 };
      break;
    case 'l_bottom_left':
      leftMid = { x, y: y + by / 2 };
      rightMid = { x: x + w, y: y + h / 2 };
      break;
    default:
      leftMid = { x, y: y + h / 2 };
      rightMid = { x: x + w, y: y + h / 2 };
  }

  return gates.map((g, i) => ({
    ...g,
    position: i === 0 ? leftMid : rightMid,
  }));
}

export function ZoneEditor() {
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const zones = useStore((s) => s.zones);
  const updateZone = useStore((s) => s.updateZone);
  const removeZone = useStore((s) => s.removeZone);
  const selectZone = useStore((s) => s.selectZone);
  const phase = useStore((s) => s.phase);

  const zone = zones.find((z) => (z.id as string) === selectedZoneId);
  const isLocked = phase === 'running' || phase === 'paused';

  const handleUpdate = useCallback(
    (field: string, value: string | number) => {
      if (!selectedZoneId || isLocked || !zone) return;

      // When shape changes, reposition gates onto the new polygon boundary
      if (field === 'shape') {
        const hasGraph = !!useStore.getState().waypointGraph;
        if (value === 'custom') {
          const poly = getZonePolygon(zone as any);
          updateZone(selectedZoneId, { shape: 'custom', polygon: [...poly], gates: [] } as any);
          useStore.getState().setPolygonEditMode(true);
        } else if (hasGraph) {
          // Graph mode: 게이트 불필요, shape만 변경
          updateZone(selectedZoneId, { [field]: value, polygon: null, gates: [] } as any);
        } else {
          const b = zone.bounds;
          const gates = repositionGatesForShape(zone.gates as any[], b, value as string, (zone as any).lRatioX ?? 0.5, (zone as any).lRatioY ?? 0.5);
          updateZone(selectedZoneId, { [field]: value, polygon: null, gates } as any);
        }
      } else if (field === 'type') {
        updateZone(selectedZoneId, { type: value, color: ZONE_COLORS[value as string] ?? zone.color } as any);
      } else {
        updateZone(selectedZoneId, { [field]: value } as any);
      }
    },
    [selectedZoneId, updateZone, isLocked, zone],
  );

  const handleRecalcArea = useCallback(() => {
    if (!selectedZoneId || isLocked || !zone) return;
    // Area = width * height in pixels, converted to m² using floor scale
    const scale = 0.025; // default px → m
    const areaM2 = Math.round(zone.bounds.w * zone.bounds.h * scale * scale * 100) / 100;
    updateZone(selectedZoneId, { area: areaM2 } as any);
  }, [selectedZoneId, isLocked, zone, updateZone]);

  const polygonEditMode = useStore((s) => s.polygonEditMode);
  const isPolygonEditing = zone?.shape === 'custom' && polygonEditMode;

  const handleCompletePolygon = useCallback(() => {
    if (!selectedZoneId || !zone || !zone.polygon || zone.polygon.length < 3) return;
    // 폴리곤 확정 — 게이트 생성 없음 (동선은 Node/Edge로 관리)
    useStore.getState().setPolygonEditMode(false);
  }, [selectedZoneId, zone]);

  const handleDelete = useCallback(() => {
    if (!selectedZoneId || isLocked) return;
    removeZone(selectedZoneId);
    selectZone(null);
  }, [selectedZoneId, removeZone, selectZone, isLocked]);

  if (!zone) return null;

  return (
    <div className="bento-box p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: zone.color }} />
          <h2 className="text-xs font-semibold">Edit Zone</h2>
        </div>
        {!isLocked && (
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-[var(--status-danger)]/20 text-muted-foreground hover:text-[var(--status-danger)]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <Field label="Name" value={zone.name} onChange={(v) => handleUpdate('name', v)} disabled={isLocked} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Capacity" value={String(zone.capacity)} type="number" onChange={(v) => handleUpdate('capacity', parseInt(v) || 0)} disabled={isLocked} />
          <div>
            <Field label="Area (m²)" value={String(zone.area)} type="number" onChange={(v) => handleUpdate('area', parseFloat(v) || 0)} disabled={isLocked} />
            {!isLocked && <button onClick={handleRecalcArea} className="text-[8px] text-primary mt-0.5 hover:underline">Auto-calc</button>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Type</label>
            <select value={zone.type} onChange={(e) => handleUpdate('type', e.target.value)} disabled={isLocked}
              className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50">
              <option value="entrance">Entrance</option>
              <option value="exhibition">Exhibition</option>
              <option value="rest">Rest</option>
              <option value="stage">Stage</option>
              <option value="exit">Exit</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Flow</label>
            <select value={zone.flowType} onChange={(e) => handleUpdate('flowType', e.target.value)} disabled={isLocked}
              className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50">
              <option value="free">Free</option>
              <option value="guided">Guided</option>
              <option value="one_way">One-Way</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Shape</label>
          <select value={zone.shape} onChange={(e) => handleUpdate('shape', e.target.value)} disabled={isLocked}
            className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50">
            <option value="rect">Rectangle</option>
            <option value="circle">Circle</option>
            <option value="l_top_left">L (Top-Left)</option>
            <option value="l_top_right">L (Top-Right)</option>
            <option value="l_bottom_left">L (Bottom-Left)</option>
            <option value="l_bottom_right">L (Bottom-Right)</option>
            <option value="o_ring">O-Ring</option>
            <option value="custom">Polygon (Custom)</option>
          </select>
          {isPolygonEditing && (
            <button
              onClick={handleCompletePolygon}
              className="w-full mt-1.5 px-3 py-1.5 text-[10px] font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              ✓ 형태 완료
            </button>
          )}
          {zone.shape === 'custom' && !polygonEditMode && (
            <button
              onClick={() => useStore.getState().setPolygonEditMode(true)}
              disabled={isLocked}
              className="w-full mt-1.5 px-3 py-1.5 text-[10px] font-medium rounded-lg bg-secondary hover:bg-accent text-foreground transition-colors disabled:opacity-40"
            >
              Edit Shape
            </button>
          )}
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Attractiveness</label>
          <input type="range" min="0" max="1" step="0.05" value={zone.attractiveness}
            onChange={(e) => handleUpdate('attractiveness', parseFloat(e.target.value))} disabled={isLocked}
            className="w-full mt-0.5" />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Low</span>
            <span className="font-data">{zone.attractiveness.toFixed(2)}</span>
            <span>High</span>
          </div>
        </div>
        {/* Gateway Mode Toggle */}
        {zone.type === 'gateway' && (
          <div className="pt-2 border-t border-border">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-1">Gateway Direction</span>
            <div className="flex gap-1">
              {(['spawn', 'both', 'exit'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => {
                    if (!selectedZoneId || isLocked) return;
                    updateZone(selectedZoneId, { gatewayMode: mode } as any);
                  }}
                  disabled={isLocked}
                  className={`flex-1 px-1.5 py-1 text-[8px] rounded border ${
                    (zone.gatewayMode ?? 'both') === mode
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary border-border hover:bg-muted'
                  } disabled:opacity-50`}
                >
                  {mode === 'spawn' ? '↓ Spawn' : mode === 'exit' ? '↑ Exit' : '↕ Both'}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Gates */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Gates ({zone.gates.length})</span>
            {!isLocked && (
              <button
                onClick={() => {
                  if (!selectedZoneId) return;
                  const newGate = {
                    id: `g_new_${Date.now()}`,
                    zoneId: zone.id,
                    floorId: zone.gates[0]?.floorId ?? 'floor_1f',
                    type: 'bidirectional',
                    position: { x: zone.bounds.x + zone.bounds.w / 2, y: zone.bounds.y + zone.bounds.h },
                    width: 40,
                    connectedGateId: null,
                    targetFloorId: null,
                    targetGateId: null,
                  };
                  updateZone(selectedZoneId, { gates: [...zone.gates, newGate] } as any);
                }}
                className="text-[8px] text-primary hover:underline"
              >
                + Add
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {zone.gates.map((gate: any, i: number) => (
              <div key={gate.id} className="flex items-center gap-1.5 text-[9px]">
                <div className={`w-2 h-2 rounded-sm ${
                  gate.type === 'entrance' ? 'bg-[var(--status-success)]' :
                  gate.type === 'exit' ? 'bg-[var(--status-danger)]' :
                  gate.type === 'portal' ? 'bg-purple-400' :
                  'bg-primary'
                }`} />
                <select
                  value={gate.type}
                  onChange={(e) => {
                    if (!selectedZoneId || isLocked) return;
                    const updated = zone.gates.map((g: any, j: number) =>
                      j === i ? { ...g, type: e.target.value } : g
                    );
                    updateZone(selectedZoneId, { gates: updated } as any);
                  }}
                  disabled={isLocked}
                  className="flex-1 px-1 py-0.5 text-[8px] font-data rounded bg-secondary border border-border disabled:opacity-50"
                >
                  <option value="entrance">Entrance</option>
                  <option value="exit">Exit</option>
                  <option value="bidirectional">Bidirectional</option>
                  <option value="portal">Portal</option>
                </select>
                <span className="text-[7px] font-data text-muted-foreground">
                  {Math.round((gate.position as any).x)},{Math.round((gate.position as any).y)}
                </span>
                {!isLocked && zone.gates.length > 1 && (
                  <button
                    onClick={() => {
                      if (!selectedZoneId) return;
                      updateZone(selectedZoneId, { gates: zone.gates.filter((_: any, j: number) => j !== i) } as any);
                    }}
                    className="text-[8px] text-muted-foreground hover:text-[var(--status-danger)]"
                  >×</button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground font-data">
          {zone.bounds.w}×{zone.bounds.h}px · {zone.shape} · {zone.mediaIds.length} media
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', disabled }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50" />
    </div>
  );
}
