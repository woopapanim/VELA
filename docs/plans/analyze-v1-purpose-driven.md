# Analyze v1 — 목적 기반 분석 솔루션

**작성일**: 2026-04-30
**브랜치**: `claude/affectionate-jones-1b7d1a`
**상태**: 계획 (코드 작업 전)
**선행 합의**: 메모리 [VELA 질문 기반 UX 방향](~/.claude/projects/-Users-suhan-AION-mark01/memory/project_question_driven_ux.md) (2026-04-23, 2026-04-27)

---

## 0. 한 줄 진단

> **현재 Analyze 는 "혼잡 모니터링 툴"이다. 목표는 "총체적 경험 분석 + 의사결정 시스템".**
> "혼잡을 보는 게 아니라 경험의 질이 어떻게 무너지는지를 보는 시스템."

---

## 1. 서비스 3단 구조 (목적 → 프리셋 → 결과)

| 단계 | 책임 | 사용자 행동 |
|------|------|----------|
| **목적 선택** (Setup) | "이 서비스로 뭘 할 수 있는지" 선택지 | 추상/구체 목적 카드 1개 선택 |
| **프리셋 (Build/Simulate)** | 선택 목적에 맞춘 입력/시뮬 default | (자동 세팅, 사용자는 조정만) |
| **결과 (Analyze)** | 그 목적 기준으로 평가·서술 | reading + drilldown + 변형 |

**작업 순서**: 결과 정의(이 문서) → 진입 선택지 → 프리셋. 거꾸로 가면 또 갈아타게 됨.

---

## 2. 핵심 원칙

1. **"달성/실패" 아닌 "관찰(Reading)"** — 합격선 입력 X. 사용자가 합격선 모르는 게 정상. 시스템이 norm 으로 답.
2. **다관점 default + 단일관점 narrow** — 추상 목적이면 4 관점 한눈에, 구체 목적이면 1 관점 좁게.
3. **분석 솔루션 = primary + side rail** — 선택 관점은 강조, 나머지 관점·백데이터는 항상 옆에.
4. **tier 별 iteration cycle 다름** (메모리 합의) — 검증 = Build cycle (레이아웃 수정), 운영 = Sweep cycle (Build 고정).
5. **AI 가 비교의 동기를 만든다** (별도 작업이지만 hook 자리 남김) — variant 제안은 사용자 수동 X, AI 후속 질문.

---

## 3. v1 Frame

```
┌────────────────────────────────┬───────────────────┐
│ [목적·관점]                     │ [다른 관점]        │
│   추상 → 4 관점 카드 grid       │  tab 으로 swap    │
│   구체 → 단일 관점 큰 카드      │  체험·작품·운영·  │
│   (합격선 X)                    │  위험 + ROI       │
├────────────────────────────────┤                   │
│ [관찰 Reading]                  │ [Reference Data]  │
│   - 핵심 metric 2~3 + norm 표시 │  KPI library     │
│   - 한 줄 서술 ("이렇게 보였다") │  raw timeline     │
│   - 신뢰도 등급                  │  분포 histogram   │
│   - norm 출처 ℹ️                 │  prior run 비교   │
├────────────────────────────────┤  zone/media drill │
│ [패턴]                          │  agent group 분해 │
│   시간·공간·persona slice       │                   │
├────────────────────────────────┤                   │
│ [왜?] breakdown drill           │                   │
│   single-level slice → drill   │                   │
├────────────────────────────────┤                   │
│ [탐색·행동]                     │                   │
│   Pinpoint · Replay            │                   │
│   검증 fork → Build            │                   │
│   운영 sweep → Simulate        │                   │
│   AI 제안 hook (자리만)         │                   │
├────────────────────────────────┤                   │
│ [Verdict 한 줄]                 │                   │
│   A: norm 매칭 + C: 다관점 균형 │                   │
│   "이 설계 OK / 검토 / 위험"    │                   │
├────────────────────────────────┤                   │
│ [Deliverable]                   │                   │
│   FullReport export wire        │                   │
└────────────────────────────────┴───────────────────┘
```

---

## 4. 4 관점 × Metric 매핑

