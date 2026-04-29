# VELA 제품 로드맵 — Curation-Driven Spec Set

**작성일**: 2026-04-25
**작성 맥락**: AI 도면 분석 폐기 결정 후, "큐레이션" (서비스 use case 정리) 작업의 산출물
**기준 브랜치**: `claude/amazing-villani-750340`

---

## 0. 이 문서의 위치

이 로드맵은 VELA 의 **제품 방향 + 구현 우선순위** 를 정리한 마스터 문서. 각 Phase 의 상세 spec 은 개별 파일로 분리:

```
docs/specs/
├─ ROADMAP.md                              ← 이 문서 (마스터)
├─ phase-0-exhibit-vocabulary.md           ← 용어 재정의
├─ phase-1-operations-policy.md            ← Phase 1 엔진 (EntryController, 5종 정책)
├─ phase-1-experience-modes.md             ← Phase 1 UX 레이어 (체험 모드, 2026-04-26 추가)
├─ phase-2-groups-docent.md                ← 단체/도슨트/VIP
├─ phase-3a-artwork-curation.md            ← 작품 배치/순서 비교
├─ phase-3b-digital-media-experience.md    ← 디지털 미디어 경험 설계
└─ phase-4-tracking-integration-design.md  ← 트래킹 연동 (design only)
```

기존 `docs/PLAN.md` 는 시뮬레이션 디버깅 계획서 (2026-04-22) 로 별개 문서. 본 ROADMAP 은 그 위에 얹는 제품 단위 plan.

---

## 1. Use Case 3 Layer Map

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1 — 기획/설계 단계 (NOW: 핵심 가치)                │
│ 시설 오픈 전, 의사결정 검증 도구                         │
├─────────────────────────────────────────────────────────┤
│ Q1. 레이아웃 A/B/C 중 뭐가 좋은가?                       │
│ Q2A. 작품 배치/순서 비교                                 │
│ Q2B. 디지털 미디어 경험 설계 비교                        │
│ Q3. 운영 정책 (수용/입장제한/단체/도슨트/VIP)            │
└─────────────────────────────────────────────────────────┘
          ↓ 시설 오픈
┌─────────────────────────────────────────────────────────┐
│ LAYER 2 — 운영 단계 (FUTURE: 트래킹 연동)                │
│ 운영중인 시설의 실데이터 + 시뮬레이션 보정               │
├─────────────────────────────────────────────────────────┤
│ Q4. 컨텐츠 소구력 → 재배치 제안                          │
│ Q5. 시간대별 추이 / 행동 유형                            │
│ Q6. 실데이터 → 시뮬레이션 캘리브레이션                   │
└─────────────────────────────────────────────────────────┘
          ↓ 도메인 확장
┌─────────────────────────────────────────────────────────┐
│ LAYER 3 — 도메인 확장 (LATER)                            │
│ 전시 → 일반 공간 시뮬레이터                              │
├─────────────────────────────────────────────────────────┤
│ • 리테일 매장 (구매 동선, 진열 최적화)                   │
│ • 병원 / 검진센터 (검사 동선, 대기열, 의존 그래프)       │
│ • 공항, 박람회, 카페 등                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 페르소나

| 페르소나 | 역할 | 사용 시점 | 우선순위 |
|---------|-----|---------|--------|
| **큐레이터** | 컨텐츠/작품 기획, 의도 정의 | 기획 단계 | 1차 |
| **공간 디자이너** | 동선/조닝/레이아웃 설계 | 기획 단계 | 1차 |
| **시설 운영팀** | 입장/단체/도슨트 운영 | 기획 + 운영 | 2차 |
| **컨텐츠 매니저** | 오픈 후 컨텐츠 교체/재배치 | 운영 (Layer 2) | 3차 |
| **시설주/투자자** | 의사결정자, 보고 receiver | 모든 단계 | receiver |

→ Layer 1 의 1차 사용자는 **큐레이터 + 공간 디자이너**. Layer 2 부터 운영팀/매니저 진입.

---

## 3. Phase 진행 순서

### Phase 0 — 용어 재정의 + 도메인 모델 정비 ← **선행 (시작점)**

| 항목 | 값 |
|------|---|
| 목적 | "Media" 단일 추상의 모호함 해소, 카테고리별 워크플로우 토대 마련 |
| 산출물 | `Exhibit` alias, `ArtworkProps` / `DigitalMediaProps` / `InteractiveProps` 추가, UI 표시명 통일, MediaEditor 카테고리별 입력 |
| 의존성 | 없음 (선행) |
| Estimate | 1 일 (8h) |
| Spec | [`phase-0-exhibit-vocabulary.md`](./phase-0-exhibit-vocabulary.md) ✅ |

### Phase 1 — 운영 정책 + 체험 모드 (2-layer)

