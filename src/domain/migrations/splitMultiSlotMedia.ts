import type { MediaId, MediaPlacement } from '@/domain';

// 1m = 20px (matches MEDIA_SCALE from constants).
const MEDIA_SCALE_PX = 20;

/**
 * "Per-device media model" migration (2026-05-12).
 *
 * Why: active/staged 미디어의 `capacity > 1` 는 의미 모순.
 * 현실에서 키오스크 6대는 "한 미디어의 6 슬롯" 이 아니라 "6개의 별개 미디어".
 * cap 슬롯 모델은:
 *   - 한 위치에 N명이 겹쳐 보이는 비현실적 시각화
 *   - `pickMediaSlot` slot-0 fallback 으로 끼임 버그 (3번 수정 시도 모두 실패한 그것)
 *
 * What: 시나리오 로드 시 active/staged + capacity > 1 인 미디어를 발견하면
 * cap=1 미디어 N개로 자동 분할. analog/passive 는 그대로 (cap 은 면적 수용을 의미).
 *
 * Placement: 원본 위치를 첫 번째로 두고, 나머지는 +x 방향으로 1.2× 미디어 너비
 * 간격으로 배치. 사용자가 후처리로 드래그해서 재배치 가능.
 *
 * ID rewriting: 첫 분할본은 원본 ID 유지, 나머지는 `${originalId}_split${i}` suffix.
 * Visitor.visitedMediaIds 등 시뮬 런타임 데이터는 시나리오 로드 시 fresh state 이므로
 * 안전. 저장된 분석 record 와는 호환 안 됨 (새 분석 필요).
 */
export interface SplitResult {
  readonly migrated: MediaPlacement[];
  /** 분할된 원본 미디어의 개수 (N대로 늘어난 source 의 수, 새로 생긴 미디어 개수 아님). */
  readonly splitSourceCount: number;
  /** 분할 후 추가로 생긴 미디어 개수 (= sum(cap-1) for each split source). */
  readonly addedCount: number;
}

export function splitMultiSlotMedia(media: readonly MediaPlacement[]): SplitResult {
  const result: MediaPlacement[] = [];
  let splitSourceCount = 0;
  let addedCount = 0;

  for (const m of media) {
    const isDevice = m.interactionType === 'active' || m.interactionType === 'staged';
    if (!isDevice || m.capacity <= 1) {
      result.push(m);
      continue;
    }

    const cap = m.capacity;
    const offsetPx = Math.max(20, m.size.width * MEDIA_SCALE_PX * 1.2);

    for (let i = 0; i < cap; i++) {
      const newId = (i === 0 ? (m.id as string) : `${m.id as string}_split${i}`) as MediaId;
      result.push({
        ...m,
        id: newId,
        capacity: 1,
        position: {
          x: m.position.x + i * offsetPx,
          y: m.position.y,
        },
      });
    }
    splitSourceCount += 1;
    addedCount += cap - 1;
  }

  return { migrated: result, splitSourceCount, addedCount };
}