✅ 즉시 가능 / ⚠️ 집계만 추가 / 🔒 측정 인프라 필요

### 4.1 공간 체험 관점 (가장 약함)

| Metric | 상태 | 비고 |
|--------|------|------|
| 평균 밀도 (m²/agent) | ⚠️ | analyzeStaticDensity 정적만, 동적 미구현 |
| **공간(존) 효율** | ✅ | peakOccupancy + zone dwell + visit count 조합 |
| 미관람 zone 비율 | ⚠️ | visitedZoneIds 있음, KPI 미통합 |
| 정체 시간 % | 🔒 | CONGESTED 임계 정의 + 시간 추적 |
| 동선 효율 (의도/실제) | 🔒 | 거리 추적 인프라 부재 |

### 4.2 작품 관람 관점

| Metric | 상태 | 비고 |
|--------|------|------|
| 평균 스킵률 | ✅ | skipRate.ts globalSkipRate |
| 의미관람 작품 수 | ⚠️ | minWatchMs 필드 정의만, 시뮬 미적용 |
| Hero reach % | 🔒 | artwork.significance='hero' 정의만, KPI 미포함 |
| 시리즈 충실도 | 🔒 | curatorialOrder 정의만 — Phase 3A |

### 4.3 운영 관점 (가장 강함)

| Metric | 상태 | 비고 |
|--------|------|------|
| 시간당 처리 인원 | ✅ | flow.ts throughputPerMinute |
| 동시 peak 인원 | ✅ | utilization.ts peakOccupancy |
| 평균 체류시간 | ✅ | flow.ts avgTime |
| 만족도 추정 | ⚠️ | OperationsConfig 정책만, 산식 미완성 |
| 관람 시간 (개인) | ✅ | avgTime + dwell 분포 |
| **최대 수용인원 권장** | ⚠️ | 산식: zone area / 1.5m² (즉시) + sweep 보강 |
| **쾌적 정책 (rate × interval)** | 🔒 | 정책 sweep 인프라 |
| **시간대별 정책** | 🔒 | time-varying spawn 미구현 (v2 후보) |
| 관람 시간 (단체) | 🔒 | Phase 2 미구현 |

### 4.4 위험·마찰 관점

| Metric | 상태 | 비고 |
|--------|------|------|
| 병목 hotspot | ✅ | bottleneck.ts score 0-1 |
| 입장 거절·이탈율 | 🔒 | EntryController 구조만, KPI 미통합 |
| 평균 대기 시간 | 🔒 | 대기 시간 기록 미적용 |
| **비상 대피** (검토 후 v2) | 🔒 | exit path 도메인 모델 변경 큰 작업 — v2 후보 |

### 4.5 Cross-perspective

| Metric | 상태 | 비고 |
|--------|------|------|
| Prior run 비교 | ✅ | runHistory.ts (Phase A) |
| Profile × zone 분해 | ⚠️ | toReportData 사후 분해 가능 |
| ROI 종합 점수 | 🔒 | 처리량 × 만족도 × 위험 산식 미정 |

---

## 5. Verdict 만드는 방법 (합격선 입력 X)

사용자가 합격선 모름 → 시스템이 답해야 함.

### A. 시스템 norm 라이브러리

| Metric | 임계 | 출처 |
|--------|------|------|
| 만족도 | ≥ 70 | per-mode default (코드) |
| 평균 밀도 | ≥ 1.5m²/agent | NFPA 101 (인파 안전 기준) |
| 정체 시간 | < 5% | **자체 권장 (근거 정리 필요)** |
| 스킵률 | < 30% | **자체 권장 (근거 정리 필요)** |
| 병목 score | < 0.6 | **자체 권장** |

→ 각 metric 옆 ℹ️ 클릭 시 **출처 + 근거 + 임계 변동 시 만족도 곡선** 노출. 신뢰성 확보의 핵심.

### B. Prior run 대비 변화량

- 같은 시나리오 prior run 있을 때 활성. "직전 대비 정체 +12%" → 악화 신호.
- runHistory.contentHash 로 동일 base 검출.
- 첫 run 일 땐 비활성.

