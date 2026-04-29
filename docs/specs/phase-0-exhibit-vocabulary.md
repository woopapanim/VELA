# Phase 0 Spec — Exhibit 용어 재정의 + 카테고리별 워크플로우 분리

**작성일**: 2026-04-25
**대상 브랜치**: `claude/amazing-villani-750340`
**선행 조건**: AI 도면 분석 코드 제거 완료 (이미 처리)
**후속 작업**: Phase 1 (운영 정책), Phase 3A (작품 큐레이션), Phase 3B (디지털 미디어 경험 설계)

---

## 0. 배경 / 동기

### 문제 정의

현재 코드베이스는 모든 전시 대상을 `Media` / `MediaPlacement` 단일 추상으로 다룸. 하지만 큐레이터 관점에서는 **본질이 다른 두 종류**가 섞여 있음:

| 큐레이터 관점 | 비교 차원 | 시뮬레이션 차원 |
|--------------|----------|----------------|
| **작품 (Artwork)** | 위치 + **순서** + 시리즈 응집 | 단순 dwell + skip |
| **디지털 미디어** | 컨텐츠 길이 + 인터랙션 방식 + capacity | 재생/세션/슬롯 모델 |

이 둘을 같은 KPI 로 비교하면 의미 있는 의사결정 불가:
- 작품은 "순서 충실도", "시리즈 완주율" 이 핵심
- 디지털 미디어는 "의미있는 완주율", "처리량" 이 핵심
- 현재 KPI 는 둘을 뭉뚱그려 평균함 → 둘 다 어중간한 답

### 사용자 통찰 인용

> "전시물 관점에서는 배치 비교 (작품 위치·순서도 영향이 크니까)
> 디지털 미디어의 경우는 체험시간이나 경험의 방법 (인터랙티브냐? 일반 관람이냐?)"

### 추가 발견 — 모델은 이미 있음

`src/domain/types/media.ts` 확인 결과 `MEDIA_CATEGORY` 가 **이미 4 분류** 로 나뉘어 있음:

```ts
MEDIA_CATEGORY = {
  ANALOG: 'analog',                  // ← 큐레이터의 "작품"
  PASSIVE_MEDIA: 'passive_media',    // ← 큐레이터의 "디지털 미디어 (관람형)"
  ACTIVE: 'active',                  // ← 큐레이터의 "인터랙티브"
  IMMERSIVE: 'immersive',            // ← 별도 카테고리 (사용자 미언급)
}
```

→ **데이터 모델은 거의 다 있음**. 진짜 작업은:
1. 용어 통일 (Media → Exhibit, UI 표시명 정리)
2. 카테고리별 KPI/워크플로우 분리
3. Artwork 카테고리에 부족한 큐레이션 속성 추가 (`curatorialOrder`, `series`, `significance`)
4. Digital Media 카테고리에 부족한 경험 속성 추가 (`minWatchMs`)

---

## 1. 현재 상태 분석

### 1.1 도메인 모델 (이미 있는 것)

```ts
// src/domain/types/media.ts

export const MEDIA_CATEGORY = {
  ANALOG: 'analog',
  PASSIVE_MEDIA: 'passive_media',
  ACTIVE: 'active',
  IMMERSIVE: 'immersive',
} as const;

export const MEDIA_TYPE = {
  // analog (4종)
  ARTIFACT, DOCUMENTS, DIORAMA, GRAPHIC_SIGN,
  // passive_media (4종)
  MEDIA_WALL, VIDEO_WALL, PROJECTION_MAPPING, SINGLE_DISPLAY,
  // active (4종)
  KIOSK, TOUCH_TABLE, INTERACTION_MEDIA, HANDS_ON_MODEL,
  // immersive (3종)
  VR_AR_STATION, IMMERSIVE_ROOM, SIMULATOR_4D,
} as const;

export interface MediaPlacement {
  id, name, type, category, zoneId, position, size, orientation,
  capacity, avgEngagementTimeMs, attractiveness,
  mustVisit?,        // ← Artwork "hero" 와 일부 중첩
  attractionRadius, interactionType,
  omnidirectional?,  // ← Artwork 360° 관람용
  shape?, polygon?,
  stageIntervalMs?,  // ← STAGED 전용
  queueBehavior?, groupFriendly?,
}
```

