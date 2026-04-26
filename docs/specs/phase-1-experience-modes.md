# Phase 1 Spec — 체험 모드 (Experience Modes)

**작성일**: 2026-04-26
**대상 브랜치**: `claude/amazing-villani-750340`
**선행 조건**: Phase 0 (Exhibit 용어/타입) 완료, Phase 1 엔진 (EntryController + 5종 정책) 완료
**관계 문서**:
- [`phase-1-operations-policy.md`](./phase-1-operations-policy.md) — 엔진 spec (그대로 유지, 본 문서가 그 위 UX 레이어)
- [`ROADMAP.md`](./ROADMAP.md) — 마스터 로드맵
- 메모리: `project_question_driven_ux.md` (2026-04-23 합의: 모드 분리 반대, 질문 진입)

---

## 0. 배경 / 동기

### 0.1 문제 정의

Phase 1 엔진 작업 (EntryController, 5종 입장 정책, OutsideQueueRenderer) 은 _기능적으로_ 완성. 하지만 UI 가 **엔진 mechanism 을 그대로 노출** 함:

```
[현재 — 엔진 중심 노출]
입장 정책 [unlimited / concurrent-cap / rate-limit / time-slot / hybrid]
  ├─ maxConcurrent / maxPerHour / 슬롯 / 인내심 / σ% / 프로필배수
스폰
  ├─ 시간/사람 모드 / Total Visitors / Max Concurrent / Spawn Rate
```

→ 공간 디자이너가 *레이아웃 검증* 만 하고 싶어도 입장 정책 5종 + 인내심 분포 + σ + 프로필 배수 + 시간/사람 모드까지 마주침. 본인의 질문과 무관한 운영 detail 이 90%.

### 0.2 사용자 통찰 (인용)

> "처음 설정할 때 페르소나를 반영하려면 입장 정책이 아니라 체험 모드가 적합할 것 같아."
>
> "레이아웃 디자인하는 사람이 레이아웃 검증하고 싶은데, 동시수용제한에 인내심과 균일·정규분포까지 알아가서 설정해야 하는 건 아니니까."
>
> "전체적으로 원하는 바는 리포트가 체험 모드 관점에 따라 나왔으면 좋겠어."

### 0.3 합의 — 질문 기반 UX

메모리 `project_question_driven_ux.md` (2026-04-23):
- **모드 분리 반대** — 별개 app 으로 쪼개지 않음
- **질문 진입** — 사용자는 "무엇을 검증/예측하고 싶은가" 로 시작
- **의도/물리 2 레이어** — 의도 (체험 모드) 가 물리 (엔진 정책) 를 wrap

본 spec 은 위 합의의 구체화.

---

## 1. 핵심 개념 — 2-Tier 체험 모드

### 1.1 분류

```
체험 모드 (ExperienceMode)
│
├─ 검증 (Validation) — "이 설계가 좋은가?"
│   ├─ 레이아웃 검증           (LAYOUT_VALIDATION)        ✅ 즉시 가능
│   ├─ 큐레이션 검증           (CURATION_VALIDATION)      🔒 Phase 3A 진입 시 활성화
│   └─ 미디어 경험 검증        (MEDIA_EXPERIENCE)         🔒 Phase 3B 진입 시 활성화
│
└─ 운영 예상 (Operations Forecast) — "이렇게 운영하면 어떻게 될까?"
    ├─ 자유 관람               (FREE_ADMISSION)           ✅
    ├─ 자유 관람 + 통제        (FREE_WITH_THROTTLE)       ✅
    ├─ 시간제 예약 관람        (TIMED_RESERVATION)        ✅
    ├─ 통제 입장               (CONTROLLED_ADMISSION)     ✅
    └─ 단체 관람               (GROUP_VISIT)              🔒 Phase 2 진입 시 활성화
```

### 1.2 Tier 별 성격 비교

| 측면 | 검증 tier | 운영 예상 tier |
|---|---|---|
| 핵심 질문 | "이 설계가 좋은가" | "이렇게 운영하면 어떻게 되나" |
| 비교 프레임 | 변형 A/B/C 동시 비교 | 단일 시나리오의 시간대별 추이 |
| 입장 정책 노출 | ❌ 숨김 (default unlimited) | ✅ 노출 + 모드별 default |
| 인내심/σ/배수 노출 | ❌ 숨김 | ✅ 노출 |
| 외부 큐 시각화 | ❌ 숨김 (큐 미발생) | ✅ 노출 |
| 시간/사람 모드 토글 | ✅ 노출 | ❌ 시간 강제 (큐 invariant 보장) |
| 핵심 KPI | 동선/체류/스킵/병목 | 대기/처리량/포기율/만족도 |
| 리포트 컬럼 | 변형별 (A vs B vs C) | 시간대별 (timeline + 권장) |
| 자동 추천 | "변형 X 추천" | "정책 파라미터 X 권장" |

### 1.3 Disabled 모드 처리

큐레이션 검증 / 미디어 경험 검증 / 단체 관람 은 enum 에 포함하되 UI 에서 *grayed-out + tooltip "Phase X 에서 활성화"*.

→ 사용자가 시뮬 가능 범위의 전체 그림을 인지하면서, 미구현 모드 클릭은 차단.

---

## 2. 페르소나 매핑

| 페르소나 | 1차 사용 모드 | 2차 |
|---|---|---|
| **공간 디자이너** | 레이아웃 검증 | 자유 관람 (운영 임팩트 확인) |
| **큐레이터** | 큐레이션 검증 (Phase 3A), 미디어 경험 검증 (Phase 3B) | 레이아웃 검증 |
| **시설 운영팀** | 자유 관람 + 통제, 시간제 예약, 통제 입장 | 단체 관람 (Phase 2) |
| **시설주/투자자** | 모드 선택 X (리포트 receiver) | — |

