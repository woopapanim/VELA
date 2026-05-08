// PerspectiveSlot — pure render layer over pre-computed CardData.
// All computation/data shaping lives in cards.compute.ts so this file
// can be hot-reloaded by React Fast Refresh without invalidating the
// compute graph.

import { Layout, Image, Users, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PerspectiveCard } from './PerspectiveCard';
import type { CardData, PerspectiveKey } from './cards.compute';

const META: Record<PerspectiveKey, { title: string; Icon: LucideIcon }> = {
  space:      { title: '공간 체험', Icon: Layout },
  artwork:    { title: '작품 관람', Icon: Image },
  operations: { title: '운영',     Icon: Users },
  risk:       { title: '위험·마찰', Icon: AlertTriangle },
};

interface SlotProps {
  perspectiveKey: PerspectiveKey;
  data: CardData;
  size?: 'compact' | 'large';
  onDrilldown?: () => void;
}

/**
 * 미리 compute 된 CardData 를 받아 PerspectiveCard 로 렌더만 — 자체 compute 호출 안 함.
 */
export function PerspectiveSlot({ perspectiveKey, data, size, onDrilldown }: SlotProps) {
  const { title, Icon } = META[perspectiveKey];
  return (
    <PerspectiveCard
      title={title}
      Icon={Icon}
      reading={data.reading}
      metrics={data.metrics}
      confidence={data.confidence}
      size={size}
      trend={size === 'large' ? data.trend : undefined}
      onDrilldown={onDrilldown}
    />
  );
}