### 1.2 사용 범위

`Media` 키워드 검색 결과: **78 파일, 1,468 회 출현**.
주요 사용처:
- 도메인: `media.ts`, `scenario.ts`, `kpi.ts`, `report.ts`, `comparison.ts`
- 시뮬레이션: `SimEngine.ts`, `EngagementBehavior.ts`, `GroupBehavior.ts`
- 시각화: `MediaRenderer.ts`, `CanvasManager.ts`
- UI: `MediaEditor.tsx`, `BuildTools.tsx`, `WelcomeScreen.tsx`, 분석 패널들
- 분석: `aggregator.ts`, `calculators/*`, `pinpoint/*`, `reporting/*`
- 스토어: `worldSlice.ts` (77 회), `simSlice.ts`

→ 풀 rename 은 매우 큰 작업.

### 1.3 갭 분석

| 영역 | 현재 | 갭 |
|------|-----|-----|
| 카테고리 분류 | 4 종 ✅ | 없음 |
| 카테고리별 KPI | ❌ 평균만 | 카테고리별 분리 필요 |
| 작품 순서 (`curatorialOrder`) | ❌ | Artwork 신규 필드 |
| 작품 시리즈 (`series`) | ❌ | Artwork 신규 필드 |
| 작품 비중 (`significance`) | ⚠️ `mustVisit` 만 있음 | hero/support/context 3 단계 |
| 의미있는 완주 (`minWatchMs`) | ❌ | Digital Media 신규 필드 |
| 의미있는 완주율 KPI | ❌ | Digital Media KPI 신규 |
| 처리량 (throughput/hour) | ❌ | Digital Media KPI 신규 |
| 순서 충실도 KPI | ❌ | Artwork KPI 신규 |
| UI 카테고리 필터 | ⚠️ 부분 | 분석 패널에서 카테고리별 보기 |

---

## 2. 용어 매핑 결정

### 2.1 새 용어 체계

| 사용자 / 문서 / UI | 코드 (도메인) | 코드 (카테고리) | 의미 |
|------------------|--------------|----------------|------|
| **전시물 (Exhibit)** | `Exhibit` *(신규 alias)* | — | 모든 전시 대상의 상위 개념 |
| ├ **작품 (Artwork)** | — | `ANALOG` | 정적 전시물, 큐레이션 의도 강함 |
| ├ **디지털 미디어 (Digital Media)** | — | `PASSIVE_MEDIA` | 시간축 컨텐츠, 재생 기반 |
| ├ **인터랙티브 (Interactive)** | — | `ACTIVE` | 사용자 입력, 슬롯/세션 |
| └ **이머시브 (Immersive)** | — | `IMMERSIVE` | 몰입형, 회차 운영 |

### 2.2 기존 용어와의 관계

- `Media` (코드 단어) → `Exhibit` 으로 점진 변경 (rename 대신 alias 후 신규 코드부터)
- `MediaCategory` → `ExhibitCategory` 로 alias
- `MediaPlacement` → `ExhibitPlacement` 로 alias
- `MediaType` (15 종) → 그대로 유지 (변경 비용 큼, 의미 충분)

### 2.3 미해결 — Immersive 처리

사용자는 use case 정리에서 Immersive 를 명시적으로 언급하지 않음. 다음과 같이 가정:
- 운영상 STAGED (회차 예약) 에 가까움 → Use Case 3 (운영 정책) 에서 다룸
- 비교 워크플로우는 Digital Media 와 유사 (경험 설계 차원)
- 별도 spec 필요 시 Phase 3C 로 분리 (현재는 Phase 3B 에 흡수)

---

## 3. Rename 전략 — 옵션 비교

