import { useMemo, useRef } from 'react';
import { useStore } from '@/stores';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { useT } from '@/i18n';

export function NodeTraffic() {
  const visitors = useStore((s) => s.visitors);
  const graph = useStore((s) => s.waypointGraph);
  const phase = useStore((s) => s.phase);
  const elapsed = useStore((s) => s.timeState.elapsed);
  const t = useT();

  // Throttle: recalc only every ~5s of sim time
  const lastCalcRef = useRef(0);
  const cachedRef = useRef<ReturnType<typeof calcStats>>(null);

  const stats = useMemo(() => {
    if (!graph || phase === 'idle') return null;
    // Throttle to every 5000ms sim time
    if (cachedRef.current && Math.abs(elapsed - lastCalcRef.current) < 5000) {
      return cachedRef.current;
    }
    lastCalcRef.current = elapsed;
    const result = calcStats(graph, visitors);
    cachedRef.current = result;
    return result;
  }, [visitors, graph, phase, elapsed]);

  if (!stats || stats.length === 0) return null;

  const maxVisits = Math.max(1, stats[0]?.visits ?? 1);

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        Node Traffic
        <InfoTooltip text={t('tooltip.nodeTraffic')} />
      </h2>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {stats.filter(s => s.visits > 0).map((s) => {
          const pct = Math.round((s.visits / maxVisits) * 100);
          const typeColor = TYPE_COLORS[s.type] ?? '#6b7280';
          return (
            <div key={s.id} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: typeColor }}
              />
              <span className="w-20 truncate font-data">{s.label}</span>
              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right font-data text-muted-foreground">{s.visits}</span>
              <span className="w-12 text-right font-data text-muted-foreground">
                {(s.avgDwell / 1000).toFixed(1)}s
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-[8px] text-muted-foreground">
        <span>visits ↑</span>
        <span>avg dwell →</span>
      </div>
    </div>
  );
}

function calcStats(graph: any, visitors: any[]) {
  const nodeStats = new Map<string, { visits: number; totalDwell: number; label: string; type: string }>();
  for (const node of graph.nodes) {
    nodeStats.set(node.id as string, {
      visits: 0, totalDwell: 0,
      label: node.label || node.type,
      type: node.type,
    });
  }
  for (const v of visitors) {
    for (const entry of v.pathLog) {
      const id = entry.nodeId as string;
      const s = nodeStats.get(id);
      if (s) {
        s.visits++;
        s.totalDwell += entry.duration;
      }
    }
  }
  return [...nodeStats.entries()]
    .map(([id, s]) => ({ id, ...s, avgDwell: s.visits > 0 ? s.totalDwell / s.visits : 0 }))
    .sort((a, b) => b.visits - a.visits);
}

const TYPE_COLORS: Record<string, string> = {
  entry: '#22c55e',
  exit: '#ef4444',
  attractor: '#f59e0b',
  hub: '#8b5cf6',
  rest: '#06b6d4',
  zone: '#6b7280',
  bend: '#64748b',
};
