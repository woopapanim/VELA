import type { DensityGrid, KpiSnapshot, WaypointGraph, ZoneConfig } from '@/domain';

// ─────────────────────────────────────────────────────────────────────
// 공간 밀도 합성 — live densityGrid 가 없을 때 (예: replay, RunRecord 로드)
// zone peakOccupancy + waypoint edge 기반으로 visitor-seconds 흐름을 모사한다.
// HeatmapRenderer 의 softMax / ramp 와 같은 normalization 톤을 공유한다.
// ─────────────────────────────────────────────────────────────────────

/**
 * Cool blue → cyan → green → yellow → red 의 클래식 dwell-heat ramp.
 * `t` = 0~1 정규화 강도. 반환은 RGBA 0-255.
 *
 * `HeatmapRenderer.ramp` 와 동일 — 두 곳에서 공유해 일관된 색감 유지.
 */
export function ramp(t: number): [number, number, number, number] {
  const stops: Array<[number, number, number, number]> = [
    [0.00, 40, 80, 200],
    [0.25, 40, 180, 220],
    [0.50, 80, 220, 120],
    [0.75, 250, 210, 60],
    [1.00, 230, 60, 60],
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0];
  const k = span > 0 ? (t - lo[0]) / span : 0;
  return [
    Math.round(lo[1] + (hi[1] - lo[1]) * k),
    Math.round(lo[2] + (hi[2] - lo[2]) * k),
    Math.round(lo[3] + (hi[3] - lo[3]) * k),
    Math.round(140 + 100 * t),
  ];
}

/**
 * 80th-percentile 기반 soft max — 단일 outlier 가 전체 색을 평탄화하지 않게.
 * 데이터 32셀 미만이면 그냥 max (히스토그램 의미 없음).
 */
export function softMax(data: Float32Array): number {
  let max = 0, nonzero = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v > 0) { nonzero++; if (v > max) max = v; }
  }
  if (nonzero === 0) return 0;
  if (nonzero < 32) return max;

  const B = 64;
  const hist = new Uint32Array(B);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v <= 0) continue;
    const b = Math.min(B - 1, Math.floor((v / max) * B));
    hist[b]++;
  }
  const target = Math.floor(nonzero * 0.80);
  let acc = 0;
  for (let b = 0; b < B; b++) {
    acc += hist[b];
    if (acc >= target) return ((b + 1) / B) * max;
  }
  return max;
}

interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

function unionWorldBounds(zones: readonly ZoneConfig[], graph: WaypointGraph | null): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const z of zones) {
    if (z.bounds.x < minX) minX = z.bounds.x;
    if (z.bounds.y < minY) minY = z.bounds.y;
    if (z.bounds.x + z.bounds.w > maxX) maxX = z.bounds.x + z.bounds.w;
    if (z.bounds.y + z.bounds.h > maxY) maxY = z.bounds.y + z.bounds.h;
  }
  if (graph) {
    for (const n of graph.nodes) {
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.y < minY) minY = n.position.y;
      if (n.position.x > maxX) maxX = n.position.x;
      if (n.position.y > maxY) maxY = n.position.y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Replay/RunRecord 시나리오에서 live densityGrid 가 비어있을 때 합성 grid 생성.
 *
 * 1) Zone 내부: peakRatio 기반 plateau (r<0.5) + 외곽 가우시안 falloff (r<1.5)
 *    → 가운데 단단한 hot 코어, 자연스러운 경계
 * 2) Waypoint edges: zone 평균 ratio 의 40% 강도로 path trail
 *    → 통로(corridor) 따라 약한 dwell trail, 사용자가 보는 reference image 톤 재현
 *
 * floorId 는 'synthetic' 표식 — 비교 로직에 사용하지 말 것.
 */
