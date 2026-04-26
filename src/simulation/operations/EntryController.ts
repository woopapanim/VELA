/**
 * EntryController — 외부 도착 → 입장 정책 throttle → 입장 허가 (Phase 1)
 *
 * SimEngine.spawnTick() 이 generate 한 visitor 를 본 컨트롤러에 enqueue 하고,
 * step() 결과의 admitted[] 만 실제 시뮬에 활성화한다.
 *
 * 정책 5종:
 *   - unlimited      : 즉시 모두 입장
 *   - concurrent-cap : 내부 동시 인원 < cap 일 때만
 *   - rate-limit     : 시간당 처리량 cap (rolling 1h window)
 *   - time-slot      : 슬롯 (예: 30분) 당 K 명, 슬롯 만료 시 reset
 *   - hybrid         : concurrent-cap + time-slot 동시 적용
 *
 * 포기 이탈: maxWaitBeforeAbandonMs 초과 시 큐에서 abandoned 로 이동.
 *
 * 호환성: 'unlimited' 모드에선 enqueue→step 1회로 즉시 admit, 회귀 0.
 *
 * 관련 spec: docs/specs/phase-1-operations-policy.md §3.1
 */

import type { EntryPolicy } from '@/domain';

// ── 큐 엔트리 (제너릭 payload — SimEngine 은 Visitor 를 넣음) ──
export interface QueuedItem<T> {
  readonly payload: T;
  readonly arrivedAt: number; // elapsed ms
  /**
   * Phase 1+ (2026-04-26): 개별 인내심 (ms). 미지정 시 policy.maxWaitBeforeAbandonMs fallback.
   * - SimEngine 이 enqueue 시 samplePatienceMs() 로 산출해서 넘긴다 (프로필/참여도/분포).
   * - 미지정 enqueue 는 legacy 동작 (모두 동일 인내심).
   */
  readonly patienceMs?: number;
}

// ── step() 컨텍스트 — 외부 (SimEngine) 가 알려줘야 하는 상태 ──
export interface AdmitContext {
  /** 현재 시각 (elapsed ms) */
  readonly now: number;
  /** 현재 시뮬 내부 활성 인원 — concurrent-cap / hybrid 에서 사용 */
  readonly currentConcurrent: number;
}

// ── step() 결과 ──
export interface AdmitResult<T> {
  readonly admitted: ReadonlyArray<QueuedItem<T>>;
  readonly abandoned: ReadonlyArray<QueuedItem<T>>;
}

// ── snapshot (UI/디버그용) ──
export interface QueueSnapshot {
  readonly queueLength: number;
  readonly oldestWaitMs: number;
  readonly totalArrived: number;
  readonly totalAdmitted: number;
  readonly totalAbandoned: number;
  /** 현재 슬롯 (time-slot/hybrid). undefined = 비해당 모드. */
  readonly currentSlotIndex?: number;
  /** 현재 슬롯 admit 카운트 */
  readonly admittedThisSlot?: number;
  /** 최근 1시간 admit 카운트 (rate-limit) */
  readonly admittedThisHour?: number;
  /** Phase 1+ (2026-04-26): 현재 큐 평균 대기 (ms). 비어 있으면 0. */
  readonly avgQueueWaitMs: number;
  /** Phase 1+ (2026-04-26): 최근 admit N 명의 평균 외부 대기 (ms). N=ADMIT_WAIT_RING_CAP. */
  readonly recentAdmitAvgWaitMs: number;
}

// ── 내부 admitHistory 엔트리 (rate-limit 용 sliding window) ──
interface AdmissionTimestamp {
  readonly at: number;
}

/** 최근 admit 평균 대기 ring buffer 용량 — 너무 길면 추세 변화 못 잡고, 짧으면 노이즈 큼. */
const ADMIT_WAIT_RING_CAP = 100;

export class EntryController<T = unknown> {
  private queue: Array<QueuedItem<T>> = [];
  private _totalArrived = 0;
  private _totalAdmitted = 0;
  private _totalAbandoned = 0;

  // rate-limit 상태
  private admissionHistory: AdmissionTimestamp[] = [];

