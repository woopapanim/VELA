import type { KpiTimeSeriesEntry } from '@/domain';

export type KeyMomentKind =
  | 'peak_congestion'
  | 'first_bottleneck'
  | 'peak_fatigue'
  | 'peak_active'
  | 'final';

export interface KeyMoment {
  readonly kind: KeyMomentKind;
  readonly timestampMs: number;
  readonly entryIndex: number;
  readonly label: string;     // short tag e.g. "Peak Congestion"
  readonly caption: string;   // one-line context, ko
  readonly metricValue: number;
}

/**
 * Picks up to ~5 distinct narrative moments from a kpiHistory time-series.
 * Each kind shows at most once. Ties broken by earliest occurrence.
 * Returns moments sorted ascending by timestamp.
 */
export function extractKeyMoments(history: readonly KpiTimeSeriesEntry[]): KeyMoment[] {
  if (history.length === 0) return [];

  const moments: KeyMoment[] = [];
  const usedIdx = new Set<number>();

  // 1. Peak congestion: max ratio across any zone
  let bestCongIdx = -1;
  let bestCong = -1;
  for (let i = 0; i < history.length; i++) {
    const r = Math.max(0, ...history[i].snapshot.zoneUtilizations.map((u) => u.ratio));
    if (r > bestCong) { bestCong = r; bestCongIdx = i; }
  }
  if (bestCongIdx >= 0 && bestCong > 0) {
    moments.push({
      kind: 'peak_congestion',
      timestampMs: history[bestCongIdx].timestamp,
      entryIndex: bestCongIdx,
      label: 'Peak Congestion',
      caption: `최대 혼잡도 ${Math.round(bestCong * 100)}% 도달`,
      metricValue: bestCong,
    });
    usedIdx.add(bestCongIdx);
  }

  // 2. First sustained bottleneck (any score > 0.5)
  for (let i = 0; i < history.length; i++) {
    if (usedIdx.has(i)) continue;
    const worst = Math.max(0, ...history[i].snapshot.bottlenecks.map((b) => b.score));
    if (worst > 0.5) {
      moments.push({
        kind: 'first_bottleneck',
        timestampMs: history[i].timestamp,
        entryIndex: i,
        label: 'First Bottleneck',
        caption: `첫 병목 발생 (score ${worst.toFixed(2)})`,
        metricValue: worst,
      });
      usedIdx.add(i);
      break;
    }
  }

  // 3. Peak fatigue: max p90
  let bestFatIdx = -1;
  let bestFat = -1;
  for (let i = 0; i < history.length; i++) {
    const p90 = history[i].snapshot.fatigueDistribution?.p90 ?? 0;
    if (p90 > bestFat) { bestFat = p90; bestFatIdx = i; }
  }
  if (bestFatIdx >= 0 && bestFat > 0 && !usedIdx.has(bestFatIdx)) {
    moments.push({
      kind: 'peak_fatigue',
      timestampMs: history[bestFatIdx].timestamp,
      entryIndex: bestFatIdx,
      label: 'Peak Fatigue',
      caption: `평균 피로도 P90 ${Math.round(bestFat * 100)}% 도달`,
      metricValue: bestFat,
    });
    usedIdx.add(bestFatIdx);
  }

  // 4. Peak active visitor count: max sum(currentOccupancy)
  let bestActIdx = -1;
  let bestAct = -1;
  for (let i = 0; i < history.length; i++) {
    const total = history[i].snapshot.zoneUtilizations.reduce((s, u) => s + u.currentOccupancy, 0);
    if (total > bestAct) { bestAct = total; bestActIdx = i; }
  }
  if (bestActIdx >= 0 && bestAct > 0 && !usedIdx.has(bestActIdx)) {
    moments.push({
      kind: 'peak_active',
      timestampMs: history[bestActIdx].timestamp,
      entryIndex: bestActIdx,
      label: 'Peak Occupancy',
      caption: `동시 활성 관람객 ${bestAct}명 정점`,
      metricValue: bestAct,
    });
    usedIdx.add(bestActIdx);
  }

  // 5. Final state — only if not the same as another already-picked moment
  const lastIdx = history.length - 1;
  if (!usedIdx.has(lastIdx)) {
    const last = history[lastIdx];
    const totalActive = last.snapshot.zoneUtilizations.reduce((s, u) => s + u.currentOccupancy, 0);
    moments.push({
      kind: 'final',
      timestampMs: last.timestamp,
      entryIndex: lastIdx,
      label: 'Final State',
      caption: `시뮬레이션 종료 — 잔여 ${totalActive}명`,
      metricValue: totalActive,
    });
    usedIdx.add(lastIdx);
  }

  return moments.sort((a, b) => a.timestampMs - b.timestampMs);
}