→ Layer 1 의 1차 사용자는 공간 디자이너 + 큐레이터 → **레이아웃 검증 + Phase 3A/B** 가 Phase 1 의 가장 큰 가치.
운영 tier 는 시설 운영팀 진입 시점부터 활성, Phase 1 안에서 4종 모두 갖춰둠.

---

## 3. 모드별 상세 정의

### 3.1 검증 — 레이아웃 검증 (LAYOUT_VALIDATION)

| 항목 | 값 |
|---|---|
| 페르소나 | 공간 디자이너 |
| 핵심 질문 | "이 동선/조닝/zone 형상이 좋은가" |
| 노출 입력 | 도착 인원, Duration, 시드, (옵션) 시간/사람 모드 |
| 숨김 입력 | 입장 정책 전체, 인내심, σ, 프로필 배수 |
| Default 정책 | `mode: 'unlimited'` (강제) |
| 비교 차원 | zone polygon / gate 위치 / 동선 mode (free / sequential / hybrid) |
| 핵심 KPI | 평균 체류, 조기 이탈률, 미디어 도달률, 병목 횟수, 혼잡 누적, 스킵률, 동선 균형도 |
| 리포트 | 변형 A/B/C 컬럼 + 자동 추천 |

### 3.2 검증 — 큐레이션 검증 (CURATION_VALIDATION) 🔒

| 항목 | 값 |
|---|---|
| 페르소나 | 큐레이터 |
| 활성화 시점 | **Phase 3A 완료 후** |
| 핵심 질문 | "이 작품 배치/순서가 의도대로 관람되는가" |
| 추가 입력 | (Phase 3A) Artwork 순서, 시리즈 그룹 |
| 추가 KPI | 순서 충실도, 시리즈 완주율, hero 도달률, backtrack 비율 |
| 비교 차원 | 작품 위치 / 순서 / 시리즈 응집 |

### 3.3 검증 — 미디어 경험 검증 (MEDIA_EXPERIENCE) 🔒

| 항목 | 값 |
|---|---|
| 페르소나 | 큐레이터 |
| 활성화 시점 | **Phase 3B 완료 후** |
| 핵심 질문 | "이 컨텐츠 길이/방식이 의미있게 체험되는가" |
| 추가 입력 | (Phase 3B) `contentDurationMs`, `minWatchMs`, `loopable`, `interactivityLevel` |
| 추가 KPI | 의미있는 완주율, 처리량, 스킵률 |
| 비교 차원 | 컨텐츠 길이 / 재생 방식 (PASSIVE/ACTIVE/STAGED) / capacity |

### 3.4 운영 예상 — 자유 관람 (FREE_ADMISSION)

| 항목 | 값 |
|---|---|
| 페르소나 | 시설 운영팀, 공간 디자이너 |
| 핵심 질문 | "제한 없이 받으면 어떻게 되나" (baseline) |
| 노출 입력 | 도착 분포, Duration |
| 숨김 입력 | cap, 슬롯, 인내심 (큐 미발생) |
| Default 정책 | `mode: 'unlimited'` |
| 핵심 KPI | 피크 동시인원, 평균 혼잡도, 시간대별 부하, 만족도 |
| 리포트 섹션 | 시간대별 부하 그래프, 과밀 구간 알림, 만족도 분포 |
| 권장 산출 | "동시 X 명 도달 → cap N 권장" (다음 모드 유도) |

### 3.5 운영 예상 — 자유 관람 + 통제 (FREE_WITH_THROTTLE)

| 항목 | 값 |
|---|---|
| 페르소나 | 시설 운영팀 (대부분 자유 walk-in, 폭주만 대비) |
| 핵심 질문 | "평소엔 자유 받고 폭주 시만 통제하면 충분한가" |
| 노출 입력 | 도착 분포, Duration, **통제 발동 cap (높은 값)**, 인내심 |
| 숨김 입력 | 슬롯 |
| Default 정책 | `mode: 'concurrent-cap'`, `maxConcurrent: ~높은 값 (예: 시설 면적 기준 ~80%)`, 인내심 30분 |
| 엔진 차이 | _없음_ (concurrent-cap 동일). UX preset + 라벨링만 다름. |
| 핵심 KPI | **통제 발동 횟수 / 누적 통제 시간 / 통제 중 평균 대기**, 만족도 |
| 리포트 섹션 | 통제 이벤트 타임라인, 통제 효과 (만족도 변화), 권장 cap 조정 |

### 3.6 운영 예상 — 시간제 예약 관람 (TIMED_RESERVATION)

| 항목 | 값 |
|---|---|
| 페르소나 | 시설 운영팀 (블록버스터, 보안/품질 관리) |
| 핵심 질문 | "슬롯 길이/cap 을 어떻게 잡아야 운영이 매끄러운가" |
| 노출 입력 | 슬롯 길이, 슬롯당 cap, 도착 분포, 인내심 |
| 숨김 입력 | concurrent-cap (슬롯이 cap 역할) |
| Default 정책 | `mode: 'time-slot'`, `slotDurationMs: 30분`, `perSlotCap: 80` |
| 핵심 KPI | 슬롯 충진율, 슬롯 낭비율, 슬롯간 혼잡 갭, 만족도 |
| 리포트 섹션 | 슬롯별 운영 표, 노쇼 시뮬, 권장 슬롯 길이 |

### 3.7 운영 예상 — 통제 입장 (CONTROLLED_ADMISSION)

