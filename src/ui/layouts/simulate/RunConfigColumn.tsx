import { useStore } from '@/stores';
import { RunConfigPanel } from '@/ui/panels/simulate/RunConfigPanel';
import { RunSummary } from './RunSummary';

// Simulate 좌측 column. idle: 편집 가능 (RunConfigPanel). 그 외: readonly summary.
// 의도(profile/category mix) 는 Build / Visitors 에서. 여기는 "어떻게 돌릴까"만.
export function RunConfigColumn() {
  const phase = useStore((s) => s.phase);
  const isIdle = phase === 'idle';

  return (
    <aside className="w-64 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex-shrink-0">
        <h2 className="text-xs font-semibold tracking-tight">
          {isIdle ? 'Run config' : '현재 설정'}
        </h2>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
          {isIdle
            ? 'Spawn · Duration · Seed · Skip — 어떻게 돌릴까'
            : '실행 중 — 변경하려면 Stop 후 다시 설정'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {isIdle ? <RunConfigPanel /> : <RunSummary />}
      </div>
    </aside>
  );
}
