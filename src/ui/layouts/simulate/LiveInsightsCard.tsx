import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/stores';
import { useLiveInsights, type LiveInsight } from './useLiveInsights';

// 5종 derived signal — bottleneck / capacity / skip / 조기이탈 / 입출구 편중.
// 빈 배열이면 "정상 운행 중" placeholder. idle 일 때는 안내 문구.
export function LiveInsightsCard() {
  const phase = useStore((s) => s.phase);
  const insights = useLiveInsights();

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-border p-3">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Live Insights
        </h3>
        {insights.length > 0 && (
          <span className="text-[9px] text-muted-foreground font-data">{insights.length}</span>
        )}
      </div>

      {phase === 'idle' && (
        <p className="text-[10px] text-muted-foreground py-2 text-center">
          시뮬레이션을 시작하면 위험 신호가 여기에 뜹니다.
        </p>
      )}

      {phase !== 'idle' && insights.length === 0 && (
        <div className="flex items-center gap-2 py-2 px-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--status-success)]" />
          <span className="text-[10px] text-muted-foreground">정상 운행 중</span>
        </div>
      )}

      {insights.length > 0 && (
        <ul className="space-y-1.5">
          {insights.map((it) => (
            <InsightRow key={it.id} insight={it} />
          ))}
        </ul>
      )}
    </div>
  );
}

function InsightRow({ insight }: { insight: LiveInsight }) {
  const Icon = insight.severity === 'critical'
    ? AlertOctagon
    : insight.severity === 'warn'
    ? AlertTriangle
    : Info;

  const color = insight.severity === 'critical'
    ? 'text-[var(--status-danger)]'
    : insight.severity === 'warn'
    ? 'text-[var(--status-warning)]'
    : 'text-primary';

  const bg = insight.severity === 'critical'
    ? 'bg-[var(--status-danger)]/8'
    : insight.severity === 'warn'
    ? 'bg-[var(--status-warning)]/8'
    : 'bg-primary/5';

  return (
    <li className={`rounded-lg ${bg} px-2 py-1.5 flex items-start gap-1.5`}>
      <Icon className={`w-3 h-3 flex-shrink-0 mt-0.5 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium leading-tight">{insight.title}</p>
        {insight.detail && (
          <p className="text-[9px] text-muted-foreground font-data leading-tight mt-0.5">
            {insight.detail}
          </p>
        )}
      </div>
    </li>
  );
}
