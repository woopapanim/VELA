# VELA — Spatial Simulation & Flow Analytics

## 프로젝트 개요
전시관 시뮬레이션 + 분석 엔진. 에이전트 기반 관람객 동선 시뮬레이션, KPI 분석, A/B 비교.

## Tech Stack
- React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui (Dark/Light)
- Zustand (World, Sim, UI, Analytics slices)
- Canvas 2D API (500+ agents)
- Chart.js + react-chartjs-2

## 아키텍처 (단방향 의존성)
```
domain ← simulation ← stores → analytics
                        ↓
                  ui / visualization
```

## 핵심 폴더
| 폴더 | 역할 |
|------|------|
| `src/domain/` | 순수 타입, 상수, ID. 의존성 없음 |
| `src/simulation/engine/` | SimEngine (동선, 미디어 관람, 물리), SimulationLoop |
| `src/simulation/steering/` | Arrival, Separation, Wander, ObstacleAvoidance, FollowLeader, GroupCohesion |
| `src/simulation/collision/` | SpatialHash, clampToRect/Polygon, resolveAgentOverlap |
| `src/simulation/pathfinding/` | ZoneGraph (gate 기반 경로 탐색) |
| `src/simulation/behavior/` | EngagementBehavior (미디어 선택, skip 판단, engagement 시간) |
| `src/stores/slices/` | worldSlice, simSlice, uiSlice, analyticsSlice |
| `src/ui/panels/build/` | SimulationControls, ZoneEditor, MediaEditor |
| `src/ui/panels/canvas/` | CanvasPanel (마우스 이벤트, 드래그, 줌) |
| `src/ui/panels/analytics/` | KPI 대시보드, 차트, 인사이트 |
| `src/visualization/renderers/` | Zone, Gate, Media, Visitor, Heatmap, FlowLine 렌더러 |
| `src/visualization/canvas/` | CanvasManager, Camera, RenderPipeline |

## SimEngine 핵심 동작
1. **Spawn** → zone[0]의 첫 gate에서 생성
2. **assignNextTarget()** → 다음 zone 또는 media 선택
3. **startTransit()** → exit gate → gap routing → entry gate → center waypoints 생성
4. **stepBehavior** → IDLE/MOVING/WATCHING/WAITING/EXITING 상태 머신
5. **미디어 관람**: PASSIVE(soft cap), ACTIVE(slot+queue), STAGED(session) 3종
6. **Exit**: zone[last]에서 미디어 완료 후 exit gate → outside → deactivate

## 미디어 시스템
- 20종 preset, rect/circle shape, orientation 지원
- 물리 히트박스 (에이전트 통과 불가)
- 관람 구역: orientation 방향 1.5m 앞, capacity = floor(area / 0.8m²)
- slot 배분 (ACTIVE), session 관리 (STAGED)
- 통계: watchCount, skipCount, waitCount, totalWatchMs, peakViewers

## 존 시스템
- shape: rect, circle, L자(4방향), O형, custom polygon
- gate: entrance/exit/bidirectional/portal
- flowType: free/guided/one_way
- 전역 동선: sequential/free/hybrid (guidedUntilIndex)

## 알려진 이슈 (2026-04-22 기준)

### 해결된 과거 이슈 (참고)
- **Transit 중 벽 통과** → `766be73` 에서 수정. `stepCollision` transit 분기가 src/dst 제외 zone 에 대해 `pushOutsidePolygon` 수행 (line ~3071).
  - 단 src/dst zone 내부 벽 관통 엣지 케이스는 남아있을 수 있음. 현재 관찰되는 증상 없음.
- **0개 존 이탈 42%** → `675ae2b` + `11cd07e` 에서 polygon fallback + media-zone auto-credit 추가로 0% 로 해결.
- **아날로그 슬롯 오버랩** → `f273cbf` 에서 nearest-free + margin 8 으로 해결.

### 현재 진행 중 이슈
- **조기이탈 45%** (1-2개 존만 보고 exit) — 최우선 과제. 원인 데이터 수집 필요.
- **스킵률 48%** — active 미디어(touch table, hands on model, interaction media) 에 집중. 2× cap 만으로 해결 안 됨.
- **Entry/Exit 64:36 불균형** — 스폰 가중치 or 근접 exit 선택 로직 점검 필요.
- **MOVING timeout 누적 95건** — active=53, staged=나머지. 라이브 CONGESTED 는 ~0 이므로 치명적은 아님.

### 진단 도구
- `window.__simEngine.diagnoseCongestion()` — 라이브 CONGESTED + 누적 timeout 집계.

