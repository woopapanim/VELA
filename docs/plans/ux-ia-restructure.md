# UX IA 재구성 계획 — 페르소나가 진입을 지배

**작성일**: 2026-04-28
**브랜치**: `claude/vela-ux-cleanup`
**선행 spec**: `docs/specs/phase-1-experience-modes.md`, `docs/specs/ROADMAP.md`
**상태**: 계획 (코드 작업 전)

---

## 0. 한 줄 진단

> **Phase 1 spec 의 "ExperienceMode = spine" 약속이 IA 까지 내려오지 않았다. 모드는 좌측 패널의 한 섹션일 뿐, 페르소나가 진입을 지배하지 못한다.**

기존 spec/코드는 페르소나 framing 과 per-mode policy/satisfaction default 까지 이미 정의·구현했지만, **MainLayout 의 좌측 패널이 12+ 섹션 dump 구조를 그대로 두고 있어** 사용자 눈에 "컴포넌트만 옮겼지 UX 가 안 바뀜" 으로 체감됨.

---

## 1. 현재 상태 — 코드로 검증한 사실

### 1.1 좌측 패널 IA (실측, [src/ui/layouts/MainLayout.tsx](src/ui/layouts/MainLayout.tsx))

3 도메인 그룹 + 12 섹션:

```
[Session]
  Project              (ProjectManager)
  Simulation           (SimulationControls)
  ReplayScrubber

[Build]                ← "공간"
  BuildTools           (Zone/Media/Node/Edge 도구)
  RegionsPanel
  ZoneEditor           (선택 zone)
  WaypointInspector    (선택 waypoint)
  MediaEditor          (선택 media)
  ZoneList             (collapsible)

[Operations]           ← "운영 시나리오"
  ExperienceModePanel  ← 8 모드 spine 인데 9번째 섹션
  SpawnConfig
  VisitorConfig
```

**문제**: ExperienceModePanel 이 "Operations 그룹의 한 섹션". 사용자가 모드를 선택하기 전에 이미 위 8 섹션을 만남. 모드는 입력/시뮬/리포트를 정렬해야 하는데, **현재는 입력 흐름의 끝에 붙어있음.**

### 1.2 Phase 구현 상태 (spec vs 코드)

| Phase | spec | 코드 | 페르소나 가치 전달? |
|-------|-----|-----|--------|
| 0 — Exhibit 어휘 | ✅ | ✅ MediaEditor 에 카테고리별 속성 입력 가능 | 기반 OK |
| 1 — Experience Modes | ✅ | ✅ ExperienceModePanel + per-mode default + Sweep + ComparisonSection (`3132fc8` → `c6d813c`) | **spine 위치 미정착** |
| 1 — Operations Policy | ✅ | ✅ 5 정책 + EntryController + PolicyComparisonLauncher | OK |
| 2 — Group/Docent/VIP | ✅ | ❌ **코드 없음** (grep: doc 만) | 시설 운영팀(단체) 가치 X |
| 3A — Artwork Curation | ✅ | ⚠️ 메타 입력 (MediaEditor) + i18n 만. ArtworkAnalyzer / SeriesPanel / Variant 비교 코드 없음 | **큐레이터 가치 X** |
| 3B — Digital Media Experience | ✅ | ⚠️ 메타 입력 + satisfaction 계산기 minWatchMs 활용. DigitalMediaAnalyzer / Comparison 화면 / interactivityLevel 시뮬 영향 없음 | **컨텐츠 매니저 가치 X** |
| 4 — Tracking | ✅ design-only | (의도적 미구현) | (Layer 2) |

**결과**: 2/8 페르소나 (LAYOUT_VALIDATION + 운영 4 모드) 만 진짜 가치를 전달. 큐레이터·컨텐츠 매니저·단체 운영팀은 모드를 골라도 **자기 KPI 가 화면에 없다.**

---

## 2. 페르소나 카드 (8 모드 × 진입 → 입력 → 시뮬 → 리포트)

