/**
 * RegionTask — Build > 공간 task 의 좌측(260px) 패널.
 *
 * 좌·우 대칭 IA (2026-04-28 v3, RegionPanelRight 와 짝):
 *   좌(좁음): 안내 + "+ 공간 추가" + (multiFloor) "자동 정렬"  ← 이 파일
 *   우(넓음): 리전 리스트 + 활성 리전 인스펙터 + 도면 에디터  ← RegionPanelRight
 *
 * 다른 task 의 BuildTools 자리에 해당 — 가벼운 트리거만 둠.
 */

import { Plus, LayoutGrid } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';

export function RegionTask() {
  const t = useT();
  const floors = useStore((s) => s.floors);
  const addFloor = useStore((s) => s.addFloor);
  const relayoutFloors = useStore((s) => s.relayoutFloors);

  const multiFloor = floors.length > 1;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground/80 leading-relaxed px-1">
        {t('build.region.leftHint')}
      </p>
      <button
        type="button"
        onClick={addFloor}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-secondary hover:bg-accent transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        {t('build.region.addAction')}
      </button>
      {multiFloor && (
        <button
          type="button"
          onClick={relayoutFloors}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] rounded-xl bg-secondary/60 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <LayoutGrid className="w-3 h-3" />
          {t('build.region.arrangeAction')}
        </button>
      )}
    </div>
  );
}