### C. 다관점 균형 점수 (v1 핵심)

```
4 관점 카드 신호 집계:
  4 ✅          → 안정 (Verdict: 이 설계 OK)
  1 ⚠️          → 주의 (Verdict: X 관점 검토)
  2+ ⚠️ or 1 ❌ → 위험 (Verdict: 위험)
```

합격선 없이도 "여러 관점이 한꺼번에 나쁘면 위험" 자동 판정.

### 신뢰도 등급 (정직성)

각 reading 옆에:
- **High**: norm 매칭 명확 + replication 보강
- **Medium**: norm 매칭 명확 + 단일 run
- **Low**: norm 자체가 자체 권장 + 단일 run

→ 분석 솔루션의 정직성. binary verdict 안 되면 confidence 표시는 더 중요.

---

## 6. tier 별 iteration cycle (메모리 합의 재확인)

| tier | 비교 cycle | Action 진입 |
|------|----------|-----------|
| **검증** (공간·작품·미디어) | Build → Simulate → Analyze → **Build** (레이아웃 수정 후 재시뮬) | "이 안 fork → Build" 버튼 → scenarioManager.branch() + setStep('build') |
| **운영** (자유·통제·시간제·...) | Simulate → Analyze → **Sweep** → Simulate (Build 고정) | "정책 A/B/C in-place sweep" 버튼 → sweep 인프라 |

**필요 인프라**:
- 검증: scenarioManager.branch() ✅ 존재. `App.handleForkToBuild()` 패턴 wire.
- 운영: **sweep 인프라 신규 작성** — variant 자동 실행 + KPI 집계 + 비교 표.

**참고**: 메모리상 `ValidationActionCard`, `PolicyComparisonLauncher` 가 다른 브랜치 (`cranky-booth-2ea021`) 에 구현되어 있음. **갈아타지 말 것 (메모리 feedback_no_branch_hopping)**. 사고만 차용해서 현 worktree 에 신규 작성.

---

## 7. 단계별 구현 plan (4 step, 4-5주)

### Step 1 — Reading frame + norm 라이브러리 (1주)

- [ ] `src/analytics/norms/` 신규 — Metric × 임계 × 출처 정의
- [ ] `src/ui/panels/analytics/AnalyzeV2Panel.tsx` 신규 — 4 카드 grid + side rail 골격
- [ ] 4 관점 카드 컴포넌트 (`SpaceCard`, `ArtworkCard`, `OperationsCard`, `RiskCard`)
- [ ] norm 출처 ℹ️ 툴팁 (출처 + 근거 + 임계 변동 곡선)
- [ ] 신뢰도 등급 표시
- [ ] 추상 vs 구체 목적 분기 (4 카드 grid vs 단일 카드)
- [ ] Side rail KPI library + raw timeline (현재 ✅ metric 만)

**산출물**: 단일 run 4 관점 reading. 운영 카드만 풍부, 나머지는 norm 매칭 + ⚠️ 부분.

### Step 2 — 측정 인프라 보강 + 패턴 (1주)

- [ ] SimEngine 측정 추가 (정체 시간%, 평균 대기 시간, 거리 추적 — 동선 효율)
- [ ] `bottleneckIndex` 시간 기반 누적 → 정체 시간% 도출
- [ ] EntryController 거절·이탈 카운터 → KPI 통합
- [ ] zone area utilization 산출 (peakOccupancy / area)
- [ ] [패턴] 블록 — 시간 슬라이스, 공간 hotspot, persona slice
- [ ] 4 카드의 ⚠️ → ✅ 승격 (가능한 만큼)

**산출물**: 4 관점 카드 모두 norm 매칭 가능. 패턴 블록으로 cross-cutting 차이 노출.

### Step 3 — "왜?" breakdown + 탐색·행동 (1.5주)

- [ ] [왜?] breakdown UI — single-level slice + drilldown
  - zone-level: 이 zone 의 visit·dwell·skip·congestion breakdown
  - media-level: 이 media 의 watch·skip·queue breakdown
  - time-window-level: 시간 슬라이스의 모든 metric
  - persona-level: visitorProfile × zone 매트릭스
