import type { BottleneckIndex } from '@/domain';
import { NORM_BOTTLENECK_SCORE } from '../norms/library';

// Step 2 (2026-04-30): zone 별 정체 누적 시간 추적.
// "정체" 정의 = bottleneckIndex.score >= NORM_BOTTLENECK_SCORE.goodAt (0.6, "가시적 정체").
// snapshot 호출 간격을 dt 로 보고 임계 이상 zone 에 누적. peakOccupancy 와 같은 module-level
// 패턴 — 시뮬레이션 시작 시 resetCongestionTracking() 호출 필요.
const congestedMsMap = new Map<string, number>();
let lastSimTimeMs = 0;

const CONGESTION_THRESHOLD = NORM_BOTTLENECK_SCORE.goodAt;

export function resetCongestionTracking(): void {
  congestedMsMap.clear();
  lastSimTimeMs = 0;
}

// 직전 snapshot 부터의 dt 를 임계 이상 zone 에 누적. 호출 후 zoneId → cumulativeMs 맵 반환.
// 첫 호출 (lastSimTimeMs=0) 은 dt=simTimeMs 인 모순이 있어 초기 호출은 누적 skip.
export function accumulateCongestionTime(
  bottlenecks: readonly BottleneckIndex[],
  simTimeMs: number,
): ReadonlyMap<string, number> {
  if (lastSimTimeMs > 0) {
    const dt = Math.max(0, simTimeMs - lastSimTimeMs);
    if (dt > 0) {
      for (const b of bottlenecks) {
        if (b.score >= CONGESTION_THRESHOLD) {
          const zid = b.zoneId as string;
          congestedMsMap.set(zid, (congestedMsMap.get(zid) ?? 0) + dt);
        }
      }
    }
  }
  lastSimTimeMs = simTimeMs;
  return congestedMsMap;
}