## 구현 상태
| 기능 | 상태 |
|------|------|
| 도메인 타입 전체 | ✅ 완료 |
| SimEngine (동선/물리/미디어) | ✅ 완료 |
| Steering (6종 behavior) | ✅ 완료 |
| Zone 편집 (shape, gate, resize) | ✅ 완료 |
| Media 편집 (배치, 크기, 회전) | ✅ 완료 |
| Media 물리 히트박스 + 관람구역 | ✅ 완료 |
| Canvas 시각화 (zone/gate/media/visitor) | ✅ 완료 |
| Heatmap | ✅ 완료 |
| FlowLine 렌더링 | ✅ 완료 |
| 시나리오 CRUD/버전/브랜치 | ✅ 완료 |
| A/B 비교 (ComparisonEngine) | ✅ 완료 |
| 정적 밀도 분석 | ✅ 완료 |
| Multi-floor 기본 구조 | ✅ 완료 |
| Multi-floor 배경 오버레이 + 영역 편집 | ✅ 완료 |
| ~~AI 도면 분석~~ | ❌ 폐기 (2026-04-25, 정확도 한계 + 모던 도면이 zone 추상에 안 맞음) |
| **Structured Reporting (VELA Report v2)** | ✅ 완료 |
| **Pinpoint 분석** | ✅ 완료 |
| **Advanced Analytics (트렌드/민감도)** | ✅ 완료 |

## 제품 로드맵 (2026-04-25 ~)

큐레이션 (서비스 use case 정리) 결과로 6 phase plan 도출. 상세 spec 은 `docs/specs/`:

| Phase | 목적 | 상태 | 참조 |
|-------|-----|-----|------|
| **0** | Exhibit 용어 + 카테고리별 속성 | spec ✅ + 코드 ✅ | [`phase-0-exhibit-vocabulary.md`](docs/specs/phase-0-exhibit-vocabulary.md) |
| **1 엔진** | 운영 정책 엔진 (5종 정책, EntryController) | spec ✅ + 코드 ✅ | [`phase-1-operations-policy.md`](docs/specs/phase-1-operations-policy.md) |
| **1 UX** | 체험 모드 (8종, 검증 3 + 운영 5) | spec ✅ + 코드 ✅ (Sweep + ModePerspective + ComparisonSection) | [`phase-1-experience-modes.md`](docs/specs/phase-1-experience-modes.md) |
| **2** | 단체 / 도슨트 / VIP | spec ✅ | [`phase-2-groups-docent.md`](docs/specs/phase-2-groups-docent.md) |
| **3A** | 작품 큐레이션 (위치 + 순서) | spec ✅ | [`phase-3a-artwork-curation.md`](docs/specs/phase-3a-artwork-curation.md) |
| **3B** | 디지털 미디어 경험 설계 | spec ✅ | [`phase-3b-digital-media-experience.md`](docs/specs/phase-3b-digital-media-experience.md) |
| **4** | 트래킹 연동 (Layer 2, design only) | spec ✅ | [`phase-4-tracking-integration-design.md`](docs/specs/phase-4-tracking-integration-design.md) |

마스터 로드맵: [`docs/specs/ROADMAP.md`](docs/specs/ROADMAP.md)

### 체험 모드 (Phase 1 UX 결정, 2026-04-26)

엔진 정책 (`unlimited / concurrent-cap / rate-limit / time-slot / hybrid`) 위에 페르소나 친화적 framing 추가. 사용자는 _체험 모드_ 로 진입, 모드가 정책/가중치/리포트 shape 를 결정.

**검증 tier** (변형 A/B/C 비교, 큐 미발생):
- 레이아웃 검증 ✅ — 공간 디자이너
- 큐레이션 검증 🔒 Phase 3A
- 미디어 경험 검증 🔒 Phase 3B

**운영 예상 tier** (단일 시나리오 timeline + 권장):
- 자유 관람 ✅
- 자유 관람 + 통제 ✅ (concurrent-cap, 높은 cap = 폭주 시만 발동)
- 시간제 예약 관람 ✅ (time-slot)
- 통제 입장 ✅ (concurrent-cap, 낮은 cap)
- 단체 관람 🔒 Phase 2

리포트 shape 도 모드별 분기 (검증 = 변형 비교, 운영 = timeline + 권장 cap).

### Exhibit 용어 (Phase 0 결정)

기존 `Media` 단일 추상 → 카테고리별 분리. 점진 마이그레이션 (alias 도입):

| UI/문서 표시 | 코드 카테고리 (`MEDIA_CATEGORY`) | 비교 차원 |
|------------|------------------------------|---------|
| 작품 (Artwork) | `ANALOG` | 위치 + 순서 + 시리즈 |
| 디지털 미디어 (Digital Media) | `PASSIVE_MEDIA` | 길이 + 인터랙션 + capacity |
| 인터랙티브 (Interactive) | `ACTIVE` | 슬롯 + capacity (Phase 1 운영 정책에서 다룸) |
| 이머시브 (Immersive) | `IMMERSIVE` | Digital Media 와 동일 워크플로우 (Phase 3B) |

상위 개념: **전시물 (Exhibit)** — 모든 카테고리의 부모. 코드에서는 `Exhibit = MediaPlacement` alias.

## 작업 규칙
- 기능 하나 완성 → 시뮬레이션 테스트 → 커밋. 한 세션에 한 기능.
- `window.__store`로 브라우저 콘솔에서 store 접근 가능
- 시뮬레이션 데이터 정합성: `totalSpawned = active + totalExited` 항상 검증
- Zone 배열 순서: [0]=spawn, [last]=exit, 중간=exhibition/rest/stage
