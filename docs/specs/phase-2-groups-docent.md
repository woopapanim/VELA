# Phase 2 Spec — 단체 / 도슨트 / VIP 운영

**작성일**: 2026-04-25
**선행 조건**: Phase 1 완료 (EntryController, 만족도 모델, A/B/C/D 비교 UI)
**후속 작업**: Phase 3A (작품 큐레이션) — 본 Phase 는 운영 정책의 마지막 단계
**Estimate**: 2 주

---

## 0. 동기 / 배경

### 0.1 풀어야 할 질문

> "단체 관람은 어떻게 운영하나? 도슨트 투어는? VIP 는 일반 관람과 어떻게 분리하나?"

Phase 1 (수용 + 입장 제한) 이 익명 개인 관람객의 흐름 제어였다면, Phase 2 는 **고유한 운영 객체** 를 도입:

- **단체 (Group Booking)**: 사전 예약된 그룹 (예: 수학여행 30명, 회사 워크샵 15명)
- **도슨트 (Docent)**: 가이드 직원, 그룹 leader 역할 (그룹원이 follow)
- **VIP 투어**: 우선 입장권, 별도 동선/시간대

이 셋은 **상호작용** 함:
- 단체 + 도슨트 = 가이드 투어
- VIP + 도슨트 = VIP 가이드 투어
- VIP + 일반시간 = 우선 입장 + 별도 동선

Phase 1 의 EntryController 는 익명 spawn rate 기반 → 본 Phase 에서 **명시적 booking** 으로 확장.

### 0.2 현재 상태

```
src/simulation/behavior/GroupBehavior.ts          ← 그룹 cohesion 있음
src/simulation/steering/GroupCohesion.ts         ← 응집 steering 있음
src/simulation/steering/FollowLeader.ts          ← leader-follower 있음
```

→ 토대는 있음. 하지만:
- "단체 예약" 이라는 명시적 객체 없음 (도착 시간, 사이즈 사전 정의)
- Docent 에이전트 타입 없음 (지금은 일반 visitor 와 동일)
- VIP 우선권 / 별도 동선 모델 없음
- 단체간 시차 운영, 충돌 회피 자동화 없음

---

## 1. 핵심 개념 정의

### 1.1 단체 예약 (Group Booking)

사전에 정해진 그룹 단위 입장:

```ts
interface GroupBooking {
  id: GroupBookingId;
  size: number;
  arrivalTime: number;       // ms (시뮬 시작 기준)
  route: 'free' | 'docent';  // 자유 관람 vs 가이드
  docentId?: DocentId;       // route='docent' 시
  profile: VisitorProfileType;  // 그룹 구성원의 통일 프로필
  priority: 'normal' | 'priority' | 'vip';  // 입장 우선권
  preferredTour?: TourTemplateId;  // 사전 정의된 투어 코스
}
```

### 1.2 도슨트 (Docent)

가이드 에이전트 — 일반 visitor 와 다른 행동 모델:

```ts
interface Docent {
  id: DocentId;
  name: string;
  schedule: DocentShift[];   // 근무 시간대
  walkSpeed: number;          // 일반 visitor 대비 느림 (그룹 보조)
  tourScript?: TourScript;    // 시간대별 정해진 코스
  capacity: number;           // 동시 투어 인원 상한 (보통 20)
}

interface TourScript {
  id: TourTemplateId;
  name: string;
  durationMs: number;         // 전체 투어 시간
  stops: Array<{
    targetId: ZoneId | MediaId;
    talkDurationMs: number;   // 해설 시간
    sequence: number;
  }>;
}
```

### 1.3 VIP 정책

별도 운영 정책 객체:

