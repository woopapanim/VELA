# Phase 3A Spec — 작품 큐레이션 워크플로우

**작성일**: 2026-04-25
**선행 조건**: Phase 0 완료 (ArtworkProps: curatorialOrder / series / significance)
**병렬 가능**: Phase 3B (디지털 미디어 경험 설계)
**Estimate**: 1.5 주

---

## 0. 동기 / 배경

### 0.1 풀어야 할 질문

> "작품(전시물) 을 어디에, 어떤 순서로 걸 것인가? 시리즈를 어떻게 묶을 것인가?"

작품은 디지털 미디어와 본질이 다름:
- **순서가 핵심**: 회화 시리즈는 "1990 → 2020 시간순" vs "주제순" vs "임팩트 우선" 의도가 명확
- **시리즈 응집**: 같은 작가의 작품들이 분리되면 큐레이터 의도 파괴
- **대표작 (hero) 차등 운영**: 모든 작품을 평등하게 다루지 않음

기존 KPI (평균 체류, 도달률) 만으로는 큐레이터의 "의도 검증" 불가:
- 의도된 순서로 봤는가? → **순서 충실도** 필요
- 시리즈를 통째 봤는가? → **시리즈 완주율** 필요
- 대표작에 충분히 머물렀는가? → **hero 추적** 필요
- 동선이 꼬였는가? → **back-tracking** 검출

### 0.2 사용자 통찰

> "전시물 관점에서는 배치 비교 (작품 위치 순서도 영향이 크니까)"

→ Phase 3A 의 핵심: **위치 + 순서** 변형 비교 + **순서 의도 검증** KPI.

---

## 1. 핵심 개념 정의

### 1.1 작품 메타데이터 (Phase 0 정의 활용)

```ts
interface ArtworkProps {
  curatorialOrder?: number;        // 시리즈 내 의도 순서 (1-based)
  series?: string;                  // 시리즈 그룹 키
  significance?: 'hero' | 'support' | 'context';
}
```

### 1.2 시리즈 (Series)

같은 큐레이터 의도 단위로 묶인 작품 집합:
- 글로벌 키 (zone 넘나들 수 있음)
- 예: "조선시대 회화", "작가 A 시리즈", "전쟁 사진"
- 한 작품은 1 시리즈만 소속 (다중 소속 X — Phase 3A 단순화)
- 시리즈 내 순서: `curatorialOrder` 1-based 정수

### 1.3 비중 (Significance) 3 등급

| 등급 | 의미 | KPI 가중 | UI 강조 |
|------|-----|--------|--------|
| `hero` | 대표작 — 전시 정체성, 모든 관람객이 봐야 할 작품 | 3.0 | 별 아이콘 + 골드 외곽선 |
| `support` | 핵심 지지 — 시리즈를 구성하는 주요 작품 | 1.0 | 기본 표시 |
| `context` | 보조 맥락 — 보면 좋지만 필수 아닌 작품 | 0.3 | 흐릿한 표시 |

### 1.4 핵심 KPI 정의

#### `curatorialOrderFidelity` — 순서 충실도

시리즈 내 작품을 **의도된 순서대로** 본 비율:

```
방문객 V 가 시리즈 S 에서 본 작품들의 실제 순서:
  [A1, A2, A4, A3, A5]   (curatorialOrder 기준)

종속 시퀀스 — 의도된 순서 부분집합:
  [A1, A2, A4, A5]       ← 4개 (A3 만 어긋남)

V 의 시리즈 S 에 대한 fidelity: 4 / 5 = 0.80

전체 fidelity = mean(visitor × series) of {fidelity}
```

기술적: Longest Increasing Subsequence (LIS) of curatorialOrder ÷ 본 작품 수.

#### `seriesCompletionRate` — 시리즈 완주율

한 시리즈의 모든 작품을 본 관람객 비율:

```
시리즈 S 의 작품 수: 8
방문객 V 가 본 시리즈 S 작품 수: 7
V 의 시리즈 S 완주: false (1 작품 누락)

전체 completionRate = (시리즈 통째 본 인원) / (해당 시리즈 1 작품 이상 본 인원)
```

