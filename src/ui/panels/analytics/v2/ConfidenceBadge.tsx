import type { Confidence } from '@/analytics/norms';

interface Props {
  level: Confidence;
}

const STYLE: Record<Confidence, { label: string; cls: string }> = {
  high:   { label: '신뢰 높음', cls: 'bg-[var(--status-success)]/12 text-[var(--status-success)]' },
  medium: { label: '신뢰 보통', cls: 'bg-primary/12 text-primary' },
  low:    { label: '신뢰 낮음', cls: 'bg-[var(--status-warning)]/12 text-[var(--status-warning)]' },
};

// 신뢰도 등급 — Reading 옆 작은 칩.
// low 면 "단일 run + 자체권장" 식 한계 명시 — 분석 솔루션의 정직성.
export function ConfidenceBadge({ level }: Props) {
  const s = STYLE[level];
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider uppercase ${s.cls}`}
      title={confidenceTooltip(level)}
    >
      {s.label}
    </span>
  );
}

function confidenceTooltip(level: Confidence): string {
  switch (level) {
    case 'high':
      return '산업표준 기준 + 반복 측정 보강';
    case 'medium':
      return '산업표준/모드 default 기준 + 단일 run';
    case 'low':
      return '자체 권장 기준 + 단일 run — 변동 가능성 있음';
  }
}
