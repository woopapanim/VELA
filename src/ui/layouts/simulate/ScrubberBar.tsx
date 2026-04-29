import { useStore } from '@/stores';
import { ReplayScrubber } from '../../panels/canvas/ReplayScrubber';

// Replay scrubber — 시뮬 끝난 뒤 (replayFrames > 0) 만 노출. 하단 floating.
export function ScrubberBar() {
  const frameCount = useStore((s) => s.replayFrames.length);
  if (frameCount === 0) return null;
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[480px] max-w-[90vw]">
      <div className="rounded-2xl bg-[var(--surface)]/90 backdrop-blur-md border border-border shadow-xl p-2">
        <ReplayScrubber />
      </div>
    </div>
  );
}