```ts
interface VipPolicy {
  mode: 'separate-time' | 'separate-route' | 'priority-pass' | 'mixed';
  // separate-time: 개관 전 1시간 등 전용 시간
  separateTimeWindow?: { startMs: number; endMs: number };
  // separate-route: 별도 entry node + 별도 동선 zone 마킹
  separateEntryNodeIds?: string[];
  // priority-pass: 일반 시간 + 큐 우선
  priorityWeight?: number;  // FIFO 가중치 (1.0 = 일반과 동일, ∞ = 즉시 입장)
}
```

### 1.4 그룹 행동 모델 확장

기존 GroupCohesion 위에 추가:

- **Tour mode**: docent 가 leader, 그룹원이 follow + 정해진 코스 따라감
- **Free mode (단체)**: 그룹 응집 유지하되 자유 관람
- **Wait sync**: 도슨트가 다음 stop 으로 이동 전, 흩어진 그룹원 대기
- **Group attention span**: 그룹원이 도슨트 해설에 집중하는 시간 (engagement 일시 정지)

### 1.5 단체간 시차 운영

자동 권장 룰:
- 같은 zone 진입 간격 ≥ `MIN_GROUP_GAP_MS` (default 15 분)
- 큰 단체 (>20명) + 작은 단체 (<10명) 동시간 금지 권장
- 도슨트 1 명당 동시 1 그룹 (capacity 까지)

위반 시 시뮬레이션은 그대로 진행하되, 결과 화면에 경고 + 권장 조정안 표시.

---

## 2. 도메인 모델

### 2.1 신규 타입

```ts
// src/domain/types/groupBooking.ts (신규)

import type { Brand } from './common';

export type GroupBookingId = Brand<string, 'GroupBookingId'>;
export type DocentId = Brand<string, 'DocentId'>;
export type TourTemplateId = Brand<string, 'TourTemplateId'>;

export type GroupRoute = 'free' | 'docent';
export type GroupPriority = 'normal' | 'priority' | 'vip';

export interface GroupBooking {
  readonly id: GroupBookingId;
  readonly size: number;
  readonly arrivalTime: number;
  readonly route: GroupRoute;
  readonly docentId?: DocentId;
  readonly profile: VisitorProfileType;
  readonly priority: GroupPriority;
  readonly preferredTour?: TourTemplateId;
  readonly notes?: string;
}

export interface DocentShift {
  readonly startMs: number;
  readonly endMs: number;
}

export interface TourStop {
  readonly targetId: string;       // ZoneId | MediaId
  readonly targetType: 'zone' | 'media';
  readonly talkDurationMs: number;
  readonly sequence: number;
}

export interface TourTemplate {
  readonly id: TourTemplateId;
  readonly name: string;
  readonly durationMs: number;
  readonly stops: ReadonlyArray<TourStop>;
}

export interface Docent {
  readonly id: DocentId;
  readonly name: string;
  readonly schedule: ReadonlyArray<DocentShift>;
  readonly walkSpeed: number;       // px/s, 보통 80-100 (일반 120)
  readonly capacity: number;
  readonly assignedTours?: ReadonlyArray<TourTemplateId>;
}

export type VipMode = 'separate-time' | 'separate-route' | 'priority-pass' | 'mixed';

export interface VipPolicy {
  readonly mode: VipMode;
  readonly separateTimeWindow?: { startMs: number; endMs: number };
  readonly separateEntryNodeIds?: ReadonlyArray<string>;
  readonly priorityWeight?: number;
}
```

### 2.2 Scenario 통합

```ts
// src/domain/types/scenario.ts (확장)

export interface Scenario {
  // ... 기존 필드
  readonly groupBookings?: ReadonlyArray<GroupBooking>;
  readonly docents?: ReadonlyArray<Docent>;
  readonly tourTemplates?: ReadonlyArray<TourTemplate>;
  readonly vipPolicy?: VipPolicy;
}
```

### 2.3 Visitor 확장

