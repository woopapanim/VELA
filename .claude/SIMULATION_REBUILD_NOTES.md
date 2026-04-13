# Simulation Engine Rebuild Notes (v3)

## 완료된 작업

### SimEngine v2 (완전 재작성)
- 명확한 상태머신: stepBehavior → stepSteering → stepPhysics → stepCollision → stepFatigue
- 존 타입 통합: zones[0]=스폰, zones[last]=퇴장, 나머지=방문대상
- isSettled 개념: 존 안 정착 시에만 wall collision/avoidance
- Transit waypoint 시스템: L자 gap routing으로 존 우회

### 동선
- 시퀀셜: zones 배열 순서대로 방문. fatigue 무관하게 순서 준수
- 자유: selectNextZone weighted random. 모든 middle zone 방문 전 Exit 차단
- 하이브리드: guidedUntilIndex까지 시퀀셜, 이후 자유

### 존 시스템
- 모든 존에 entrance + exit gate (bidirectional 호환)
- 존 겹침 방지 (store 레벨 + canvas 레벨)
- L-shape 존 지원 (gate 자동 재배치)
- 존 순서 드래그 변경 + gate rechain

### Transit 경로
- L자 gap routing: 존 사이 빈 공간으로 우회
- 세로 배치: 좌/우 우회
- exitGatePos → exitOutward → gapCorners → entryApproach → entryGatePos → center
- routeAroundZones: 직선이 존을 관통하면 모서리 우회

### 미디어 Phase 1
- **물리 엔터티**: 미디어 = rect 장애물 (collision + steering avoidance)
- **PASSIVE (관람형)**: LED wall 등. 관람구역 도착 → 바로 WATCHING. soft capacity 초과 시 skip
- **ACTIVE (체험형)**: 키오스크, VR 등. wait point → capacity 체크 → 슬롯 배치 or WAITING → skip
- **Interaction point**: orientation 기반 정면 접근 (PASSIVE=가까이, ACTIVE=대기공간)
- **미디어 slot 배치**: capacity에 따라 미디어 rect 안에 분산
- **MediaRenderer**: rect + orientation 회전 + 이름 텍스트 + capacity 색상
- **MediaEditor 패널**: name, size, orientation, interactionType, capacity, engagement, attractiveness
- **캔버스 미디어 드래그/회전**: 클릭 선택, 드래그 이동, 회전 핸들

### 데이터 수집
- totalSpawned / totalExited 카운터
- 미디어별 stats: watchCount, skipCount, waitCount, totalWatchMs, totalWaitMs, peakViewers
- _tickMediaViewers: 같은 tick race condition 방지
- MediaStatsPanel: 미디어별 실시간 통계 (Watched, Skipped, Skip%, Avg Watch, Waited, Peak)

### KPI
- throughput: totalExited / minutesElapsed (정상 동작)
- fatigue: 현실적 수치 (general ~45분에 100%)
- skip threshold: maxWaitTimeMs 30초, skipMultiplier 조절 가능 (UI)
- 데이터 정합성: totalSpawned = active + totalExited (항상 true)

### UI
- 속도 조절 버튼 (1x/3x/5x/10x/20x)
- Skip Threshold 설정 (Max Wait, Skip Multiplier)
- 존 겹침 방지
- 존 순서 드래그 + gate rechain
- Media Activity 패널 (우측)

## 핵심 파일
- `src/simulation/engine/SimEngine.ts` — 메인 엔진 (v2 재작성)
- `src/simulation/engine/transit.ts` — zone polygon, walls, gate finder
- `src/simulation/collision/resolution.ts` — collision + pushOutsidePolygon
- `src/visualization/renderers/MediaRenderer.ts` — 미디어 시각화
- `src/ui/panels/build/MediaEditor.tsx` — 미디어 편집 패널
- `src/ui/panels/analytics/MediaStatsPanel.tsx` — 미디어 통계 패널
- `src/ui/panels/build/SimulationControls.tsx` — 시뮬 제어 + 속도
- `src/ui/panels/canvas/CanvasPanel.tsx` — 캔버스 인터랙션
- `src/analytics/calculators/flow.ts` — throughput 계산
- `src/domain/constants.ts` — MEDIA_SCALE, FATIGUE_RATES, SKIP_THRESHOLD

## 남은 작업
- [ ] 미디어 형태 변경 (Circle, L-shape, Custom Polygon)
- [ ] STAGED (회차형) 미디어
- [ ] 미디어 데이터 CSV 내보내기
- [ ] 그룹 행동 (followLeader, groupCohesion)
- [ ] 디버그 시각화 (transit 경로, interaction area 토글)
- [ ] 미디어 에디터 고도화 (캔버스 리사이즈 핸들)
