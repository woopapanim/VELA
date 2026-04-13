import type { StateCreator } from 'zustand';
import type { Visitor, VisitorGroup, TimeState } from '@/domain';

export interface ReplayFrame {
  visitors: Visitor[];
  groups: VisitorGroup[];
  timeState: TimeState;
  timestamp: number;
}

export interface ReplaySlice {
  replayFrames: ReplayFrame[];
  replayIndex: number;
  isReplaying: boolean;
  followAgentId: string | null;

  pushReplayFrame: (frame: ReplayFrame) => void;
  setReplayIndex: (index: number) => void;
  setIsReplaying: (v: boolean) => void;
  setFollowAgent: (id: string | null) => void;
  clearReplay: () => void;
}

const MAX_FRAMES = 300; // ~5 min at 1 frame/s

export const createReplaySlice: StateCreator<ReplaySlice, [], [], ReplaySlice> = (set) => ({
  replayFrames: [],
  replayIndex: -1,
  isReplaying: false,
  followAgentId: null,

  pushReplayFrame: (frame) =>
    set((s) => ({
      replayFrames: [...s.replayFrames.slice(-(MAX_FRAMES - 1)), frame],
    })),

  setReplayIndex: (index) => set({ replayIndex: index }),
  setIsReplaying: (v) => set({ isReplaying: v }),
  setFollowAgent: (id) => set({ followAgentId: id }),
  clearReplay: () => set({ replayFrames: [], replayIndex: -1, isReplaying: false, followAgentId: null }),
});
