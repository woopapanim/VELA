# Phase 3B Spec — 디지털 미디어 경험 설계

**작성일**: 2026-04-25
**선행 조건**: Phase 0 완료 (DigitalMediaProps: contentDurationMs / minWatchMs / loopable)
**병렬 가능**: Phase 3A (작품 큐레이션)
**Estimate**: 1.5 주

---

## 0. 동기 / 배경

### 0.1 풀어야 할 질문

> "이 디지털 컨텐츠를 어떻게 경험시킬 것인가? 길이, 재생 방식, 인터랙션을 어떻게 설계할 것인가?"

작품(Artwork) 비교가 **위치/순서** 차원이라면, 디지털 미디어 비교는 **경험 자체의 설계** 차원:

- 5 분 풀 영상 vs 2 분 압축 vs 인터랙티브 선택형
- PASSIVE (지나가며 본다) vs STAGED (시간 맞춰 들어와 본다)
- 동시 수용 5 명 vs 20 명 vs 50 명
- 단순 영상 vs 챕터 선택 가능

같은 컨텐츠라도 **경험 형식** 에 따라 효과가 천차만별. 큐레이터는 "이 위치에는 어떤 경험이 적합한가" 를 시뮬로 검증해야 함.

### 0.2 사용자 통찰

> "디지털 미디어의 경우는 체험시간이나 경험의 방법 (인터랙티브냐? 일반 관람이냐?)"

→ Phase 3B 의 핵심: **경험 형식 변형 비교** + **의미있는 체험 측정**.

### 0.3 Phase 3A 와의 차이

| 차원 | Phase 3A (작품) | Phase 3B (디지털 미디어) |
|------|---------------|----------------------|
| 비교 대상 | 위치 + 순서 | 길이 + 방식 + capacity |
| 핵심 KPI | 순서 충실도, 시리즈 완주 | 의미있는 완주율, 처리량 |
| 시뮬 영향 | 없음 (메타만) | `minWatchMs` 가 skip 판단에 영향 |
| 변형 차원 | 공간적 (어디에) | 시간/구조적 (어떻게) |

---

## 1. 핵심 개념 정의

### 1.1 디지털 미디어 메타 (Phase 0 정의 활용)

```ts
interface DigitalMediaProps {
  contentDurationMs?: number;   // 컨텐츠 전체 길이
  minWatchMs?: number;          // 의미있는 체험 최소 시간
  loopable?: boolean;           // 루프 가능 (PASSIVE 시 의미)
}
```

여기에 Phase 3B 에서 추가:

```ts
interface DigitalMediaProps {
  // 기존 +
  chapters?: ReadonlyArray<{
    id: string;
    title: string;
    startMs: number;
    endMs: number;
  }>;
  interactivityLevel?: 'view-only' | 'chapter-select' | 'full-interactive';
}
```

### 1.2 의미있는 체험 (Meaningful Engagement)

단순 도달이 아니라 **`minWatchMs` 이상 머문 체험** 만 의미있다고 간주:

```
미디어 M (contentDurationMs=300s, minWatchMs=60s)

방문객 V1: 35초 본 후 떠남     → 도달 O, 의미있는 체험 X
방문객 V2: 75초 본 후 떠남     → 도달 O, 의미있는 체험 O (부분)
방문객 V3: 300초 풀 시청        → 도달 O, 의미있는 체험 O (완주)

reachRate = 3/3 = 100%
meaningfulCompletionRate = 2/3 = 67%
fullCompletionRate = 1/3 = 33%
```

### 1.3 처리량 (Throughput)

시간당 의미있는 체험 인원:

```
시뮬 시간: 3 시간
미디어 M 의 의미있는 체험: 240 명

throughputPerHour = 240 / 3 = 80
```

### 1.4 컨텐츠 스킵률 (Content Skip Rate)

`contentDurationMs` 대비 조기 이탈 비율:

