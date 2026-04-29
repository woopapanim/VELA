# Phase 1 Spec — 운영 정책 (수용 + 입장 제한)

**작성일**: 2026-04-25
**선행 조건**: Phase 0 완료 (Exhibit 용어 + 카테고리별 속성)
**후속 작업**: Phase 2 (단체/도슨트/VIP — 본 모듈 위에서 동작)
**Estimate**: 2-3 주

---

## 0. 동기 / 배경

### 0.1 풀어야 할 질문

> "동시 수용 몇 명까지 받아야 쾌적한가? 입장을 제한해야 하는가? 어떤 방식으로?"

이건 시설 오픈 전 가장 큰 운영 의사결정 중 하나. 현재 VELA 는 이걸 시뮬레이션할 수단이 거의 없음:
- spawn rate 만 있음 (시간당 N 명 도착)
- 외부 대기열 모델 없음
- 입장 throttle / 시간슬롯 예약 모델 없음
- 만족도 추정 없음 (혼잡도만 raw 값으로 보여줌)

### 0.2 현재 상태

```
[현재]  외부 도착 → 즉시 spawn (입장) → 시뮬 → exit
        ↑
        무제한, 입장 제어 없음
```

### 0.3 목표 상태

```
[Phase 1]  외부 도착 → outsideQueue → EntryController →
           ┌─────────┬─────────────┐
           │ 무제한  │ rate-limit  │ time-slot      │
           └─────────┴─────────────┴────────────────┘
           → 시설 내부 spawn → 시뮬 → exit

           동시에 만족도 추정 (혼잡도 + 체류시간 + 대기시간)
```

---

## 1. 핵심 개념 정의

### 1.1 입장 정책 (Entry Policy)

| 정책 | 설명 | 파라미터 |
|------|-----|--------|
| `unlimited` | 무제한 입장 (현재 기본값, baseline) | — |
| `concurrent-cap` | 동시 수용 상한 N — 내부 인원 N 미만일 때만 입장 | `maxConcurrent` |
| `rate-limit` | 시간당 처리 상한 — 분당 입장 인원 cap | `maxPerHour` |
| `time-slot` | 시간슬롯 예약 — 30분 단위 슬롯, 슬롯당 K 명 | `slotDurationMs`, `perSlotCap` |
| `hybrid` | concurrent-cap + 슬롯 (대형 시설용) | 위 조합 |

### 1.2 외부 대기열 (Outside Queue)

- 도착했으나 입장 제한으로 입장 불가한 방문객
- FIFO + 그룹 응집 (그룹은 같이 입장)
- 인내심 모델: 대기 시간이 `maxWaitTimeBeforeAbandon` 초과 시 이탈 (포기)
- 캔버스 시각화: 시설 외곽 entry node 근처에 대기열 표시

### 1.3 만족도 추정 (Satisfaction Estimate)

방문객별 만족도 (0-1) + 집계 평균:

```
satisfaction = w_crowd · (1 - crowdScore)
             + w_dwell · dwellAdequacyScore
             + w_wait · (1 - waitScore)
             + w_engagement · engagementCompletionScore

           (w_crowd + w_dwell + w_wait + w_engagement = 1, 기본 가중치 0.3/0.3/0.2/0.2)
```

세부 정의:

- `crowdScore`: 방문객 경로상 평균 혼잡도 (0=한산, 1=과밀). `crowdAreaSec / totalSec`.
- `dwellAdequacyScore`: 의도된 체류 vs 실제 체류 (`actualDwellMs / recommendedDwellMs`, 1.0 cap).
- `waitScore`: 외부 + 내부 대기 시간 정규화. `min(totalWaitMs / W_MAX, 1)`. `W_MAX = 30 min` 기본.
- `engagementCompletionScore`: 도달한 미디어 중 의미있는 체험 비율 (Phase 0 의 `minWatchMs` 활용).

