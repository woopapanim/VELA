# AION mark01 — Exhibition Digital Twin

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

## 알려진 이슈 (2026-04-13 기준)

### 핵심 버그: Transit 중 벽 통과
- **근본 원인**: transit 상태(`currentZoneId = null`)일 때 `stepCollision`에서 zone 벽 충돌을 안 함
- 코드 주석: "Transit: agent follows waypoints freely" — waypoint 경로만 믿고 벽 무시
- **결과**: waypoint가 zone을 관통하면 에이전트도 벽을 뚫고 지나감
- **올바른 해결**: transit 에이전트도 모든 zone 벽과 충돌해야 함. gate 위치에서만 통과 허용.
- 이건 waypoint 경로 최적화(gapY 등)로 해결할 문제가 아님 → **물리 충돌 레이어에서 해결**
- 관련 코드: `SimEngine.ts` `stepCollision` 메서드, `getZonePolygon`/`getZoneWalls` (transit.ts)

### 수정 완료 (uncommitted)
- **게이트 드래그**: sim 후 카메라 좌표 캐시로 해결 (`CanvasPanel.tsx`)
- **Occupancy 게이지**: currentZoneId → 위치 기반 bounds 체크 (`ZoneRenderer.ts`)

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
| **Pinpoint 분석** | ⬜ 스텁 |
| **Structured Reporting** | ⬜ 스텁 |
| **Advanced Analytics (트렌드/민감도)** | ⬜ 스텁 |

## 작업 규칙
- 기능 하나 완성 → 시뮬레이션 테스트 → 커밋. 한 세션에 한 기능.
- `window.__store`로 브라우저 콘솔에서 store 접근 가능
- 시뮬레이션 데이터 정합성: `totalSpawned = active + totalExited` 항상 검증
- Zone 배열 순서: [0]=spawn, [last]=exit, 중간=exhibition/rest/stage