```
방문객 V 가 미디어 M 에서 머문 시간: 35초
contentDurationMs: 300초
skip 시점: 35/300 = 11.7%

contentSkipRate = mean of (1 - actualDwellMs / contentDurationMs)
                  단, actualDwellMs >= minWatchMs 인 경우만 (의미있는 체험 중 조기 이탈)
```

→ 0% 면 모두 풀 시청, 50% 면 평균 절반에서 떠남.

### 1.5 인터랙션 깊이 영향

`interactivityLevel` 에 따라 시뮬 동작 변화:
- `view-only`: 단순 시청 (PASSIVE 모드와 동일)
- `chapter-select`: 평균 시청 길이 30% 단축, skip 률 20% 감소 (자기 관심사만 본다)
- `full-interactive`: 평균 시청 길이 +50%, capacity 2/3 (한 명이 더 오래)

---

## 2. 도메인 모델

### 2.1 DigitalMediaProps 확장 (Phase 0 + 추가)

```ts
// src/domain/types/media.ts (확장)

export type InteractivityLevel = 'view-only' | 'chapter-select' | 'full-interactive';

export interface MediaChapter {
  readonly id: string;
  readonly title: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface DigitalMediaProps {
  // Phase 0 정의
  readonly contentDurationMs?: number;
  readonly minWatchMs?: number;
  readonly loopable?: boolean;
  // Phase 3B 추가
  readonly chapters?: ReadonlyArray<MediaChapter>;
  readonly interactivityLevel?: InteractivityLevel;
}
```

### 2.2 신규 KPI 타입

```ts
// src/domain/types/kpi.ts (확장)

export interface DigitalMediaKpi {
  readonly avgMeaningfulCompletionRate: number;   // 0-1
  readonly avgFullCompletionRate: number;
  readonly avgThroughputPerHour: number;
  readonly avgContentSkipRate: number;
  readonly avgWatchDurationMs: number;
  readonly insightDeliveryScore: number;          // 컨텐츠 정보량 가중 (선택)
  readonly mediaDetail: ReadonlyArray<{
    exhibitId: string;
    name: string;
    interactivityLevel: InteractivityLevel;
    contentDurationMs: number;
    reachRate: number;
    meaningfulCompletionRate: number;
    fullCompletionRate: number;
    throughputPerHour: number;
    avgWatchMs: number;
    skipRate: number;
    capacityUtilization: number;
  }>;
}
```

### 2.3 Variant 타입 (Phase 3A 와 공유)

```ts
// src/domain/types/variant.ts (Phase 3A 에서 정의됨)

variantType: 'artwork-placement' | 'digital-media' | 'operations' | 'layout';

// digital-media variant 의 delta 예시:
{
  exhibitChanges: [
    { exhibitId: 'mw_1', field: 'contentDurationMs', oldValue: 300000, newValue: 120000 },
    { exhibitId: 'mw_1', field: 'interactivityLevel', oldValue: 'view-only', newValue: 'chapter-select' },
    { exhibitId: 'mw_1', field: 'capacity', oldValue: 5, newValue: 15 },
  ]
}
```

→ Phase 3A 의 `VariantManager` / `VariantDelta` 그대로 재사용.

---

## 3. 모듈 설계

### 3.1 DigitalMediaAnalyzer (신규)

위치: `src/analytics/calculators/digitalMedia.ts`

```ts
export class DigitalMediaAnalyzer {
  compute(
    visitors: ReadonlyArray<Visitor>,
    exhibits: ReadonlyArray<MediaPlacement>,
    engagementHistory: ReadonlyArray<EngagementEvent>,
    simDurationMs: number,
  ): DigitalMediaKpi;

  /** 미디어별 throughput 계산 */
  private computeThroughput(
    events: EngagementEvent[],
    minWatchMs: number,
    simDurationMs: number,
  ): number;

  /** 컨텐츠 스킵률 (의미있는 체험 중 조기 이탈) */
  private computeContentSkipRate(
    events: EngagementEvent[],
    contentDurationMs: number,
    minWatchMs: number,
  ): number;
}
```

### 3.2 EngagementBehavior 수정

