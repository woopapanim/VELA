import { useCallback, useRef, useEffect } from 'react';
import { Rewind, FastForward, SkipBack, Play, Pause } from 'lucide-react';
import { useStore } from '@/stores';
import type { Visitor, VisitorGroup, SimulationPhase, TimeState } from '@/domain';

interface PreReplaySnapshot {
  visitors: Visitor[];
  groups: VisitorGroup[];
  timeState: TimeState;
  phase: SimulationPhase;
  totalSpawned: number;
  totalExited: number;
  mediaStats: Map<string, any>;
  spawnByNode: ReadonlyMap<string, number>;
  exitByNode: ReadonlyMap<string, number>;
  // Replay 중엔 누적 heatmap 이 의미 없음 — 진입 시 'none' 으로 전환, Exit 시 복원
  // (2026-04-28 사용자 결정: option a).
  overlayMode: ReturnType<typeof useStore.getState>['overlayMode'];
}

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
  // Enter Replay 직전 store 스냅샷. Exit 시 이 상태로 복원해야 사용자가 "탐색하던 자리에 멈춘"
  // 어색한 상태에 갇히지 않음 (2026-04-28 사용자 피드백).
  const preReplaySnapshotRef = useRef<PreReplaySnapshot | null>(null);

  const applyFrame = useCallback((index: number) => {
    if (index < 0 || index >= frameCount) return;
    const frame = replayFrames[index];
    setReplayIndex(index);
    const s = useStore.getState();
    updateSimState(frame.visitors, frame.groups, frame.timeState, 'paused', s.totalSpawned, s.totalExited, s.mediaStats, s.spawnByNode, s.exitByNode);
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
      store.updateSimState(frame.visitors, frame.groups, frame.timeState, 'paused', store.totalSpawned, store.totalExited, store.mediaStats, store.spawnByNode, store.exitByNode);
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
    const store = useStore.getState();
    if (isReplaying) {
      stopAutoPlay();
      // Exit Replay → 진입 직전 상태로 복원. 스냅샷 없으면 마지막 frame 으로 fallback.
      const snap = preReplaySnapshotRef.current;
      if (snap) {
        updateSimState(
          snap.visitors,
          snap.groups,
          snap.timeState,
          snap.phase,
          snap.totalSpawned,
          snap.totalExited,
          snap.mediaStats,
          snap.spawnByNode,
          snap.exitByNode,
        );
        // overlayMode 복원 — Replay 진입 시 강제 'none' 으로 바꿨다면 원래대로.
        store.setOverlayMode(snap.overlayMode);
      } else if (frameCount > 0) {
        applyFrame(frameCount - 1);
      }
      preReplaySnapshotRef.current = null;
      setIsReplaying(false);
    } else {
      // Enter Replay → 현재 store 상태 스냅샷.
      preReplaySnapshotRef.current = {
        visitors: store.visitors,
        groups: store.groups,
        timeState: store.timeState,
        phase: store.phase,
        totalSpawned: store.totalSpawned,
        totalExited: store.totalExited,
        mediaStats: store.mediaStats,
        spawnByNode: store.spawnByNode,
        exitByNode: store.exitByNode,
        overlayMode: store.overlayMode,
      };
      // Replay 중엔 heatmap 이 cumulative density grid 라서 frame 동기화 안 됨 — 강제 off.
      if (store.overlayMode === 'heatmap') store.setOverlayMode('none');
      setIsReplaying(true);
      applyFrame(replayIndex >= 0 ? replayIndex : 0);
    }
  }, [isReplaying, setIsReplaying, applyFrame, replayIndex, stopAutoPlay, updateSimState, frameCount]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    stopAutoPlay();
    applyFrame(parseInt(e.target.value));
  }, [applyFrame, stopAutoPlay]);

  // Replay 는 시뮬이 끝난(또는 일시정지된) 뒤에만 진입 가능. running 중엔 숨김.
  if (frameCount < 3 || phase === 'idle' || phase === 'running') return null;

  const currentFrame = replayIndex >= 0 && replayIndex < frameCount ? replayFrames[replayIndex] : null;
  const currentMin = currentFrame ? Math.floor(currentFrame.timestamp / 60000) : 0;
  const currentSec = currentFrame ? Math.floor((currentFrame.timestamp % 60000) / 1000) : 0;

  return (
    <div className="bento-box p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="panel-section">
          Replay ({frameCount} frames)
        </h2>
        <button
          onClick={handleToggleReplay}
          className={`px-2 py-0.5 text-[11px] font-medium rounded-lg transition-all ${
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
