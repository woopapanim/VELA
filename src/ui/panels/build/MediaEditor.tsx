import { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/stores';
import { MEDIA_SCALE, MEDIA_SQMETER_PER_PERSON } from '@/domain';
import type { Vector2D } from '@/domain';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { useT } from '@/i18n';

const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
  analog: { label: 'Analog', color: '#a78bfa' },
  passive_media: { label: 'Passive', color: '#3b82f6' },
  active: { label: 'Active', color: '#f59e0b' },
  immersive: { label: 'Immersive', color: '#ec4899' },
};

export function MediaEditor() {
  const selectedMediaId = useStore((s) => s.selectedMediaId);
  const media = useStore((s) => s.media);
  const updateMedia = useStore((s) => s.updateMedia);
  const removeMedia = useStore((s) => s.removeMedia);
  const phase = useStore((s) => s.phase);
  const mediaPolygonEditMode = useStore((s) => s.mediaPolygonEditMode);
  const setMediaPolygonEditMode = useStore((s) => s.setMediaPolygonEditMode);
  const t = useT();

  const m = media.find((m) => (m.id as string) === selectedMediaId);
  const isLocked = phase === 'running' || phase === 'paused';

  const handleUpdate = useCallback(
    (field: string, value: any) => {
      if (!selectedMediaId || isLocked) return;
      updateMedia(selectedMediaId, { [field]: value } as any);
    },
    [selectedMediaId, updateMedia, isLocked],
  );

  if (!m) return null;

  const interactionType = (m as any).interactionType || 'passive';
  const autoCapacity = Math.max(1, Math.floor(
    (m.size.width * m.size.height) / MEDIA_SQMETER_PER_PERSON
  ));

  return (
    <div data-editor="media" className="bento-box p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          {(() => {
            const cat = (m as any).category;
            const badge = CATEGORY_BADGE[cat];
            return badge ? (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-medium text-white" style={{ backgroundColor: badge.color }}>
                {badge.label}
              </span>
            ) : (
              <div className={`w-2 h-2 rounded-sm ${interactionType === 'active' ? 'bg-amber-400' : 'bg-blue-400'}`} />
            );
          })()}
          Edit Media
        </h3>
        {!isLocked && (
          <button onClick={() => removeMedia(selectedMediaId!)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Name</label>
        <input
          value={(m as any).name || m.type.replace(/_/g, ' ')}
          onChange={(e) => handleUpdate('name', e.target.value)}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
        />
      </div>

      {/* Size (hidden for custom polygon — derived from vertices) */}
      {(m as any).shape !== 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Width (m)</label>
            <input type="number" step="0.5" min="0.5" max="20"
              value={m.size.width}
              onChange={(e) => handleUpdate('size', { ...m.size, width: parseFloat(e.target.value) || 1 })}
              disabled={isLocked}
              className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Height (m)</label>
            <input type="number" step="0.5" min="0.5" max="20"
              value={m.size.height}
              onChange={(e) => handleUpdate('size', { ...m.size, height: parseFloat(e.target.value) || 1 })}
              disabled={isLocked}
              className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
            />
          </div>
        </div>
      )}

      {/* Orientation */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Orientation</label>
            <InfoTooltip text={t('tooltip.media.orientation')} />
          </div>
          <span className="text-[9px] font-data">{m.orientation}°</span>
        </div>
        <input type="range" min="0" max="315" step="45"
          value={m.orientation}
          onChange={(e) => handleUpdate('orientation', parseInt(e.target.value))}
          disabled={isLocked}
          className="w-full h-1"
        />
      </div>

      {/* Shape */}
      <div>
        <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Shape</label>
        <select
          value={(m as any).shape || 'rect'}
          onChange={(e) => {
            const newShape = e.target.value;
            if (newShape === 'custom' && (m as any).shape !== 'custom') {
              // Convert rect/circle to polygon: generate 4 corners from current size
              const pw = m.size.width * MEDIA_SCALE;
              const ph = m.size.height * MEDIA_SCALE;
              const poly: Vector2D[] = [
                { x: -pw / 2, y: -ph / 2 },
                { x:  pw / 2, y: -ph / 2 },
                { x:  pw / 2, y:  ph / 2 },
                { x: -pw / 2, y:  ph / 2 },
              ];
              updateMedia(selectedMediaId!, { shape: 'custom', polygon: poly } as any);
              setMediaPolygonEditMode(true);
            } else if (newShape !== 'custom' && (m as any).shape === 'custom') {
              // Convert polygon back to rect/circle: derive size from polygon AABB
              const poly = m.polygon;
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
                updateMedia(selectedMediaId!, { shape: newShape, polygon: undefined, size: { width: w, height: h } } as any);
              } else {
                updateMedia(selectedMediaId!, { shape: newShape, polygon: undefined } as any);
              }
              setMediaPolygonEditMode(false);
            } else {
              handleUpdate('shape', newShape);
            }
          }}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
        >
          <option value="rect">Rectangle</option>
          <option value="circle">Circle</option>
          <option value="ellipse">Ellipse</option>
          <option value="custom">Polygon</option>
        </select>
      </div>

      {/* Polygon edit mode toggle */}
      {(m as any).shape === 'custom' && !isLocked && (
        <button
          onClick={() => setMediaPolygonEditMode(!mediaPolygonEditMode)}
          className={`w-full px-2 py-1 text-[10px] rounded-lg border transition-colors ${
            mediaPolygonEditMode
              ? 'bg-green-500/20 border-green-500/40 text-green-400'
              : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {mediaPolygonEditMode ? t('editor.shape.done') : t('editor.shape.edit')}
        </button>
      )}

      {/* Interaction Type */}
      <div>
        <div className="flex items-center gap-1">
          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Interaction</label>
          <InfoTooltip text={t('tooltip.media.interaction')} />
        </div>
        <select
          value={interactionType}
          onChange={(e) => handleUpdate('interactionType', e.target.value)}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
        >
          <option value="passive">Passive</option>
          <option value="active">Active</option>
          <option value="staged">Staged</option>
          <option value="analog">Analog</option>
        </select>
      </div>

      {/* Omnidirectional (analog only) */}
      {interactionType === 'analog' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Omnidirectional</label>
            <InfoTooltip text={t('tooltip.media.omnidirectional')} />
          </div>
          <button
            onClick={() => handleUpdate('omnidirectional', !(m as any).omnidirectional)}
            disabled={isLocked}
            className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${
              (m as any).omnidirectional ? 'bg-violet-500/20 text-violet-400' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {(m as any).omnidirectional ? '360°' : 'Front'}
          </button>
        </div>
      )}

      {/* Stage Interval (staged only) */}
      {interactionType === 'staged' && (
        <div>
          <div className="flex items-center gap-1">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Session Interval (s)</label>
            <InfoTooltip text={t('tooltip.media.stageInterval')} />
          </div>
          <input type="number" step="10" min="10"
            value={Math.round(((m as any).stageIntervalMs ?? 60000) / 1000)}
            onChange={(e) => handleUpdate('stageIntervalMs', (parseInt(e.target.value) || 60) * 1000)}
            disabled={isLocked}
            className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
          />
        </div>
      )}

      {/* Capacity (not for analog) */}
      {interactionType !== 'analog' && (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="flex items-center gap-1">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Capacity</label>
            <InfoTooltip text={t('tooltip.media.capacity')} />
          </div>
          <input type="number" min="1" max="200"
            value={m.capacity}
            onChange={(e) => handleUpdate('capacity', parseInt(e.target.value) || 1)}
            disabled={isLocked}
            className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Auto Cap</label>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] font-data text-muted-foreground">{autoCapacity}</span>
            {!isLocked && (
              <button onClick={() => handleUpdate('capacity', autoCapacity)}
                className="text-[8px] text-primary hover:underline">Apply</button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Engagement Time */}
      <div>
        <div className="flex items-center gap-1">
          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Engagement (s)</label>
          <InfoTooltip text={t('tooltip.media.engagement')} />
        </div>
        <input type="number" step="5" min="1"
          value={Math.round(m.avgEngagementTimeMs / 1000)}
          onChange={(e) => handleUpdate('avgEngagementTimeMs', (parseInt(e.target.value) || 10) * 1000)}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
        />
      </div>

      {/* View Distance (passive only) */}
      {interactionType === 'passive' && (
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">View Distance (m)</label>
            <InfoTooltip text={t('tooltip.media.viewDistance')} />
          </div>
          <span className="text-[9px] font-data">{((m as any).viewDistance ?? 2.0).toFixed(1)}m</span>
        </div>
        <input type="range" min="0.5" max="10" step="0.5"
          value={(m as any).viewDistance ?? 2.0}
          onChange={(e) => handleUpdate('viewDistance', parseFloat(e.target.value))}
          disabled={isLocked}
          className="w-full h-1"
        />
      </div>
      )}

      {/* Attractiveness */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Attractiveness</label>
            <InfoTooltip text={t('tooltip.media.attractiveness')} />
          </div>
          <span className="text-[9px] font-data">{m.attractiveness.toFixed(1)}</span>
        </div>
        <input type="range" min="0" max="1" step="0.1"
          value={m.attractiveness}
          onChange={(e) => handleUpdate('attractiveness', parseFloat(e.target.value))}
          disabled={isLocked}
          className="w-full h-1"
        />
      </div>

      {/* Queue Behavior (not for analog) */}
      {interactionType !== 'analog' && (
      <div>
        <div className="flex items-center gap-1">
          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Queue Behavior</label>
          <InfoTooltip text={t('tooltip.media.queueBehavior')} />
        </div>
        <select
          value={(m as any).queueBehavior || 'none'}
          onChange={(e) => handleUpdate('queueBehavior', e.target.value)}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
        >
          <option value="none">None</option>
          <option value="linear">Linear</option>
          <option value="area">Area</option>
        </select>
      </div>
      )}

      {/* Group Friendly */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Group Friendly</label>
          <InfoTooltip text={t('tooltip.media.groupFriendly')} />
        </div>
        <button
          onClick={() => handleUpdate('groupFriendly', !(m as any).groupFriendly)}
          disabled={isLocked}
          className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${
            (m as any).groupFriendly ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'
          }`}
        >
          {(m as any).groupFriendly ? 'Yes' : 'No'}
        </button>
      </div>
    </div>
  );
}
