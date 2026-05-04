import { useStore } from '@/stores';
import { RunConfigPanel } from '@/ui/panels/simulate/RunConfigPanel';
import { RunSummary } from './RunSummary';
import { ReplayScrubber } from '@/ui/panels/canvas/ReplayScrubber';

// Simulate 좌측 column. idle: 편집 가능 (RunConfigPanel). 그 외: readonly summary.
// 완료/일시정지 + replay frames 보유 시 ReplayScrubber 가 상단에 등장
// (이전엔 하단 ControlBar 의 timeline 자리를 차지했으나, 좌측으로 이동해
//  진행률 progress bar 는 항상 노출되도록 분리).
export function RunConfigColumn() {
  const phase = useStore((s) => s.phase);
  const replayCount = useStore((s) => s.replayFrames.length);
  const isIdle = phase === 'idle';
  const isReplayable = (phase === 'completed' || phase === 'paused') && replayCount > 0;

  return (
    <aside className="w-60 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex-shrink-0">
        <h2 className="text-xs font-semibold tracking-tight">
          {isIdle ? 'Run config' : 'Current settings'}
        </h2>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
          {isIdle
            ? 'Spawn · Duration · Seed · Skip — how to run'
            : 'Running — Stop to change settings'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isReplayable && <ReplayScrubber />}
        {isIdle ? <RunConfigPanel /> : <RunSummary />}
      </div>
    </aside>
  );
}