각 카드는 spec 의 `ExperienceMode` enum 과 1:1. 모드 선택 = 페르소나 선언.

> 이미 spec ([phase-1-experience-modes.md](docs/specs/phase-1-experience-modes.md)) 에서 페르소나 매핑·per-mode policy/satisfaction defaults 가 정의되어 있다. 본 계획은 그것을 **IA 의 골격으로 끌어올리는 일**.

### 2.1 검증 tier (variant A/B/C 비교, 큐 미발생)

| 페르소나 / 모드 | 핵심 질문 | 입력에서 보여줄 것 | 리포트에서 보여줄 것 | 코드 상태 |
|-----------------|----------|-------------------|--------------------|----------|
| **공간 디자이너** / `LAYOUT_VALIDATION` | "이 레이아웃이 좋은가?" | Zone/Media/Node/Edge, 정적 밀도, 동선 그래프 | 평균 밀도, congestion 시간, 동선 효율, A/B/C 비교 | ✅ |
| **큐레이터** / `CURATION_VALIDATION` 🔒3A | "작품을 이 순서·위치에 두면 의도가 전달되나?" | 시리즈 매니저, curatorialOrder 드래그, hero 마킹, Variant 배치 fork | 순서 충실도(LIS), 시리즈 완주율, hero reach/dwell, backtrack | ❌ **미구현** |
| **컨텐츠 매니저** / `MEDIA_EXPERIENCE` 🔒3B | "이 디지털 컨텐츠 길이·인터랙션이 적절한가?" | 컨텐츠 길이, minWatchMs, chapter, interactivityLevel, capacity, Variant 경험 fork | 의미있는 완주율, throughput, 컨텐츠 스킵률, capacity 활용률 | ⚠️ 메타만 |

### 2.2 운영 예상 tier (단일 시나리오 timeline + 권장)

| 페르소나 / 모드 | 핵심 질문 | 입력에서 보여줄 것 | 리포트에서 보여줄 것 | 코드 상태 |
|-----------------|----------|-------------------|--------------------|----------|
| **시설 운영팀 (자유)** / `FREE_ADMISSION` | "무제한 입장 시 무슨 일이 벌어지나?" | Spawn rate, Visitor profile, ExperienceMode 운영 default | 동시인원 timeline, 만족도, 혼잡 누적, 권장 cap | ✅ |
| **시설 운영팀 (자유+통제)** / `FREE_WITH_THROTTLE` | "여유 있는 cap 만 두면 충분한가?" | + concurrent-cap, 대기 인내심 | + 외부 큐, 평균 대기, 포기율, 권장 cap | ✅ |
| **시설 운영팀 (예약제)** / `TIMED_RESERVATION` | "30분 슬롯 K 명이 적정한가?" | + slot duration, perSlotCap, TimeSlotEditor | + 슬롯별 입장량, 슬롯 활용률, 슬롯간 대기 | ✅ |
| **시설 운영팀 (통제 입장)** / `CONTROLLED_ADMISSION` | "엄격한 동시 cap 으로 쾌적도 우선?" | + 낮은 cap, 인내심, 외부 큐 모델 | + 만족도 ↑, 처리량 ↓ trade-off, 권장 cap range | ✅ |
| **시설 운영팀 (단체)** / `GROUP_VISIT` 🔒2 | "단체+도슨트 운영 시 충돌은?" | GroupBookings, Docents, TourTemplate, VipPolicy | 그룹 응집도, 충돌 타임라인, 도슨트 가동률, VIP 영향 | ❌ **미구현** |

### 2.3 (cross-cutting) 시설주 / 투자자

명시적 모드는 없음. **Analyze 단계에서 모드 KPI 1~2 개씩 모아 한 화면 요약**: ROI 식 + 만족도 + 처리량 + risk flag. Phase 1 의 ComparisonSection 이 토대.

---

## 3. IA 재구성 원칙

### 3.1 핵심 원칙