- [ ] Pinpoint 통합 (이미 있는 코드 wire)
- [ ] Replay 통합 (이미 있는 ReplayScrubber wire)
- [ ] **검증 fork-to-Build** — App.handleForkToBuild 신규 + Build 단계 진입
- [ ] **운영 sweep 인프라 신규** — variant 자동 실행 + 비교 표
  - 산식 기반 답 (cap = area / 1.5m²) 즉시 표시
  - knee-point 단일 run 휴리스틱
  - 진짜 sweep 은 N=3 (cap A/B/C) 시나리오 자동 실행
- [ ] AI 제안 hook (자리만 — 별도 작업)

**산출물**: 의사결정 가능한 행동 루프 완성. 검증 cycle + 운영 cycle 둘 다 작동.

### Step 4 — Verdict + Deliverable + 다듬기 (1주)

- [ ] Verdict 자동 판정 logic (A norm + B prior run + C 다관점 균형)
- [ ] Verdict 한 줄 컴포넌트
- [ ] FullReport export wire ([Deliverable] 블록)
- [ ] 추상/구체 목적 분기 마무리
- [ ] norm 라이브러리 출처 근거 정리 (특히 자체 권장 항목)
- [ ] preview 회귀 검증 (4 관점 × 검증/운영 tier × 추상/구체 목적)

**산출물**: v1 출시 가능 상태.

---

## 8. v2+ 차후 항목 (의도적 보류)

- **합격선 입력** — 사용자가 익숙해진 후 v2 에서 옵션으로
- **AI variant 제안** — 별도 작업, v1 hook 자리만
- **Replication 신뢰구간** — 같은 설정 N회 실행 인프라
- **비상 대피 관점** — exit path 도메인 모델 변경 큰 작업
- **persona/time/scenario variant** — 비교 차원 확장
- **Storytelling narrative** — AI 자동 서술
- **time-varying spawn** — 시간대별 정책 답에 필요
- **Phase 3A (큐레이션)** — 시리즈 충실도, hero reach
- **Phase 3B (디지털 미디어)** — 의미관람, interactivity 시뮬 영향
- **Phase 2 (단체/도슨트/VIP)** — 단체 관람시간, 그룹 응집도

---

## 9. 결정 요약 (2026-04-30)

| # | 결정 | 출처 |
|---|------|------|
| 1 | "왜?" breakdown → v1 포함 | 사용자 |
| 2 | 합격선 입력 X (사용자도 모름) | 사용자 |
| 3 | AI variant 제안 → 별도 | 사용자 |
| 4 | tier 별 iteration cycle (검증/운영) | 메모리 2026-04-28 |
| 5 | "달성" 표현 부담 → "관찰(Reading)" | 사용자 |
| 6 | 분석 솔루션 정체성 → primary + side rail | 사용자 |
| 7 | 추상/구체 목적 분기 | 사용자 |
| 8 | 갈아타지 X — 다른 브랜치 사고만 차용 | 메모리 feedback_no_branch_hopping |

---

## 10. 미결 / 검토 필요

- [ ] norm 라이브러리 자체 권장 항목 (정체 시간 5%, 스킵률 30%, 병목 0.6) **근거**
- [ ] 다관점 균형 점수의 임계 (4 ✅ vs 1 ⚠️ vs 2+ ⚠️) 검토 — 1 ⚠️ 조차 너무 관대할 수 있음
- [ ] 추상 목적 카드의 실제 카피 ("공간 설계 디자인 검토" 등) — Setup 단계 작업과 연결
- [ ] AI 제안 hook 의 진입 위치 — Verdict 옆? 탐색 블록 안? 별도 panel?
- [ ] 운영 sweep 의 default variant 개수 (3? 5?) + 사용자 조정 가능성

---

## 11. 다음 행동

1. 본 계획 사용자 합의 → Step 1 착수
2. Step 1 시작 전 — Setup 단계 (목적 선택지) 의 추상/구체 카드 카피 초안 별도 정리 필요? 결정 필요.
3. 미결 항목 (§10) 일부는 Step 1 진행하면서 자연 해결 — 막힐 때 사용자 콜.
