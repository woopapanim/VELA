// v2 analytics panels 간 공유 타입 — 순환 import 회피용 (2026-05-04).
// cards.tsx (data) 와 PerspectiveCard.tsx (view) 양쪽이 reference 하므로 별도 파일.

import type { Norm, NormStatus } from '@/analytics/norms';

export interface PerspectiveMetric {
  label: string;
  displayValue: string;
  norm?: Norm;
  status: NormStatus;
}

export interface PerspectiveTrend {
  /** 시계열 값 (정규화 안된 raw — 0~1 ratio 또는 단위값). */
  values: readonly (number | null)[];
  /** norm 임계 — 시각적 표시. */
  threshold?: number;
  /** trend shape — header 에 화살표 + 라벨로 노출. */
  shape?: 'flat' | 'worsening' | 'improving' | 'unknown';
  /** ratio 형태(0~1) 인지 — 도메인 고정에 사용. */
  isRatio?: boolean;
}