가중치는 사용자 조정 가능 (기획 의도에 따라). 백서에 근거 명시.

### 1.4 4 등급 만족도 라벨

| 점수 범위 | 라벨 | 색상 |
|---------|-----|-----|
| 0.85 ~ 1.00 | ★★★★★ Excellent | green |
| 0.70 ~ 0.85 | ★★★★☆ Good | lime |
| 0.50 ~ 0.70 | ★★★☆☆ Fair | yellow |
| 0.30 ~ 0.50 | ★★☆☆☆ Poor | orange |
| 0.00 ~ 0.30 | ★☆☆☆☆ Bad | red |

---

## 2. 도메인 모델

### 2.1 신규 타입

```ts
// src/domain/types/operations.ts (신규)

export type EntryPolicyMode =
  | 'unlimited'
  | 'concurrent-cap'
  | 'rate-limit'
  | 'time-slot'
  | 'hybrid';

export interface EntryPolicy {
  readonly mode: EntryPolicyMode;
  readonly maxConcurrent?: number;
  readonly maxPerHour?: number;
  readonly slotDurationMs?: number;
  readonly perSlotCap?: number;
  /** 외부 대기 인내심 (초과 시 포기) */
  readonly maxWaitBeforeAbandonMs?: number;
}

export interface SatisfactionWeights {
  readonly crowd: number;      // default 0.3
  readonly dwell: number;      // default 0.3
  readonly wait: number;       // default 0.2
  readonly engagement: number; // default 0.2
}

export interface OperationsConfig {
  readonly entryPolicy: EntryPolicy;
  readonly satisfactionWeights: SatisfactionWeights;
}
```

### 2.2 Scenario 통합

```ts
// src/domain/types/scenario.ts (확장)

export interface SimulationConfig {
  // ... 기존 필드
  readonly operations?: OperationsConfig;  // optional, 미설정 시 unlimited 동작
}
```

### 2.3 Visitor 확장

```ts
// src/domain/types/visitor.ts (확장)

export interface Visitor {
  // ... 기존 필드
  readonly arrivedAt: number;        // 외부 도착 시각
  readonly admittedAt?: number;      // 입장 시각 (외부 대기 종료)
  readonly outsideWaitMs?: number;   // admittedAt - arrivedAt
  readonly abandonedAt?: number;     // 포기 이탈 시각
  readonly satisfactionScore?: number; // exit 시 계산
}
```

### 2.4 신규 KPI

```ts
// src/domain/types/kpi.ts (확장)

export interface OperationsKpi {
  readonly avgOutsideWaitMs: number;
  readonly maxOutsideWaitMs: number;
  readonly p95OutsideWaitMs: number;
  readonly abandonmentRate: number;    // 포기 이탈 비율
  readonly throughputPerHour: number;
  readonly peakConcurrent: number;
  readonly avgConcurrent: number;
  readonly avgSatisfaction: number;
  readonly satisfactionDistribution: { excellent, good, fair, poor, bad };
  readonly congestionMinutes: number;  // 시설 평균 혼잡도가 임계 초과한 누적 분
}
```

---

## 3. 모듈 설계

### 3.1 EntryController (신규 모듈)

위치: `src/simulation/operations/EntryController.ts`

```ts
export class EntryController {
  constructor(
    private policy: EntryPolicy,
    private clock: () => number,
  ) {}

  /** 외부에서 도착한 방문객을 큐에 등록 */
  enqueue(visitor: Visitor): void;

  /** 현재 admit 가능한지 정책에 따라 판단 */
  canAdmit(state: { currentConcurrent: number; admittedThisHour: number; currentSlotIndex: number; admittedThisSlot: number }): boolean;

  /** dt 동안 처리 — 큐에서 입장 가능한 방문객 꺼내고 admittedAt 기록 */
  step(dt: number, state: AdmissionState): { admitted: Visitor[]; abandoned: Visitor[] };

  /** 시각화/디버그용 큐 스냅샷 */
  snapshot(): { queueLength: number; oldestWaitMs: number; estimatedNextAdmitMs: number };
}
```

