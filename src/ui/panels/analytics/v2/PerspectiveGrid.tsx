import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info, Layout, Image, Users, AlertTriangle as Friction } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { KpiSnapshot, KpiTimeSeriesEntry, ZoneConfig, MediaPlacement } from '@/domain';
import {
  aggregateVerdict,
  type VerdictLevel,
  type NormStatus,
} from '@/analytics/norms';
import {
  buildAllCardData, PerspectiveSlot,
  type CardData, type PerspectiveKey,
} from './cards';

export interface EntryStatsInput {
  readonly totalArrived: number;
  readonly totalAdmitted: number;
  readonly totalAbandoned: number;
  readonly avgAdmitWaitMs: number;
  readonly rejectionRate: number;
}

interface Props {
  snapshot: KpiSnapshot | null;
  kpiHistory?: readonly KpiTimeSeriesEntry[];
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
  // 4 관점 모두 한 번에 compute. 이전엔 statusByKey 산출 + Card 내부에서 각각 또 compute 해 8회 호출됐음 (2026-05-04).
  const cardData = useMemo(() => buildAllCardData({
    snapshot: props.snapshot,
    kpiHistory: props.kpiHistory,
    zones: props.zones,
    media: props.media,
    totalSpawned: props.totalSpawned,
    totalExited: props.totalExited,
    fatigueMean: props.fatigueMean,
    entryStats: props.entryStats,
  }), [
    props.snapshot, props.kpiHistory, props.zones, props.media,
    props.totalSpawned, props.totalExited, props.fatigueMean, props.entryStats,
  ]);

  const statusByKey: Record<PerspectiveKey, NormStatus> = {
    space:      cardData.space.status,
    artwork:    cardData.artwork.status,
    operations: cardData.operations.status,
    risk:       cardData.risk.status,
  };

  const allStatuses = Object.values(statusByKey);
  const verdict = aggregateVerdict(allStatuses);
  const V = VERDICT[verdict];
  const VIcon = V.Icon;

  // 항상 비대칭 (hero+sub) — 단조한 4-equal grid 폐기 (2026-04-30).
  // hero = 가장 주의 필요한 관점 (worst), 나머지는 우측 stack.
  const order: PerspectiveKey[] = ['space', 'artwork', 'operations', 'risk'];
  const worstKey = pickWorstKey(statusByKey, props.primaryPerspective);
  const riskCount = order.filter((k) => statusByKey[k] === 'bad' || statusByKey[k] === 'warn').length;

  return (
    <div className="flex flex-col gap-3">
      {/* Verdict — 한 줄 strip */}
      <section className={`rounded-xl border ${V.ring} ${V.bg} px-3.5 py-2 flex items-center gap-2.5`}>
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${V.iconBg} flex-shrink-0`}>
          <VIcon className={`w-3.5 h-3.5 ${V.text}`} />
        </div>
        <div className="flex-1 min-w-0 flex items-baseline gap-3">
          <h2 className={`text-[13px] font-semibold tracking-tight ${V.text} truncate`}>
            {V.headline}
          </h2>
          {verdict !== 'empty' && verdict !== 'ok' && (
            <span className="text-[10px] font-data tabular-nums text-muted-foreground flex-shrink-0">
              {riskCount}/4 관점 주의
            </span>
          )}
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

      {/* 4 관점 카드 — 항상 hero+sub 비대칭 */}
      <ConcreteLayout cardData={cardData} primary={worstKey} />
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
  cardData, primary,
}: {
  cardData: Record<PerspectiveKey, CardData>;
  primary: PerspectiveKey;
}) {
  const order: PerspectiveKey[] = ['space', 'artwork', 'operations', 'risk'];
  const others = order.filter((k) => k !== primary);

  // Primary 좌측 2/3 + 나머지 3 개 우측 1/3 stack. grid 의 row-span 강제 stretching
  // 이 빈 공간 만드는 이슈가 있어 flex 2-col 로 — 두 칼럼 각자의 내용 높이로 자연 정렬 (2026-04-30).
  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="md:flex-[2] min-w-0">
        <PerspectiveSlot perspectiveKey={primary} data={cardData[primary]} size="large" />
      </div>
      <div className="md:flex-1 min-w-0 flex flex-col gap-3">
        {others.map((k) => (
          <PerspectiveSlot key={k} perspectiveKey={k} data={cardData[k]} size="compact" />
        ))}
      </div>
    </div>
  );
}