### 옵션 A: 풀 rename (Media → Exhibit)
- **장점**: 의미 명확, 도메인 확장 (리테일/병원) 시 자연스러움
- **단점**: 78 파일 / 1468 회 변경, 큰 PR, 저장된 시나리오 호환성, git blame 손상
- **리스크**: 한 PR 에 다른 작업 못 끼움, 회귀 위험 큼

### 옵션 B: 코드 그대로 + UI/문서만 분리
- **장점**: 코드 안정, 작업 빠름
- **단점**: "Media" 가 작품도 포함하는 모호함 영구화, 신규 개발자 혼란

### 옵션 C: 하이브리드 (점진 마이그레이션) ← **결정**
- 도메인 layer 에 `Exhibit` alias 추가 (`export type Exhibit = MediaPlacement`)
- 신규 코드는 `Exhibit` 사용
- UI 표시명/i18n 은 즉시 "전시물 / 작품 / 디지털 미디어" 로 통일
- 기존 `Media*` 사용처는 다른 작업 시 touch 할 때 점진 마이그레이션
- 6개월 후 deprecation warning, 12개월 후 제거

**결정 사유**:
- 데이터 모델이 이미 충분 → 풀 rename 의 이득 작음
- UI/문서 통일이 사용자 가치의 90% → 빠르게 가져감
- 후속 Phase 작업 (3A/3B) 이 자연스럽게 신규 용어 사용

---

## 4. 도메인 모델 추가 사항

### 4.1 Exhibit alias (즉시)

```ts
// src/domain/types/exhibit.ts (신규 파일)

import type {
  MediaPlacement, MediaCategory, MediaType,
  MediaPreset, MediaInteractionType,
} from './media';

/** 전시물 — 모든 전시 대상의 상위 개념 (Media 의 새 이름) */
export type Exhibit = MediaPlacement;
export type ExhibitCategory = MediaCategory;
export type ExhibitType = MediaType;
export type ExhibitPreset = MediaPreset;
export type ExhibitEngagementMode = MediaInteractionType;

/** 큐레이터 관점 카테고리 (UI 표시용) */
export const EXHIBIT_KIND = {
  ARTWORK: 'analog',           // 작품
  DIGITAL: 'passive_media',    // 디지털 미디어
  INTERACTIVE: 'active',       // 인터랙티브
  IMMERSIVE: 'immersive',      // 이머시브
} as const;
```

### 4.2 카테고리별 추가 속성

`MediaPlacement` 에 optional discriminated 필드 추가:

```ts
// src/domain/types/media.ts (확장)

export interface ArtworkProps {
  /** 같은 시리즈 내 의도된 관람 순서 (1-based) */
  readonly curatorialOrder?: number;
  /** 시리즈/섹션 그룹 키 (예: "조선시대 회화", "작가 A 시리즈") */
  readonly series?: string;
  /** 작품 비중 — KPI 가중 + UI 강조 */
  readonly significance?: 'hero' | 'support' | 'context';
}

export interface DigitalMediaProps {
  /** 컨텐츠 전체 길이 */
  readonly contentDurationMs?: number;
  /** 의미있는 체험으로 인정할 최소 시간 */
  readonly minWatchMs?: number;
  /** 루프 가능 여부 (PASSIVE 일 때 의미) */
  readonly loopable?: boolean;
}

export interface InteractiveProps {
  /** 평균 인터랙션 깊이 (0-1, 단순 터치 → 풀 인터랙션) */
  readonly interactionDepth?: number;
  /** 세션 모드 — 기존 queueBehavior 와 보완 */
  readonly sessionMode?: 'slot' | 'queue' | 'free';
}

export interface MediaPlacement {
  // ... 기존 필드 모두 유지
  readonly artwork?: ArtworkProps;
  readonly digital?: DigitalMediaProps;
  readonly interactive?: InteractiveProps;
}
```

**중요**: 모두 `optional`. 기존 시나리오 파일 100% 호환.

