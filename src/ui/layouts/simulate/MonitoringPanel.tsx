import { OverviewCard } from './OverviewCard';
import { LiveInsightsCard } from './LiveInsightsCard';
import { ZoneCardsList } from './ZoneCardsList';
import { MediaCardsList } from './MediaCardsList';

// Simulate 우측 column. Overview → Live Insights → Zone → Media stack.
// Floating overlay 폐기 — paneled column 으로 통일 (2026-04-29).
// Zone (공간 점유) 와 Media (전시물 관람/스킵) 를 분리해서 두 관점 모두 노출.
export function MonitoringPanel() {
  return (
    <aside
      className="w-80 border-l border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-hidden"
      aria-label="Live monitoring"
    >
      <div className="px-3 py-2.5 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold tracking-tight">Live monitoring</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          Current state · Risk signals · Zones & exhibits
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <OverviewCard />
        <LiveInsightsCard />
        <ZoneCardsList />
        <MediaCardsList />
      </div>
    </aside>
  );
}
