import { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { useStore } from '@/stores';

export function CompletionModal() {
  const phase = useStore((s) => s.phase);
  const visitors = useStore((s) => s.visitors);
  const timeState = useStore((s) => s.timeState);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const zones = useStore((s) => s.zones);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (phase === 'completed' && !dismissed) {
      setShow(true);
    }
    if (phase === 'idle') {
      setDismissed(false);
      setShow(false);
    }
  }, [phase, dismissed]);

  if (!show) return null;

  const total = visitors.length;
  const active = visitors.filter((v) => v.isActive).length;
  const exited = total - active;
  const watching = visitors.filter((v) => v.isActive && v.currentAction === 'WATCHING').length;
  const mins = Math.floor(timeState.elapsed / 60000);
  const avgFatigue = latestSnapshot?.fatigueDistribution.mean ?? 0;
  const peakUtil = latestSnapshot ? Math.max(...latestSnapshot.zoneUtilizations.map((u) => u.ratio)) : 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass rounded-2xl border border-border shadow-2xl w-96 overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 p-6 text-center relative">
          <button
            onClick={() => { setShow(false); setDismissed(true); }}
            className="absolute top-3 right-3 p-1 rounded hover:bg-secondary"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Simulation Complete</h2>
          <p className="text-xs text-muted-foreground mt-1">{mins} minutes simulated</p>
        </div>

        {/* Stats */}
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total" value={total} />
            <Stat label="Exited" value={exited} />
            <Stat label="Active" value={active} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Peak Load" value={`${Math.round(peakUtil * 100)}%`}
              color={peakUtil > 0.9 ? 'text-[var(--status-danger)]' : undefined} />
            <Stat label="Avg Fatigue" value={`${Math.round(avgFatigue * 100)}%`}
              color={avgFatigue > 0.7 ? 'text-[var(--status-danger)]' : undefined} />
            <Stat label="Watching" value={watching} color="text-[var(--status-success)]" />
          </div>

          {/* Zone summary */}
          <div className="pt-3 border-t border-border">
            <p className="panel-label mb-2">Zone Performance</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {zones.map((z) => {
                const util = latestSnapshot?.zoneUtilizations.find((u) => u.zoneId === z.id);
                const pct = Math.round((util?.ratio ?? 0) * 100);
                return (
                  <div key={z.id as string} className="flex items-center gap-2 text-[10px]">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: z.color }} />
                    <span className="flex-1 truncate">{z.name}</span>
                    <span className="font-data text-muted-foreground">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-sm font-semibold font-data ${color ?? 'text-foreground'}`}>{value}</div>
      <div className="text-[8px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}
