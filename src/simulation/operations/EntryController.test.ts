/**
 * EntryController unit tests — Phase 1
 *
 * 5 정책 모두의 행동 + abandonment + invariant 를 검증.
 * SimEngine 통합 회귀 안전망: unlimited 모드는 즉시 admit (=기존 동작).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntryController } from './EntryController';
import type { EntryPolicy } from '@/domain';

// 테스트 페이로드 — 실제 Visitor 대신 식별 가능한 string ID 사용.
type TestId = string;

function makeCtx(now: number, currentConcurrent = 0) {
  return { now, currentConcurrent };
}

describe('EntryController — unlimited', () => {
  it('admits all enqueued items immediately (regression baseline)', () => {
    const ctrl = new EntryController<TestId>({ mode: 'unlimited' });
    ctrl.enqueue('a', 0);
    ctrl.enqueue('b', 100);
    ctrl.enqueue('c', 200);

    const result = ctrl.step(makeCtx(300));
    expect(result.admitted.map(q => q.payload)).toEqual(['a', 'b', 'c']);
    expect(result.abandoned).toHaveLength(0);
    expect(ctrl.snapshot(300).queueLength).toBe(0);
    expect(ctrl.snapshot(300).totalAdmitted).toBe(3);
  });

  it('does not abandon even with extreme wait (no maxWait in unlimited)', () => {
    const ctrl = new EntryController<TestId>({ mode: 'unlimited' });
    ctrl.enqueue('a', 0);
    const result = ctrl.step(makeCtx(60_000_000)); // 1000 hours
    expect(result.admitted).toHaveLength(1);
    expect(result.abandoned).toHaveLength(0);
  });
});

describe('EntryController — concurrent-cap', () => {
  it('admits up to cap then queues the rest', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'concurrent-cap',
      maxConcurrent: 2,
    });
    ctrl.enqueue('a', 0);
    ctrl.enqueue('b', 0);
    ctrl.enqueue('c', 0);
    ctrl.enqueue('d', 0);

    const r1 = ctrl.step(makeCtx(0, 0));
    expect(r1.admitted.map(q => q.payload)).toEqual(['a', 'b']);
    expect(ctrl.snapshot(0).queueLength).toBe(2);
  });

  it('admits more as currentConcurrent drops', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'concurrent-cap',
      maxConcurrent: 2,
    });
    ctrl.enqueue('a', 0);
    ctrl.enqueue('b', 0);
    ctrl.enqueue('c', 0);

    ctrl.step(makeCtx(0, 0));      // a, b admitted; queue=[c]
    const r2 = ctrl.step(makeCtx(100, 2));  // still at cap, no admit
    expect(r2.admitted).toHaveLength(0);
    const r3 = ctrl.step(makeCtx(200, 1));  // 1 slot freed
    expect(r3.admitted.map(q => q.payload)).toEqual(['c']);
  });

  it('abandons after maxWait exceeded (FIFO order)', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'concurrent-cap',
      maxConcurrent: 1,
      maxWaitBeforeAbandonMs: 10_000,
    });
    ctrl.enqueue('a', 0);
    ctrl.enqueue('b', 1_000);
    ctrl.enqueue('c', 5_000);

    // a admitted at t=0
    ctrl.step(makeCtx(0, 0));
    // a still inside (currentConcurrent=1), b waited 11s → abandon
    const r = ctrl.step(makeCtx(12_000, 1));
    expect(r.abandoned.map(q => q.payload)).toEqual(['b']);
    // c only waited 7s, still in queue
    expect(ctrl.snapshot(12_000).queueLength).toBe(1);
  });
});

describe('EntryController — rate-limit', () => {
  it('caps admissions per rolling 1-hour window', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'rate-limit',
      maxPerHour: 3,
    });
    for (let i = 0; i < 5; i++) ctrl.enqueue(`v${i}`, 0);

    const r1 = ctrl.step(makeCtx(0));
    expect(r1.admitted).toHaveLength(3);
    expect(ctrl.snapshot(0).queueLength).toBe(2);

    // Still within the hour — no more admits
    const r2 = ctrl.step(makeCtx(30 * 60_000)); // 30 min
    expect(r2.admitted).toHaveLength(0);
  });

  it('rolls window — admits more after 1h', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'rate-limit',
      maxPerHour: 2,
    });
    ctrl.enqueue('a', 0);
    ctrl.enqueue('b', 0);
    ctrl.enqueue('c', 0);

    ctrl.step(makeCtx(0));  // admits a, b
    expect(ctrl.snapshot(0).queueLength).toBe(1);

    // 1h+1ms later, history pruned, c can admit
    const r = ctrl.step(makeCtx(3_600_001));
    expect(r.admitted.map(q => q.payload)).toEqual(['c']);
  });
});

describe('EntryController — time-slot', () => {
  it('admits up to perSlotCap then waits for next slot', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'time-slot',
      slotDurationMs: 1_800_000, // 30 min
      perSlotCap: 2,
    });
    for (let i = 0; i < 5; i++) ctrl.enqueue(`v${i}`, 0);

    const r1 = ctrl.step(makeCtx(0));
    expect(r1.admitted).toHaveLength(2);
    // Still in slot 0
    const r2 = ctrl.step(makeCtx(15 * 60_000));
    expect(r2.admitted).toHaveLength(0);
    // New slot at 30min
    const r3 = ctrl.step(makeCtx(1_800_000));
    expect(r3.admitted).toHaveLength(2);
    // Slot 2
    const r4 = ctrl.step(makeCtx(3_600_000));
    expect(r4.admitted).toHaveLength(1);
  });

  it('exposes slot index in snapshot', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'time-slot',
      slotDurationMs: 1000,
      perSlotCap: 5,
    });
    ctrl.enqueue('a', 0);
    ctrl.step(makeCtx(2_500)); // slot 2
    const s = ctrl.snapshot(2_500);
    expect(s.currentSlotIndex).toBe(2);
    expect(s.admittedThisSlot).toBe(1);
  });
});

describe('EntryController — hybrid', () => {
  it('respects both concurrent-cap and time-slot', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'hybrid',
      maxConcurrent: 3,
      slotDurationMs: 1_000,
      perSlotCap: 5,
    });
    for (let i = 0; i < 10; i++) ctrl.enqueue(`v${i}`, 0);

    // Slot cap (5) > concurrent cap (3, currentConcurrent=0) → 3 admitted
    const r1 = ctrl.step(makeCtx(0, 0));
    expect(r1.admitted).toHaveLength(3);

    // currentConcurrent=3, cap=3 → 0 admitted (concurrent blocks)
    const r2 = ctrl.step(makeCtx(500, 3));
    expect(r2.admitted).toHaveLength(0);

    // Next slot, concurrent dropped to 1 → can admit min(slot remaining=5, concurrent free=2)=2
    const r3 = ctrl.step(makeCtx(1_500, 1));
    expect(r3.admitted).toHaveLength(2);
  });
});

describe('EntryController — abandonment + drain', () => {
  let ctrl: EntryController<TestId>;
  const policy: EntryPolicy = {
    mode: 'concurrent-cap',
    maxConcurrent: 0, // never admits — for testing pure abandonment
    maxWaitBeforeAbandonMs: 1_000,
  };

  beforeEach(() => {
    ctrl = new EntryController<TestId>(policy);
  });

  it('FIFO abandonment — older first', () => {
    ctrl.enqueue('a', 0);
    ctrl.enqueue('b', 500);
    ctrl.enqueue('c', 1_500);

    // At t=1500, a waited 1500 (over), b waited 1000 (at cap, abandon), c waited 0 (ok)
    const r = ctrl.step(makeCtx(1_500, 0));
    expect(r.abandoned.map(q => q.payload)).toEqual(['a', 'b']);
    expect(ctrl.snapshot(1_500).queueLength).toBe(1);
  });

  it('drainAsAbandoned moves remaining queue to abandoned (sim end)', () => {
    ctrl.enqueue('a', 0);
    ctrl.enqueue('b', 0);
    const drained = ctrl.drainAsAbandoned();
    expect(drained.map(q => q.payload)).toEqual(['a', 'b']);
    expect(ctrl.snapshot(0).queueLength).toBe(0);
    expect(ctrl.snapshot(0).totalAbandoned).toBe(2);
  });
});

describe('EntryController — per-item patience (Phase 1+)', () => {
  it('per-item patienceMs overrides policy maxWaitBeforeAbandonMs', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'concurrent-cap',
      maxConcurrent: 0, // never admit
      maxWaitBeforeAbandonMs: 10_000, // policy default 10s
    });
    // a: per-item patience 5s (shorter than policy), b: 30s (longer)
    ctrl.enqueue('a', 0, 5_000);
    ctrl.enqueue('b', 0, 30_000);
    // At t=6_000: a abandoned (waited 6s > 5s), b ok (waited 6s < 30s)
    const r = ctrl.step(makeCtx(6_000, 0));
    expect(r.abandoned.map(q => q.payload)).toEqual(['a']);
    expect(ctrl.snapshot(6_000).queueLength).toBe(1);
    // At t=12_000: b would normally abandon at policy 10s, but per-item patience 30s saves it
    const r2 = ctrl.step(makeCtx(12_000, 0));
    expect(r2.abandoned).toHaveLength(0);
    expect(ctrl.snapshot(12_000).queueLength).toBe(1);
  });

  it('avgQueueWaitMs reflects mean wait of currently queued items', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'concurrent-cap',
      maxConcurrent: 0,
      maxWaitBeforeAbandonMs: 1_000_000,
    });
    ctrl.enqueue('a', 0);    // wait 10s at t=10_000
    ctrl.enqueue('b', 4_000); // wait 6s at t=10_000
    const s = ctrl.snapshot(10_000);
    expect(s.avgQueueWaitMs).toBe(8_000); // (10_000 + 6_000) / 2
  });

  it('recentAdmitAvgWaitMs records admit wait times', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'concurrent-cap',
      maxConcurrent: 10,
    });
    ctrl.enqueue('a', 0);
    ctrl.enqueue('b', 0);
    ctrl.enqueue('c', 0);
    ctrl.step(makeCtx(5_000, 0));        // all admitted with wait=5_000
    expect(ctrl.snapshot(5_000).recentAdmitAvgWaitMs).toBe(5_000);
  });

  it('avgQueueWaitMs is 0 when queue empty', () => {
    const ctrl = new EntryController<TestId>({ mode: 'unlimited' });
    expect(ctrl.snapshot(0).avgQueueWaitMs).toBe(0);
    expect(ctrl.snapshot(0).recentAdmitAvgWaitMs).toBe(0);
  });
});

describe('EntryController — invariants', () => {
  it('totalArrived = admitted + abandoned + currently_waiting (always)', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'concurrent-cap',
      maxConcurrent: 1,
      maxWaitBeforeAbandonMs: 100,
    });
    for (let i = 0; i < 10; i++) ctrl.enqueue(`v${i}`, i * 10);

    ctrl.step(makeCtx(50, 0));   // admit v0
    ctrl.step(makeCtx(200, 1));  // abandon old; admit none (at cap)

    const s = ctrl.snapshot(200);
    expect(s.totalArrived).toBe(s.totalAdmitted + s.totalAbandoned + s.queueLength);
  });

  it('reset() zeroes all counters', () => {
    const ctrl = new EntryController<TestId>({ mode: 'unlimited' });
    ctrl.enqueue('a', 0);
    ctrl.step(makeCtx(0));
    ctrl.reset();
    const s = ctrl.snapshot(0);
    expect(s.totalArrived).toBe(0);
    expect(s.totalAdmitted).toBe(0);
    expect(s.totalAbandoned).toBe(0);
    expect(s.queueLength).toBe(0);
  });

  it('setPolicy preserves queue', () => {
    const ctrl = new EntryController<TestId>({
      mode: 'concurrent-cap',
      maxConcurrent: 0,
    });
    ctrl.enqueue('a', 0);
    ctrl.enqueue('b', 0);
    ctrl.setPolicy({ mode: 'unlimited' });
    const r = ctrl.step(makeCtx(100, 0));
    expect(r.admitted.map(q => q.payload)).toEqual(['a', 'b']);
  });
});