#### `heroReachRate` / `heroDwellMs`

- `heroReachRate`: significance='hero' 작품에 도달한 관람객 비율
- `heroDwellMs`: hero 작품 평균 체류 시간

#### `backtrackRate` — 역방향 비율

이전 zone (또는 이전 작품) 으로 되돌아간 이동 비율:
```
방문객 V 의 이동 시퀀스 (zone): [Z1, Z2, Z3, Z2, Z4]
역방향 이동: Z3 → Z2 (1 회)

backtrackRate = backtrackCount / totalTransitions
```

높으면 동선 꼬임 = 레이아웃/순서 설계 실패 신호.

---

## 2. 도메인 모델 — Phase 0 + 추가

### 2.1 Phase 0 에서 정의된 ArtworkProps 그대로 사용

```ts
// src/domain/types/media.ts (Phase 0 에서 추가됨)
export interface ArtworkProps {
  readonly curatorialOrder?: number;
  readonly series?: string;
  readonly significance?: 'hero' | 'support' | 'context';
}
```

### 2.2 신규 KPI 타입

```ts
// src/domain/types/kpi.ts (확장)

export interface ArtworkKpi {
  readonly curatorialOrderFidelity: number;       // 0-1
  readonly seriesCompletionRate: number;          // 0-1
  readonly heroReachRate: number;
  readonly heroAvgDwellMs: number;
  readonly heroSkipRate: number;
  readonly backtrackRate: number;
  readonly avgArtworksViewedPerVisitor: number;
  readonly seriesBreakdown: ReadonlyArray<{
    seriesKey: string;
    avgFidelity: number;
    completionRate: number;
    artworkCount: number;
  }>;
  readonly artworkDetail: ReadonlyArray<{
    exhibitId: string;
    name: string;
    significance: 'hero' | 'support' | 'context';
    reachRate: number;
    avgDwellMs: number;
    skipRate: number;
  }>;
}
```

### 2.3 Variant fork 모델 (Phase 3A/3B 공유)

```ts
// src/domain/types/variant.ts (신규, Phase 3A/3B 공유)

export interface ScenarioVariant {
  readonly id: string;
  readonly baseScenarioId: string;
  readonly name: string;
  readonly variantType: 'artwork-placement' | 'digital-media' | 'operations' | 'layout';
  readonly delta: VariantDelta;
  readonly createdAt: number;
}

export interface VariantDelta {
  /** 변경된 exhibit (위치/속성 차이) */
  readonly exhibitChanges?: ReadonlyArray<{
    exhibitId: string;
    field: 'position' | 'curatorialOrder' | 'series' | 'significance' | 'orientation';
    oldValue: any;
    newValue: any;
  }>;
  /** 추가/삭제된 exhibit */
  readonly exhibitAdded?: ReadonlyArray<string>;
  readonly exhibitRemoved?: ReadonlyArray<string>;
}
```

→ 베이스 시나리오 + delta 만 저장 (전체 복제 X). 스토리지 효율 + diff 명확.

---

## 3. 모듈 설계

### 3.1 ArtworkAnalyzer (신규)

위치: `src/analytics/calculators/artwork.ts`

```ts
export class ArtworkAnalyzer {
  /** 시뮬 결과 + scenario 의 Artwork 메타로 KPI 산출 */
  compute(
    visitors: ReadonlyArray<Visitor>,
    exhibits: ReadonlyArray<MediaPlacement>,
    engagementHistory: ReadonlyArray<EngagementEvent>,
  ): ArtworkKpi;

  /** 시리즈별 fidelity 계산 (LIS 알고리즘) */
  private computeSeriesFidelity(
    visitedArtworks: Array<{ id: string; curatorialOrder: number }>,
  ): number;

  /** 역방향 이동 검출 */
  private computeBacktrack(path: ReadonlyArray<ZoneId>): number;
}
```