### 4.3 시나리오 파일 호환성

- 기존 저장 파일은 신규 필드 누락 → 모두 `undefined` 로 로드 → KPI 는 카테고리별 값 미제공 (UI 에서 "데이터 없음" 표시)
- 마이그레이션 스크립트 불필요
- 사용자가 큐레이션 패널에서 직접 입력 (또는 일괄 편집)

---

## 5. UI 영향 범위

### 5.1 즉시 변경 (Phase 0 범위)

| 파일 | 변경 내용 |
|------|---------|
| `src/i18n/ko.ts` | "미디어" → "전시물" / "작품" / "디지털 미디어" / "인터랙티브" 로 분리 |
| `src/i18n/en.ts` | "Media" → "Exhibit" / "Artwork" / "Digital Media" / "Interactive" |
| `src/ui/panels/build/MediaEditor.tsx` | 카테고리별 속성 입력 UI 추가 (artwork/digital/interactive 섹션) |
| `src/ui/panels/canvas/PropertyPopover.tsx` | 선택된 전시물의 카테고리에 따라 표시 속성 분기 |
| `src/ui/panels/build/ZoneTemplates.tsx` | 라벨/툴팁 업데이트 |

### 5.2 후속 변경 (Phase 3A/3B 범위, Phase 0 에 포함 X)

| 파일 | 변경 내용 |
|------|---------|
| `src/ui/panels/analytics/ZoneMediaPerformance.tsx` | 카테고리별 KPI 분리 표시 |
| `src/ui/reports/vela/sections/MediaSection.tsx` | 보고서 섹션 분리 (작품 / 디지털 미디어) |
| `src/analytics/calculators/*` | 카테고리별 calculator 추가 (`curatorialOrderFidelity`, `meaningfulCompletionRate` 등) |

---

## 6. 시뮬레이션 엔진 영향

**거의 없음**. 신규 필드는 KPI 계산용이고, 시뮬레이션 step 로직 자체는 변경 없음.

예외 검토 사항:
- `significance: 'hero'` 와 기존 `mustVisit` 의 관계 정리 필요 (둘 다 "반드시 관람" 의미)
  - 결정: `mustVisit` 은 시뮬레이션 강제 플래그 (steering 에서 무시 못 함), `significance` 는 KPI/UI 표시용. 직교.
- `minWatchMs` 는 `EngagementBehavior.ts` 에서 skip 판단에 활용 가능 (선택)
  - 결정: Phase 0 에서는 KPI 계산만 사용. skip 로직 변경은 Phase 3B 에서 검토.

---

## 7. 신규 메트릭 토대 (Phase 3A/3B 준비)

Phase 0 에서는 **메트릭 정의만 명시**, 구현은 Phase 3A/3B.

### 7.1 Artwork (Phase 3A 에서 구현)

| 메트릭 | 정의 | 데이터 소스 |
|--------|-----|-----------|
| `curatorialOrderFidelity` | 시리즈 내 작품을 의도된 순서대로 본 비율 | visitor.engagementHistory + artwork.curatorialOrder |
| `seriesCompletionRate` | 한 시리즈의 모든 작품을 본 관람객 비율 | engagementHistory + series 그룹 |
| `heroReachRate` | significance='hero' 작품 도달률 | engagementHistory |
| `heroDwellMs` | hero 작품 평균 체류 | engagementHistory |
| `backtrackRate` | 역방향 (이전 zone/artwork 로 되돌림) 비율 | path history |

### 7.2 Digital Media (Phase 3B 에서 구현)

| 메트릭 | 정의 | 데이터 소스 |
|--------|-----|-----------|
| `meaningfulCompletionRate` | `minWatchMs` 이상 체험한 비율 | engagementHistory |
| `throughputPerHour` | 시간당 처리 인원 | engagementHistory + duration |
| `contentSkipRate` | 컨텐츠 길이 대비 조기 이탈 비율 | engagementHistory + contentDurationMs |

---