```ts
// src/domain/types/visitor.ts (확장)

export interface Visitor {
  // ... 기존 필드
  readonly bookingId?: GroupBookingId;       // 단체 소속이면
  readonly docentId?: DocentId;              // tour 중이면
  readonly priority: GroupPriority;          // 입장 우선권
  readonly currentTourStop?: number;         // tour 진행 인덱스
}

// 신규 visitor 타입
export interface DocentVisitor extends Visitor {
  readonly isDocent: true;
  readonly tourScriptId?: TourTemplateId;
  readonly currentGroupSize: number;
}
```

### 2.4 신규 KPI

```ts
// src/domain/types/kpi.ts (확장)

export interface GroupOperationsKpi {
  readonly totalGroups: number;
  readonly avgGroupCohesion: number;   // 0-1, 그룹원이 leader 근처 머문 비율
  readonly groupCollisionEvents: number;  // 그룹간 zone 동시 진입 충돌
  readonly avgTourCompletionRate: number;
  readonly avgTourDurationMs: number;
  readonly tourScriptDeviationMs: number; // 계획 vs 실제 시간차
  readonly docentUtilization: number;     // 도슨트 가동률 (실 투어 시간 / 근무 시간)
}

export interface VipOperationsKpi {
  readonly vipCount: number;
  readonly vipAvgSatisfaction: number;
  readonly vipAvgWaitMs: number;
  readonly vipImpactOnRegular: {
    throughputDelta: number;   // % 변화
    satisfactionDelta: number;
  };
}
```

---

## 3. 모듈 설계

### 3.1 BookingScheduler (신규)

위치: `src/simulation/operations/BookingScheduler.ts`

- 시뮬 시작 시 `groupBookings[]` 정렬 (arrivalTime 기준)
- 각 booking 도착 시 그룹 visitors 일괄 생성 → EntryController 에 enqueue
- `priority` 에 따라 EntryController 의 우선순위 적용
- VipPolicy 의 `separateTimeWindow` / `separateEntryNodeIds` 처리

```ts
export class BookingScheduler {
  constructor(
    private bookings: GroupBooking[],
    private docents: Docent[],
    private vipPolicy: VipPolicy | null,
    private entryController: EntryController,
  ) {}

  /** 시뮬 dt 동안 도착 처리 */
  step(currentTime: number): { spawned: Visitor[]; tours: TourSession[] };

  /** VIP separate-time 윈도우 active 여부 */
  isVipExclusiveWindow(currentTime: number): boolean;
}
```

### 3.2 DocentBehavior (신규)

위치: `src/simulation/behavior/DocentBehavior.ts`

기존 `EngagementBehavior` 와 별개로 도슨트 전용 step:

- TourScript 의 stops 를 순서대로 방문
- 각 stop 에서 `talkDurationMs` 동안 대기 (그룹원 응집 확인)
- 그룹원 흩어짐 시 `wait sync` (그룹 응집 회복까지 대기)
- 마지막 stop 후 그룹 해산 → 일반 free 동선

### 3.3 GroupBehavior 확장

기존 `src/simulation/behavior/GroupBehavior.ts` 에 추가:

- `tourMode` 분기: docent leader follow + 일시 정지 시 attention span 모델
- `freeGroupMode`: 응집 유지 + 자유 관람 (현재 GroupCohesion 활용)
- 그룹원의 미디어 engagement 는 그룹 평균에 동기화 (한 명만 길게 보지 않음)

### 3.4 EntryController 확장 (Phase 1 모듈 수정)

```ts
// EntryController 의 canAdmit 확장

canAdmit(state, candidate: Visitor | GroupBooking): boolean {
  // VIP separate-time: 일반 입장 차단
  if (this.scheduler.isVipExclusiveWindow(now) && candidate.priority !== 'vip') return false;
  
  // priority-pass: VIP 우선 (큐 추월)
  if (candidate.priority === 'vip' && this.vipPolicy?.mode === 'priority-pass') {
    return state.currentConcurrent < this.policy.maxConcurrent;
  }
  
  // 그룹은 사이즈만큼 cap 여유 필요
  const needed = (candidate as GroupBooking).size ?? 1;
  return state.currentConcurrent + needed <= this.policy.maxConcurrent;
}
```

