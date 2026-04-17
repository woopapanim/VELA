# Plan: Media Polygon Shape + Group Size Fix

## Context
Two changes requested:
1. **Media polygon editing** — Currently media only supports `rect` and `circle`. Need `custom` polygon shape with vertex add/move/delete, reusing the zone polygon editing pattern.
2. **Group size bug** — Small groups (expected 2-4) always produce 2 members because `Math.min(maxSize, remaining)` clamps the range when remaining is small, and the spawn loop frequently hits this case.

---

## Task 1: Media Polygon Shape Editing

### 1A. Domain type extension
**File:** `src/domain/types/media.ts`
- Extend `MediaShape`: `'rect' | 'circle' | 'custom'`
- Add `polygon?: Vector2D[]` field to `MediaPlacement`

### 1B. MediaRenderer — polygon rendering
**File:** `src/visualization/renderers/MediaRenderer.ts`
- Add polygon branch alongside circle/rect (lines 79-101)
  - Use `ctx.moveTo/lineTo` to draw polygon path
  - Fill + stroke same as rect/circle
- Resize handles: show vertex handles (white circles like zone, line 113-123 of ZoneRenderer) instead of corner squares when `shape === 'custom'`
- Rotation handle: still show front indicator based on orientation

### 1C. MediaEditor UI — shape dropdown + edit button
**File:** `src/ui/panels/build/MediaEditor.tsx`
- Add "Polygon" option to shape dropdown (line 110-121)
- When shape is `custom` and not editing: show "Edit Shape" button (same as ZoneEditor pattern, line 210-218)
- When editing: show "Complete" button
- Hide width/height size inputs when shape is `custom` (size derived from polygon bounds)
- New UI state: `mediaPolygonEditMode` in uiSlice

### 1D. uiSlice — media polygon edit mode state
**File:** `src/stores/slices/uiSlice.ts`
- Add `mediaPolygonEditMode: boolean` + `setMediaPolygonEditMode(on: boolean)`

### 1E. CanvasPanel — vertex interactions for media
**File:** `src/ui/panels/canvas/CanvasPanel.tsx`
- New DragMode: `'media-vertex'`
- On mouseDown with selected media + custom shape + mediaPolygonEditMode:
  1. Check vertex hit (8px radius) → start `media-vertex` drag
  2. Check edge hit (6px) → insert vertex + start drag
- On mouseMove with `media-vertex` mode: update vertex position
- On mouseUp: finalize vertex position, recalc polygon bounds
- Right-click on vertex → delete vertex (if polygon.length > 3)
- Escape exits media polygon edit mode
- Reuse existing `closestPointOnSeg` helper

### 1F. SimEngine — polygon hitbox physics
**File:** `src/simulation/engine/SimEngine.ts`
- `isMediaCircle()` stays as-is
- Add `isMediaPolygon()` check
- `getMediaRect()` for polygon: compute AABB from vertices
- `getMediaWalls()` for polygon: return consecutive vertex pairs as wall segments
- `isInsideMedia()` for polygon: use point-in-polygon test (reuse `ptInPoly` from CanvasPanel or extract to utility)
- `pushOutsideMedia()` for polygon: find nearest edge, push perpendicular

### 1G. Initial polygon creation
When user switches media shape from rect/circle to custom:
- Generate initial polygon from current rect bounds (4 corners, rotated by orientation)
- Store in `polygon` field
- This gives them a starting shape they can then edit

---

## Task 2: Group Size Bug Fix

### Root Cause
**File:** `src/simulation/spawner/VisitorSpawner.ts` (line 159)

```typescript
const groupSize = rng.nextInt(minSize, Math.min(maxSize, remaining));
```

When `remaining <= maxSize`, the clamping makes `nextInt(2, 2)` or `nextInt(2, 3)` — biasing toward small groups. Worse, the spawn loop mixes solo/group categories, so `remaining` frequently drops to small numbers.

### Fix
Line 159-160: Don't clamp by remaining. Instead, if remaining < minSize, skip group and spawn solo. If remaining >= minSize, use full range `nextInt(minSize, maxSize)` and clamp the result to remaining after the fact:

```typescript
if (remaining < minSize) { 
  // Not enough for a group — fall through to spawn as solo
  remaining -= 1; continue; 
}
const groupSize = Math.min(rng.nextInt(minSize, maxSize), remaining);
```

This ensures the random distribution is uniform across [2,4] and only clips the result when absolutely necessary (end of batch).

Same fix for GUIDED_TOUR block (line 193).

---

## Verification
1. Run dev server, create a media, change shape to "Polygon"
2. Click "Edit Shape" → verify vertex handles appear
3. Drag vertices, click edges to add, right-click to delete
4. Run simulation → verify agents collide with polygon media correctly
5. For group fix: run simulation with small_group distribution, check group sizes in console (`window.__store.getState()`) — should see groups of 3 and 4, not just 2