1. **모드는 spine 이지 섹션이 아니다.** 모드 선택 → IA 가 그 모드에 맞춰 좁아져야 함.
2. **페르소나가 모르는 섹션은 숨겨라.** 큐레이터 모드에 SpawnConfig 디테일 노출 X. 운영팀 모드에 시리즈 매니저 노출 X.
3. **공통 인프라 (Project / Simulation / Build 도구) 는 항상 노출.** 모드 무관하게 필요.
4. **Lock 모드도 카드 노출.** 클릭 시 "🔒 Phase 2/3A/3B 에서 활성" + 미리보기. 사용자가 "쉽잖아" 라고 한 것 = 가치 약속을 보여주는 것이 진입 매력.
5. **모드 변경 = 가벼운 행동.** 기존 입력 보존 + default 만 갈아끼움 (이미 spec 의 customization 검출 로직 존재).

### 3.2 진입 흐름 (제안)

```
[App 진입]
   ↓
[Welcome 단계]  ← 첫 진입은 모드 선택부터
   - "무엇을 검증/예측할 건가요?" (8 카드)
   - 카드 = 페르소나 + 핵심 질문 + 예상 결과 한 줄
   - 선택 → 모드 default 적용 (정책/가중치)
   ↓
[Build 단계]  ← 모드별 큐레이팅된 입력
   - 공간 도구 (Zone/Media/Node) 항상 노출
   - 모드별 추가 패널 노출 (큐레이션 → SeriesPanel,
     디지털 → MediaExperienceEditor, 운영 → SpawnConfig)
   ↓
[Simulate 단계]  ← 모드별 default 로 실행
   - 검증 tier: A/B/C variant 자동 prompt
   - 운영 tier: 단일 실행 + Sweep 옵션
   ↓
[Analyze 단계]  ← 모드별 리포트 shape
   - 검증: ComparisonSection (이미 구현)
   - 운영: ModePerspectiveSection (이미 구현)
   - 두 tier 공통: Verdict 한 줄 + 핵심 KPI 4
```

이미 [`WelcomeSurvey`](src/ui/panels/build/) (커밋 `b64a9d5`) + ExperienceModePanel + ComparisonSection + Sweep 가 코드로 존재. **빠진 건 이들을 4 단계 IA 로 묶어내는 것 + Build 단계가 모드를 "안다" 는 것.**

---

## 4. 모드 × 섹션 매트릭스 (좌측 패널 재배치)

`Always` = 모드 무관 항상 노출. `MODE` = 그 모드 선택 시만 노출. `🔒` = 미구현이지만 lock 카드로 노출.

| 섹션 | LAYOUT | CURATION 🔒 | MEDIA 🔒 | FREE | THROTTLE | TIMED | CTRL | GROUP 🔒 |
|------|:------:|:-----------:|:--------:|:----:|:--------:|:-----:|:----:|:--------:|
| Project | Always | | | | | | | |
| Simulation | Always | | | | | | | |
| **ModeSelector** (=spine) | Always | | | | | | | |
| BuildTools (Zone/Media/Node/Edge) | Always | | | | | | | |
| ZoneEditor / WaypointInspector / MediaEditor (선택 시) | Always | | | | | | | |
| RegionsPanel | Always | | | | | | | |
| ZoneList | Always | | | | | | | |
| **SeriesPanel** (Phase 3A) | — | ✓ | — | — | — | — | — | — |
| **MediaExperienceEditor** (Phase 3B) | — | — | ✓ | — | — | — | — | — |
| **VariantManager** (검증 tier 공통) | ✓ | ✓ | ✓ | — | — | — | — | — |
| SpawnConfig | — | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| VisitorConfig | — | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| **EntryPolicyParams** (cap/rate/slot) | — | — | — | — | ✓ | ✓ | ✓ | ✓ |
| TimeSlotEditor | — | — | — | — | — | ✓ | — | — |
| **GroupBookingsPanel** (Phase 2) | — | — | — | — | — | — | — | ✓ |
| **DocentsPanel** (Phase 2) | — | — | — | — | — | — | — | ✓ |
| **VipPolicyPanel** (Phase 2) | — | — | — | — | — | — | — | ✓ |
| **PolicyComparisonLauncher** | — | — | — | — | ✓ | ✓ | ✓ | ✓ |

