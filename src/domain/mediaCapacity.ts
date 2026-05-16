import type { MediaPlacement } from './types';

/**
 * Single source of truth for the cap value used by simulation AND rendering.
 *
 * Matches the engine's internal `effectiveMediaCapacity` exactly (same formula,
 * just exposed as a pure function so the renderer can show the same number
 * without reaching into engine privates).
 *
 *  - analog : max(stored m.capacity, perimeter / 0.8m per person). 면적 큰
 *             디오라마는 stored 값 (보통 6-10) 보다 perimeter 기반 (20-90)
 *             이 커서 후자 사용 — 더 현실적.
 *  - passive / active / staged : stored m.capacity (active/staged 는 PR #41
 *             per-device 모델에서 항상 1).
 *
 * 2026-05-13 (display 통일): MediaRenderer 가 m.capacity 를 직접 표시하던 것
 * (e.g. "0/6") 을 effectiveMediaCapacity 결과 (e.g. "0/23") 로 변경. 엔진이
 * 실제로 쓰는 값과 화면 표시가 일치하게 됨. 엔진 formula 자체는 변경 없음.
 *
 * 주의: 이 함수의 formula 를 바꾸면 시뮬 동작도 바뀜 (엔진이 같은 함수 호출).
 * 회귀 위험 영역이라 신중하게 — PR #43 second commit 의 formula 변경은
 * +98% stuck 회귀로 revert 됐었음. */
export function effectiveMediaCapacity(m: MediaPlacement): number {
  const intType = m.interactionType ?? 'passive';
  if (intType === 'analog') {
    const pwM = m.size.width, phM = m.size.height;
    const autoCap = Math.max(2, Math.floor((2 * (pwM + phM)) / 0.8));
    return Math.max(m.capacity || 0, autoCap);
  }
  return Math.max(1, m.capacity || 1);
}