### 3.5 충돌 분석기 (신규)

위치: `src/analytics/calculators/groupConflicts.ts`

- 시뮬 종료 후 그룹간 zone 동시 진입 이벤트 검출
- 권장 조정안 자동 산출: "단체 B 도착 시간 +12 분 권장"
- `groupCollisionEvents` 카운트 및 타임라인 산출

---

## 4. UI / UX Flow

### 4.1 단체 예약 입력 패널

위치: `src/ui/panels/build/GroupBookingsPanel.tsx` (신규)

```
┌── 단체 예약 ──────────────────────────────────┐
│                                                │
│ [+ 단체 추가]                                  │
│                                                │
│ ┌─ 단체 #1 ──────────────────────────────┐    │
│ │ 사이즈:     [30]   명                   │    │
│ │ 도착 시간:  [14:00] (시뮬 +1.0h)        │    │
│ │ 코스:      ○ 자유  ● 도슨트            │    │
│ │ 도슨트:    [김큐레이터 ▾]              │    │
│ │ 투어:      [기본 60분 코스 ▾]          │    │
│ │ 우선권:    [일반 ▾]                    │    │
│ │ 프로필:    [학생 (general) ▾]          │    │
│ │ [삭제]                                  │    │
│ └─────────────────────────────────────────┘    │
│                                                │
│ ┌─ 단체 #2 ─────────────────────────...       │
│                                                │
│ ⚠️ 단체 #1 + #2 도착 시간 5분 차 — 충돌 위험   │
│    권장: 단체 #2 +10 분                        │
│                                                │
└────────────────────────────────────────────────┘
```

### 4.2 도슨트 관리 패널

위치: `src/ui/panels/build/DocentsPanel.tsx` (신규)

- 도슨트 명단 + 근무 시간
- 투어 템플릿 편집기 (stops 순서, 해설 시간)
- 가동률 미리보기 (시뮬 후 결과)

### 4.3 VIP 정책 패널

위치: `src/ui/panels/build/VipPolicyPanel.tsx` (신규)

```
┌── VIP 정책 ─────────────────────────────────┐
│                                              │
│ 모드: ○ 사용 안함                            │
│       ● 별도 시간대                          │
│       ○ 별도 동선                            │
│       ○ 우선 입장권                          │
│       ○ 혼합                                 │
│                                              │
│ 별도 시간:  [09:00] ~ [10:00]                │
│             (개관 전 1시간 VIP 전용)         │
│                                              │
│ 영향 미리보기 (이전 시뮬):                   │
│   일반 처리량 영향: -8%                      │
│   VIP 만족도:       ★★★★★                  │
│   운영 비용:        도슨트 1명 + 1시간       │
│                                              │
└──────────────────────────────────────────────┘
```

### 4.4 시뮬 진행 시각화

CanvasPanel 에 추가:
- 단체 그룹: 같은 색 외곽선 (그룹별 다른 색)
- 도슨트: 별 모양 아이콘 + 이름 라벨
- VIP: 골드 하이라이트
- Tour stop: 도슨트 위치에 "현재 stop X/Y" 라벨

### 4.5 충돌 타임라인 시각화

위치: `src/ui/panels/analytics/GroupTimeline.tsx` (신규)

```
시간(분)  0    15   30   45   60   75   90
─────────────────────────────────────────────
단체 A   ━━━━━━━━━━━━ (zone 1→2→3)
단체 B           ━━━━━━━━━━━━━━━━ (zone 1→2→3)
                 ⚠️ 30분: zone 2 동시 진입
단체 C                       ━━━━━━━━━━
                             (zone 1→3, fast)
─────────────────────────────────────────────
권장: B 출발 +12분, 또는 B 코스를 1→3→2 로
```

### 4.6 운영 정책 비교 (Phase 1 의 PolicyComparison 확장)