### 3.2 SimEngine 통합 지점

현재 `SimEngine.ts:797` 의 `spawnTick(dt)` 이 spawn 시점 — 이 함수가 직접 `generateSpawnBatch` 를 호출함. 

수정안:
1. `spawnTick(dt)` 에서 생성된 visitor 를 **즉시 활성화하지 않고** `EntryController.enqueue()` 에 등록
2. 동시에 `EntryController.step(dt)` 호출 → `admitted[]` 받아서 `state.visitors.set(...)` (실제 입장)
3. `OperationsKpi` 는 `analytics/aggregator.ts` 에 신규 calculator 추가

```ts
// SimEngine.spawnTick() 의사코드 (수정 후)

private spawnTick(dt: number) {
  // 1) 기존 로직: spawn 결정 + visitor 객체 생성
  const generated = this.generatePending(dt);  // 신규 메서드 (기존 spawn 로직 분리)

  // 2) 외부 큐에 등록 (즉시 활성화 X)
  for (const v of generated) {
    this.entryController.enqueue({ ...v, arrivedAt: this.clock() });
  }

  // 3) 정책에 따라 admit
  const { admitted, abandoned } = this.entryController.step(dt, this.admissionState);

  // 4) 입장 처리 — 실제 시뮬레이션 활성화
  for (const v of admitted) {
    const visitor: Visitor = { ...v, admittedAt: this.clock() };
    this.state.visitors.set(visitor.id, this.assignNextTarget(visitor));
    this._totalSpawned++;
  }

  // 5) 포기 이탈 기록
  for (const v of abandoned) {
    this._abandonedCount++;
    // analytics 에 abandonment 이벤트 기록
  }
}
```

**중요 — `unlimited` 모드 호환성**:
`EntryPolicy.mode === 'unlimited'` 이면 `canAdmit()` 항상 `true` 반환 → 기존 동작과 100% 동일. 기존 시나리오는 영향 없음.

### 3.3 외부 큐 시각화

위치: `src/visualization/renderers/OutsideQueueRenderer.ts` (신규)

- 시설 외곽 entry node 위치에 줄 그래픽 (8 명 단위 그룹핑)
- 큐 길이 + 평균 대기 시간 라벨
- hover 시 상세 (대기 시간 분포)
- 색상: 대기 시간에 따라 green → yellow → red

### 3.4 만족도 계산기

위치: `src/analytics/calculators/satisfaction.ts` (신규)

- 방문객 exit 시점에 `satisfactionScore` 계산
- 시뮬 종료 시 평균 + 분포 + 라벨별 비율 산출
- `OperationsKpi` 의 `avgSatisfaction`, `satisfactionDistribution` 채움

---

## 4. UI / UX Flow

### 4.1 입장 정책 입력 패널

위치: `src/ui/panels/build/OperationsPanel.tsx` (신규)

레이아웃 (BuildTools 의 한 섹션으로 추가):

```
┌── 운영 정책 ───────────────────────────────┐
│                                            │
│ 정책: ○ 무제한                             │
│       ● 동시 수용 상한                     │
│       ○ 시간당 처리 상한                   │
│       ○ 시간슬롯 예약                      │
│       ○ 하이브리드                         │
│                                            │
│ ┌─ 동시 수용 상한 ─────────────────────┐  │
│ │ 동시 수용 상한:    [200] 명          │  │
│ │ 외부 대기 인내심: [15] 분             │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ ┌─ 만족도 가중치 (고급) ───────────────┐  │
│ │ 혼잡:      [0.30] ━━━●━━━━━━━━━━     │  │
│ │ 체류시간: [0.30] ━━━●━━━━━━━━━━     │  │
│ │ 대기:      [0.20] ━●━━━━━━━━━━━━     │  │
│ │ 체험완주: [0.20] ━●━━━━━━━━━━━━     │  │
│ │ (합계: 1.00 ✓)                         │  │
│ └──────────────────────────────────────┘  │
│                                            │
└────────────────────────────────────────────┘
```