### 3.2 VariantManager (신규, Phase 3A/3B 공유)

위치: `src/comparison/VariantManager.ts`

```ts
export class VariantManager {
  /** 베이스에서 fork — 변형 ID 생성 + delta 저장 */
  fork(base: Scenario, name: string, variantType: VariantType): ScenarioVariant;

  /** delta 적용 → 실제 시나리오 복원 */
  materialize(base: Scenario, variant: ScenarioVariant): Scenario;

  /** 두 변형 간 diff (UI 표시용) */
  diff(a: Scenario, b: Scenario): VariantDelta;

  /** 변형 그룹 한꺼번에 시뮬 실행 */
  runAll(variants: ScenarioVariant[]): Promise<MultiVariantResult>;
}
```

### 3.3 시뮬레이션 엔진 영향

**없음**. ArtworkProps 메타데이터는 시뮬 step 에 영향 없음. KPI 계산만 추가.

단, `EngagementBehavior` 가 `significance: 'hero'` 작품에 대해 attractiveness 가중을 줄지 검토:
- 결정: **검토 X**. `mustVisit` 와 직교 유지 (Phase 0 결정 재확인). `significance` 는 KPI/UI 표시용만.
- 큐레이터가 hero 강제 관람을 원하면 `mustVisit: true` 사용.

---

## 4. UI / UX Flow

### 4.1 Artwork 메타 입력 (MediaEditor 확장)

Phase 0 에서 MediaEditor 에 카테고리별 섹션 추가됨. Phase 3A 에서 강화:

```
┌── 작품 속성 (analog 카테고리) ──────────────┐
│                                              │
│ 시리즈:        [조선시대 회화 ▾] [+ 새로 만들기] │
│ 시리즈 내 순서: [3] / 8                      │
│ 비중:          ○ 보조 맥락                   │
│                ● 핵심 지지                   │
│                ○ 대표작 (hero)               │
│                                              │
│ ┌─ 시리즈 미리보기 ──────────────────────┐  │
│ │ 조선시대 회화 (8 작품)                  │  │
│ │ 1. 풍속도 (zone A)  ★                   │  │
│ │ 2. 산수화 (zone A)                      │  │
│ │ 3. 인물화 (zone B)  ← 현재              │  │
│ │ 4. 화조도 (zone B)                      │  │
│ │ ...                                      │  │
│ │                                          │  │
│ │ ⚠️ 순서 3→4 가 zone 변경: 동선 비효율  │  │
│ └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 4.2 시리즈 관리 패널 (신규)

위치: `src/ui/panels/build/SeriesPanel.tsx` (신규)

- 모든 시리즈 목록 + 작품 수
- 시리즈 클릭 → 작품 순서 드래그로 재정렬
- 시리즈 zone 분포 시각화 (작품 위치 미리보기)
- 시리즈 색상 부여 (캔버스에서 동일 시리즈 색상 외곽선)

### 4.3 변형 비교 워크플로우 (Variant Comparison)

#### 4.3.1 Variant fork

위치: BuildTools 또는 Welcome 진입점에 "비교 모드" 버튼

```
┌── 작품 배치 비교 모드 ──────────────────────┐
│                                              │
│ 베이스: "신규 전시 v1"                       │
│                                              │
│ 변형 목록:                                   │
│  • 변형 A: 시간순 배치 [편집] [실행] [삭제]   │
│  • 변형 B: 주제순 배치 [편집] [실행] [삭제]   │
│  • 변형 C: 임팩트 우선 [편집] [실행] [삭제]   │
│  [+ 새 변형 추가]                            │
│                                              │
│ [모두 실행 (병렬, ~3분)]                     │
│                                              │
└──────────────────────────────────────────────┘
```

#### 4.3.2 변형 편집 모드

- 베이스 시나리오 위에서 작품만 옮기기 가능
- 변경한 작품은 캔버스에 잔상 표시 (이전 위치 회색)
- 다른 변형의 작품 위치도 옅게 오버레이 (참고)
- 변경 사항 = delta 자동 저장

#### 4.3.3 결과 비교 화면

위치: `src/ui/panels/analytics/ArtworkComparison.tsx` (신규)

```
                          변형 A        변형 B        변형 C
                       (시간순)      (주제순)      (임팩트)
