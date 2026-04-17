# Plan: Media Polygon (Custom Shape) Hitbox

## Context
현재 미디어는 `rect`/`circle` 두 가지 형태만 지원. 자유 형태(polygon) 히트박스를 추가하여 L자, 곡면, 비정형 전시물을 표현할 수 있게 한다. Zone의 custom polygon 구현 패턴을 미디어에 적용.

---

## 변경 파일 및 내용

### 1. Domain Type 확장
**`src/domain/types/media.ts`**
- `MediaShape` 타입에 `'custom'` 추가: `'rect' | 'circle' | 'custom'`
- `MediaPlacement`에 `polygon?: readonly Vector2D[]` 필드 추가

### 2. uiSlice — 미디어 폴리곤 편집 모드
**`src/stores/slices/uiSlice.ts`**
- `mediaPolygonEditMode: boolean` 상태 추가
- `setMediaPolygonEditMode(on: boolean)` 액션 추가
- 기존 `polygonEditMode`(zone용)과 별도 관리

### 3. SimEngine — 폴리곤 물리 충돌
**`src/simulation/engine/SimEngine.ts`**
- `isMediaPolygon(m)`: `m.shape === 'custom' && m.polygon?.length > 2`
- `getMediaRect(m)`: polygon일 때 vertices에서 AABB 계산
- `getMediaWalls(m)`: polygon vertices 순회하여 wall segments 반환
- `isInsideMedia(pos, m)`: `isPointInPolygon()` (이미 import됨) 재사용
- `pushOutsideMedia(pos, m)`: `pushOutsidePolygon()` import하여 재사용
- `getMediaSlotPosition(m, idx)`: polygon일 때 polygon centroid 기반 slot 배치

### 4. MediaRenderer — 폴리곤 렌더링
**`src/visualization/renderers/MediaRenderer.ts`**
- polygon 분기 추가 (rect/circle 분기와 동일 레벨)
- `ctx.moveTo/lineTo`로 polygon path 그리기
- **중요**: 미디어 렌더링은 `ctx.translate(position) + ctx.rotate(rad)` 이후 로컬 좌표에서 그림. polygon vertices는 월드 좌표이므로, polygon일 때는 rotation 전에 그리거나, polygon을 position-relative 좌표로 저장
- **결정**: polygon vertices를 **미디어 center 기준 상대좌표**로 저장 (zone과 달리 미디어는 이동/회전이 빈번). 렌더링 시 translate+rotate 후 상대좌표 그대로 사용 가능
- 선택 시 vertex handles (흰색 원, zone 패턴) 표시
- resize handle 대신 vertex handle 사용

### 5. MediaEditor UI
**`src/ui/panels/build/MediaEditor.tsx`**
- Shape 드롭다운에 "Polygon" 옵션 추가
- `custom` shape일 때 width/height 입력 숨김 (bounds에서 자동 계산)
- "Edit Shape" / "Complete" 토글 버튼 (zone 패턴)
- orientation slider는 유지 (polygon 전체 회전에 사용)

### 6. CanvasPanel — 버텍스 인터랙션
**`src/ui/panels/canvas/CanvasPanel.tsx`**
- DragMode에 `'media-vertex'` 추가
- mediaPolygonEditMode일 때:
  - vertex hit (8px) → drag vertex
  - edge midpoint hit (6px) → insert vertex + drag
  - right-click vertex → delete (polygon.length > 3)
- vertex drag 시 polygon 업데이트 + AABB(size) 재계산
- Escape → mediaPolygonEditMode 해제

### 7. Shape 전환 로직
**`src/ui/panels/build/MediaEditor.tsx`** 또는 **worldSlice**
- rect/circle → custom 전환 시: 현재 rect의 4개 꼭짓점을 로컬 좌표(center 기준)로 생성
- custom → rect/circle 전환 시: polygon AABB로 size 복원, polygon 삭제

---

## 좌표계 결정

**미디어 polygon = center-relative 로컬 좌표** (orientation rotation 적용 전)
- 저장: `polygon: [{x: -30, y: -20}, {x: 30, y: -20}, ...]` (center = 0,0)
- 렌더링: `ctx.translate(pos) → ctx.rotate(rad)` 후 그대로 사용
- 충돌: SimEngine에서 월드 좌표 변환 필요 (rotate + translate)
- 편집: CanvasPanel에서 월드→로컬 좌표 변환 후 vertex 업데이트

이 방식의 장점: 미디어 이동 시 polygon 좌표 변경 불필요, orientation 회전이 자연스럽게 동작

---

## 재사용 함수
- `isPointInPolygon()` — `src/simulation/collision/resolution.ts` (SimEngine에 이미 import됨)
- `pushOutsidePolygon()` — `src/simulation/collision/resolution.ts` (새로 import)
- `ptInPoly()` — `src/ui/panels/canvas/CanvasPanel.tsx` (이미 존재)
- `closestPointOnSeg()` — CanvasPanel에 이미 존재
- `getZoneVertices()` 패턴 참고 — `src/domain/zoneGeometry.ts`

---

## Verification
1. Dev server 실행, 미디어 생성 후 shape를 "Polygon"으로 변경
2. "Edit Shape" 클릭 → vertex handles 확인
3. Vertex drag, edge 클릭으로 vertex 추가, right-click으로 삭제
4. 시뮬레이션 실행 → agent가 polygon 미디어를 통과하지 않는지 확인
5. 미디어 이동/회전이 polygon과 함께 정상 동작하는지 확인
