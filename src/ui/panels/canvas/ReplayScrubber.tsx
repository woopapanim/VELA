import { useCallback, useRef, useEffect } from 'react';
import { Rewind, FastForward, SkipBack, Play, Pause } from 'lucide-react';
import { useStore } from '@/stores';

export function ReplayScrubber() {
  const replayFrames = useStore((s) => s.replayFrames);
  const replayIndex = useStore((s) => s.replayIndex);
  const isReplaying = useStore((s) => s.isReplaying);
  const setReplayIndex = useStore((s) => s.setReplayIndex);
  const setIsReplaying = useStore((s) => s.setIsReplaying);
  const updateSimState = useStore((s) => s.updateSimState);
  const phase = useStore((s) => s.phase);

  const frameCount = replayFrames.length;
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayingRef = useRef(false);

  const applyFrame = useCallback((index: number) => {
    if (index < 0 || index >= frameCount) return;
    const frame = replayFrames[index];
    setReplayIndex(index);
    updateSimState(frame.visitors, frame.groups, frame.timeState, 'paused');
  }, [replayFrames, frameCount, setReplayIndex, updateSimState]);

  const startAutoPlay = useCallback(() => {
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    isPlayingRef.current = true;
    playTimerRef.current = setInterval(() => {
      const store = useStore.getState();
      const next = store.replayIndex + 1;
      if (next >= store.replayFrames.length) {
        if (playTimerRef.current) clearInterval(playTimerRef.current);
        isPlayingRef.current = false;
        return;
      }
      const frame = store.replayFrames[next];
      store.setReplayIndex(next);
      store.updateSimState(frame.visitors, frame.groups, frame.timeState, 'paused');
    }, 200); // 5 fps playback
  }, []);

  const stopAutoPlay = useCallback(() => {
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    playTimerRef.current = null;
    isPlayingRef.current = false;
  }, []);

  useEffect(() => {
    return () => { if (playTimerRef.current) clearInterval(playTimerRef.current); };
  }, []);

  const handleToggleReplay = useCallback(() => {
    if (isReplaying) {
      stopAutoPlay();
      setIsReplaying(false);
    } else {
      setIsReplaying(true);
      applyFrame(replayIndex >= 0 ? replayIndex : 0);
    }
  }, [isReplaying, setIsReplaying, applyFrame, replayIndex, stopAutoPlay]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    stopAutoPlay();
    applyFrame(parseInt(e.target.value));
  }, [applyFrame, stopAutoPlay]);

  if (frameCount < 3 || phase === 'idle') return null;

  const currentFrame = replayIndex >= 0 && replayIndex < frameCount ? replayFrames[replayIndex] : null;
  const currentMin = currentFrame ? Math.floor(currentFrame.timestamp / 60000) : 0;
  const currentSec = currentFrame ? Math.floor((currentFrame.timestamp % 60000) / 1000) : 0;

  return (
    <div className="bento-box p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Replay ({frameCount} frames)
        </h2>
        <button
          onClick={handleToggleReplay}
          className={`px-2 py-0.5 text-[9px] font-data rounded-lg transition-all ${
            isReplaying
              ? 'bg-[var(--status-warning)] text-white'
              : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
        >
          {isReplaying ? 'Exit Replay' : 'Enter Replay'}
        </button>
      </div>

      {isReplaying && (
        <div className="space-y-2">
          <input
            type="range" min="0" max={frameCount - 1}
            value={replayIndex >= 0 ? replayIndex : 0}
            onChange={handleScrub}
            className="w-full h-1.5"
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button onClick={() => { stopAutoPlay(); applyFrame(0); }} className="p-1 rounded hover:bg-secondary">
                <SkipBack className="w-3 h-3 text-muted-foreground" />
              </button>
              <button onClick={() => { stopAutoPlay(); applyFrame(Math.max(0, replayIndex - 1)); }} className="p-1 rounded hover:bg-secondary">
                <Rewind className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                onClick={() => isPlayingRef.current ? stopAutoPlay() : startAutoPlay()}
                className="p-1 rounded hover:bg-secondary"
              >
                {isPlayingRef.current
                  ? <Pause className="w-3 h-3 text-[var(--status-warning)]" />
                  : <Play className="w-3 h-3 text-[var(--status-success)]" />
                }
              </button>
              <button onClick={() => { stopAutoPlay(); applyFrame(Math.min(frameCount - 1, replayIndex + 1)); }} className="p-1 rounded hover:bg-secondary">
                <FastForward className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
            <span className="text-[9px] font-data text-muted-foreground">
              {replayIndex + 1}/{frameCount}
              {currentFrame && ` · ${String(currentMin).padStart(2, '0')}:${String(currentSec).padStart(2, '0')}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
