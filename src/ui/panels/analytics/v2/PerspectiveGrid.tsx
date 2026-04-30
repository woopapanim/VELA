import { CheckCircle2, AlertTriangle, AlertOctagon, Info, Layout, Image, Users, AlertTriangle as Friction } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { KpiSnapshot, ZoneConfig, MediaPlacement } from '@/domain';
import {
  aggregateVerdict,
  type VerdictLevel,
  type NormStatus,
} from '@/analytics/norms';
import {
  SpaceCard, ArtworkCard, OperationsCard, RiskCard,
  computeSpaceMetrics, computeArtworkMetrics, computeOperationsMetrics, computeRiskMetrics,
} from './cards';

type PerspectiveKey = 'space' | 'artwork' | 'operations' | 'risk';

export interface EntryStatsInput {
  readonly totalArrived: number;
  readonly totalAdmitted: number;
  readonly totalAbandoned: number;
  readonly avgAdmitWaitMs: number;
  readonly rejectionRate: number;
}

interface Props {
  snapshot: KpiSnapshot | null;
  zones: readonly ZoneConfig[];
  media: readonly MediaPlacement[];
  totalSpawned: number;
  totalExited: number;
  fatigueMean: number;
  entryStats?: EntryStatsInput;
  layout?: 'auto' | 'abstract' | 'concrete';
  primaryPerspective?: PerspectiveKey;
  purposeLabel?: string;
}

const VERDICT: Record<VerdictLevel, {
  text: string; ring: string; bg: string; iconBg: string; Icon: LucideIcon; headline: string;
}> = {
  ok: {
    text: 'text-[var(--status-success)]',
    ring: 'border-[var(--status-success)]/30',
    bg: 'bg-[var(--status-success)]/[0.04]',
    iconBg: 'bg-[var(--status-success)]/10',
    Icon: CheckCircle2,
    headline: '4 관점 모두 안정 범위',
  },
  review: {
    text: 'text-[var(--status-warning)]',
    ring: 'border-[var(--status-warning)]/35',
    bg: 'bg-[var(--status-warning)]/[0.04]',
    iconBg: 'bg-[var(--status-warning)]/10',
    Icon: AlertTriangle,
    headline: '일부 관점 검토 신호',
  },
  risk: {
    text: 'text-[var(--status-danger)]',
    ring: 'border-[var(--status-danger)]/40',
    bg: 'bg-[var(--status-danger)]/[0.04]',
    iconBg: 'bg-[var(--status-danger)]/10',
    Icon: AlertOctagon,
    headline: '복수 관점 위험 신호',
  },
  empty: {
    text: 'text-muted-foreground',
    ring: 'border-border',
    bg: 'bg-secondary/30',
    iconBg: 'bg-secondary',
    Icon: Info,
    headline: '아직 분석 데이터가 없습니다',
  },
};

const STATUS_DOT: Record<NormStatus, string> = {
  good:    'bg-[var(--status-success)]',
  warn:    'bg-[var(--status-warning)]',
  bad:     'bg-[var(--status-danger)]',
  unknown: 'bg-muted-foreground/30',
};

const PERSPECTIVE_META: Record<PerspectiveKey, { label: string; Icon: LucideIcon }> = {
  space:      { label: '공간 체험', Icon: Layout },
  artwork:    { label: '작품 관람', Icon: Image },
  operations: { label: '운영',     Icon: Users },
  risk:       { label: '위험·마찰', Icon: Friction },
};

export function PerspectiveGrid(props: Props) {
  const cardProps = {
    snapshot: props.snapshot,
    zones: props.zones,
    media: props.media,
    totalSpawned: props.totalSpawned,
    totalExited: props.totalExited,
    fatigueMean: props.fatigueMean,
    entryStats: props.entryStats,
  };

  const statusByKey: Record<PerspectiveKey, NormStatus> = {
    space:      computeSpaceMetrics(cardProps).status,
    artwork:    computeArtworkMetrics(cardProps).status,
    operations: computeOperationsMetrics(cardProps).status,
    risk:       computeRiskMetrics(cardProps).status,
  };

  const allStatuses = Object.values(statusByKey);
  const verdict = aggregateVerdict(allStatuses);
  const V = VERDICT[verdict];
  const VIcon = V.Icon;

  // Auto layout: 데이터 있고 worst=bad/warn 일 때 비대칭 (worst 가 primary)
  const order: PerspectiveKey[] = ['space', 'artwork', 'operations', 'risk'];
  const worstKey = pickWorstKey(statusByKey, props.primaryPerspective);
  const layout = props.layout ?? 'auto';
  const useConcrete =
    layout === 'concrete' ||
    (layout === 'auto' && (verdict === 'risk' || verdict === 'review'));

  return (
    <div className="flex flex-col gap-3">
      {/* Verdict — 한 줄 strip */}
      <section className={`rounded-xl border ${V.ring} ${V.bg} px-4 py-2.5 flex items-center gap-3`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${V.iconBg} flex-shrink-0`}>
          <VIcon className={`w-4 h-4 ${V.text}`} />
        </div>
        <div className="flex-1 min-w-0 flex items-baseline gap-3">
          <h2 className={`text-sm font-semibold tracking-tight ${V.text} truncate`}>
            {V.headline}
          </h2>
          {props.purposeLabel && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
              · {props.purposeLabel}
            </span>
          )}
        </div>
        {/* 4 관점 dot strip */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {order.map((k) => {
            const Meta = PERSPECTIVE_META[k];
            const s = statusByKey[k];
            return (
              <div key={k} className="flex items-center gap-1.5" title={`${Meta.label} · ${s}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />
                <Meta.Icon className="w-3 h-3 text-muted-foreground/80" />
                <span className="text-[10px] text-muted-foreground hidden md:inline">{Meta.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4 관점 카드 */}
      {useConcrete ? (
        <ConcreteLayout cardProps={cardProps} primary={worstKey} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SpaceCard {...cardProps} />
          <ArtworkCard {...cardProps} />
          <OperationsCard {...cardProps} />
          <RiskCard {...cardProps} />
        </div>
      )}
    </div>
  );
}

function pickWorstKey(
  statusByKey: Record<PerspectiveKey, NormStatus>,
  fallback?: PerspectiveKey,
): PerspectiveKey {
  const order: Record<NormStatus, number> = { bad: 0, warn: 1, unknown: 2, good: 3 };
  const keys: PerspectiveKey[] = ['space', 'artwork', 'operations', 'risk'];
  return [...keys].sort((a, b) => order[statusByKey[a]] - order[statusByKey[b]])[0]
    ?? fallback ?? 'operations';
}

function ConcreteLayout({
  cardProps, primary,
}: {
  cardProps: Parameters<typeof SpaceCard>[0];
  primary: PerspectiveKey;
}) {
  const cardMap: Record<PerspectiveKey, typeof SpaceCard> = {
    space: SpaceCard,
    artwork: ArtworkCard,
    operations: OperationsCard,
    risk: RiskCard,
  };
  const order: PerspectiveKey[] = ['space', 'artwork', 'operations', 'risk'];
  const others = order.filter((k) => k !== primary);
  const Primary = cardMap[primary];

  // Primary 를 위쪽 wide, 나머지 3 을 아래 가로 분할 — 좁은 칼럼 truncation 방지 + 시각 위계 유지.
  return (
    <div className="flex flex-col gap-3">
      <Primary {...cardProps} size="large" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {others.map((k) => {
          const Card = cardMap[k];
          return <Card key={k} {...cardProps} />;
        })}
      </div>
    </div>
  );
}