### 4.2 시뮬 진행 중 표시

CanvasPanel 상단 status bar 에:
```
내부: 187 / 200 ●  외부 대기: 12 명  평균 대기: 4.3 min  만족도: ★★★★☆ 0.78
```

### 4.3 정책 비교 화면 (A/B/C/D)

위치: `src/ui/panels/analytics/PolicyComparison.tsx` (신규)

- 같은 시나리오 / 같은 도착 분포 / 정책만 다른 변형 N 개를 한 화면에서 비교
- Variant fork: 베이스에서 정책만 다르게 4 개까지 동시 시뮬
- 결과 테이블: 핵심 지표 6 개 (피크 동시인원, 평균 대기, 처리량, 만족도, 포기율, 혼잡 누적분)
- 자동 추천: 만족도 가중 점수로 ✓ 표시
- 차이가 큰 셀 자동 하이라이트 (top 1 색상 강조, bottom 1 회색)

```
                  배치 A          배치 B           배치 C            배치 D
                (무제한)      (동시 200)      (슬롯 80×30분)    (혼합)
─────────────────────────────────────────────────────────────────────────
피크 동시 인원  312 명          200 명 (cap)    240 명             210 명
평균 외부 대기  0 min            8 min            0.5 min            3 min
포기 이탈률     0%               4%               0%                 1%
시간당 처리량   240 명           180 명           160 명             185 명
혼잡 누적분    47 min           14 min           12 min             18 min
만족도         ★★☆☆☆ 0.42  ★★★★☆ 0.74   ★★★★★ 0.86      ★★★★☆ 0.78
─────────────────────────────────────────────────────────────────────────
                                                  ✓ 추천: 배치 C
```

### 4.4 권장 정책 자동 산출 (옵션)

- 사용자 입력: 목표 (만족도 우선 / 처리량 우선 / 균형)
- 시스템: 정책 grid search (예: 동시 100/150/200/250/300, 슬롯 60/80/100, 슬롯간격 20/30/40)
- 각 조합 시뮬 → 목표 함수 최적 조합 추천
- 비용: N 개 변형 = N 회 시뮬 (백그라운드 실행, 5-15 분 소요)
- Phase 1 후반에 시도, MVP 에는 미포함

---

## 5. 비교 UI 강화 (A/B/C/D)

### 5.1 현재 ComparisonEngine 의 한계

- A vs B 만 (2 way)
- UI 가 단일 비교 가정
- "차이가 큰 지표" 자동 하이라이트 없음
- "추천" 자동 산출 없음

### 5.2 확장 사항

| 항목 | 현재 | Phase 1 후 |
|------|-----|----------|
| 변형 수 | 2 | 2-6 (UI 제약 6 까지) |
| 추천 | 없음 | 가중 점수 기반 자동 추천 |
| 차이 하이라이트 | 없음 | 셀 색상 강조 (top/bottom) |
| 변형 fork | 시나리오 복제 | 1 클릭 fork (정책만 다름) |
| KPI 묶음 | 단일 | 카테고리별 (운영/체험/공간) 탭 |

### 5.3 ComparisonEngine 수정

위치: `src/comparison/ComparisonEngine.ts`

- `compareN(scenarios: Scenario[])` 메서드 추가
- 각 시나리오 병렬 실행 (Web Worker pool, 4 동시)
- 결과를 `MultiComparisonResult` 로 정리 (변형 수 N 까지)

---

## 6. 시뮬레이션 엔진 영향

### 6.1 변경 최소 원칙

- 시뮬 step 로직 자체는 변경 없음
- spawn 시점에 `EntryController` 끼워 넣기만
- `unlimited` 모드면 기존 동작 100% 유지