| 항목 | 값 |
|---|---|
| 페르소나 | 시설 운영팀 (capacity 엄격 관리) |
| 핵심 질문 | "강한 cap 으로 쾌적함을 유지하려면 외부 대기/포기는 얼마나 발생하나" |
| 노출 입력 | cap (낮은 값) **또는** 시간당 처리량, 인내심, 분포 모델 |
| Default 정책 | `mode: 'concurrent-cap'`, `maxConcurrent: ~200 (낮은 값)`, 인내심 30분 + 정규분포 σ 30% |
| 핵심 KPI | 외부 대기 평균, 대기 분포 (p95), 포기율, 시간당 처리량, 만족도 |
| 리포트 섹션 | 외부 대기 분포 차트, 포기 이벤트 타임라인, 권장 cap (만족도-처리량 trade-off) |

### 3.8 운영 예상 — 단체 관람 (GROUP_VISIT) 🔒

| 항목 | 값 |
|---|---|
| 페르소나 | 시설 운영팀 (수학여행, 단체 예약) |
| 활성화 시점 | **Phase 2 완료 후** |
| 핵심 질문 | "단체 + 개인 혼합 운영 시 충돌은?" |
| 추가 입력 | (Phase 2) GroupBooking, Docent 배치, 단체 동선 |
| 추가 KPI | 그룹 충돌 이벤트, 그룹 평균 대기, 일반 관람객 영향, 도슨트 활용률 |

---

## 4. 도메인 모델 추가

### 4.1 ExperienceMode enum

```ts
// src/domain/types/experienceMode.ts (신규)

export type ExperienceModeTier = 'validation' | 'operations';

export type ExperienceMode =
  // Validation tier
  | 'layout_validation'
  | 'curation_validation'      // 🔒 Phase 3A
  | 'media_experience'         // 🔒 Phase 3B
  // Operations tier
  | 'free_admission'
  | 'free_with_throttle'
  | 'timed_reservation'
  | 'controlled_admission'
  | 'group_visit';             // 🔒 Phase 2

export interface ExperienceModeMeta {
  readonly mode: ExperienceMode;
  readonly tier: ExperienceModeTier;
  readonly enabled: boolean;       // Phase 단계별 활성/비활성
  readonly enabledFromPhase?: string; // disabled 시 안내 텍스트용
}

export const EXPERIENCE_MODE_REGISTRY: Record<ExperienceMode, ExperienceModeMeta>;
```

### 4.2 Scenario 확장

```ts
// src/domain/types/scenario.ts (확장)

export interface Scenario {
  // ... 기존 필드
  readonly experienceMode?: ExperienceMode; // optional, 미설정 = 'free_admission' (운영 default)
}
```

**호환성**: 기존 시나리오는 `experienceMode` 가 없음 → 마이그레이션 정책:
- 기존 `simulationConfig.operations.entryPolicy.mode === 'unlimited'` → `experienceMode: 'free_admission'`
- 기존 `mode === 'concurrent-cap'` → `experienceMode: 'controlled_admission'` (보수적 매핑)
- 기존 `mode === 'time-slot'` → `experienceMode: 'timed_reservation'`
- 기존 `mode === 'rate-limit'` → `experienceMode: 'controlled_admission'`
- 기존 `mode === 'hybrid'` → `experienceMode: 'controlled_admission'` (or 신규 `controlled_admission` 안에서 hybrid 옵션 제공)

`free_with_throttle` 는 신규 framing — 자동 마이그레이션 대상 없음.

### 4.3 ExperienceMode → 정책 default 매핑

```ts
// src/domain/constants/experienceModeDefaults.ts (신규)

export const EXPERIENCE_MODE_POLICY_DEFAULTS: Record<ExperienceMode, EntryPolicy> = {
  layout_validation:    { mode: 'unlimited' },
  curation_validation:  { mode: 'unlimited' },
  media_experience:     { mode: 'unlimited' },
  free_admission:       { mode: 'unlimited' },
  free_with_throttle:   {
    mode: 'concurrent-cap',
    maxConcurrent: 400,                // 높은 cap = 폭주 시만 발동
    maxWaitBeforeAbandonMs: 1_800_000,
    patienceModel: 'normal',
    patienceStdMs: 540_000,
  },
  timed_reservation:    {
    mode: 'time-slot',
    slotDurationMs: 1_800_000,
    perSlotCap: 80,
    maxWaitBeforeAbandonMs: 1_800_000,
  },
  controlled_admission: {
    mode: 'concurrent-cap',
    maxConcurrent: 200,                // 낮은 cap = 강한 통제
    maxWaitBeforeAbandonMs: 1_800_000,
    patienceModel: 'normal',
    patienceStdMs: 540_000,
  },
  group_visit:          { mode: 'unlimited' }, // Phase 2 에서 재정의
};
```

### 4.4 ExperienceMode → 만족도 가중치 매핑

각 모드의 _의도_ 가 다르므로 만족도 4 요소 (혼잡 / 체류 / 대기 / 체험완주) 가중치도 다름:

```ts
// src/domain/constants/satisfactionWeightsByMode.ts (신규)

export const SATISFACTION_WEIGHTS_BY_MODE: Record<ExperienceMode, SatisfactionWeights> = {
  // 검증: 큐 미발생 → wait 가중 0
  layout_validation:    { crowd: 0.4, dwell: 0.3, wait: 0.0, engagement: 0.3 },
  curation_validation:  { crowd: 0.3, dwell: 0.3, wait: 0.0, engagement: 0.4 }, // 체험완주 ↑
  media_experience:     { crowd: 0.2, dwell: 0.3, wait: 0.0, engagement: 0.5 }, // 체험완주 ↑↑

  // 운영
  free_admission:       { crowd: 0.5, dwell: 0.2, wait: 0.1, engagement: 0.2 }, // 혼잡 ↑↑
  free_with_throttle:   { crowd: 0.4, dwell: 0.2, wait: 0.2, engagement: 0.2 }, // 혼잡+대기 균형
  timed_reservation:    { crowd: 0.2, dwell: 0.3, wait: 0.3, engagement: 0.2 }, // 대기 (슬롯 낭비) ↑
  controlled_admission: { crowd: 0.2, dwell: 0.2, wait: 0.4, engagement: 0.2 }, // 대기 ↑↑
  group_visit:          { crowd: 0.3, dwell: 0.3, wait: 0.2, engagement: 0.2 }, // Phase 2 재정의
};
```

