import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/stores';
import { useLiveInsights, type LiveInsight } from './useLiveInsights';

const SEVERITY_LABEL: Record<LiveInsight['severity'], string> = {
  critical: '심각',
  warn: '경고',
  info: '안내',
  ok: '정상',
};

// 5종 derived signal — bottleneck / capacity / skip / 조기이탈 / 입출구 편중.
// 접근성: severity 를 색뿐 아니라 텍스트 prefix 로 표시. 각 row aria-label.
export function LiveInsightsCard() {
  const phase = useStore((s) => s.phase);
  const insights = useLiveInsights();

  return (
    <section
      className="rounded-xl bg-[var(--surface)] border border-border p-3"
      aria-labelledby="insights-heading"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h3
          id="insights-heading"
          className="text-[11px] uppercase tracking-wider font-semibold text-foreground/80"
        >
          Live Insights
        </h3>
        {insights.length > 0 && (
          <span className="text-[10px] text-muted-foreground font-data" aria-label={`${insights.length}개 신호`}>
            {insights.length}
          </span>
        )}
      </div>

      {phase === 'idle' && (
        <p className="text-[11px] text-muted-foreground py-2 text-center">
          시뮬레이션을 시작하면 위험 신호가 여기에 뜹니다.
        </p>
      )}

      {phase !== 'idle' && insights.length === 0 && (
        <div className="flex items-center gap-2 py-2 px-1" aria-label="현재 정상 운행 중">
          <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" aria-hidden="true" />
          <span className="text-[11px] text-foreground/80">정상 운행 중</span>
        </div>
      )}

      {insights.length > 0 && (
        <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1" role="list">
          {insights.map((it) => (
            <InsightRow key={it.id} insight={it} />
          ))}
        </ul>
      )}
    </section>
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
    ? 'bg-[var(--status-danger)]/10 border-[var(--status-danger)]/20'
    : insight.severity === 'warn'
    ? 'bg-[var(--status-warning)]/10 border-[var(--status-warning)]/20'
    : 'bg-primary/8 border-primary/15';

  const ariaLabel = `${SEVERITY_LABEL[insight.severity]}: ${insight.title}${insight.detail ? ` — ${insight.detail}` : ''}`;

  return (
    <li
      className={`rounded-lg border ${bg} px-2 py-1.5 flex items-start gap-1.5`}
      aria-label={ariaLabel}
    >
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${color}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium leading-tight text-foreground" aria-hidden="true">
          <span className="sr-only">{SEVERITY_LABEL[insight.severity]}: </span>
          {insight.title}
        </p>
        {insight.detail && (
          <p className="text-[10px] text-foreground/70 font-data leading-tight mt-0.5" aria-hidden="true">
            {insight.detail}
          </p>
        )}
      </div>
    </li>
  );
}