위치: `src/simulation/behavior/EngagementBehavior.ts`

기존 skip 판단 로직에 `minWatchMs` 추가:
- 현재: 평균 engagement 시간 + skip threshold 로 판단
- 변경: `minWatchMs` 가 정의된 미디어는 그 값을 "최소 의미있는 체험" 으로 해석
- 영향: skip rate 측정의 정확도 향상

`interactivityLevel` 에 따른 시뮬 동작:
- `view-only`: 기존 PASSIVE 모드 그대로
- `chapter-select`: `avgEngagementTimeMs` × 0.7 적용, skip 확률 20% 감소
- `full-interactive`: `avgEngagementTimeMs` × 1.5 적용, capacity × 0.67

### 3.3 시뮬레이션 엔진 영향

- `EngagementBehavior` 에서 위 분기 추가
- 신규 invariant 없음
- 회귀 방지: `interactivityLevel` 미설정 → `view-only` (기존 동작)

---

## 4. UI / UX Flow

### 4.1 디지털 미디어 메타 입력 (MediaEditor 확장)

```
┌── 디지털 미디어 속성 (passive_media 카테고리) ──┐
│                                                  │
│ 컨텐츠 길이:    [05:00]  m:s                    │
│ 의미있는 체험: [01:00]  m:s (최소 시청 시간)    │
│ 루프 재생:      ☑ 가능                          │
│                                                  │
│ 인터랙션 수준: ● 시청 전용 (view-only)          │
│                ○ 챕터 선택 가능                 │
│                ○ 풀 인터랙티브                  │
│                                                  │
│ ┌─ 챕터 (선택) ─────────────────────────────┐  │
│ │ + 챕터 추가                                │  │
│ │ • 인트로     [00:00 - 01:00]  [편집][삭제] │  │
│ │ • 본문 1     [01:00 - 03:00]              │  │
│ │ • 본문 2     [03:00 - 05:00]              │  │
│ └────────────────────────────────────────────┘  │
│                                                  │
│ ⚠️ 의미있는 체험 시간이 컨텐츠 길이의 20% 이하   │
│    (실 효과 의문)                                │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 4.2 경험 변형 비교 워크플로우

#### 4.2.1 Variant fork (Phase 3A 와 공유 진입점)

비교 모드에서 variant type 으로 "디지털 미디어 경험" 선택 → 변형 생성.

#### 4.2.2 변형 편집 모드

베이스에서 디지털 미디어의 다음 속성만 편집 가능:
- contentDurationMs
- minWatchMs
- interactivityLevel
- capacity
- engagementMode (PASSIVE / ACTIVE / STAGED)

위치 변경 X (Phase 3A 영역).

#### 4.2.3 결과 비교 화면

위치: `src/ui/panels/analytics/DigitalMediaComparison.tsx` (신규)

```
컨텐츠: "전시 소개 영상"
                       경험 A         경험 B          경험 C
                    (5분 PASSIVE)  (2분 PASSIVE)  (5분 STAGED)
─────────────────────────────────────────────────────────────
도달률                  82%            85%            76%
의미있는 완주율         32%            68%            89%   ✓
완전 완주율             18%            45%            87%   ✓
평균 시청 시간          2.1 min        1.8 min        4.7 min
컨텐츠 스킵률           58%            32%            6%    ✓
처리량 (시간당)         42 명          78 명   ✓     28 명
혼잡 발생               중             낮음           높음 (대기열)
capacity 활용률         55%            38%            92%   ✓
─────────────────────────────────────────────────────────────
종합 점수              0.62          0.71          0.84   ✓
                       ━━━━━━━ 추천 ━━━━━━━

권장 사용처:
  · 통과 위치 → 경험 B (짧게 압축, 처리량 우수)
  · 메인 컨텐츠 → 경험 C (STAGED 세션, 깊은 체험)
─────────────────────────────────────────────────────────────
```

#### 4.2.4 미디어별 drill-down

미디어 한 점 클릭 → 변형별 세부 KPI:
```
"전시 소개 영상"
                    경험 A      경험 B      경험 C
