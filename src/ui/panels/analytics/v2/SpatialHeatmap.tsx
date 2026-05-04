import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import type { DensityGrid, KpiSnapshot, WaypointGraph, ZoneConfig } from '@/domain';
import { synthesizeDensityGrid, ramp, softMax } from '@/analytics/spatial/synthesizeDensity';

interface Props {
  zones: readonly ZoneConfig[];
  snapshot: KpiSnapshot | null;
  /** Live 시뮬레이션 densityGrids — 우선 사용, 없으면 합성. */
  densityGrids?: ReadonlyMap<string, DensityGrid> | null;
  /** Waypoint graph — node/edge overlay + path-trail 합성 입력. */
  waypointGraph?: WaypointGraph | null;
  /** zone 클릭 → drilldown */
  onSelectZone?: (zoneId: string) => void;
  selectedZoneId?: string | null;
}

const HEATMAP_HEIGHT_PX = 360;

// Waypoint node 타입별 색 (WaypointRenderer 와 동일 톤).
const NODE_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  entry:     { fill: '#22c55e', stroke: '#16a34a', label: 'E' },
  exit:      { fill: '#ef4444', stroke: '#dc2626', label: 'X' },
  zone:      { fill: '#3b82f6', stroke: '#2563eb', label: 'Z' },
  attractor: { fill: '#f59e0b', stroke: '#d97706', label: 'A' },
  hub:       { fill: '#8b5cf6', stroke: '#7c3aed', label: 'H' },
  rest:      { fill: '#f59e0b', stroke: '#d97706', label: 'R' },
  bend:      { fill: '#64748b', stroke: '#475569', label: '·' },
  portal:    { fill: '#06b6d4', stroke: '#0891b2', label: '↕' },
};

interface ViewBox { x: number; y: number; w: number; h: number }

function unionBounds(zones: readonly ZoneConfig[], graph: WaypointGraph | null): ViewBox {
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
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 100, h: 60 };
  const pad = Math.max(2, Math.min(maxX - minX, maxY - minY) * 0.08);
  return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
}

// Theme 변경 감지 — html.dark 클래스 토글 시 MutationObserver 로 갱신.
// ThemeProvider 가 <html> 의 dark 클래스를 토글한다는 가정.
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document === 'undefined') return true;
    return document.documentElement.classList.contains('dark');
  });
  const stableSet = useCallback((next: boolean) => setIsDark(next), []);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const update = () => stableSet(html.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [stableSet]);
  return isDark;
}