  // time-slot/hybrid 상태
  private currentSlotIndex = -1;
  private admittedThisSlot = 0;

  // Phase 1+ (2026-04-26): 최근 admit 의 외부 대기 시간 ring buffer (avg 계산용).
  private admitWaitRing: number[] = [];
  private admitWaitRingHead = 0;

  // erasableSyntaxOnly 호환 — parameter property 대신 명시적 필드 + assign.
  private policy: EntryPolicy;

  constructor(policy: EntryPolicy) {
    this.policy = policy;
  }

  /** 정책 교체 (러닝 중 변경 시). 큐는 유지. */
  setPolicy(policy: EntryPolicy): void {
    this.policy = policy;
  }

  getPolicy(): EntryPolicy {
    return this.policy;
  }

  /**
   * 외부에서 도착한 payload 를 큐에 등록.
   * @param patienceMs Phase 1+ (2026-04-26): 개별 인내심 (ms). 미지정 시 policy.maxWaitBeforeAbandonMs.
   */
  enqueue(payload: T, arrivedAt: number, patienceMs?: number): void {
    this.queue.push({ payload, arrivedAt, patienceMs });
    this._totalArrived++;
  }

  /**
   * dt 동안 정책 적용 — 큐에서 admit 가능한 것 꺼내고, abandon 처리.
   * 호출 빈도: SimEngine 의 spawnTick 마다 (60Hz 기준 16ms 마다).
   */
  step(ctx: AdmitContext): AdmitResult<T> {
    const { now, currentConcurrent } = ctx;
    const admitted: QueuedItem<T>[] = [];
    const abandoned: QueuedItem<T>[] = [];

    // 1) Abandonment 먼저 — 큐 머리부터 (FIFO 라 머리가 제일 오래 대기)
    // Phase 1+ (2026-04-26): per-item patienceMs 우선, 없으면 policy.maxWaitBeforeAbandonMs.
    // 단 분포 모델 적용 후엔 FIFO 임에도 머리가 먼저 abandon 한다는 보장이 약해짐
    // (앞 사람 인내심이 우연히 큰 경우) → 큐 전체를 1회 스캔 (head-only 조기 종료 폐기).
    const policyMaxWait = this.policy.maxWaitBeforeAbandonMs;
    if (this.policy.mode !== 'unlimited' && (policyMaxWait !== undefined || this.queue.some(q => q.patienceMs !== undefined))) {
      const survivors: QueuedItem<T>[] = [];
      for (const item of this.queue) {
        const limit = item.patienceMs ?? policyMaxWait;
        if (limit !== undefined && now - item.arrivedAt >= limit) {
          abandoned.push(item);
          this._totalAbandoned++;
        } else {
          survivors.push(item);
        }
      }
      this.queue = survivors;
    }

    // 2) rate-limit 의 1시간 윈도우 prune
    if (this.policy.mode === 'rate-limit') {
      const cutoff = now - 3_600_000; // 1h
      this.admissionHistory = this.admissionHistory.filter(a => a.at > cutoff);
    }

    // 3) time-slot/hybrid 의 슬롯 전환 감지
    const slotMode = this.policy.mode === 'time-slot' || this.policy.mode === 'hybrid';
    if (slotMode && this.policy.slotDurationMs && this.policy.slotDurationMs > 0) {
      const slot = Math.floor(now / this.policy.slotDurationMs);
      if (slot !== this.currentSlotIndex) {
        this.currentSlotIndex = slot;
        this.admittedThisSlot = 0;
      }
    }

    // 4) Admission — 큐 머리부터, canAdmit 가 false 가 될 때까지
    let runningConcurrent = currentConcurrent;
    while (this.queue.length > 0) {
      if (!this.canAdmitOne(runningConcurrent)) break;
      const head = this.queue.shift()!;
      admitted.push(head);
      this._totalAdmitted++;
      runningConcurrent++;
      this.admissionHistory.push({ at: now });
      if (slotMode) this.admittedThisSlot++;
      // Phase 1+ (2026-04-26): 외부 대기 시간 기록 (avg 계산용 ring buffer).
      this.recordAdmitWait(Math.max(0, now - head.arrivedAt));
    }

    return { admitted, abandoned };
  }

