import { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/stores';
import { MEDIA_SCALE, MEDIA_SQMETER_PER_PERSON } from '@/domain';

export function MediaEditor() {
  const selectedMediaId = useStore((s) => s.selectedMediaId);
  const media = useStore((s) => s.media);
  const updateMedia = useStore((s) => s.updateMedia);
  const removeMedia = useStore((s) => s.removeMedia);
  const phase = useStore((s) => s.phase);

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

  const isActive = (m as any).interactionType === 'active';
  const autoCapacity = Math.max(1, Math.floor(
    (m.size.width * m.size.height) / MEDIA_SQMETER_PER_PERSON
  ));

  return (
    <div className="bento-box p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-sm ${isActive ? 'bg-amber-400' : 'bg-blue-400'}`} />
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

      {/* Size */}
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

      {/* Orientation */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Orientation</label>
          <span className="text-[9px] font-data">{m.orientation}°</span>
        </div>
        <input type="range" min="0" max="315" step="45"
          value={m.orientation}
          onChange={(e) => handleUpdate('orientation', parseInt(e.target.value))}
          disabled={isLocked}
          className="w-full h-1"
        />
      </div>

      {/* Interaction Type */}
      <div>
        <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Interaction</label>
        <select
          value={(m as any).interactionType || 'passive'}
          onChange={(e) => handleUpdate('interactionType', e.target.value)}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
        >
          <option value="passive">Passive (관람형)</option>
          <option value="active">Active (체험형)</option>
        </select>
      </div>

      {/* Capacity */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Capacity</label>
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

      {/* Engagement Time */}
      <div>
        <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Engagement (s)</label>
        <input type="number" step="5" min="1"
          value={Math.round(m.avgEngagementTimeMs / 1000)}
          onChange={(e) => handleUpdate('avgEngagementTimeMs', (parseInt(e.target.value) || 10) * 1000)}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[10px] font-data rounded-lg bg-secondary border border-border disabled:opacity-50"
        />
      </div>

      {/* Attractiveness */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Attractiveness</label>
          <span className="text-[9px] font-data">{m.attractiveness.toFixed(1)}</span>
        </div>
        <input type="range" min="0" max="1" step="0.1"
          value={m.attractiveness}
          onChange={(e) => handleUpdate('attractiveness', parseFloat(e.target.value))}
          disabled={isLocked}
          className="w-full h-1"
        />
      </div>
    </div>
  );
}