시청 분포           --█▆▄▂      ▂▄█▆▂      ████▆▄
(0~100% 구간)
시청 분포 mean      28%         52%         87%
도달 후 즉시 이탈   45%         18%         3%
재시청률            1.2x        2.1x        n/a (1회)
대기 시간 평균      0           0           1.3 min
```

### 4.3 정책 vs 경험 비교 매트릭스 (고급)

운영 정책 (Phase 1) × 디지털 미디어 경험 (Phase 3B) 의 2 차원 비교:

```
                      capacity 5    capacity 15    capacity 30
─────────────────────────────────────────────────────────────
시설 200명 cap        만족 0.65     만족 0.78      만족 0.72
시설 300명 cap        만족 0.52     만족 0.68      만족 0.74
시설 무제한           만족 0.41     만족 0.55      만족 0.62
─────────────────────────────────────────────────────────────
        ✓ 최적: 시설 200명 cap × capacity 15
```

(고급 기능, Phase 3B 후반에 시도)

---

## 5. 시뮬레이션 엔진 영향

### 5.1 EngagementBehavior 변경

기존:
```ts
// 단순 평균 시간 + skip threshold
const skipChance = (waitTime / engagement.avgTime) > skipThreshold ? ...
```

변경:
```ts
// minWatchMs 와 interactivityLevel 반영
const effectiveAvgTime = engagement.avgTime * interactivityMultiplier(interactivityLevel);
const effectiveCapacity = engagement.capacity * capacityMultiplier(interactivityLevel);

// 시청 시간 결정
const dwellTime = sampleDwellTime(effectiveAvgTime, profile);

// 의미있는 체험 여부 (minWatchMs 기준)
visitor.engagement.recordWatch(mediaId, dwellTime, dwellTime >= minWatchMs);
```

### 5.2 변경 영향 분석

- 기존 시나리오 (interactivityLevel 미설정) → view-only (기존 동작)
- 회귀 0
- 새 KPI 는 옵션 (minWatchMs 미설정 시 fullCompletionRate 만 보고)

### 5.3 EngagementEvent 데이터 확장

```ts
interface EngagementEvent {
  // 기존
  visitorId, mediaId, startMs, endMs;
  // 신규
  isMeaningful?: boolean;     // dwellMs >= minWatchMs
  completionRatio?: number;    // dwellMs / contentDurationMs
}
```

---

## 6. 미해결 이슈 / 결정 필요 사항

| # | 이슈 | 제안 | 결정 시점 |
|---|------|-----|---------|
| 1 | `minWatchMs` 자동 추정 (contentDurationMs × 0.2) | 자동 제안값 + 사용자 override | 본 spec |
| 2 | 챕터 모델 시뮬 반영? | Phase 3B 는 표시/분석만, 시뮬 step 영향 X | 본 spec |
| 3 | `interactivityLevel` 의 multiplier 값 검증 | 기본값 (chapter:0.7×0.8, full:1.5×0.67), 백서 case study | Phase 3B 종료 후 |
| 4 | insightDeliveryScore 의 컨텐츠 정보량 입력 | 큐레이터 1-5 입력 (기본 3) | 본 spec |
| 5 | Immersive 카테고리 (VR/AR/4D) 도 본 Phase? | YES — Immersive 는 Digital Media 의 특수 케이스로 흡수 | 본 spec |
| 6 | STAGED 미디어의 슬롯 변경 비교 | 본 Phase 에 포함 (engagementMode 도 변형 차원) | 본 spec |
| 7 | "정책 × 경험" 매트릭스 비교 비용 | 4 정책 × 4 경험 = 16 시뮬, 백그라운드 5-15분 | Phase 3B 후반 |

---

## 7. 작업 항목 + Estimate

```
[A] DigitalMediaProps 확장 + Chapter 모델 (0.5 일)
├─ chapters, interactivityLevel 타입 추가
├─ 도메인 export
└─ 단위 테스트