기존 비교 화면에 단체/VIP 정책도 변형 차원으로 추가:

```
                  정책 1            정책 2            정책 3
                (VIP 별도시간)   (VIP 우선입장)   (단체간격 +10)
─────────────────────────────────────────────────────────────
일반 만족도     ★★★★☆ 0.78    ★★★☆☆ 0.62    ★★★★★ 0.85
VIP 만족도      ★★★★★ 0.95    ★★★★☆ 0.80    n/a
처리량/h        180              210              175
운영 부담       높음             중               낮음
─────────────────────────────────────────────────────────────
                                                  ✓ 추천: 정책 3
```

---

## 5. 시뮬레이션 엔진 영향

### 5.1 변경 지점

- `SimEngine.spawnTick()`: BookingScheduler 통합
- `SimEngine.stepBehavior()`: docent visitor 분기 → DocentBehavior
- `SimEngine.assignNextTarget()`: tour 중인 visitor 는 docent 따라감

### 5.2 회귀 방지

- `groupBookings`/`docents`/`vipPolicy` 미설정 시 = Phase 1 동작과 100% 동일
- 기존 시나리오 영향 없음

### 5.3 성능 영향

- Docent 에이전트 추가로 visitor 수 증가 (도슨트당 +1)
- 그룹간 충돌 검출은 후처리 (시뮬 중 비용 0)
- 예상 영향: < 5% (도슨트는 10 명 미만 가정)

---

## 6. 신규 메트릭 상세

### 6.1 그룹 운영 메트릭

- `avgGroupCohesion`: 그룹원이 leader (도슨트 또는 그룹 중심) 반경 5m 내 머문 비율
- `groupCollisionEvents`: 두 그룹이 같은 zone 에 동시 진입한 횟수
- `tourCompletionRate`: 투어 stop 완주 비율 (계획 stops 중 실제 방문)
- `tourScriptDeviationMs`: 계획 시간 vs 실제 시간 차 (음수 = 빠름, 양수 = 늦음)

### 6.2 도슨트 메트릭

- `docentUtilization`: 실 투어 시간 / 근무 시간
- `docentTourCount`: 시뮬 기간 동안 진행한 투어 수
- `docentAvgGroupSize`: 평균 인솔 인원

### 6.3 VIP 메트릭

- `vipCount`: VIP 입장 인원
- `vipAvgSatisfaction`: VIP 만족도 평균 (Phase 1 만족도 모델 사용)
- `vipImpactOnRegular`: VIP 정책 적용 vs 미적용 시 일반 관람객 KPI 차이

---

## 7. 미해결 이슈 / 결정 필요 사항

| # | 이슈 | 제안 | 결정 시점 |
|---|------|-----|---------|
| 1 | 도슨트도 EntryController 통과? | No — 직원이므로 입장 cap 무관 | 본 spec |
| 2 | 단체 사이즈 > maxConcurrent 잔여? | 통째 다음 cycle 까지 대기, 분할 X | 본 spec |
| 3 | Tour 중 그룹원 이탈 (느린 사람) 처리 | 도슨트는 wait sync, 5 분 초과 시 그룹원 abandoned 처리 | 본 spec |
| 4 | VIP separate-route 시 zone 마킹 방식 | zone metadata 에 `vipOnly: boolean` 추가 | 본 spec |
| 5 | 도슨트 walkSpeed 차이 모델링 정확도 | 일반의 70% (백서 case study 로 검증) | Phase 2 종료 후 |
| 6 | 단체 + 일반 + VIP 모두 활성화 시 UX 복잡도 | 기본 뷰는 단순, "고급" 토글로 모두 노출 | UI 구현 시 |
| 7 | TourTemplate 사전 정의 vs ad-hoc | Phase 2 는 사전 정의만, ad-hoc 은 backlog | 본 spec |

---

## 8. 작업 항목 + Estimate

