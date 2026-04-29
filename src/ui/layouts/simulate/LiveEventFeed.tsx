import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Flag, Activity } from 'lucide-react';
import { useStore } from '@/stores';
import type { ZoneId } from '@/domain';

type Event =
  | { kind: 'bottleneck-start'; t: number; zoneId: ZoneId; score: number }
  | { kind: 'bottleneck-end'; t: number; zoneId: ZoneId; durationMs: number }
  | { kind: 'milestone'; t: number; count: number };

const VISITOR_MILESTONES = [50, 100, 200, 500] as const;

// kpiHistory 를 walk 해서 시간순 이벤트로 변환. memoize 로 비용 낮춤.
function deriveEvents(history: ReadonlyArray<{ simulationTimeMs: number; bottlenecks: ReadonlyArray<{ zoneId: ZoneId; score: number }> }>): Event[] {
  const events: Event[] = [];
  const activeBn = new Map<string, number>(); // zoneId → start time
  let lastMilestone = 0;

  for (const snap of history) {
    const t = snap.simulationTimeMs;
    const present = new Set<string>();

    for (const bn of snap.bottlenecks) {
      const key = bn.zoneId as string;
      present.add(key);
      if (!activeBn.has(key)) {
        events.push({ kind: 'bottleneck-start', t, zoneId: bn.zoneId, score: bn.score });
        activeBn.set(key, t);
      }
    }
    for (const [key, start] of Array.from(activeBn.entries())) {
      if (!present.has(key)) {
        events.push({ kind: 'bottleneck-end', t, zoneId: key as ZoneId, durationMs: t - start });
        activeBn.delete(key);
      }
    }

    // visitor milestones (use snapshot-equivalent — derive from utilizations sum is unreliable;
    // emit purely from a passed-in count signal would be better. For now skip in walk and
    // compute below via store.totalSpawned).
    void lastMilestone;
  }
  return events;
}

export function LiveEventFeed() {
  const phase = useStore((s) => s.phase);
  const kpiHistory = useStore((s) => s.kpiHistory);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const zones = useStore((s) => s.zones);

  const events = useMemo(() => {
    const list = deriveEvents(kpiHistory as any);
    // Visitor milestones — based on totalSpawned at time of latest snapshot.
    // 1차 단순화: 현재 도달한 마일스톤을 모두 single events 로 (정확한 도달 시각은 미상).
    for (const m of VISITOR_MILESTONES) {
      if (totalSpawned >= m) {
        list.push({ kind: 'milestone', t: -1, count: m });
      }
    }
    return list;
  }, [kpiHistory, totalSpawned]);

  // 시간 역순. milestones (t = -1) 은 최상단으로.
  const sorted = [...events].sort((a, b) => {
    if (a.t === -1 && b.t === -1) return b.count - a.count;
    if (a.t === -1) return -1;
    if (b.t === -1) return 1;
    return b.t - a.t;
  });

  const zoneName = (zoneId: ZoneId) => zones.find((z) => z.id === zoneId)?.name ?? '?';

  return (
    <aside className="absolute top-3 right-3 bottom-20 w-56 z-10 pointer-events-none flex flex-col">
      <div className="flex items-center gap-1.5 px-2 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium pointer-events-auto">
        <Activity className="w-3 h-3" />
        Live events
      </div>
      <div className="flex-1 overflow-y-auto rounded-xl bg-[var(--surface)]/85 backdrop-blur-md border border-border shadow-lg pointer-events-auto">
        {phase === 'idle' && sorted.length === 0 && (
          <p className="px-3 py-4 text-[10px] text-muted-foreground text-center">
            시뮬레이션을 시작하면 이벤트가 여기에 누적됩니다.
          </p>
        )}
        {phase !== 'idle' && sorted.length === 0 && (
          <p className="px-3 py-4 text-[10px] text-muted-foreground text-center">
            아직 이벤트 없음 — 정상 운행 중
          </p>
        )}
        <ul className="divide-y divide-border/40">
          {sorted.slice(0, 60).map((e, i) => (
            <li key={i} className="px-2.5 py-1.5 text-[10px] flex items-start gap-1.5">
              <Icon e={e} />
              <div className="flex-1 min-w-0">
                <Title e={e} zoneName={zoneName} />
                <Time e={e} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function Icon({ e }: { e: Event }) {
  if (e.kind === 'bottleneck-start')
    return <AlertTriangle className="w-3 h-3 text-[var(--status-warning)] flex-shrink-0 mt-0.5" />;
  if (e.kind === 'bottleneck-end')
    return <CheckCircle2 className="w-3 h-3 text-[var(--status-success)] flex-shrink-0 mt-0.5" />;
  return <Flag className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />;
}

function Title({ e, zoneName }: { e: Event; zoneName: (id: ZoneId) => string }) {
  if (e.kind === 'bottleneck-start')
    return (
      <p className="font-medium leading-tight">
        {zoneName(e.zoneId)} <span className="text-[var(--status-warning)]">병목</span>
        <span className="ml-1 text-muted-foreground font-data">({Math.round(e.score * 100)})</span>
      </p>
    );
  if (e.kind === 'bottleneck-end')
    return (
      <p className="font-medium leading-tight">
        {zoneName(e.zoneId)} 해소
        <span className="ml-1 text-muted-foreground font-data text-[9px]">
          {Math.round(e.durationMs / 1000)}s
        </span>
      </p>
    );
  return <p className="font-medium leading-tight">{e.count}명 도달</p>;
}

function Time({ e }: { e: Event }) {
  if (e.t === -1) return null;
  const mm = Math.floor(e.t / 60000);
  const ss = Math.floor((e.t % 60000) / 1000);
  return (
    <span className="text-[9px] text-muted-foreground font-data">
      {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
    </span>
  );
}