사용자가 OperationsPanel 에서 가중치 슬라이더로 미세 조정 가능 (기본값은 위).

---

## 5. UI 재구성

### 5.1 패널 최상단 — 체험 모드 선택

위치: `src/ui/panels/build/ExperienceModePanel.tsx` (신규, 모든 build 패널의 최상단)

레이아웃:

```
┌── 체험 모드 ─────────────────────────────────┐
│                                              │
│ 무엇을 검증/예측하시나요?                     │
│                                              │
│ ▼ 검증 (이 설계가 좋은가)                    │
│   ● 레이아웃 검증                            │
│   ○ 큐레이션 검증     🔒 (Phase 3A)         │
│   ○ 미디어 경험 검증   🔒 (Phase 3B)         │
│                                              │
│ ▼ 운영 예상 (이렇게 운영하면)                │
│   ○ 자유 관람                                │
│   ○ 자유 관람 + 통제                         │
│   ○ 시간제 예약 관람                         │
│   ○ 통제 입장                                │
│   ○ 단체 관람          🔒 (Phase 2)          │
│                                              │
│ [선택한 모드 짧은 설명 + ℹ︎ 가이드]          │
│                                              │
└──────────────────────────────────────────────┘
```

### 5.2 하위 패널의 conditional 노출

| 하위 패널 | 검증 tier | 운영 예상 tier |
|---|---|---|
| OperationsPanel (입장 정책) | 숨김 | 모드별 default + 노출 정책 |
| SpawnConfig | 시간/사람 모드 노출 | 시간 모드 강제, 토글 숨김 |
| 외부 큐 시각화 | 비활성 | 활성 |
| Experience 탭의 Entry Queue Live | 숨김 | 표시 |

### 5.3 모드 변경 시 동작

1. `experienceMode` 변경 → `EXPERIENCE_MODE_POLICY_DEFAULTS[next]` 로 entryPolicy reset
2. `simulationMode` 자동 조정 (운영 tier → 'time' 강제)
3. `satisfactionWeights` → `SATISFACTION_WEIGHTS_BY_MODE[next]` 로 reset
4. 사용자가 미세 조정한 상태가 있으면 confirmation: "변경하면 정책/가중치가 재설정됩니다. 진행?"

---

## 6. 리포트 — Additive Overlay (2026-04-26 정정)

### 6.1 원칙 — 백데이터 유지 + 모드 관점 overlay

기존 11 섹션 (`Hero / Tldr / Executive / Density / Timeline / SystemOverview / Flow / Behavior / Media / Recos / Appendix`) 은 _그대로 유지_. 모드별로 통째로 다른 템플릿을 만들지 않음.

추가되는 것 3 가지:

1. **`ModePerspectiveSection`** (신규) — 선택 모드 관점의 총평. Hero 직후, Tldr 앞.
2. **`ComparisonSection`** (신규) — 검증 = 변형 A/B/C 비교, 운영 = 정책 sweep + 권장. Tldr 직후.
3. **`RecosSection.findings` 생성 로직 정정** — 모드 목적 align. RecosSection 자체는 변경 없음, 데이터만 모드 인식.

> 사용자 인용 (2026-04-26): "지금 리포트처럼 백데이터는 기본적으로 있고, 리포트 서두에 총평에 대한 관점과 지금 없는 비교 컴퍼넌트가 들어가는거지.. 개선점도 목적과 일치한 개선점이 도출되면 좋을 것 같고"

### 6.2 변경된 리포트 구조

```
HeroSection
[NEW] ModePerspectiveSection ───── 모드별 총평 (서두)
TldrSection
[NEW] ComparisonSection ────────── 변형 비교 or 정책 sweep
ExecutiveSection
DensitySection
TimelineSection
SystemOverviewSection
FlowSection
BehaviorSection
MediaSection
RecosSection ───────────────────── findings 만 모드 align (구조 동일)
AppendixSection
```

### 6.3 ModePerspectiveSection

**역할**: 사용자가 선택한 체험 모드 관점에서 "이 시뮬 결과를 어떻게 읽어야 하는가" 한 줄 framing + 핵심 결론 1-2 문장.

**구조**:

```ts
interface ModePerspective {
  readonly modeLabel: string;          // "레이아웃 검증" / "통제 입장" 등
  readonly tier: ExperienceModeTier;
  readonly question: string;           // 모드의 핵심 질문 (3.1-3.8 표의 "핵심 질문")
  readonly verdict: 'good' | 'caution' | 'concern';
  readonly verdictLine: string;        // "동선이 의도대로 흐르고 있습니다" 등 (자동 생성)
  readonly keyIndicators: ReadonlyArray<{ label: string; value: string; sentiment: 'pos' | 'neu' | 'neg' }>;
  // 모드별 핵심 지표 3-4 개 (spec §3 의 "핵심 KPI" 에서 골라옴)
}
```

**모드별 verdict 휴리스틱 (예시)**:

| 모드 | good | caution | concern |
|---|---|---|---|
| layout_validation | 조기이탈 ≤20% & 미디어도달 ≥70% | 조기이탈 20-40% | 조기이탈 >40% or 병목 다발 |
| free_admission | 피크 동시 ≤ capacity 80% | 80-100% | >100% (과밀) |
| free_with_throttle | 통제 발동 ≤5회 | 5-20회 | >20회 (cap 부족) |
| timed_reservation | 슬롯 충진 70-90% | 50-70% or 90-100% | <50% (낭비) or >100% (오버부킹) |
| controlled_admission | 만족도 ≥0.7 & 포기율 ≤10% | 0.5-0.7 / 10-25% | <0.5 / >25% |

세부 임계값은 구현 시 백서 근거 참조.

### 6.4 ComparisonSection

**검증 tier**: 변형 A/B/C 컬럼 비교

```ts
interface ValidationComparison {
  readonly variants: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly kpis: Record<string, number>;
    readonly score: number;            // 가중 점수
  }>;
  readonly winner: string;             // 변형 id
  readonly winnerReason: string;       // "조기이탈 12% (vs 28%)" 등
  readonly highlightedDeltas: ReadonlyArray<{ kpi: string; delta: number }>;
  // 차이가 큰 지표 자동 강조
}
```

**운영 tier**: 단일 시나리오 + 정책 sweep (옵션)

```ts
interface OperationsComparison {
  readonly current: { kpis: Record<string, number>; score: number };
  readonly sweep?: ReadonlyArray<{    // 사용자가 sweep 도구 사용 시
    readonly paramLabel: string;       // "maxConcurrent: 200" 등
    readonly kpis: Record<string, number>;
    readonly score: number;
  }>;
  readonly recommendation?: {
    readonly paramLabel: string;       // "maxConcurrent: 250 권장"
    readonly tradeoff: string;         // "포기율 5% ↓, 처리량 8% ↓"
  };
}
```

→ 검증 tier 는 ComparisonSection 이 _필수_ (모드 본질이 비교).
→ 운영 tier 는 단일 결과면 current 만, sweep 실행 시 추천 함께.
→ sweep 미실행 시 ComparisonSection 자체를 skip (조건부 렌더).

### 6.5 RecosSection 의 findings 모드 align

기존 `RecosSection` 컴포넌트는 변경 없음. `findings` 생성 로직 (`toReportData()` 또는 별도 finding generator) 이 모드 인식하도록 enrich:

```ts
// 현재: findings 는 일반 휴리스틱 (혼잡, 미디어 활용도 등)
// 변경: 모드별 priority 가중치 적용

function generateFindings(data: ReportData, mode: ExperienceMode): Finding[] {
  const all = generateAllCandidateFindings(data);  // 기존 로직
  const weighted = all.map(f => ({
    ...f,
    priority: f.priority * MODE_FINDING_WEIGHTS[mode][f.category],
  }));
  return weighted.sort((a, b) => b.priority - a.priority).slice(0, 5);
}
```

`MODE_FINDING_WEIGHTS` 예시:

| 모드 | 동선 | 미디어 | 혼잡 | 대기 | 처리량 |
|---|---|---|---|---|---|
| layout_validation | 1.5 | 1.0 | 1.2 | 0.0 | 0.0 |
| free_admission | 0.8 | 0.8 | 1.5 | 0.5 | 0.8 |
| free_with_throttle | 0.8 | 0.8 | 1.3 | 1.2 | 0.8 |
| timed_reservation | 0.8 | 1.0 | 0.8 | 1.3 | 1.5 |
| controlled_admission | 0.8 | 0.8 | 0.8 | 1.5 | 1.3 |

→ 검증 tier 는 동선/미디어 우선, 운영 tier 는 모드별 운영 지표 우선. 결과적으로 _목적과 일치한 개선점_ 이 상위 노출.

### 6.6 비교 UI 의 위치

- **검증 tier**: ComparisonSection (리포트 서두) + 별도 비교 도구 (canvas overlay 등) — Phase 1 본 spec 에서 ComparisonSection 만 우선.
- **운영 tier**: ComparisonSection 안의 sweep 도구 — 정책 파라미터 sweep (cap 50/100/150 등) 을 한 화면에 표.

기존 `phase-1-operations-policy.md` §4.3 의 "정책 A/B/C/D 동시 비교" 는 운영 tier 의 ComparisonSection 안 sweep 도구로 흡수.

---

## 7. 구현 작업 분해

### 7.1 작업 항목