### 6.2 검증 — 회귀 방지

- 기존 시나리오 (operations 미설정) 로드 → `unlimited` 모드 자동 적용
- 기존 시나리오 시뮬 결과 = Phase 0 시뮬 결과 (회귀 0)
- 자동 회귀 테스트: 6 개 샘플 시나리오 시뮬 → 핵심 KPI 일치 확인 (`totalSpawned`, `totalExited`, `avgVisitDuration`)

### 6.3 새 invariant

- `totalArrived = totalAdmitted + totalAbandoned + totalCurrentlyWaiting`
- `totalAdmitted = totalSpawned`
- `totalSpawned = active + totalExited + totalAbandonedAfterAdmit`

---

## 7. 신규 메트릭 상세

### 7.1 외부 대기 메트릭

- `avgOutsideWaitMs`: 입장한 사람들의 평균 외부 대기
- `maxOutsideWaitMs`: 최대값
- `p95OutsideWaitMs`: 95 퍼센타일 (피크 시간대 체감 대기)
- `abandonmentRate`: 포기 이탈 / 도착 인원

### 7.2 처리량 메트릭

- `throughputPerHour`: 시간당 입장 인원 (정상 상태 평균)
- `peakConcurrent`: 피크 동시 인원
- `avgConcurrent`: 평균 동시 인원
- `concurrentTimeline`: 1 분 단위 동시 인원 시계열 (그래프용)

### 7.3 혼잡 메트릭

- `congestionMinutes`: 시설 평균 혼잡도 > 0.7 인 시간 누적
- `peakCrowdScore`: 피크 혼잡도

### 7.4 만족도 메트릭

- `avgSatisfaction`: 0-1 평균
- `satisfactionDistribution`: 5 라벨별 비율 (excellent/good/fair/poor/bad)
- 백서: 가중치 산정 근거, 라벨 임계값 근거

---

## 8. 미해결 이슈 / 결정 필요 사항

| # | 이슈 | 제안 | 결정 시점 |
|---|------|-----|---------|
| 1 | 도착 분포 — 시간슬롯과 무관하게 도착할 텐데 외부 큐 모델은 어떻게? | 도착은 기존 spawn rate, 입장만 throttle. 도착-입장 갭이 outsideQueue | 본 spec |
| 2 | 그룹 입장 — 그룹은 같이 입장? 분리 가능? | 그룹은 같이 입장 (응집). cap 부족 시 다음 cycle 까지 통째로 대기 | 본 spec |
| 3 | 슬롯 예약 — 사전 예약 vs 도착 순 | Phase 1 은 도착 순 (walk-in). 사전 예약 구분은 Phase 2 (VIP) 에서 | 본 spec |
| 4 | 만족도 가중치 기본값 검증 | 백서 작성 시 case study 로 검증, 기본값은 0.3/0.3/0.2/0.2 | Phase 1 종료 후 |
| 5 | concurrentCap 시 신규 도착자가 우선? 큐가 우선? | FIFO (큐 우선) | 본 spec |
| 6 | 시뮬 종료 처리 — duration 끝났는데 외부에 큐가 남으면? | 종료 시점 큐는 abandon 으로 처리, 분리 카운트 | 본 spec |

---

## 9. 작업 항목 + Estimate

### 9.1 작업 분해