**결과**: 좌측 패널이 **상시 7 섹션 + 모드별 1~5 섹션** 으로 좁아짐. 현재 12 dump 대비 페르소나 평균 노출 섹션 ≈ 8~10. 제일 큰 차이는 **노이즈가 사라진다는 것**.

---

## 5. 미구현 Phase 우선순위 (페르소나 가치 전달 관점)

spec 은 다 있지만 코드 미구현인 Phase 들. IA 만 고치고 카드 lock 으로 두면 결국 절반의 페르소나가 가치 없음. 우선순위 결정 필요:

| 우선순위 | 작업 | 이유 | Estimate (spec 기준) |
|---------|------|-----|----------------------|
| **P0** | IA 재구성 (본 계획) | 모드 spine 정착 — 다른 모든 작업의 토대 | 1.5 주 |
| **P1** | Phase 3A 작품 큐레이션 코드 | 큐레이터 페르소나 = 핵심 사용자. ArtworkAnalyzer + SeriesPanel + VariantManager. spec 의 시뮬 영향 없음 → 가성비 최고 | ~1.5 주 |
| **P2** | Phase 3B 디지털 미디어 코드 | 컨텐츠 매니저. EngagementBehavior 수정 1 곳 + Analyzer + Comparison | ~1.4 주 |
| **P3** | Phase 2 단체/도슨트/VIP | 시설 운영팀(단체) 페르소나. 신규 시뮬 모듈 多 → 가장 무거움 | ~3 주 |

**제안**: P0 (IA) → P1 (큐레이터) → P2 (디지털 미디어) → P3 (단체) 순. 각 Phase 작업 시 그에 해당하는 모드 카드 lock 해제.

> 사용자가 "큐레이션과 미디어 경험은 왜?? 이것도 쉽잖아" 라고 한 것 = P1/P2 우선순위 동의 신호로 해석. 합의 필요.

---

## 6. 단계별 작업 plan (P0 = IA 재구성)

### Stage A — Welcome / 진입 (3-4 일)

- [ ] `src/ui/welcome/ModeSelector.tsx` 신규 — 8 카드 + 페르소나 + 핵심 질문 + 예상 결과 미리보기
- [ ] WelcomeSurvey (`b64a9d5`) 와 통합 또는 대체
- [ ] 첫 진입 시 모드 미선택 → ModeSelector 풀스크린, 선택 후 MainLayout
- [ ] Locked 모드 클릭 시 "🔒 Phase X 에서 활성" + 미리보기 모달 (가치 약속 노출)

### Stage B — MainLayout 모드 인지 IA (3-4 일)

- [ ] [MainLayout.tsx](src/ui/layouts/MainLayout.tsx) 좌측 패널을 `useExperienceMode()` 기반 conditional 렌더로 재구조
- [ ] 모드 × 섹션 매트릭스 (§4) 그대로 적용
- [ ] ModeSelector 를 좌측 패널 최상단에 항상 배치 (spine)
- [ ] 모드 변경 = inline 카드 expander (기존 ExperienceModePanel 의 confirm dialog 재사용)
- [ ] 좌측 패널 그룹 헤더 (`Session / Build / Operations`) 유지하되, 모드별 섹션은 그룹 안에서 토글

### Stage C — Analyze 단계 모드 정렬 (2 일)

- [ ] AnalyticsPanel 이 모드 인지 → 검증 tier 면 ComparisonSection 우선, 운영 tier 면 ModePerspectiveSection 우선
- [ ] 두 tier 공통 "Verdict 한 줄" 컴포넌트 (이미 ComparisonSection 일부에 있음 → 추출)

### Stage D — Locked 모드 카드 가치 미리보기 (1 일)

- [ ] CURATION_VALIDATION / MEDIA_EXPERIENCE / GROUP_VISIT 카드 클릭 → 모달
- [ ] 각 모달에 "이 모드가 켜지면 보게 될 것" (KPI 예시 + spec 인용)
- [ ] "P1/P2/P3 작업 후 활성" CTA — 사용자 합의 후

