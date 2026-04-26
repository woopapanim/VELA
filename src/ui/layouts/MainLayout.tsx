import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { SimulationControls } from '../panels/build/SimulationControls';
import { ProjectManager } from '../panels/build/ProjectManager';
import { BuildTools } from '../panels/build/BuildTools';
import { ZoneEditor } from '../panels/build/ZoneEditor';
import { WaypointInspector } from '../panels/build/WaypointInspector';
import { MediaEditor } from '../panels/build/MediaEditor';
import { VisitorConfig } from '../panels/build/VisitorConfig';
import { SpawnConfig } from '../panels/build/SpawnConfig';
import { OperationsPanel } from '../panels/build/OperationsPanel';
import { ExperienceModePanel } from '../panels/build/ExperienceModePanel';
import { RegionsPanel } from '../panels/build/RegionsPanel';
import { ReplayScrubber } from '../panels/canvas/ReplayScrubber';
import { AnalyticsPanel } from '../panels/analytics/AnalyticsPanel';
import { ProgressRing } from '../components/ProgressRing';
import { HelpButton } from '../components/HelpOverlay';
import { StatsFooter } from '../components/StatsFooter';
import { InfoTooltip } from '../components/InfoTooltip';
import { useStore } from '@/stores';
import { useRef } from 'react';
import { useT } from '@/i18n';

export function MainLayout() {
  const visitors = useStore((s) => s.visitors);
  const timeState = useStore((s) => s.timeState);
  const phase = useStore((s) => s.phase);
  const visitorHistory = useRef<number[]>([]);
  const zones = useStore((s) => s.zones);
  const scenario = useStore((s) => s.scenario);
  const simProgress = scenario ? Math.min(1, timeState.elapsed / scenario.simulationConfig.duration) : 0;
  const t = useT();

  const activeCount = visitors.filter((v) => v.isActive).length;
  const elapsed = timeState.elapsed;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  // Track visitor count history for sparkline
  if (phase !== 'idle' && (visitorHistory.current.length === 0 || visitorHistory.current[visitorHistory.current.length - 1] !== activeCount)) {
    visitorHistory.current = [...visitorHistory.current.slice(-30), activeCount];
  }
  if (phase === 'idle') visitorHistory.current = [];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">
            VELA
          </h1>
          {scenario && (
            <span className="text-xs text-muted-foreground italic truncate max-w-48">
              {scenario.meta.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {phase !== 'idle' && (
            <div className="flex items-center gap-3 text-xs font-data">
              <ProgressRing progress={simProgress} size={18} />
              <span className="text-muted-foreground">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>
          )}
          <HelpButton />
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* 3-Panel Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Build / Control */}
        <aside className="w-72 border-r border-border bg-[var(--surface)] overflow-y-auto">
          <div className="p-3 space-y-3">
            <div className="bento-box p-4">
              <h2 className="panel-section mb-3 flex items-center gap-1.5">
                Project
                <InfoTooltip text={t('tooltip.project')} />
              </h2>
              <ProjectManager />
            </div>

            <div className="bento-box p-4">
              <h2 className="panel-section mb-3 flex items-center gap-1.5">
                Simulation
                <InfoTooltip text={t('tooltip.simulation')} />
              </h2>
              <SimulationControls />
            </div>

            <ReplayScrubber />

            {/* ── Phase 1 UX (2026-04-26): 체험 모드 = 모든 build 입력의 _상위_ 선언 ── */}
            <ExperienceModePanel />

            <div className="bento-box p-4">
              <BuildTools />
            </div>

            <RegionsPanel />

            <ZoneEditor />
            <WaypointInspector />
            <MediaEditor />

            <ZoneListDragDrop />

            <OperationsPanel />

            <div className="bento-box p-4">
              <h2 className="panel-section mb-3 flex items-center gap-1.5">
                Spawn
                <InfoTooltip text={t('tooltip.spawn')} />
              </h2>
              <SpawnConfig />
            </div>

            <div className="bento-box p-4">
              <h2 className="panel-section mb-3 flex items-center gap-1.5">
                Visitors
                <InfoTooltip text={t('tooltip.visitors')} />
              </h2>
              <VisitorConfig />
            </div>

          </div>
        </aside>

        {/* Center Panel — Canvas */}
        <main className="flex-1 bg-background overflow-hidden relative flex flex-col">
          <div className="flex-1 relative">
            <CanvasPanel />
          </div>
        </main>

        {/* Right Panel — Analytics / Insight */}
        <aside className="w-80 border-l border-border bg-[var(--surface)] overflow-y-auto">
          <AnalyticsPanel />
        </aside>
      </div>

      {/* Stats Footer */}
      <StatsFooter />
    </div>
  );
}

// ── Zone List (click-to-select) ──
// Note: 동선은 waypoint graph 가 결정. zone 배열 순서는 [0]=spawn / [last]=exit 약속만 유의미하므로
// 중간 zone 의 reorder UI 는 제거 (Graph-Point 시스템 도입 이후 dead).
function ZoneListDragDrop() {
  const zones = useStore((s) => s.zones);
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const t = useT();

  return (
    <div className="bento-box p-4">
      <h2 className="panel-section mb-3 flex items-center gap-1.5">
        Zones ({zones.length})
        <InfoTooltip text={t('tooltip.zones')} />
      </h2>
      <div className="space-y-0.5 max-h-[50vh] overflow-y-auto px-1 py-1">
        {zones.map((zone) => {
          const isSelected = (zone.id as string) === selectedZoneId;
          const isEntrance = zone.type === 'entrance';
          const isExit = zone.type === 'exit';

          return (
            <div
              key={zone.id as string}
              onClick={(e) => { useStore.getState().selectZone(zone.id as string); (e.currentTarget as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all
                ${isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-secondary/50'}
              `}
            >
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: zone.color }} />
              <span className={`flex-1 truncate ${isSelected ? 'font-medium' : ''}`}>{zone.name}</span>
              <span className="text-muted-foreground font-data text-[9px]">
                {isEntrance ? '⬆entrance' : isExit ? '⬇exit' : zone.type}
              </span>
            </div>
          );
        })}
        {zones.length === 0 && (
          <p className="text-xs text-muted-foreground">Load a scenario or add zones</p>
        )}
      </div>
    </div>
  );
}