export function synthesizeDensityGrid(
  zones: readonly ZoneConfig[],
  snapshot: KpiSnapshot,
  cellPx: number,
  graph: WaypointGraph | null = null,
): DensityGrid | null {
  if (zones.length === 0) return null;

  const bounds = unionWorldBounds(zones, graph);
  if (!bounds) return null;

  const { minX, minY, maxX, maxY } = bounds;
  const pad = Math.max(2, Math.min(maxX - minX, maxY - minY) * 0.1);
  const originX = minX - pad;
  const originY = minY - pad;
  const cols = Math.max(16, Math.ceil(((maxX - minX) + pad * 2) / cellPx));
  const rows = Math.max(16, Math.ceil(((maxY - minY) + pad * 2) / cellPx));
  const data = new Float32Array(cols * rows);

  // 1) Zone plateau + falloff. zone 외부 1.5x bounds 까지만 영향 — bounding-box 컬링.
  for (const z of zones) {
    const u = snapshot.zoneUtilizations.find((zu) => zu.zoneId === z.id);
    if (!u || u.capacity <= 0 || u.peakOccupancy <= 0) continue;
    const ratio = u.peakOccupancy / u.capacity;
    const cx = z.bounds.x + z.bounds.w / 2;
    const cy = z.bounds.y + z.bounds.h / 2;
    const halfW = z.bounds.w / 2;
    const halfH = z.bounds.h / 2;

    // r=1.5 (정규화) 까지만 weight > 0 — 그 외는 컬. zone 영역 1.5x 박스로 grid 범위 축소.
    const wxMin = z.bounds.x - halfW * 0.5;
    const wxMax = z.bounds.x + z.bounds.w + halfW * 0.5;
    const wyMin = z.bounds.y - halfH * 0.5;
    const wyMax = z.bounds.y + z.bounds.h + halfH * 0.5;
    const colStart = Math.max(0, Math.floor((wxMin - originX) / cellPx));
    const colEnd   = Math.min(cols, Math.ceil((wxMax - originX) / cellPx));
    const rowStart = Math.max(0, Math.floor((wyMin - originY) / cellPx));
    const rowEnd   = Math.min(rows, Math.ceil((wyMax - originY) / cellPx));

    for (let row = rowStart; row < rowEnd; row++) {
      const wy = originY + (row + 0.5) * cellPx;
      const ny = (wy - cy) / halfH;
      for (let col = colStart; col < colEnd; col++) {
        const wx = originX + (col + 0.5) * cellPx;
        const nx = (wx - cx) / halfW;
        const r = Math.sqrt(nx * nx + ny * ny);
        let weight = 0;
        if (r < 0.5) weight = 1;
        else if (r < 1.5) {
          const t = (r - 0.5) / 1.0;
          weight = Math.exp(-t * t * 4);
        }
        if (weight > 0) {
          data[row * cols + col] += ratio * weight;
        }
      }
    }
  }

  // 2) Waypoint edges → path trail. 평균 ratio × 0.4 강도로 통로 따라 가우시안 plant.
  if (graph && graph.edges.length > 0) {
    let avgRatio = 0;
    let cnt = 0;
    for (const u of snapshot.zoneUtilizations) {
      if (u.capacity > 0) { avgRatio += u.peakOccupancy / u.capacity; cnt++; }
    }
    avgRatio = cnt > 0 ? avgRatio / cnt : 0;
    const pathIntensity = avgRatio * 0.4;

    if (pathIntensity > 0.01) {
      const nodeMap = new Map(graph.nodes.map((n) => [n.id as string, n]));
      const radius = Math.max(2, cellPx * 2);
      const radiusCellHalfRange = Math.ceil(radius * 1.2 / cellPx);
      for (const e of graph.edges) {
        const a = nodeMap.get(e.fromId as string);
        const b = nodeMap.get(e.toId as string);
        if (!a || !b) continue;
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-3) continue;

        const samples = Math.max(8, Math.ceil(len / cellPx));
        for (let s = 0; s <= samples; s++) {
          const t = s / samples;
          const px = a.position.x + dx * t;
          const py = a.position.y + dy * t;

          // (px, py) 주변 radius*1.2 안의 cell 만 — bounding-box 컬링.
          const sampleColStart = Math.max(0, Math.floor((px - originX) / cellPx) - radiusCellHalfRange);
          const sampleColEnd   = Math.min(cols, Math.ceil((px - originX) / cellPx) + radiusCellHalfRange);
          const sampleRowStart = Math.max(0, Math.floor((py - originY) / cellPx) - radiusCellHalfRange);
          const sampleRowEnd   = Math.min(rows, Math.ceil((py - originY) / cellPx) + radiusCellHalfRange);

          for (let row = sampleRowStart; row < sampleRowEnd; row++) {
            const wy = originY + (row + 0.5) * cellPx;
            const ddy = wy - py;
            for (let col = sampleColStart; col < sampleColEnd; col++) {
              const wx = originX + (col + 0.5) * cellPx;
              const ddx = wx - px;
              const d2 = ddx * ddx + ddy * ddy;
              const w = Math.exp(-d2 / (radius * radius * 0.5));
              if (w > 0.01) {
                data[row * cols + col] += pathIntensity * w / samples;
              }
            }
          }
        }
      }
    }
  }

  return {
    floorId: 'synthetic' as DensityGrid['floorId'],
    originX,
    originY,
    cellPx,
    cols,
    rows,
    data,
  };
}
