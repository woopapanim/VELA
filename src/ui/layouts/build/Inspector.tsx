import { X } from 'lucide-react';
import { useStore } from '@/stores';
import { ZoneEditor } from '../../panels/build/ZoneEditor';
import { MediaEditor } from '../../panels/build/MediaEditor';
import { WaypointInspector } from '../../panels/build/WaypointInspector';

// 우측 슬라이드인 인스펙터. canvas 위에 absolute 로 떠 있고, 선택된 객체가
// 있을 때만 노출. 좌/우 column 영구 점유 X — 필요할 때만 등장.
// 닫기 버튼 = 모든 selection 해제.
export function Inspector() {
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const selectedMediaId = useStore((s) => s.selectedMediaId);
  const selectedWaypointId = useStore((s) => s.selectedWaypointId);

  const isOpen = !!selectedZoneId || !!selectedMediaId || !!selectedWaypointId;
  if (!isOpen) return null;

  const kind = selectedZoneId ? 'Zone' : selectedMediaId ? 'Exhibit' : 'Waypoint';

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
          title="Close"
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