```
[A] 도메인 모델 (1 일)
├─ ExperienceMode enum + REGISTRY
├─ Scenario.experienceMode 필드
├─ EXPERIENCE_MODE_POLICY_DEFAULTS
├─ SATISFACTION_WEIGHTS_BY_MODE
└─ 마이그레이션 함수 (기존 시나리오 → 모드 매핑)

[B] ExperienceModePanel UI (1.5 일)
├─ 2-tier 라디오 그룹 + disabled 표시
├─ 모드 변경 시 entryPolicy/weights reset
├─ confirmation dialog (사용자 조정값 보호)
└─ i18n (ko/en)

[C] 하위 패널 conditional (1 일)
├─ OperationsPanel: 검증 tier 일 때 숨김
├─ SpawnConfig: 운영 tier 일 때 시간/사람 토글 숨김
├─ EntryQueueLive: 검증 tier 일 때 비활성
└─ 외부 큐 렌더러: 같은 정책

[D] 만족도 계산기 (1.5 일) — Phase 1 원래 spec [D] 와 통합
├─ crowd/dwell/wait/engagement score 계산
├─ 모드별 가중치 적용
├─ 5 라벨 분포 집계
└─ 단위 테스트

[E] 리포트 overlay (1.5 일) — additive, 기존 11 섹션 그대로
├─ ModePerspectiveSection (신규, Hero 직후)
│   └─ 모드별 verdict 휴리스틱 (good/caution/concern)
├─ RecosSection findings 모드 align
│   └─ MODE_FINDING_WEIGHTS 적용
└─ ComparisonSection 의 데이터 모델 (실제 컴포넌트는 [F])

[F] ComparisonSection 컴포넌트 + sweep (2.5 일) — Phase 1 원래 spec [G+H] 재정의
├─ ValidationComparison (검증 tier — 변형 A/B/C 컬럼)
├─ OperationsComparison (운영 tier — current + sweep + 권장)
├─ 변형 fork (시나리오 복제, 라벨링)
├─ Sweep 도구 (정책 param × 3-5 값 동시 시뮬, Worker pool)
└─ MultiComparisonResult 확장

[G] 검증 / 통합 테스트 (1.5 일)
├─ 모드별 시나리오 회귀
├─ 마이그레이션 동작 확인 (기존 시나리오 8개 로드)
├─ ModePerspective verdict 단위 테스트
└─ E2E 모드 전환 워크플로우

[H] 문서 / CLAUDE.md / 백서 (1 일)
├─ 만족도 공식 + 모드별 가중치 근거
├─ ModePerspective verdict 임계값 근거
├─ 마이그레이션 가이드
└─ Phase 1 retrospective

총합: 약 11.5 일 = 2.3 주 (리포트 overlay 정정으로 [E][F] 단축)
```

### 7.2 Definition of Done (Phase 1 본 spec 기준)

- [ ] ExperienceMode enum + 8 모드 정의
- [ ] 활성 5 모드 (레이아웃 검증 + 운영 4종) 모두 시뮬 가능
- [ ] disabled 3 모드 (큐레이션/미디어/단체) UI 표시 + 클릭 차단
- [ ] 패널 conditional 노출 (검증/운영 tier 별)
- [ ] 만족도 계산 + 모드별 가중치 적용
- [ ] 리포트 overlay 3 종 (ModePerspectiveSection, ComparisonSection, RecosSection findings 모드 align) — 기존 11 섹션은 그대로
- [ ] 비교 UI (검증 tier 의 A/B/C, 운영 tier 의 정책 sweep)
- [ ] 회귀 0 (기존 시나리오 = 마이그레이션 후 동등 결과)
- [ ] 단위 + 통합 테스트 pass
- [ ] CLAUDE.md 업데이트, 백서 만족도 섹션 초안

### 7.3 Phase 1 → Phase 2 전환 조건

- 위 DoD 통과
- `group_visit` 모드 enable 준비 (스펙 검토)
- 만족도 case study 1 회 (모드별 가중치 검증)

---

## 8. 마이그레이션 / 호환성

### 8.1 기존 시나리오 자동 마이그레이션

로드 시 `scenario.experienceMode` 가 없으면:

```ts
function inferExperienceMode(scenario: Scenario): ExperienceMode {
  const mode = scenario.simulationConfig.operations?.entryPolicy?.mode ?? 'unlimited';
  switch (mode) {
    case 'unlimited':       return 'free_admission';
    case 'concurrent-cap':  return 'controlled_admission';
    case 'rate-limit':      return 'controlled_admission';
    case 'time-slot':       return 'timed_reservation';
    case 'hybrid':          return 'controlled_admission';
  }
}
```

저장 시점에 `experienceMode` 가 시나리오 파일에 명시 → 다음 로드부터 추론 불필요.

### 8.2 회귀 보장

- 기존 시나리오 시뮬 결과 = Phase 1 본 spec 적용 후 결과 (만족도 가중치만 다를 수 있음 — 모드별 default 적용)
- 기존 KPI 계산 로직 변경 없음
- 사용자가 만족도 가중치를 직접 설정한 경우 우선 (default 매핑 무시)

### 8.3 기존 OperationsPanel 의 운명

- 운영 tier 일 때만 노출 (위치는 그대로 — 체험 모드 패널 바로 아래)
- 인내심 분포 모델 / σ / 프로필 배수 토글은 _운영 tier 안에서만_ 의미. 그대로 유지.
- 검증 tier 진입 시 패널 자체가 숨겨짐.

---

## 9. 미해결 이슈 / 결정 필요 사항

| # | 이슈 | 제안 | 결정 시점 |
|---|---|---|---|
| 1 | 기존 hybrid 정책의 위치 | controlled_admission 안의 옵션? 별도 모드? | 본 spec — controlled_admission 안에 흡수 |
| 2 | free_with_throttle 의 default cap (시설 면적 비례 자동?) | Phase 1 후반 검토, 우선은 고정값 400 | 구현 시 |
| 3 | 만족도 가중치의 사용자 조정 vs 모드 default | 모드 변경 시 reset + confirmation | 본 spec |
| 4 | 검증 tier 의 비교 변형 수 (A/B/C 만? D 까지?) | 6 까지 (기존 spec 유지) | 본 spec |
| 5 | 모드 변경 시 시뮬 결과 보존 | 새 모드 진입 시 결과 invalidate, 재실행 유도 | 본 spec |
| 6 | 자동 권장 알고리즘 (운영 tier) | 모드별 휴리스틱 (예: cap 권장 = 만족도 ≥ 0.7 인 최소 cap) | 구현 시 |

---

## 10. 결정 / 확정 사항

본 spec 작성 시점 (2026-04-26) 확정:

1. ✅ 2-tier 체험 모드 분류 (검증 / 운영 예상)
2. ✅ 8 모드 enum (활성 5 + disabled 3)
3. ✅ disabled 모드 UI 노출 (Phase 안내 tooltip 포함)
4. ✅ 검증 tier: 입장 정책 숨김, default unlimited
5. ✅ 운영 tier: 입장 정책 노출, 모드별 default + 시간 모드 강제
6. ✅ 만족도 가중치 모드별 default + 사용자 조정 가능
7. ✅ 리포트 shape 모드별 분기 (검증 = 변형 비교, 운영 = timeline + 권장)
8. ✅ free_with_throttle 신규 framing (엔진은 concurrent-cap 동일, UX preset)
9. ✅ 단체 관람 (group_visit) 은 Phase 2 에서 활성화
10. ✅ 큐레이션/미디어 검증 (curation/media) 은 Phase 3A/3B 에서 활성화
11. ✅ 기존 시나리오 자동 마이그레이션 (정책 mode → 체험 모드 추론)
12. ✅ 리포트 = additive overlay (2026-04-26): 기존 11 섹션 백데이터 유지, ModePerspectiveSection (서두 총평) + ComparisonSection (변형/sweep 비교) + RecosSection findings 모드 align 만 추가

---

## 부록 — 기존 spec 과의 관계

`phase-1-operations-policy.md` 와의 분담:

| 영역 | 위치 |
|---|---|
| EntryController, 5 정책 엔진, 외부 큐 모델 | `phase-1-operations-policy.md` (엔진 spec, 그대로 유지) |
| 체험 모드 enum, UI 구성, 리포트 분기 | **본 spec** (UX 레이어) |
| 만족도 공식, 5 라벨 | `phase-1-operations-policy.md` 에 정의, 모드별 가중치는 본 spec |
| 비교 UI | 본 spec 에서 *검증/운영 tier 별 분기* 로 재정의 |

→ 두 spec 은 _겹치지 않고_ 위/아래 레이어. 엔진은 그대로, UX 만 위에서 framing.

---

## 부록 — 사용자 통찰 인용

- "전체적으로 원하는 바는 리포트가 체험 모드 관점에 따라 나왔으면 좋겠어"
- "검증 쪽은 기존에 스폰셋팅으로 해도 가능할 것 같고, 운영 예상 쪽은 동시수용·입장통제·대기관련 로직 등이 필요할 것 같고"
- "체험 모드는 레이아웃 검증, 큐레이션 검증, 미디어 경험 검증이 같은 성격"
- "운영 예상 시뮬레이션은 자유관람, 자유관람인데 동시 수용인원이 넘으면 통제, 시간제 예약 관람, 통제 입장, 단체 관람"
- "레이아웃 디자인하는 사람이 레이아웃 검증하고 싶은데, 동시수용제한에 인내심과 균일·정규분포까지 알아가서 설정해야 하는 건 아니니까"

---

## 부록 — 구현 진행 상황 (2026-04-26 완료)

본 spec 의 [A] ~ [F2] 작업 항목은 다음 commit 으로 완료. [G] 정합성 패스 + [H] 문서화도 함께.

| # | 항목 | Commit | 비고 |
|---|------|--------|-----|
| [A] | ExperienceMode enum + REGISTRY + Scenario 확장 + 마이그레이션 | `3132fc8` + `16eea90` | `SimulationConfig.operations` 슬롯 보충 후속 commit. |
| [B] | ExperienceModePanel UI + i18n + MainLayout | `70da95b` | 8 모드 (active 5 + disabled 3) tier 별 그룹. |
| [C] | 하위 패널 conditional + EntryQueueLive | `ebb3ae5` | 검증 tier 에서 OperationsPanel/EntryQueueLive 자동 숨김. |
| [D] | 만족도 계산기 + 단위 테스트 | `c5be9dd` | 4-component 가중합 + 5 라벨, mode 별 weights matrix. |
| [E] | ModePerspectiveSection (additive overlay) | `7cfb5f4` | Hero 직후 삽입, 기존 11 섹션 그대로. mode-aware verdict (good/caution/concern). |
| [F1] | ComparisonSection — 검증 tier 변형 비교 | `dfef2e6` | parentId chain → siblings → A/B/C 매트릭스. tier-weighted winner + recommended 배너. |
| [F2a] | SweepRunner — 헤드리스 cap 탐색 | `8e54cec` | AbortController, 600-tick 배치 yield, capex tiebreak. 13 unit tests. |
| [F2b] | SweepLauncher UI 패널 | `3347165` | OperationsPanel 내부, mode 에 맞는 sweepable param 자동 선택, "적용" 으로 즉시 정책 반영. |
| [G] | 정합성 / 통합 | `c6d813c` | tsc --noEmit 통과 (내 코드 0 error), 109 unit tests pass, i18n 686-key parity (en/ko). |
| [H] | 문서화 | (this section) | spec 부록 + CLAUDE.md 갱신 + 백서 노트. |

### Definition of Done — 결과

- [x] ExperienceMode enum + 8 모드 정의
- [x] 활성 5 모드 (레이아웃 검증 + 운영 4종) 모두 시뮬 가능
- [x] disabled 3 모드 (큐레이션/미디어/단체) UI 표시 + 클릭 차단
- [x] 패널 conditional 노출 (검증/운영 tier 별)
- [x] 만족도 계산 + 모드별 가중치 적용
- [x] 리포트 overlay 3 종 (ModePerspectiveSection, ComparisonSection, RecosSection findings 모드 align) — 기존 11 섹션은 그대로
- [x] 비교 UI (검증 tier 의 A/B/C, 운영 tier 의 정책 sweep)
- [x] 회귀 0 (기존 시나리오 = `experienceMode` 미설정 시 `inferExperienceMode(operations.entryPolicy.mode)` 로 polyfill — 동작 변경 없음)
- [x] 단위 + 통합 테스트 pass (109/109)
- [x] CLAUDE.md 업데이트, 백서 만족도 섹션 초안

