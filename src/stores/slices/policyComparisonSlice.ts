import type { StateCreator } from 'zustand';
import type { KpiSnapshot } from '@/domain';

export type PolicySlotId = 'A' | 'B' | 'C';
export type PolicyComparisonMode = 'preset' | 'progressive';

export interface PolicySlot {
  readonly id: PolicySlotId;
  /** 슬롯에 지정된 cap 값. null = 미지정 (이 슬롯은 사용 안 함). */
  readonly capValue: number | null;
  readonly status: 'empty' | 'configured' | 'captured';
  readonly capturedAt: number | null;
  readonly snapshot: KpiSnapshot | null;
  /** 캡처 당시 active visitor 수 (디버그/표시용). */
  readonly totalSpawned: number | null;
  readonly totalExited: number | null;
}

export interface PolicyRecommendation {
  readonly basedOnSlotId: PolicySlotId;
  readonly suggestedB: number;
  readonly suggestedC: number;
  readonly reasonKey: string;
}

export interface PolicyComparisonSlice {
  policySlots: { A: PolicySlot; B: PolicySlot; C: PolicySlot };
  policyMode: PolicyComparisonMode;
  /** 다음 시뮬 실행 시 캡처될 슬롯. null = 비교 모드 비활성. */
  activePolicySlotId: PolicySlotId | null;
  policyRecommendation: PolicyRecommendation | null;

  setPolicyMode: (mode: PolicyComparisonMode) => void;
  setPolicySlotCap: (slotId: PolicySlotId, capValue: number | null) => void;
  setActivePolicySlot: (slotId: PolicySlotId | null) => void;
  capturePolicySlotResult: (
    slotId: PolicySlotId,
    snapshot: KpiSnapshot,
    totalSpawned: number,
    totalExited: number,
  ) => void;
  clearPolicySlot: (slotId: PolicySlotId) => void;
  clearAllPolicySlots: () => void;
  setPolicyRecommendation: (recommendation: PolicyRecommendation | null) => void;
}

const emptySlot = (id: PolicySlotId): PolicySlot => ({
  id,
  capValue: null,
  status: 'empty',
  capturedAt: null,
  snapshot: null,
  totalSpawned: null,
  totalExited: null,
});

export const createPolicyComparisonSlice: StateCreator<PolicyComparisonSlice, [], [], PolicyComparisonSlice> = (set) => ({
  policySlots: { A: emptySlot('A'), B: emptySlot('B'), C: emptySlot('C') },
  policyMode: 'progressive',
  activePolicySlotId: null,
  policyRecommendation: null,

  setPolicyMode: (mode) => set({ policyMode: mode }),

  setPolicySlotCap: (slotId, capValue) =>
    set((s) => {
      const slot = s.policySlots[slotId];
      // cap 변경하면 이전 캡처 결과는 무효화 (cap 이 다른 결과니까)
      const next: PolicySlot = {
        ...slot,
        capValue,
        status: capValue == null ? 'empty' : 'configured',
        snapshot: null,
        capturedAt: null,
        totalSpawned: null,
        totalExited: null,
      };
      return { policySlots: { ...s.policySlots, [slotId]: next } };
    }),

  setActivePolicySlot: (slotId) => set({ activePolicySlotId: slotId }),

  capturePolicySlotResult: (slotId, snapshot, totalSpawned, totalExited) =>
    set((s) => {
      const slot = s.policySlots[slotId];
      if (slot.capValue == null) return s;
      const next: PolicySlot = {
        ...slot,
        status: 'captured',
        capturedAt: Date.now(),
        snapshot,
        totalSpawned,
        totalExited,
      };
      return {
        policySlots: { ...s.policySlots, [slotId]: next },
        activePolicySlotId: null,
      };
    }),

  clearPolicySlot: (slotId) =>
    set((s) => ({
      policySlots: { ...s.policySlots, [slotId]: emptySlot(slotId) },
      activePolicySlotId: s.activePolicySlotId === slotId ? null : s.activePolicySlotId,
      policyRecommendation:
        s.policyRecommendation?.basedOnSlotId === slotId ? null : s.policyRecommendation,
    })),

  clearAllPolicySlots: () =>
    set({
      policySlots: { A: emptySlot('A'), B: emptySlot('B'), C: emptySlot('C') },
      activePolicySlotId: null,
      policyRecommendation: null,
    }),

  setPolicyRecommendation: (recommendation) => set({ policyRecommendation: recommendation }),
});
