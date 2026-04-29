import { OverviewCard } from './OverviewCard';
import { LiveInsightsCard } from './LiveInsightsCard';
import { ZoneCardsList } from './ZoneCardsList';

// Simulate 우측 column. Overview → Live Insights → Per-zone 카드 stack.
// Floating overlay 폐기 — paneled column 으로 통일 (2026-04-29).
export function MonitoringPanel() {
  return (
    <aside className="w-80 border-l border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex-shrink-0">
        <h2 className="text-xs font-semibold tracking-tight">Live monitoring</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
          현재 상태 · 위험 신호 · zone별 점유
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <OverviewCard />
        <LiveInsightsCard />
        <ZoneCardsList />
      </div>
    </aside>
  );
}
