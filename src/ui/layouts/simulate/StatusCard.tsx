import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
import { useStore } from '@/stores';

// 단일 verdict 카드. "지금 이 시뮬은 어떤 상태?" — 한 줄 답.
// 캔버스 위 top-left 에 가볍게 — 영구 dump 아님.
export function StatusCard() {
  const phase = useStore((s) => s.phase);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const visitors = useStore((s) => s.visitors);

  if (phase === 'idle') return null;

  const active = visitors.filter((v) => v.isActive).length;
  const bnCount = latestSnapshot?.bottlenecks.length ?? 0;
  const critical = (latestSnapshot?.bottlenecks ?? []).filter((b) => b.score > 0.85).length;

  let level: 'ok' | 'warn' | 'critical';
  let label: string;
  if (critical > 0) {
    level = 'critical';
    label = `${critical} critical`;
  } else if (bnCount > 0) {
    level = 'warn';
    label = `${bnCount} bottleneck`;
  } else {
    level = 'ok';
    label = '정상';
  }

  const Icon = level === 'critical' ? AlertOctagon : level === 'warn' ? AlertTriangle : CheckCircle2;
  const color =
    level === 'critical'
      ? 'text-[var(--status-danger)]'
      : level === 'warn'
      ? 'text-[var(--status-warning)]'
      : 'text-[var(--status-success)]';

  return (
    <div className="absolute top-3 left-3 z-10 pointer-events-none">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)]/85 backdrop-blur-md border border-border shadow-lg pointer-events-auto">
        <Icon className={`w-4 h-4 ${color}`} />
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[9px] text-muted-foreground font-data">
            {active} active · {phase}
          </span>
        </div>
      </div>
    </div>
  );
}