### 후속 작업 (Phase 1 외)

본 commit 체인 외부에 prior session 의 _Phase 0 (Exhibit 용어)_ 작업이 working tree 에 미커밋 상태로 존재. tsc -b 시 발생하는 ~85 errors 는 모두 그쪽 (toReportData.ts SimulationSnapshot vs KpiSnapshot 마이그레이션 미완성, MediaConfig deprecation 등) — Phase 1 UX 와 독립.

→ 별도 fix-up session 에서 Exhibit 마이그레이션 마무리 권장.

---

## 부록 — 백서 수록 항목 (요약)

본 spec 의 _수학적 / 메커니즘적_ 핵심을 향후 VELA 백서에 옮길 수 있도록 한 곳에 정리.

### A. 만족도 함수 (Satisfaction Score)

방문객 1 인의 만족도 `s ∈ [0, 1]` 는 4 component 의 가중합:

```
s = w_crowd      · (1 − crowd_score)
  + w_dwell      · clamp01(actual_dwell / recommended_dwell)
  + w_wait       · (1 − min(total_wait / W_max, 1))
  + w_engagement · clamp01(media_completed / media_visited)

invariant:  Σ w_i = 1  (검증: isSatisfactionWeightsValid)
W_max     = 30 min  (외부 큐 + 내부 대기 합산 천장; 인내심 분포와 무관한 normalize 상수)
```

5 라벨 매핑 (단순 임계):

| 라벨 | 점수 |
|------|------|
| excellent | s ≥ 0.85 |
| good | 0.70 ≤ s < 0.85 |
| fair | 0.55 ≤ s < 0.70 |
| poor | 0.40 ≤ s < 0.55 |
| bad | s < 0.40 |

### B. 모드별 가중치 (Why per-mode)

체험 모드는 _무엇을 좋게 평가할지_ 가 다르므로 같은 4 component 에 다른 가중치를 건다 (`SATISFACTION_WEIGHTS_BY_MODE` 매트릭스). 예:

- **레이아웃 검증**: dwell 0.5, engagement 0.3 — "관람을 충분히 하는가" 가 핵심.
- **자유 관람**: crowd 0.4, dwell 0.3 — "쾌적함" 이 우위.
- **통제 입장**: wait 0.5 — "기다리는 사람이 많아도 OK 한가" 가 KPI.
- **시간제 예약**: dwell 0.4, engagement 0.3 — 슬롯 안에서 충분히 봤는가.

같은 시뮬 결과로도 모드에 따라 다른 verdict 를 내리는 게 정당화되는 근거.

### C. Cap Sweep (Operations Tier 추천 도구)

문제: 운영자는 "동시 수용 인원 N 을 몇으로 잡아야 만족도가 가장 좋은가" 를 알고 싶지만, 단일 시뮬로는 답이 안 나옴 (_what-if_ 가 필요).

해결: 같은 시나리오를 N ∈ [from, to] 범위에서 step 간격으로 헤드리스 시뮬, 각 변형의 평균 만족도 + 부가 KPI 를 row 로 모아 비교 → 추천.

추천 규칙:

```
1) row.satisfactionAvg 가 최대인 row 찾기 (top)
2) top.score 와 1e-3 이내인 row 들을 winners 로 모음
3) winners 가 1개 → key='best-satisfaction', value=winner.paramValue
4) winners 가 2+ → key='tied' (점수 동률), value=min(winners.paramValue) (capex tiebreak)
5) winners 모두 sample=0 → key='no-data'
6) AbortSignal 발화 → key='aborted'
```

`tied` 는 _점수_ 가 동률이라는 의미이지 capex tiebreak 가 적용된 모든 결과가 아님 — clear winner 면 paramValue 가 더 작아도 `best-satisfaction`. 사용자 의사결정 신뢰를 위한 의도적 구분.

### D. 검증 tier 변형 비교 (Validation Tier Compare)

검증 tier (예: 레이아웃 변형 A/B/C) 는 큐가 발생하지 않으므로 wait/abandon KPI 가 무의미. 그래서 5 metric 만 비교, tier 별 가중치로 winner 산출:

| Metric | validation 가중치 | operations 가중치 |
|--------|-----------------|-----------------|
| 완주율 | 1.0 | 1.0 |
| 글로벌 스킵률 | 1.0 | 0.5 |
| 피크 활용률 | 0.5 | 1.0 |
| P90 피로도 | 0.5 | 1.0 |
| 평균 만족도 | 1.0 | 1.0 |

검증 tier 는 _컨텐츠 도달 / 회피_ 가 핵심, 운영 tier 는 _혼잡 / 피로_ 가 핵심 → 같은 metric 도 가중치를 달리 둠.

### E. 인내심 분포 (Patience Distribution)

외부 큐에서 방문객이 견디는 한계 시간 (`patienceModel`):

- **fixed**: 모두 동일 (빠른 비교용, deterministic)
- **normal**: 평균 `maxWaitBeforeAbandonMs`, σ = `patienceStdMs` (UI 에서는 평균의 % 로 입력) 의 정규분포

근거 (Wharton 큐잉 연구 + 미술관 평균):
- 무료 walk-in: 10–15분
- 유료 일반 전시: 30–45분 (표준)
- 블록버스터 (Klimt, Van Gogh): 45–60분
- 테마파크 헤드라이너: 60–90분
- 사전예약 timed-entry: 30–60분

너무 짧게 잡으면 모든 cap 케이스가 saturated → sweep 의미 사라짐 (UI 경고).