─────────────────────────────────────────────────────────────
순서 충실도            87%           52%           71%
대표작 도달률          91%           88%           97%   ✓
대표작 평균 체류        2.1 min       2.4 min       1.8 min
시리즈 완주율          74%   ✓       41%           63%
역방향 비율            8%    ✓       22%           15%
평균 작품 관람 수       6.2           4.8           7.1   ✓
─────────────────────────────────────────────────────────────
종합 점수 (가중합)     0.78  ✓       0.51         0.69
                       ━━━━━━━ 추천 ━━━━━━━
시리즈별 분석:
  · 조선시대 회화      A: 89% / B: 35% / C: 72%
  · 현대 미술          A: 81% / B: 78% / C: 65%
─────────────────────────────────────────────────────────────
```

#### 4.3.4 작품별 상세 (drill-down)

작품 한 점 클릭 → 변형별 KPI:
```
"풍속도" (hero)
                     변형 A    변형 B    변형 C
도달률              94%       97%       98%
평균 체류            3.2 min   2.1 min   2.5 min
스킵률              6%        12%       4%
시리즈 내 위치       1/8       3/8       5/8
주변 혼잡도         낮음      높음      중
```

### 4.4 캔버스 시각화 강화

- significance='hero' 작품: 골드 외곽선 + 별 아이콘
- 같은 시리즈 작품: 동일 색상 외곽선 (시리즈별 자동 색)
- curatorialOrder 표시 옵션: 작품 위에 작은 숫자 라벨

---

## 5. 시뮬레이션 엔진 영향

### 5.1 변경 없음

- ArtworkProps 메타데이터는 step 로직에 영향 없음
- EngagementBehavior 변경 없음
- KPI 계산만 추가

### 5.2 EngagementHistory 데이터 요구

`ArtworkAnalyzer` 가 시리즈 fidelity 계산하려면 visitor 의 engagement 시퀀스 필요. 현재:
- `Visitor.engagementHistory: EngagementEvent[]` 가 있는지 확인 필요
- 없거나 부족 시 Phase 3A 작업 [A] 에 추가

### 5.3 회귀 방지

- ArtworkProps 미설정 작품 → fidelity 계산 시 제외
- `series` 미설정 → "uncategorized" 시리즈로 묶음 (KPI 표시는 별도)

---

## 6. 미해결 이슈 / 결정 필요 사항

| # | 이슈 | 제안 | 결정 시점 |
|---|------|-----|---------|
| 1 | 시리즈 다중 소속 (한 작품이 2 시리즈) | Phase 3A 는 단일 소속만, 다중 소속 backlog | 본 spec |
| 2 | `curatorialOrder` 자동 추론 (zone 진입 + 위치) | 자동 제안 옵션 (Phase 3A 후반), 수동 입력 우선 | Phase 3A 후반 |
| 3 | hero 작품에 attractiveness 가중? | 직교 유지 (mustVisit 사용), 본 spec | 본 spec |
| 4 | 종합 점수 가중치 | 기본 (fidelity 0.3 / completion 0.25 / hero 0.2 / backtrack 0.15 / 평균관람 0.1), 사용자 조정 가능 | 본 spec |
| 5 | LIS 계산 비용 (방문객 × 시리즈) | O(n log n) — 500 visitor × 10 series × 평균 8 작품 = 충분히 빠름 | 본 spec |
| 6 | 변형 동시 실행 수 한계 | 4 (Phase 1 의 Worker pool 재사용) | 본 spec |
| 7 | 변형 delta 충돌 (베이스 변경 후) | 베이스 변경 시 변형 invalidate + warning | 본 spec |

---

## 7. 작업 항목 + Estimate

```
[A] EngagementHistory 검증 + 보강 (1 일)
├─ Visitor 의 engagement 시퀀스 데이터 확인
├─ 부족 시 SimEngine 에 기록 추가
└─ 단위 테스트

