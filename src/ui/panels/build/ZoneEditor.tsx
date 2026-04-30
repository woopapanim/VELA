import { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/stores';
import { getZonePolygon } from '@/simulation/engine/transit';
import { ZONE_COLORS, INTERNATIONAL_DENSITY_STANDARD, MEDIA_SCALE } from '@/domain';
import { useT } from '@/i18n';
import { InfoTooltip } from '@/ui/components/InfoTooltip';

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
  const t = useT();

  const zone = zones.find((z) => (z.id as string) === selectedZoneId);
  const isLocked = phase === 'running' || phase === 'paused';
  const media = useStore((s) => s.media);

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
      } else if (field === 'area') {
        // Area changed → recalc capacity from new area minus media
        const newArea = typeof value === 'number' ? value : parseFloat(value as string) || 0;
        const zoneMedia = media.filter(m => (m.zoneId as string) === selectedZoneId);
        const mediaArea = zoneMedia.reduce((sum, m) => sum + m.size.width * m.size.height, 0);
        const effectiveArea = Math.max(1, newArea - mediaArea);
        const capacity = Math.max(1, Math.floor(effectiveArea / INTERNATIONAL_DENSITY_STANDARD));
        updateZone(selectedZoneId, { area: newArea, capacity } as any);
      } else {
        updateZone(selectedZoneId, { [field]: value } as any);
      }
    },
    [selectedZoneId, updateZone, isLocked, zone, media],
  );

  const handleRecalcArea = useCallback(() => {
    if (!selectedZoneId || isLocked || !zone) return;
    // Zone gross area (px → m²)
    const pxToM = 1 / MEDIA_SCALE; // 1px = 0.05m
    const grossArea = zone.bounds.w * pxToM * zone.bounds.h * pxToM;
    // Subtract media hitbox areas in this zone
    const zoneMedia = media.filter(m => (m.zoneId as string) === selectedZoneId);
    const mediaArea = zoneMedia.reduce((sum, m) => sum + m.size.width * m.size.height, 0);
    const effectiveArea = Math.max(1, Math.round((grossArea - mediaArea) * 100) / 100);
    // Capacity = effective area ÷ international density standard (2.5 m²/person)
    const capacity = Math.max(1, Math.floor(effectiveArea / INTERNATIONAL_DENSITY_STANDARD));
    updateZone(selectedZoneId, { area: effectiveArea, capacity } as any);
  }, [selectedZoneId, isLocked, zone, media, updateZone]);

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
    <div data-editor="zone" className="bento-box p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: zone.color }} />
          <h2 className="panel-title">{t('zoneEditor.title')}</h2>
        </div>
        {!isLocked && (
          <button
            onClick={handleDelete}
            title={t('zoneEditor.delete.title')}
            className="p-1 rounded hover:bg-[var(--status-danger)]/20 text-muted-foreground hover:text-[var(--status-danger)]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        <Field label={t('zoneEditor.field.name')} value={zone.name} onChange={(v) => handleUpdate('name', v)} disabled={isLocked} />
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('zoneEditor.field.capacity')} value={String(zone.capacity)} type="number" onChange={(v) => handleUpdate('capacity', parseInt(v) || 0)} disabled={isLocked} tooltip={t('tooltip.zone.capacity')} />
          <div>
            <Field label={t('zoneEditor.field.area')} value={String(zone.area)} type="number" onChange={(v) => handleUpdate('area', parseFloat(v) || 0)} disabled={isLocked} />
            {!isLocked && <button onClick={handleRecalcArea} className="text-[8px] text-primary mt-0.5 hover:underline">{t('zoneEditor.field.autoCalc')}</button>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="panel-label">{t('zoneEditor.field.type')}</label>
            <select value={zone.type} onChange={(e) => handleUpdate('type', e.target.value)} disabled={isLocked}
              className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50">
              <option value="entrance">{t('zoneEditor.type.entrance')}</option>
              <option value="exhibition">{t('zoneEditor.type.exhibition')}</option>
              <option value="rest">{t('zoneEditor.type.rest')}</option>
              <option value="stage">{t('zoneEditor.type.stage')}</option>
              <option value="exit">{t('zoneEditor.type.exit')}</option>
            </select>
          </div>
          <div>
            <label className="panel-label">{t('zoneEditor.field.flow')}</label>
            <select value={zone.flowType} onChange={(e) => handleUpdate('flowType', e.target.value)} disabled={isLocked}
              className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50">
              <option value="free">{t('zoneEditor.flow.free')}</option>
              <option value="guided">{t('zoneEditor.flow.guided')}</option>
              <option value="one_way">{t('zoneEditor.flow.oneWay')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="panel-label">{t('zoneEditor.field.shape')}</label>
          <select value={zone.shape} onChange={(e) => handleUpdate('shape', e.target.value)} disabled={isLocked}
            className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50">
            <option value="rect">{t('zoneEditor.shape.rect')}</option>
            <option value="circle">{t('zoneEditor.shape.circle')}</option>
            <option value="l_top_left">{t('zoneEditor.shape.lTopLeft')}</option>
            <option value="l_top_right">{t('zoneEditor.shape.lTopRight')}</option>
            <option value="l_bottom_left">{t('zoneEditor.shape.lBottomLeft')}</option>
            <option value="l_bottom_right">{t('zoneEditor.shape.lBottomRight')}</option>
            <option value="o_ring">{t('zoneEditor.shape.oRing')}</option>
            <option value="custom">{t('zoneEditor.shape.custom')}</option>
          </select>
          {isPolygonEditing && (
            <button
              onClick={handleCompletePolygon}
              className="w-full mt-1.5 px-3 py-1.5 text-[10px] font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              {t('editor.shape.done')}
            </button>
          )}
          {zone.shape === 'custom' && !polygonEditMode && (
            <button
              onClick={() => useStore.getState().setPolygonEditMode(true)}
              disabled={isLocked}
              className="w-full mt-1.5 px-3 py-1.5 text-[10px] font-medium rounded-lg bg-secondary hover:bg-accent text-foreground transition-colors disabled:opacity-40"
            >
              {t('editor.shape.edit')}
            </button>
          )}
        </div>
        <div>
          <label className="panel-label">{t('zoneEditor.field.attractiveness')}</label>
          <input type="range" min="0" max="1" step="0.05" value={zone.attractiveness}
            onChange={(e) => handleUpdate('attractiveness', parseFloat(e.target.value))} disabled={isLocked}
            className="w-full mt-0.5" />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>{t('zoneEditor.field.attractiveness.low')}</span>
            <span className="font-data">{zone.attractiveness.toFixed(2)}</span>
            <span>{t('zoneEditor.field.attractiveness.high')}</span>
          </div>
        </div>
        {/* Must-visit (hero zone) — forces visit regardless of fatigue */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <label className="panel-label">{t('zoneEditor.field.mustVisit')}</label>
            <InfoTooltip text={t('zoneEditor.mustVisit.tooltip')} />
          </div>
          <button
            onClick={() => {
              if (!selectedZoneId || isLocked) return;
              updateZone(selectedZoneId, { mustVisit: !(zone as any).mustVisit } as any);
            }}
            disabled={isLocked}
            className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${
              (zone as any).mustVisit
                ? 'bg-amber-500/20 text-amber-400 font-semibold'
                : 'bg-secondary text-muted-foreground'
            } disabled:opacity-50`}
          >
            {(zone as any).mustVisit ? t('zoneEditor.mustVisit.on') : t('zoneEditor.mustVisit.off')}
          </button>
        </div>
        {/* Gateway Mode Toggle */}
        {zone.type === 'gateway' && (
          <div className="pt-2 border-t border-border">
            <span className="panel-label block mb-1">{t('zoneEditor.gateway.label')}</span>
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
                  {mode === 'spawn' ? t('zoneEditor.gateway.spawn') : mode === 'exit' ? t('zoneEditor.gateway.exit') : t('zoneEditor.gateway.both')}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="text-[10px] text-muted-foreground font-data">
          {t('zoneEditor.summary', {
            w: (zone.bounds.w / MEDIA_SCALE).toFixed(1),
            h: (zone.bounds.h / MEDIA_SCALE).toFixed(1),
            shape: zone.shape,
            count: media.filter(m => (m.zoneId as string) === (zone.id as string)).length,
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', disabled, tooltip }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean; tooltip?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <label className="panel-label">{label}</label>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50" />
    </div>
  );
}