  /** Phase 1+ (2026-04-26): admit wait ring buffer 기록 (capacity 100). */
  private recordAdmitWait(waitMs: number): void {
    if (this.admitWaitRing.length < ADMIT_WAIT_RING_CAP) {
      this.admitWaitRing.push(waitMs);
    } else {
      this.admitWaitRing[this.admitWaitRingHead] = waitMs;
      this.admitWaitRingHead = (this.admitWaitRingHead + 1) % ADMIT_WAIT_RING_CAP;
    }
  }

  /** 정책별 admit 가능 여부 (단일 인원 1명 admit 시도). */
  private canAdmitOne(currentConcurrent: number): boolean {
    const p = this.policy;
    switch (p.mode) {
      case 'unlimited':
        return true;
      case 'concurrent-cap':
        return p.maxConcurrent === undefined || currentConcurrent < p.maxConcurrent;
      case 'rate-limit':
        return p.maxPerHour === undefined || this.admissionHistory.length < p.maxPerHour;
      case 'time-slot':
        return p.perSlotCap === undefined || this.admittedThisSlot < p.perSlotCap;
      case 'hybrid': {
        const concurrentOk = p.maxConcurrent === undefined || currentConcurrent < p.maxConcurrent;
        const slotOk = p.perSlotCap === undefined || this.admittedThisSlot < p.perSlotCap;
        return concurrentOk && slotOk;
      }
    }
  }

  /** 시뮬 종료 시점에 외부 큐에 남은 사람들을 abandoned 로 처리. */
  drainAsAbandoned(): ReadonlyArray<QueuedItem<T>> {
    const remaining = this.queue.slice();
    this._totalAbandoned += remaining.length;
    this.queue.length = 0;
    return remaining;
  }

  /** UI/렌더러용 큐 상태 스냅샷. */
  snapshot(now: number): QueueSnapshot {
    const oldestWait = this.queue.length > 0 ? Math.max(0, now - this.queue[0].arrivedAt) : 0;
    const slotMode = this.policy.mode === 'time-slot' || this.policy.mode === 'hybrid';

    // Phase 1+ (2026-04-26): 평균 대기 KPI.
    let avgQueueWait = 0;
    if (this.queue.length > 0) {
      let sum = 0;
      for (const item of this.queue) sum += Math.max(0, now - item.arrivedAt);
      avgQueueWait = sum / this.queue.length;
    }
    let recentAdmitAvgWait = 0;
    if (this.admitWaitRing.length > 0) {
      let sum = 0;
      for (const w of this.admitWaitRing) sum += w;
      recentAdmitAvgWait = sum / this.admitWaitRing.length;
    }

    return {
      queueLength: this.queue.length,
      oldestWaitMs: oldestWait,
      totalArrived: this._totalArrived,
      totalAdmitted: this._totalAdmitted,
      totalAbandoned: this._totalAbandoned,
      currentSlotIndex: slotMode ? this.currentSlotIndex : undefined,
      admittedThisSlot: slotMode ? this.admittedThisSlot : undefined,
      admittedThisHour: this.policy.mode === 'rate-limit' ? this.admissionHistory.length : undefined,
      avgQueueWaitMs: avgQueueWait,
      recentAdmitAvgWaitMs: recentAdmitAvgWait,
    };
  }

  /** 큐 내용 직접 접근 (시각화용 read-only). */
  peekQueue(): ReadonlyArray<QueuedItem<T>> {
    return this.queue;
  }

  /** 카운터/큐 리셋 (시뮬 재시작 시). */
  reset(): void {
    this.queue.length = 0;
    this._totalArrived = 0;
    this._totalAdmitted = 0;
    this._totalAbandoned = 0;
    this.admissionHistory.length = 0;
    this.currentSlotIndex = -1;
    this.admittedThisSlot = 0;
    this.admitWaitRing.length = 0;
    this.admitWaitRingHead = 0;
  }
}
