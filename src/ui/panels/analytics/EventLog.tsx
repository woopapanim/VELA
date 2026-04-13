import { useMemo } from 'react';
import { useStore } from '@/stores';

interface SimEvent {
  time: string;
  type: 'spawn' | 'bottleneck' | 'milestone' | 'info';
  message: string;
}

export function EventLog() {
  const visitors = useStore((s) => s.visitors);
  const timeState = useStore((s) => s.timeState);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const zones = useStore((s) => s.zones);
  const phase = useStore((s) => s.phase);

  const events = useMemo<SimEvent[]>(() => {
    if (phase === 'idle' || !latestSnapshot) return [];

    const evts: SimEvent[] = [];
    const elapsed = timeState.elapsed;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const active = visitors.filter((v) => v.isActive).length;
    const total = visitors.length;

    // Milestones
    if (active >= 50 && active < 55) evts.push({ time: timeStr, type: 'milestone', message: `50 agents active` });
    if (active >= 100 && active < 105) evts.push({ time: timeStr, type: 'milestone', message: `100 agents active` });
    if (active >= 200 && active < 205) evts.push({ time: timeStr, type: 'milestone', message: `200 agents active` });

    // Bottleneck alerts
    for (const bn of latestSnapshot.bottlenecks) {
      if (bn.score > 0.8) {
        const zone = zones.find((z) => z.id === bn.zoneId);
        evts.push({ time: timeStr, type: 'bottleneck', message: `${zone?.name ?? '?'} critical (${Math.round(bn.score * 100)})` });
      }
    }

    // Fatigue alert
    if (latestSnapshot.fatigueDistribution.p90 > 0.85) {
      evts.push({ time: timeStr, type: 'info', message: `High fatigue: P90 = ${Math.round(latestSnapshot.fatigueDistribution.p90 * 100)}%` });
    }

    // Spawn info
    const exited = total - active;
    if (exited > 0) {
      evts.push({ time: timeStr, type: 'spawn', message: `${active} active / ${exited} exited of ${total} total` });
    }

    return evts.slice(0, 6);
  }, [visitors, timeState, latestSnapshot, zones, phase]);

  if (events.length === 0) return null;

  const typeColors = {
    spawn: 'text-primary',
    bottleneck: 'text-[var(--status-danger)]',
    milestone: 'text-[var(--status-success)]',
    info: 'text-muted-foreground',
  };

  const typeIcons = {
    spawn: '👤',
    bottleneck: '🔴',
    milestone: '🏆',
    info: 'ℹ️',
  };

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Event Log
      </h2>
      <div className="space-y-1">
        {events.map((evt, i) => (
          <div key={i} className="flex items-start gap-2 text-[9px]">
            <span className="font-data text-muted-foreground w-10 shrink-0">{evt.time}</span>
            <span className="shrink-0">{typeIcons[evt.type]}</span>
            <span className={typeColors[evt.type]}>{evt.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