| 항목 | 값 |
|------|---|
| 목적 | "동시 N 명 받으면 어떻게 되는가" 시뮬레이션 — 운영 의사결정의 토대 + 페르소나별 진입 framing |
| 엔진 산출물 | `EntryController` 모듈, outsideQueue 모델 + 시각화 (`phase-1-operations-policy.md`) ✅ 완료 |
| UX 산출물 | 체험 모드 8종 (검증 3 + 운영 5), 모드별 정책/가중치 default, 리포트 분기, 비교 UI tier 별 분기 (`phase-1-experience-modes.md`) — 진행 중 |
| 의존성 | Phase 0 완료 |
| Estimate | 엔진 ✅ + UX 약 2.7 주 |
| Spec | [`phase-1-operations-policy.md`](./phase-1-operations-policy.md) ✅ + [`phase-1-experience-modes.md`](./phase-1-experience-modes.md) (2026-04-26) |
| 변경 사유 | 엔진 spec 만으로는 "공간 디자이너가 레이아웃만 검증" 같은 페르소나 워크플로우를 wrap 하지 못함. 의도/물리 2 레이어 (메모리 `project_question_driven_ux.md`) 구체화. |

### Phase 2 — 단체 / 도슨트 / VIP

| 항목 | 값 |
|------|---|
| 목적 | 단체 + 개인 혼합 운영, 도슨트 leader-follower, VIP 별도 동선 |
| 산출물 | `GroupBooking` 모델, Docent 에이전트 타입, 그룹간 충돌 회피, VIP 정책 비교 |
| 의존성 | Phase 1 (입장 제어 토대) |
| Estimate | 2 주 |
| Spec | [`phase-2-groups-docent.md`](./phase-2-groups-docent.md) |

### Phase 3A — 작품 큐레이션 워크플로우

| 항목 | 값 |
|------|---|
| 목적 | 작품 위치 + **순서** + 시리즈 응집 비교. 큐레이터의 의도 검증 |
| 산출물 | Artwork 카테고리 KPI (순서 충실도, 시리즈 완주율, hero 추적), 작품 순서/그룹 편집 UI, Variant fork + diff overlay |
| 의존성 | Phase 0 (Artwork 속성 정의) |
| Estimate | 1.5 주 |
| Spec | [`phase-3a-artwork-curation.md`](./phase-3a-artwork-curation.md) |

### Phase 3B — 디지털 미디어 경험 설계

| 항목 | 값 |
|------|---|
| 목적 | 컨텐츠 길이 + 인터랙션 방식 + capacity 비교. "어떻게 경험시킬 것인가" 설계 |
| 산출물 | Digital Media KPI (의미있는 완주율, 처리량, 컨텐츠 스킵률), 경험 변형 비교 UI, `minWatchMs` 모델 |
| 의존성 | Phase 0 (DigitalMedia 속성 정의) |
| Estimate | 1.5 주 |
| Spec | [`phase-3b-digital-media-experience.md`](./phase-3b-digital-media-experience.md) |

### Phase 4 — 트래킹 연동 (design only, no code)

| 항목 | 값 |
|------|---|
| 목적 | Layer 2 진입 위한 design 문서. 트래킹 파트너십/투자 결정 후 구현 |
| 산출물 | 데이터 import 포맷 spec, Sim ↔ Real 갭 분석 도구 design, 캘리브레이션 워크플로우 |
| 의존성 | Phase 1-3 완료 (시뮬 모델 안정화 후) |
| Estimate | spec 1 주, 구현은 별도 |
| Spec | [`phase-4-tracking-integration-design.md`](./phase-4-tracking-integration-design.md) |

---

## 4. 의존성 그래프

```
Phase 0 (용어/도메인)
   │
   ├─→ Phase 1 (운영 정책)
   │     │
   │     └─→ Phase 2 (단체/도슨트/VIP)
   │
   ├─→ Phase 3A (작품 큐레이션)  ─┐
   │                              ├─→ Phase 4 (트래킹 연동, design)
   └─→ Phase 3B (디지털 미디어) ─┘
```

**병렬 가능**: Phase 1 ↔ Phase 3A ↔ Phase 3B 는 독립 (다른 영역). 단, 인력/포커스 분산 위험 → 순차 권장.

**권장 진행 순서**: 0 → 1 → 2 → 3A → 3B → 4

이유:
- Phase 1 (운영 정책) 이 가장 큰 갭이고, 이후 Phase 들의 토대 (단체 운영도 결국 입장 제어)
- Phase 3A → 3B 순서: 작품 모델이 디지털 미디어 모델보다 단순, 워크플로우 패턴 먼저 확립
- Phase 4 는 마지막 — Layer 1 모델이 안정된 후 Layer 2 와 매핑

---

## 5. 마일스톤 / 일정 추정

