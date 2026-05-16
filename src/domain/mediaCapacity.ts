import type { MediaPlacement } from './types';

/**
 * Single source of truth for media capacity.
 *
 * 2026-05-13 (옵션 B per-device 일관성 작업):
 * `m.capacity` 필드는 옛 slot-count 모델의 잔재로 analog/passive 에서 deprecated.
 * 실제 capacity 는 면적 기반으로만 계산. MediaEditor 는 analog/passive 에서 capacity
 * input 을 숨기고, MediaRenderer 는 이 함수의 결과를 표시한다.
 *
 *  - analog  : perimeter / 1.0m per person (둘러보기)
 *  - passive : (width × viewDistance) / 1.5m² per person (앞 시청 영역)
 *  - active / staged : 1 (per-device — PR #41 per-device model)
 *
 * Pure function: no engine state, safe for both runtime (`SimEngine`) and
 * rendering (`MediaRenderer`).
 */
export function effectiveMediaCapacity(m: MediaPlacement): number {
  const intType = m.interactionType ?? 'passive';
  if (intType === 'analog') {
    const pwM = m.size.width, phM = m.size.height;
    return Math.max(2, Math.floor((2 * (pwM + phM)) / 1.0));
  }
  if (intType === 'passive') {
    const pwM = m.size.width;
    const viewDistM = m.viewDistance ?? 2.0;
    return Math.max(2, Math.floor((pwM * viewDistM) / 1.5));
  }
  // active / staged: per-device, always 1
  return 1;
}
