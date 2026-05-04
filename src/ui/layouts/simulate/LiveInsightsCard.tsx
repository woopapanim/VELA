import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/stores';
import { useLiveInsights, type LiveInsight } from './useLiveInsights';

const SEVERITY_LABEL: Record<LiveInsight['severity'], string> = {
  critical: 'Critical',
  warn: 'Warning',
  info: 'Info',
  ok: 'OK',
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
          <span className="text-[10px] text-muted-foreground font-data" aria-label={`${insights.length} signals`}>
            {insights.length}
          </span>
        )}
      </div>

      {phase === 'idle' && (
        <p className="text-[11px] text-muted-foreground py-2 text-center">
          Risk signals appear here once the simulation starts.
        </p>
      )}

      {phase !== 'idle' && insights.length === 0 && (
        <div className="flex items-center gap-2 py-2 px-1" aria-label="Operating normally">
          <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" aria-hidden="true" />
          <span className="text-[11px] text-foreground/80">Operating normally</span>
        </div>
      )}

      {insights.length > 0 && (
        <ul className="divide-y divide-border/40 max-h-44 overflow-y-auto pr-1" role="list">
          {insights.map((it) => (
            <InsightRow key={it.id} insight={it} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Dense single-row signal: severity icon · title · inline detail. Background
// chips/borders dropped — severity은 아이콘 색만으로 표현. 세로 스캐터 줄여
// Overview/Zones/Media 와의 stack 호흡을 맞춘다.
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

  const ariaLabel = `${SEVERITY_LABEL[insight.severity]}: ${insight.title}${insight.detail ? ` — ${insight.detail}` : ''}`;

  return (
    <li
      className="py-1 flex items-center gap-1.5"
      aria-label={ariaLabel}
      title={insight.detail ?? insight.title}
    >
      <Icon className={`w-3 h-3 flex-shrink-0 ${color}`} aria-hidden="true" />
      <p className="text-[11px] leading-tight text-foreground truncate flex-1 min-w-0" aria-hidden="true">
        <span className="sr-only">{SEVERITY_LABEL[insight.severity]}: </span>
        <span className="font-medium">{insight.title}</span>
        {insight.detail && (
          <span className="text-foreground/60 font-data ml-1">· {insight.detail}</span>
        )}
      </p>
    </li>
  );
}