| 마일스톤 | 누적 기간 | 산출물 |
|---------|---------|------|
| **M0** — Phase 0 완료 | +1 일 | 용어 통일, 카테고리별 속성 입력 가능 |
| **M1** — Phase 1 완료 | +3 주 | 입장 제한 시뮬, 만족도 추정, A/B/C/D 비교 UI |
| **M2** — Phase 2 완료 | +5 주 | 단체/도슨트/VIP 운영 시뮬 |
| **M3** — Phase 3A 완료 | +6.5 주 | 작품 큐레이션 비교 워크플로우 |
| **M4** — Phase 3B 완료 | +8 주 | 디지털 미디어 경험 설계 비교 |
| **M5** — Phase 4 spec | +9 주 | 트래킹 연동 design (구현 X) |

→ 실 작업 ~9 주 = 2 달. 디버깅/리뷰/회귀 버퍼 30% 포함 시 **약 3 달** 추정.

---

## 6. 명시적 비목표 (Non-Goals)

이 로드맵에서 **하지 않는 것**:

- ❌ AI 도면 분석 재시도 (이미 폐기 결정)
- ❌ DL 모델 fine-tuning, Roboflow/CVAT 작업
- ❌ Layer 2/3 구현 (Phase 4 는 design 만)
- ❌ 미디어 → Exhibit 풀 rename (alias 만, 점진 마이그레이션)
- ❌ 시뮬레이션 엔진 대규모 리팩토링 (현재 구조 유지, 신규 모듈만 추가)
- ❌ UI 프레임워크 변경, 새 라이브러리 도입

---

## 7. 위험 요소 (Risks)

| 위험 | 영향 | 대응 |
|------|-----|-----|
| Phase 1 의 만족도 추정 공식이 자의적 | 의사결정 신뢰도 ↓ | 백서에 근거 명시, 가중치 사용자 조정 가능 |
| 카테고리별 KPI 분리로 비교 화면 복잡도 ↑ | 큐레이터 학습곡선 | 기본 뷰 + 상세 뷰 토글, "추천" 자동 산출 |
| 단체/도슨트 모델 (Phase 2) 의 검증 데이터 부족 | 시뮬 정확도 의문 | Phase 4 캘리브레이션 단계에서 보정 |
| 점진 마이그레이션 (Media → Exhibit) 의 코드 일관성 | 신/구 용어 혼재 | 신규 코드는 100% Exhibit, PR 시 lint rule 검토 |
| 9 주 일정의 over-run | 일정 지연 | 각 Phase 완료 시점 회고, 우선순위 재조정 |

---

## 8. 결정 / 확정 사항

이 로드맵 작성 시점 (2026-04-25) 에 확정된 것:

1. ✅ AI 도면 분석 완전 폐기 (코드 제거 완료)
2. ✅ 큐레이션 = "서비스 use case 정리" 로 정의
3. ✅ 3 Layer 분류 (기획 / 운영 / 도메인 확장) 채택
4. ✅ 1차 페르소나 = 큐레이터 + 공간 디자이너
5. ✅ Use Case 2 를 2A (작품) + 2B (디지털 미디어) 로 분리
6. ✅ Media → Exhibit 점진 마이그레이션 (옵션 C)
7. ✅ Phase 진행 순서: 0 → 1 → 2 → 3A → 3B → 4
8. ✅ Phase 4 는 design only, 구현은 트래킹 파트너십/투자 결정 후

추가 확정 (2026-04-26):

9. ✅ Phase 1 을 엔진 (`phase-1-operations-policy.md`) + UX 레이어 (`phase-1-experience-modes.md`) 로 분리
10. ✅ 체험 모드 8종 (검증 3 + 운영 5) 채택, disabled 모드는 UI 노출 + 클릭 차단
11. ✅ 리포트는 체험 모드 관점에 따라 shape 가 달라짐 (검증 = 변형 비교, 운영 = timeline + 권장)
12. ✅ 만족도 가중치는 모드별 default + 사용자 조정

---

## 9. 다음 액션

1. ROADMAP + 5 개 Phase spec 모두 작성 완료 후 사용자 검토
2. 검토 통과 시 Phase 0 구현 즉시 시작
3. Phase 0 완료 후 Phase 1 구현 진입 (spec 은 이미 있음)

---

## 부록 — 결정에 영향을 준 사용자 통찰 (인용)

- "이게 다시보니~ 요즘 도면들은 형태도 자유롭게 ~존으로 규정하기에 애매한게 많어"
- "ai로 도면 올리는건 의미가 없을 것 같아"
- "큐레이션하자" → 서비스 use case 정리로 해석 확정
- "전시물 관점에서는 배치 비교 (작품 위치 순서도 영향이 크니까)"
- "디지털 미디어의 경우는 체험시간이나 경험의 방법"
- "계획서 만들고 하자" → 본 ROADMAP 작성 트리거

관련 메모리:
- `project_question_driven_ux.md` — 질문 기반 UX 방향
- `feedback_data_over_physics.md` — 데이터 품질 우선
- `feedback_no_gates.md` — Gate 언급 금지 (Graph-Point 사용)
- `project_whitepaper_plan.md` — 백서 작성 예정 (각 Phase 의 공식/근거는 백서에 수록)