export function SpatialHeatmap({
  zones,
  snapshot,
  densityGrids,
  waypointGraph,
  onSelectZone,
  selectedZoneId,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isDark = useIsDark();
  const graph = waypointGraph ?? null;

  // 데이터 우선순위: live density > 합성. 합성은 zone peakOccupancy + waypoint path 기반.
  const densityGrid = useMemo<DensityGrid | null>(() => {
    if (!snapshot) return null;
    if (densityGrids) {
      for (const g of densityGrids.values()) {
        if (g.data.some((v) => v > 0)) return g;
      }
    }
    const cellPx = 0.5;
    return synthesizeDensityGrid(zones, snapshot, cellPx, graph);
  }, [snapshot, zones, densityGrids, graph]);

  const viewBox = useMemo(() => unionBounds(zones, graph), [zones, graph]);

  const worstZone = useMemo(() => {
    if (!snapshot) return null;
    let best: { zone: ZoneConfig; ratio: number; peak: number; cap: number } | null = null;
    for (const z of zones) {
      const u = snapshot.zoneUtilizations.find((zu) => zu.zoneId === z.id);
      if (!u || u.capacity <= 0) continue;
      const ratio = u.peakOccupancy / u.capacity;
      if (!best || ratio > best.ratio) best = { zone: z, ratio, peak: u.peakOccupancy, cap: u.capacity };
    }
    return best;
  }, [zones, snapshot]);

  // Offscreen heatmap canvas (densityGrid → ramp 적용된 imageData) — densityGrid/isDark 변경 시만 재계산.
  // selectedZoneId 변경에는 재계산 안 함 (overlay 만 다시 그림).
  useEffect(() => {
    if (!densityGrid || densityGrid.cols === 0 || densityGrid.rows === 0) {
      offscreenRef.current = null;
      return;
    }
    let cnv = offscreenRef.current;
    if (!cnv || cnv.width !== densityGrid.cols || cnv.height !== densityGrid.rows) {
      cnv = document.createElement('canvas');
      cnv.width = densityGrid.cols;
      cnv.height = densityGrid.rows;
      offscreenRef.current = cnv;
    }
    const ctx = cnv.getContext('2d');
    if (!ctx) return;
    const max = softMax(densityGrid.data);
    const inv = max > 0 ? 1 / max : 0;
    const img = ctx.createImageData(densityGrid.cols, densityGrid.rows);
    for (let i = 0; i < densityGrid.data.length; i++) {
      const v = Math.min(1, densityGrid.data[i] * inv);
      const j = i * 4;
      if (v < 0.01) { img.data[j + 3] = 0; continue; }
      const [r, g, b, a] = ramp(v);
      img.data[j] = r; img.data[j + 1] = g; img.data[j + 2] = b; img.data[j + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
  }, [densityGrid]);

  // Main canvas 그리기 — overlay (zone outline + waypoint) 는 selectedZoneId 변경에도 재실행.
  useEffect(() => {
    const cnv = canvasRef.current;
    const container = containerRef.current;
    if (!cnv || !container) return;

    const draw = () => {
      const cssW = container.clientWidth;
      const cssH = HEATMAP_HEIGHT_PX;
      const dpr = window.devicePixelRatio || 1;
      cnv.width = Math.round(cssW * dpr);
      cnv.height = Math.round(cssH * dpr);
      cnv.style.width = cssW + 'px';
      cnv.style.height = cssH + 'px';

      const ctx = cnv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      // World → screen 변환 (fit to viewBox, contain)
      const sx = cssW / viewBox.w;
      const sy = cssH / viewBox.h;
      const scale = Math.min(sx, sy);
      const offsetX = (cssW - viewBox.w * scale) / 2 - viewBox.x * scale;
      const offsetY = (cssH - viewBox.h * scale) / 2 - viewBox.y * scale;
      const wToS = (x: number, y: number) => ({
        x: x * scale + offsetX,
        y: y * scale + offsetY,
      });

      // 1. 배경 그리드.
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 0.5;
      const gridStep = Math.max(2, Math.round(viewBox.w / 30));
      for (let gx = Math.ceil(viewBox.x / gridStep) * gridStep; gx <= viewBox.x + viewBox.w; gx += gridStep) {
        const a = wToS(gx, viewBox.y);
        const b = wToS(gx, viewBox.y + viewBox.h);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (let gy = Math.ceil(viewBox.y / gridStep) * gridStep; gy <= viewBox.y + viewBox.h; gy += gridStep) {
        const a = wToS(viewBox.x, gy);
        const b = wToS(viewBox.x + viewBox.w, gy);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();

      // 2. Heatmap — offscreen bitmap + bilinear upscale + Gaussian blur.
      if (densityGrid && offscreenRef.current) {
        const dstX = densityGrid.originX * scale + offsetX;
        const dstY = densityGrid.originY * scale + offsetY;
        const dstW = densityGrid.cols * densityGrid.cellPx * scale;
        const dstH = densityGrid.rows * densityGrid.cellPx * scale;
        ctx.save();
        ctx.globalAlpha = isDark ? 0.92 : 0.82;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const cellScreenPx = densityGrid.cellPx * scale;
        ctx.filter = `blur(${Math.max(2, Math.round(cellScreenPx * 0.7))}px)`;
        ctx.drawImage(offscreenRef.current, dstX, dstY, dstW, dstH);
        ctx.restore();
      }

      // 3. Zone 외곽선 + 라벨.
      ctx.save();
      for (const z of zones) {
        const isSelected = selectedZoneId === z.id;
        const tl = wToS(z.bounds.x, z.bounds.y);
        const w = z.bounds.w * scale;
        const h = z.bounds.h * scale;
        ctx.strokeStyle = isSelected ? 'rgba(99,102,241,0.95)' : 'rgba(99,180,255,0.55)';
        ctx.lineWidth = isSelected ? 2 : 1;
        if (z.polygon && z.polygon.length >= 3) {
          ctx.beginPath();
          for (let i = 0; i < z.polygon.length; i++) {
            const p = wToS(z.polygon[i].x, z.polygon[i].y);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
          ctx.stroke();
        } else {
          ctx.strokeRect(tl.x, tl.y, w, h);
        }
        ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(z.name, tl.x + 4, tl.y + 3);
      }
      ctx.restore();

      // 4. Waypoint edges + arrows.
      if (graph) {
        const nodeMap = new Map(graph.nodes.map((n) => [n.id as string, n]));
        ctx.save();
        ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.5)' : 'rgba(71,85,105,0.4)';
        ctx.fillStyle = isDark ? 'rgba(148,163,184,0.5)' : 'rgba(71,85,105,0.4)';
        ctx.lineWidth = 1;
        for (const e of graph.edges) {
          const from = nodeMap.get(e.fromId as string);
          const to = nodeMap.get(e.toId as string);
          if (!from || !to) continue;
          const a = wToS(from.position.x, from.position.y);
          const b = wToS(to.position.x, to.position.y);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy);
          if (len > 12) {
            const ux = dx / len, uy = dy / len;
            const tipX = b.x - ux * 9;
            const tipY = b.y - uy * 9;
            const arrowSize = 6;
            const px = -uy * arrowSize * 0.6;
            const py = ux * arrowSize * 0.6;
            ctx.beginPath();
            ctx.moveTo(tipX + ux * arrowSize, tipY + uy * arrowSize);
            ctx.lineTo(tipX + px, tipY + py);
            ctx.lineTo(tipX - px, tipY - py);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.restore();

        // 5. Waypoint nodes — 컬러 원 + 라벨.
        for (const n of graph.nodes) {
          const p = wToS(n.position.x, n.position.y);
          const meta = NODE_COLORS[n.type] ?? NODE_COLORS.bend;
          const r = n.type === 'bend' ? 5 : 9;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = meta.fill;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = meta.stroke;
          ctx.stroke();
          if (n.type !== 'bend') {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(meta.label, p.x, p.y + 0.5);
          }
          if (n.label && n.type !== 'bend') {
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
            ctx.font = '9px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(n.label, p.x, p.y + r + 3);
          }
        }
        ctx.textAlign = 'start';
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [densityGrid, viewBox, zones, graph, isDark, selectedZoneId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelectZone) return;
    const cnv = canvasRef.current;
    const container = containerRef.current;
    if (!cnv || !container) return;
    const rect = cnv.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const sx = rect.width / viewBox.w;
    const sy = rect.height / viewBox.h;
    const scale = Math.min(sx, sy);
    const offsetX = (rect.width - viewBox.w * scale) / 2 - viewBox.x * scale;
    const offsetY = (rect.height - viewBox.h * scale) / 2 - viewBox.y * scale;
    const wx = (cx - offsetX) / scale;
    const wy = (cy - offsetY) / scale;
    for (const z of zones) {
      const inX = wx >= z.bounds.x && wx <= z.bounds.x + z.bounds.w;
      const inY = wy >= z.bounds.y && wy <= z.bounds.y + z.bounds.h;
      if (inX && inY) {
        onSelectZone(z.id as string);
        return;
      }
    }
  };

  if (zones.length === 0 || !snapshot) return null;

  const sortedZones = [...zones]
    .map((z) => {
      const u = snapshot.zoneUtilizations.find((zu) => zu.zoneId === z.id);
      const ratio = u && u.capacity > 0 ? u.peakOccupancy / u.capacity : 0;
      return { z, ratio };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);

  return (
    <section
      id="spatial"
      className="rounded-xl border border-border bg-[var(--surface)] overflow-hidden scroll-mt-4 flex-shrink-0"
    >
      <header className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/60">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--status-warning)]/10">
          <Flame className="w-4 h-4 text-[var(--status-warning)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold tracking-tight">공간 점유 히트맵</h3>
          <p className="text-[10.5px] text-muted-foreground leading-snug">
            누적 visitor-seconds 밀도 — 도면 위 색이 진할수록 사람이 오래 머문 곳
          </p>
        </div>
        {worstZone && (
          <div className="flex items-center gap-2 text-[11px] flex-shrink-0">
            <span className="text-muted-foreground">최고</span>
            <span className="font-data tabular-nums font-semibold text-foreground">{worstZone.zone.name}</span>
            <span className={`font-data tabular-nums font-semibold ${
              worstZone.ratio >= 0.85 ? 'text-[var(--status-danger)]'
              : worstZone.ratio >= 0.7 ? 'text-[var(--status-warning)]'
              : 'text-foreground/85'
            }`}>
              {Math.round(worstZone.ratio * 100)}%
            </span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px]">
        <div ref={containerRef} className="relative bg-[color:var(--background)]/40 border-r border-border/40">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`block w-full ${onSelectZone ? 'cursor-pointer' : ''}`}
            style={{ height: HEATMAP_HEIGHT_PX }}
            aria-label="공간 점유 히트맵"
          />
          <div className="absolute bottom-2 left-2 flex items-center gap-2 px-2 py-1 rounded-md bg-background/70 backdrop-blur-sm border border-border/40 text-[9px] uppercase tracking-wider">
            <span className="text-muted-foreground">cool</span>
            <div className="w-24 h-1.5 rounded-full" style={{
              background: 'linear-gradient(to right, rgb(40,80,200), rgb(40,180,220), rgb(80,220,120), rgb(250,210,60), rgb(230,60,60))',
            }} />
            <span className="text-muted-foreground">hot</span>
          </div>
        </div>

        <div className="px-3 py-2.5 flex flex-col gap-3">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">
              상위 zone (피크 점유율)
            </div>
            <ul className="space-y-0.5">
              {sortedZones.map(({ z, ratio }, i) => {
                const isSelected = selectedZoneId === z.id;
                return (
                  <li key={z.id as string}>
                    <button
                      type="button"
                      disabled={!onSelectZone}
                      onClick={() => onSelectZone?.(z.id as string)}
                      className={`w-full flex items-center gap-2 text-[11px] rounded-md px-1.5 py-1 transition-colors text-left ${
                        isSelected
                          ? 'bg-primary/10 ring-1 ring-primary/40'
                          : onSelectZone
                          ? 'hover:bg-secondary/50'
                          : ''
                      }`}
                    >
                      <span className="font-data tabular-nums text-muted-foreground/60 w-3 flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{z.name}</span>
                      <span className={`font-data tabular-nums ${
                        ratio >= 0.85 ? 'text-[var(--status-danger)]'
                        : ratio >= 0.7 ? 'text-[var(--status-warning)]'
                        : 'text-foreground/85'
                      }`}>
                        {Math.round(ratio * 100)}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-[9px] text-muted-foreground/70 leading-snug border-t border-border/40 pt-2">
            live density 가 있으면 실제 누적, 없으면 zone peak 기반 가우시안 합성.
          </p>
        </div>
      </div>

      {/* Screen reader 전용 zone × 점유율 테이블 — 캔버스만으로는 SR 접근 불가하므로 */}
      <table className="sr-only" aria-label="Zone 별 피크 점유율 테이블">
        <thead>
          <tr>
            <th scope="col">Zone</th>
            <th scope="col">최대 점유</th>
            <th scope="col">수용량</th>
            <th scope="col">점유율</th>
          </tr>
        </thead>
        <tbody>
          {sortedZones.map(({ z, ratio }) => {
            const u = snapshot.zoneUtilizations.find((zu) => zu.zoneId === z.id);
            return (
              <tr key={z.id as string}>
                <td>{z.name}</td>
                <td>{u?.peakOccupancy ?? 0}</td>
                <td>{u?.capacity ?? 0}</td>
                <td>{Math.round(ratio * 100)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