```
[A] 도메인 + 타입 (1.5 일)
├─ GroupBooking, Docent, TourTemplate, VipPolicy
├─ Visitor 확장 (bookingId, docentId, priority)
├─ 신규 KPI 타입
└─ Scenario 통합

[B] BookingScheduler (1.5 일)
├─ 도착 처리 + EntryController 연동
├─ VIP separate-time 윈도우 처리
├─ 우선권 처리
└─ 단위 테스트

[C] DocentBehavior + GroupBehavior 확장 (2 일)
├─ Tour mode (leader follow + 정해진 코스)
├─ Wait sync (그룹원 응집 회복 대기)
├─ Attention span 모델 (engagement 일시 정지)
└─ 단위 테스트

[D] EntryController 확장 (0.5 일)
├─ 그룹 단위 admit
├─ priority-pass / separate-time 분기
└─ 회귀 테스트

[E] 충돌 분석기 (1 일)
├─ 그룹간 zone 동시 진입 검출
├─ 권장 조정안 산출
└─ Timeline 데이터 생성

[F] UI - GroupBookingsPanel (2 일)
├─ 단체 추가/편집/삭제
├─ 충돌 경고 + 권장안 표시
├─ i18n
└─ 검증 (사이즈 > 0, arrivalTime 정렬 등)

[G] UI - DocentsPanel + Tour 편집 (2 일)
├─ 도슨트 명단 + 근무 시간
├─ TourTemplate 편집 (stops 순서, 해설 시간)
└─ 가동률 미리보기

[H] UI - VipPolicyPanel (1 일)
├─ 4 모드 입력
└─ 영향 미리보기

[I] 시각화 (1.5 일)
├─ 그룹 색상 외곽선
├─ Docent 별 아이콘 + 이름
├─ VIP 골드 하이라이트
└─ Tour stop 라벨

[J] GroupTimeline 분석 화면 (1 일)
└─ 단체별 진행 타임라인 + 충돌 마킹

[K] 검증 / 통합 테스트 (1.5 일)
├─ 단체/도슨트/VIP 통합 시나리오
├─ Phase 1 회귀 (operations 만 사용)
└─ 성능 검증

[L] 문서 / 백서 (1 일)
├─ CLAUDE.md 업데이트
├─ 백서 도슨트 모델 섹션
└─ Phase 2 retrospective

총합: 약 16.5 일 = 3.3 주 (버퍼 포함)
순작업: 약 11 일 = 2.2 주
```

### 8.2 Definition of Done

- [ ] GroupBooking 입력 + 시뮬 동작
- [ ] Docent 에이전트 + Tour 진행
- [ ] VIP 정책 4 모드 동작
- [ ] 그룹간 충돌 검출 + 권장안
- [ ] 운영 정책 비교 화면에 단체/VIP 변형 차원 추가
- [ ] 회귀 0 (operations 만 사용 = Phase 1 결과)
- [ ] 통합 시나리오 테스트 pass
- [ ] CLAUDE.md / 백서 업데이트

---

## 9. 결정 / 확정 사항

본 spec 작성 시점 (2026-04-25) 확정:

1. ✅ GroupBooking = 사전 예약 객체 (도착 시간, 사이즈, 코스, 우선권)
2. ✅ Docent = 별도 visitor 타입 (입장 cap 무관, 느린 walkSpeed)
3. ✅ TourTemplate = 사전 정의 (ad-hoc 은 backlog)
4. ✅ VIP 4 모드 (separate-time / separate-route / priority-pass / mixed)
5. ✅ 단체는 통째 입장 (분할 없음)
6. ✅ Wait sync 5 분 초과 시 그룹원 abandon
7. ✅ Phase 2 = Phase 1 의 EntryController 위에서 동작 (직교)
8. ✅ 회귀 0 (groupBookings 미설정 시 = Phase 1)

---

## 부록 — 사용자 통찰 인용

- "단체는 어떻게 운영할지"
- "도슨트나 VIP 투어는 어떻게 운영할지"