[B] DigitalMediaKpi + DigitalMediaAnalyzer (1.5 일)
├─ 타입 정의
├─ 5 종 메트릭 계산 (meaningful completion, throughput, content skip, ...)
├─ capacity utilization 계산
├─ 미디어별 breakdown
└─ 단위 테스트

[C] EngagementBehavior 수정 (1 일)
├─ minWatchMs 반영
├─ interactivityLevel multiplier
├─ EngagementEvent 확장 (isMeaningful, completionRatio)
└─ 회귀 테스트

[D] MediaEditor 강화 (1 일)
├─ 컨텐츠 길이 / minWatchMs 입력
├─ Chapter 편집기
├─ interactivityLevel 라디오
├─ 자동 추정 (minWatchMs = contentDurationMs × 0.2)
└─ 의미있는 체험 비율 경고

[E] Variant 비교 모드 (Phase 3A 진입점 재사용, 0.5 일)
├─ digital-media variant type 분기
├─ 편집 가능 필드 제한 (위치 X, 경험 속성만)
└─ 잔상 시각화 X (위치 변경 없으니)

[F] DigitalMediaComparison 결과 화면 (2 일)
├─ 변형 비교 테이블
├─ 자동 추천 (가중 점수)
├─ 미디어별 drill-down
├─ 시청 분포 그래프
└─ 권장 사용처 자동 산출

[G] (선택) 정책 × 경험 매트릭스 (1 일)
├─ Phase 1 + Phase 3B 결합 비교
├─ N×M 시뮬 그리드
└─ 최적 셀 자동 추천

[H] 검증 / 통합 테스트 (1 일)
├─ 샘플 시나리오 (5 디지털 미디어, 3 변형)
├─ KPI 계산 검증 + 회귀 테스트
└─ 성능 검증

[I] 문서 / 백서 (0.5 일)
├─ CLAUDE.md 업데이트
├─ 백서 의미있는 체험 / interactivity multiplier 섹션
└─ Phase 3B retrospective

총합: 약 9 일 = 1.8 주 (버퍼 포함, [G] 제외)
순작업: 약 7 일 = 1.4 주
```

### 7.2 Definition of Done

- [ ] DigitalMediaProps 확장 (chapters, interactivityLevel)
- [ ] 5 종 Digital Media KPI 계산 + 표시
- [ ] EngagementBehavior 가 minWatchMs / interactivityLevel 반영
- [ ] Variant 비교 동작 (digital-media variant type)
- [ ] DigitalMediaComparison 화면 + 자동 추천
- [ ] 미디어별 drill-down + 시청 분포 그래프
- [ ] 회귀 0 (메타 미설정 시 = 기존 동작)
- [ ] CLAUDE.md / 백서 업데이트
- [ ] (옵션) 정책 × 경험 매트릭스

---

## 8. 결정 / 확정 사항

본 spec 작성 시점 (2026-04-25) 확정:

1. ✅ `minWatchMs` 가 의미있는 체험 기준
2. ✅ `interactivityLevel` 3 단계 + multiplier 모델
3. ✅ Chapter 는 표시/분석만, 시뮬 영향 X
4. ✅ Immersive 카테고리는 Digital Media 의 특수 케이스로 흡수 (Phase 3C 분리 X)
5. ✅ engagementMode 변경도 디지털 미디어 variant 차원에 포함
6. ✅ Variant Manager 는 Phase 3A 와 공유
7. ✅ EngagementBehavior 수정 (회귀 0 보장)
8. ✅ 정책 × 경험 매트릭스는 옵션 (Phase 3B 후반)

---

## 부록 — 사용자 통찰 인용

- "디지털 미디어의 경우는 체험시간이나 경험의 방법 (인터랙티브냐? 일반 관람이냐?)"
- "공간 설계 하면서 미디어 배치가 어떤게 좋은지 비교"

본 Phase 는 **경험 자체의 형식** (시간/구조/인터랙션) 비교에 집중. 위치 비교는 Phase 3A.
