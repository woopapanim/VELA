import { useEffect } from 'react';
import {
  DrilldownPanel,
  MediaDrilldownPanel,
  TimeDrilldownPanel,
  PersonaDrilldownPanel,
} from '@/ui/panels/analytics/v2';
import type { computeZoneBreakdown } from '@/analytics/breakdown/zoneBreakdown';
import type { computeMediaBreakdown } from '@/analytics/breakdown/mediaBreakdown';
import type { computeTimeBreakdown } from '@/analytics/breakdown/timeBreakdown';
import type { computePersonaBreakdown } from '@/analytics/breakdown/personaBreakdown';

export type DrilldownKind = 'zone' | 'media' | 'time' | 'persona';

interface Props {
  kind: DrilldownKind;
  zoneBreakdown: ReturnType<typeof computeZoneBreakdown> | null;
  mediaBreakdown: ReturnType<typeof computeMediaBreakdown> | null;
  timeBreakdown: ReturnType<typeof computeTimeBreakdown> | null;
  personaBreakdown: ReturnType<typeof computePersonaBreakdown> | null;
  onClose: () => void;
  onForkZone: () => void;
  onForkMedia: () => void;
}

// 우측 rail 영역을 차지하는 sheet. main 흐름 끊지 않고 깊이 있는 분석 패널 노출 (2026-04-30).
// rail 보다 살짝 넓혀 (w-96) 차트/테이블 가독성 확보.
// Esc 키로 닫기 — sheet 가 열려있을 때만 listener 활성.
export function DrilldownSheet({
  kind,
  zoneBreakdown,
  mediaBreakdown,
  timeBreakdown,
  personaBreakdown,
  onClose,
  onForkZone,
  onForkMedia,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside
      className="w-96 border-l border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-hidden"
      aria-label="Drilldown sheet"
    >
      <div className="flex-1 overflow-y-auto p-3">
        {kind === 'zone' && zoneBreakdown && (
          <DrilldownPanel
            breakdown={zoneBreakdown}
            onClose={onClose}
            onForkToBuild={onForkZone}
          />
        )}
        {kind === 'media' && mediaBreakdown && (
          <MediaDrilldownPanel
            breakdown={mediaBreakdown}
            onClose={onClose}
            onForkToBuild={onForkMedia}
          />
        )}
        {kind === 'time' && timeBreakdown && (
          <TimeDrilldownPanel breakdown={timeBreakdown} onClose={onClose} />
        )}
        {kind === 'persona' && personaBreakdown && (
          <PersonaDrilldownPanel breakdown={personaBreakdown} onClose={onClose} />
        )}
      </div>
    </aside>
  );
}
