import { useState } from 'react';
import { Pin, Trash2, Pencil, Check, X } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import type { PinId, PinnedTimePoint } from '@/domain';

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export function PinTimeline() {
  const t = useT();
  const pins = useStore((s) => s.pins);
  const selectedPinId = useStore((s) => s.selectedPinId);
  const comparePinIds = useStore((s) => s.comparePinIds);
  const selectPin = useStore((s) => s.selectPin);
  const removePin = useStore((s) => s.removePin);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const updatePinLabel = useStore((s) => s.updatePinLabel);
  const clearPins = useStore((s) => s.clearPins);

  const duration = useStore((s) => s.timeState.elapsed);
  const simConfigDuration = useStore((s) => s.scenario?.simulationConfig.duration ?? 0);

  const axisMax = Math.max(duration, simConfigDuration, 60_000, ...pins.map((p) => p.simulationTimeMs));

  if (pins.length === 0) {
    return (
      <div className="bento-box p-4">
        <h2 className="panel-section mb-2 flex items-center gap-1.5">
          <Pin className="w-3 h-3" />
          {t('pinpoint.timeline.title')}
        </h2>
        <div className="text-center py-4">
          <p className="text-[11px] font-medium">{t('pinpoint.empty.title')}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{t('pinpoint.empty.hint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-box p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="panel-section flex items-center gap-1.5">
          <Pin className="w-3 h-3" />
          {t('pinpoint.timeline.title')} ({pins.length})
        </h2>
        <button
          onClick={clearPins}
          className="text-[9px] text-muted-foreground hover:text-[var(--status-danger)] uppercase"
        >
          {t('pinpoint.action.clear')}
        </button>
      </div>

      {/* Timeline axis */}
      <div className="relative h-6 mb-3 bg-secondary/40 rounded-md">
        {pins.map((p) => {
          const pct = axisMax > 0 ? Math.min(100, (p.simulationTimeMs / axisMax) * 100) : 0;
          const isSelected = p.id === selectedPinId;
          const isCompare = comparePinIds.includes(p.id as PinId);
          return (
            <button
              key={p.id as string}
              onClick={(e) => {
                if (e.shiftKey) {
                  const ok = toggleCompare(p.id as PinId);
                  if (!ok) {
                    // toast: handled by caller usually — silent no-op here
                  }
                } else {
                  selectPin(p.id as PinId);
                }
              }}
              title={`${p.label} · ${fmtClock(p.simulationTimeMs)}`}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all ${
                isSelected
                  ? 'w-4 h-4 bg-primary ring-2 ring-primary/30'
                  : isCompare
                  ? 'w-3 h-3 bg-[var(--status-warning)]'
                  : 'w-2.5 h-2.5 bg-muted-foreground hover:bg-primary/70'
              }`}
              style={{ left: `${pct}%` }}
            />
          );
        })}
      </div>

      {/* Pin list */}
      <div className="space-y-1">
        {pins.map((p) => (
          <PinRow
            key={p.id as string}
            pin={p}
            selected={p.id === selectedPinId}
            compareActive={comparePinIds.includes(p.id as PinId)}
            onSelect={() => selectPin(p.id as PinId)}
            onToggleCompare={() => toggleCompare(p.id as PinId)}
            onRemove={() => removePin(p.id as PinId)}
            onRename={(label) => updatePinLabel(p.id as PinId, label)}
          />
        ))}
      </div>
    </div>
  );
}

function PinRow({
  pin, selected, compareActive, onSelect, onToggleCompare, onRemove, onRename,
}: {
  pin: PinnedTimePoint;
  selected: boolean;
  compareActive: boolean;
  onSelect: () => void;
  onToggleCompare: () => void;
  onRemove: () => void;
  onRename: (label: string) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pin.label);

  const commit = () => {
    const v = draft.trim();
    if (v) onRename(v);
    setEditing(false);
  };

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors ${
        selected ? 'bg-primary/10 border border-primary/30' : 'bg-secondary/30 hover:bg-secondary/60 border border-transparent'
      }`}
      onClick={onSelect}
    >
      <span className="font-data text-[10px] text-muted-foreground w-10 shrink-0">{fmtClock(pin.simulationTimeMs)}</span>
      {editing ? (
        <>
          <input
            className="flex-1 px-1 py-0.5 text-[10px] bg-background border border-border rounded"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setDraft(pin.label); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
          <button onClick={(e) => { e.stopPropagation(); commit(); }} className="p-0.5 text-[var(--status-success)]">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDraft(pin.label); setEditing(false); }} className="p-0.5 text-muted-foreground">
            <X className="w-3 h-3" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-[11px] truncate">{pin.label}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setDraft(pin.label); setEditing(true); }}
            title={t('pinpoint.list.editLabel')}
            className="p-0.5 text-muted-foreground hover:text-primary"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
            title={t('pinpoint.action.compare')}
            className={`px-1 py-0.5 text-[9px] font-data uppercase rounded ${
              compareActive ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]' : 'text-muted-foreground hover:text-primary'
            }`}
          >
            {t('pinpoint.action.compare')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-0.5 text-muted-foreground hover:text-[var(--status-danger)]"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  );
}
