import { X } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { ZoneEditor } from '../../panels/build/ZoneEditor';
import { MediaEditor } from '../../panels/build/MediaEditor';
import { WaypointInspector } from '../../panels/build/WaypointInspector';

export function Inspector() {
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const selectedMediaId = useStore((s) => s.selectedMediaId);
  const selectedWaypointId = useStore((s) => s.selectedWaypointId);
  const t = useT();

  const isOpen = !!selectedZoneId || !!selectedMediaId || !!selectedWaypointId;
  if (!isOpen) return null;

  const kind = selectedZoneId
    ? t('build.inspector.kind.zone')
    : selectedMediaId
    ? t('build.inspector.kind.exhibit')
    : t('build.inspector.kind.waypoint');

  const handleClose = () => {
    const s = useStore.getState();
    s.selectZone(null);
    s.selectMedia(null);
    s.selectWaypoint(null);
  };

  return (
    <aside className="absolute top-0 right-0 bottom-0 w-80 bg-[var(--surface)]/95 backdrop-blur-sm border-l border-border shadow-2xl flex flex-col z-20 animate-in slide-in-from-right-4 duration-150">
      <div className="flex items-center justify-between px-3 h-9 border-b border-border flex-shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium">
          {kind}
        </span>
        <button
          type="button"
          onClick={handleClose}
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title={t('build.inspector.close')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {selectedZoneId && <ZoneEditor />}
        {selectedMediaId && <MediaEditor />}
        {selectedWaypointId && <WaypointInspector />}
      </div>
    </aside>
  );
}