## 8. 미해결 이슈 / 결정 필요 사항

| # | 이슈 | 제안 | 결정 필요 시점 |
|---|------|-----|--------------|
| 1 | `Media` → `Exhibit` 풀 rename 시점 | 12 개월 후 또는 영구 alias 유지 | Phase 0 종료 후 |
| 2 | Immersive 별도 워크플로우 필요? | Phase 3B 에 흡수, 필요 시 분리 | Phase 3B 시작 시 |
| 3 | `mustVisit` ↔ `significance: 'hero'` 통합? | 직교 유지 (시뮬 vs UI/KPI) | Phase 0 (이 문서에서 결정) |
| 4 | `curatorialOrder` 자동 추론 가능? (zone 진입 순서 + 위치) | 수동 입력 + 자동 제안 옵션 | Phase 3A |
| 5 | Series 그룹은 zone 단위? 글로벌? | 글로벌 (zone 넘나드는 시리즈 가능) | Phase 0 (이 문서) |

---

## 9. 작업 순서 + estimate

### 9.1 Phase 0 작업 항목

```
1. docs/specs/phase-0-exhibit-vocabulary.md  ← 이 문서
   ✅ 완료

2. src/domain/types/exhibit.ts (신규)
   - Exhibit / ExhibitCategory / ExhibitKind alias
   - Estimate: 30 min

3. src/domain/types/media.ts (확장)
   - ArtworkProps / DigitalMediaProps / InteractiveProps 추가
   - MediaPlacement 에 optional 필드 추가
   - Estimate: 1 hr

4. src/domain/types/index.ts + src/domain/index.ts
   - Exhibit 타입 re-export
   - Estimate: 15 min

5. src/i18n/ko.ts, en.ts
   - "미디어" → "전시물" / 카테고리별 라벨 추가
   - Estimate: 1 hr

6. src/ui/panels/build/MediaEditor.tsx
   - 카테고리별 속성 입력 섹션
   - artwork.curatorialOrder, series, significance
   - digital.contentDurationMs, minWatchMs, loopable
   - interactive.sessionMode (interactionDepth 는 후순위)
   - Estimate: 3 hr

7. src/ui/panels/canvas/PropertyPopover.tsx
   - 카테고리별 속성 표시
   - Estimate: 1 hr

8. 기존 시나리오 호환성 테스트
   - 옛 시나리오 로드 → 신규 필드 undefined → UI 정상 동작 확인
   - Estimate: 30 min

9. 문서 업데이트
   - CLAUDE.md 에 Exhibit 용어 표 추가
   - Estimate: 30 min

총합: 약 8 시간 (1 일)
```

### 9.2 Phase 0 완료 정의 (Definition of Done)

- [ ] `Exhibit` alias 도메인에서 사용 가능
- [ ] `ArtworkProps` / `DigitalMediaProps` / `InteractiveProps` 정의 + MediaPlacement 에 optional 통합
- [ ] UI 표시명 100% 통일 (한국어/영어)
- [ ] MediaEditor 에서 카테고리별 속성 입력 가능
- [ ] 기존 시나리오 로드 시 회귀 0
- [ ] typecheck pass / 기존 테스트 pass
- [ ] CLAUDE.md 업데이트

### 9.3 Phase 0 → Phase 1 전환

Phase 0 완료 후 즉시 Phase 1 (운영 정책 — 수용 + 입장 제한) spec 작성. Phase 1 은 새 Exhibit 용어 사용.

---

## 부록 A — 참고

- 사용자 통찰 (대화 기록):
  - "미디어가 전시물을 포함하는데 어떤 표현이 좋을까?"
  - "전시물 관점에서는 배치 비교 (작품 위치 순서도 영향이 크니까)"
  - "디지털 미디어의 경우는 체험시간이나 경험의 방법"
- 관련 메모리: `project_question_driven_ux.md`, `project_whitepaper_plan.md`
- 후속 spec: `phase-1-operations-policy.md` (작성 예정)