### Stage E — 검증 / 누적 (1 일)

- [ ] preview 로 Welcome → 8 모드 진입 → 좌측 패널 변형 확인 (모드별 스크린샷)
- [ ] [CLAUDE.md](CLAUDE.md) 의 Phase 1 UX 라인 "ExperienceModePanel = Phase 1 UX 모드 선택기" → "ModeSelector + IA spine" 으로 갱신
- [ ] 본 계획서 Stage A~D 완료 체크
- [ ] 메모리 핸드오프 갱신 (다음 세션이 P1 으로 진입할 수 있게)

**Stage A~E 합산: ~10 일 / 2 주**. P1 (Phase 3A 큐레이션) 진입 전.

---

## 7. 누적 보장 (다음 세션 인계)

본 계획이 다음 세션에서 잊히지 않도록:

1. **이 파일 자체** = `docs/plans/ux-ia-restructure.md` 가 진실의 원본
2. **CLAUDE.md** 갱신 — Phase 1 UX 항목 옆에 "(IA 정착 진행 중, 본 계획 참조)" 표기
3. **메모리 인계 갱신** — `project_next_session_handoff.md` 를 본 계획 가리키도록 교체
4. **Stage 단위 커밋** — Stage A 완료 = 커밋 1 개, "feat(ux): mode-aware welcome (Stage A of IA restructure)"
5. **체크리스트는 본 파일에서 관리** — Stage 박스 체크 = 진행 상황 단일 출처

---

## 8. 미해결 / 사용자 합의 필요

| # | 이슈 | 제안 |
|---|------|------|
| 1 | P1/P2/P3 우선순위 (큐레이션 → 미디어 → 단체) | 사용자 확정 필요 |
| 2 | Welcome 진입을 항상 풀스크린? 아니면 첫 진입만? | "첫 진입 + 헤더에서 항상 다시 호출 가능" 제안 |
| 3 | 모드 변경 시 기존 입력 보존 정책 | 이미 ExperienceModePanel 에 customization 검출 + confirm 있음 → 재사용 |
| 4 | Locked 모드 카드의 "가치 미리보기" 깊이 | KPI 이름 + spec 1 줄 인용 정도. 가짜 데이터 X |
| 5 | 시설주/투자자 cross-cutting 요약을 별도 모드로? | 별도 모드 X. Analyze 단계의 공통 푸터로 처리 |
| 6 | 본 IA 변경이 시뮬 invariant / 데이터 정합성에 영향? | 없음. UI 만. 시뮬 엔진 / 데이터 모델 미변경 |

---

## 9. 결정 / 확정 사항

본 계획 작성 시점 (2026-04-28) 확정:

1. ✅ ExperienceMode 8 종 = 페르소나 8 종 (1:1 매핑)
2. ✅ Welcome 단계는 모드 선택부터 (페르소나 선언)
3. ✅ MainLayout 좌측 패널은 모드 인지 conditional 렌더로 재구조
4. ✅ Locked 모드도 카드 노출 (가치 약속 = 진입 매력)
5. ✅ 시뮬 엔진 / 데이터 모델 변경 없음 (UI 만)
6. ✅ Stage A~E 단계별 커밋 (누적 보장)
7. ✅ CLAUDE.md + 메모리 핸드오프 동시 갱신

---

## 부록 — 이 계획이 답하는 사용자 미해결 의문

1. **"Spawn/Visitor 패널이 어느 단계 소속인가?"** → §4 매트릭스. 운영 5 모드에서만 노출, 검증 3 모드에서 숨김.
2. **"컴포넌트만 옮기지 말고 UX 에 맞춰 UI 도 재설계"** → §3 IA 재구성 원칙. 모드별 conditional + Welcome 추가 = 진짜 재설계.
3. **"시뮬 엔진 검증"** → 본 계획과 직교. 병렬 트랙으로 진행 가능.