[B] ArtworkKpi 타입 + ArtworkAnalyzer (1.5 일)
├─ 타입 정의
├─ LIS 알고리즘 구현 + 테스트
├─ 5 종 메트릭 계산 (fidelity, completion, hero reach/dwell, backtrack)
├─ 시리즈별 / 작품별 breakdown
└─ 단위 테스트

[C] VariantManager (1.5 일)
├─ fork / materialize / diff / runAll
├─ delta 모델 구현
├─ 베이스 변경 시 invalidate 로직
└─ 단위 테스트

[D] MediaEditor 강화 (1 일)
├─ 시리즈 선택 + 새로 만들기
├─ curatorialOrder 자동 다음번호 제안
├─ 시리즈 미리보기 (현재 작품 위치)
└─ 동선 비효율 경고

[E] SeriesPanel UI (1 일)
├─ 시리즈 목록 + 작품 수
├─ 드래그 재정렬
├─ 시리즈 색상 부여
└─ zone 분포 시각화

[F] 변형 비교 모드 진입점 (1 일)
├─ BuildTools 에 "비교 모드" 버튼
├─ Variant 목록 + fork
├─ 변형 편집 모드 (잔상 표시)
└─ 모두 실행 (Worker pool)

[G] ArtworkComparison 결과 화면 (2 일)
├─ 변형 비교 테이블
├─ 자동 추천 (가중 점수)
├─ 시리즈별 breakdown
├─ 작품별 drill-down
└─ 차이 하이라이트

[H] 캔버스 시각화 강화 (0.5 일)
├─ Hero 골드 외곽선
├─ 시리즈 색상
└─ curatorialOrder 라벨 토글

[I] 검증 / 통합 테스트 (1 일)
├─ 샘플 시나리오 (3 시리즈, 24 작품, 3 변형)
├─ KPI 계산 검증
├─ 회귀 테스트
└─ 성능 (4 변형 동시 시뮬 < 60s)

[J] 문서 / 백서 (0.5 일)
├─ CLAUDE.md 업데이트
├─ 백서 LIS / fidelity 공식 섹션
└─ Phase 3A retrospective

총합: 약 11 일 = 2.2 주 (버퍼 포함)
순작업: 약 7.5 일 = 1.5 주
```

### 7.2 Definition of Done

- [ ] 작품 시리즈/순서/비중 입력 가능
- [ ] 5 종 Artwork KPI 계산 + 표시
- [ ] Variant fork + 동시 실행 (4 까지)
- [ ] ArtworkComparison 화면 + 자동 추천
- [ ] 시리즈별 / 작품별 drill-down
- [ ] 캔버스 시각화 강화 (hero, 시리즈 색상)
- [ ] 회귀 0 (ArtworkProps 미설정 시 = 기존 동작)
- [ ] CLAUDE.md / 백서 업데이트

---

## 8. 결정 / 확정 사항

본 spec 작성 시점 (2026-04-25) 확정:

1. ✅ Series 단일 소속 (Phase 3A), 다중 소속은 backlog
2. ✅ Significance 3 등급 (hero / support / context), KPI 가중
3. ✅ curatorialOrderFidelity = LIS / 본 작품 수
4. ✅ Hero 와 mustVisit 직교 (Phase 0 결정 재확인)
5. ✅ Variant = base + delta (전체 복제 X)
6. ✅ 동시 실행 4 변형 (Worker pool)
7. ✅ 종합 점수 기본 가중 (사용자 조정 가능)
8. ✅ 시뮬 엔진 변경 없음 (KPI 계산만 추가)

---

## 부록 — 사용자 통찰 인용

- "전시물 관점에서는 배치 비교 (작품 위치 순서도 영향이 크니까)"
- "공간 설계 하면서 미디어 배치가 어떤게 좋은지 비교"