```
[A] 도메인 + 타입 (1 일)
├─ EntryPolicy, OperationsConfig 타입
├─ Visitor 확장 (arrivedAt, admittedAt, ...)
├─ OperationsKpi 타입
└─ Scenario 통합

[B] EntryController 모듈 (2 일)
├─ enqueue/canAdmit/step API
├─ 정책 5 종 구현
├─ 그룹 응집 처리
├─ 포기 이탈 모델
└─ 단위 테스트 (정책 5 종)

[C] SimEngine 통합 (1 일)
├─ spawnTick 분해 (generatePending + admit)
├─ EntryController 연결
├─ unlimited 모드 회귀 테스트
└─ invariant 검증

[D] 만족도 계산기 (1.5 일)
├─ crowd/dwell/wait/engagement score 계산
├─ 가중 합산
├─ 분포 집계
└─ 단위 테스트

[E] OperationsPanel UI (2 일)
├─ 정책 입력 5 종
├─ 만족도 가중치 슬라이더
├─ 도움말/툴팁
└─ i18n (ko/en)

[F] 외부 큐 시각화 (1.5 일)
├─ OutsideQueueRenderer
├─ 큐 길이/대기시간 표시
├─ 색상 그라디언트
└─ Status bar 표시

[G] 정책 비교 UI (3 일)
├─ Variant fork (1-click)
├─ 병렬 실행 (Worker pool)
├─ MultiComparisonResult
├─ 비교 테이블 + 자동 추천
└─ 차이 하이라이트

[H] ComparisonEngine 확장 (1.5 일)
├─ compareN 메서드
├─ MultiComparisonResult 타입
└─ 회귀 테스트

[I] 검증 / 통합 테스트 (1.5 일)
├─ 6 개 샘플 시나리오 회귀
├─ 정책 5 종 시나리오 통합
├─ E2E 정책 비교 워크플로우
└─ 성능 검증 (4 변형 동시 시뮬 < 60s)

[J] 문서 / 백서 (1 일)
├─ CLAUDE.md 업데이트
├─ 백서 초안 (만족도 공식 근거)
└─ Phase 1 retrospective

총합: 약 16 일 = 3.2 주 (버퍼 포함)
순작업: 11 일 = 2.2 주
```

### 9.2 Definition of Done

- [ ] 5 종 입장 정책 모두 시뮬 가능
- [ ] 외부 큐 시각화 동작
- [ ] 만족도 추정 계산 + 5 라벨 분포
- [ ] OperationsPanel UI 완성
- [ ] 정책 A/B/C/D 동시 비교 가능
- [ ] 자동 추천 (가중 점수 기반)
- [ ] 회귀 0 (기존 시나리오 = 기존 결과)
- [ ] 단위 테스트 + 통합 테스트 pass
- [ ] 백서 만족도 섹션 초안 작성
- [ ] CLAUDE.md 업데이트

### 9.3 Phase 1 → Phase 2 전환 조건

- 위 DoD 모두 통과
- Phase 2 spec 검토 완료
- 만족도 공식 case study 1 회 (가상 시나리오로 가중치 검증)

---

## 10. 결정 / 확정 사항

본 spec 작성 시점 (2026-04-25) 확정:

1. ✅ 입장 정책 5 종 (unlimited / concurrent-cap / rate-limit / time-slot / hybrid)
2. ✅ 외부 대기 큐 모델 (FIFO + 그룹 응집)
3. ✅ 만족도 4 요소 가중 합산 (혼잡/체류/대기/체험완주)
4. ✅ 5 라벨 분포 (excellent ~ bad)
5. ✅ ComparisonEngine N-way 확장 (2 → 6)
6. ✅ unlimited 모드 = 기존 동작 호환 (회귀 0)
7. ✅ 그룹은 같이 입장
8. ✅ Phase 1 은 walk-in 만 (사전 예약은 Phase 2)

---

## 부록 — 사용자 통찰 인용

- "공간 설계 하면서 운영관점에서 최대 수용인원을 얼마나 잡을지"
- "그에따라 입장 제한을 두어야하는지"
- "단체는 어떻게 운영할지" → Phase 2 로 분리
- "도슨트나 VIP 투어는 어떻게 운영할지" → Phase 2 로 분리

본 Phase 는 **수용 + 입장 제한** 에 집중. 단체/도슨트/VIP 는 Phase 2 의 토대로 본 모듈 (EntryController) 을 활용.
