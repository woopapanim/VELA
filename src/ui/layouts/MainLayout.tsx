import { ThemeToggle } from '../components/ThemeToggle';
import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { SimulationControls } from '../panels/build/SimulationControls';
import { ProjectManager } from '../panels/build/ProjectManager';
import { BuildTools } from '../panels/build/BuildTools';
import { ZoneEditor } from '../panels/build/ZoneEditor';
import { WaypointInspector } from '../panels/build/WaypointInspector';
import { MediaEditor } from '../panels/build/MediaEditor';
import { VisitorConfig } from '../panels/build/VisitorConfig';
import { FloorTabs } from '../panels/build/FloorTabs';
import { ReplayScrubber } from '../panels/canvas/ReplayScrubber';
import { AnalyticsPanel } from '../panels/analytics/AnalyticsPanel';
import { MediaStatsPanel } from '../panels/analytics/MediaStatsPanel';
import { Sparkline } from '../components/Sparkline';
import { ProgressRing } from '../components/ProgressRing';
import { HelpButton } from '../components/HelpOverlay';
import { StatsFooter } from '../components/StatsFooter';
import { useStore } from '@/stores';
import { useRef, useState } from 'react';

export function MainLayout() {
  const visitors = useStore((s) => s.visitors);
  const timeState = useStore((s) => s.timeState);
  const phase = useStore((s) => s.phase);
  const visitorHistory = useRef<number[]>([]);
  const zones = useStore((s) => s.zones);
  const scenario = useStore((s) => s.scenario);
  const simProgress = scenario ? Math.min(1, timeState.elapsed / scenario.simulationConfig.duration) : 0;

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
            <span className="text-xs text-muted-foreground font-data truncate max-w-48">
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
              <Sparkline data={visitorHistory.current} color="#3b82f6" />
              <span className="text-primary">{activeCount} agents</span>
            </div>
          )}
          <HelpButton />
          <ThemeToggle />
        </div>
      </header>

      {/* 3-Panel Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Build / Control */}
        <aside className="w-72 border-r border-border bg-[var(--surface)] overflow-y-auto">
          <div className="p-3 space-y-3">
            <div className="bento-box p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Project
              </h2>
              <ProjectManager />
            </div>

            <div className="bento-box p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Simulation
              </h2>
              <SimulationControls />
            </div>

            <ReplayScrubber />

            <div className="bento-box p-4">
              <BuildTools />
            </div>

            <ZoneEditor />
            <WaypointInspector />
            <MediaEditor />

            <ZoneListDragDrop />

            <div className="bento-box p-4">
              <VisitorConfig />
            </div>

          </div>
        </aside>

        {/* Center Panel — Canvas */}
        <main className="flex-1 bg-background overflow-hidden relative flex flex-col">
          <FloorTabs />
          <div className="flex-1 relative">
            <CanvasPanel />
          </div>
        </main>

        {/* Right Panel — Analytics / Insight */}
        <aside className="w-80 border-l border-border bg-[var(--surface)] overflow-y-auto">
          <MediaStatsPanel />
          <AnalyticsPanel />
        </aside>
      </div>

      {/* Stats Footer */}
      <StatsFooter />
    </div>
  );
}

// ── Drag-and-Drop Zone List ──
/** Re-chain gate connectedGateId to match zone array order */
function rechainGates(zones: any[]): any[] {
  return zones.map((zone, i) => {
    const prevZone = i > 0 ? zones[i - 1] : null;
    const nextZone = i < zones.length - 1 ? zones[i + 1] : null;

    const gates = zone.gates.map((g: any) => {
      if (g.type === 'entrance') {
        // entrance gate connects back to previous zone's exit gate
        const prevExit = prevZone?.gates.find((pg: any) => pg.type === 'exit');
        return { ...g, connectedGateId: prevExit?.id ?? null };
      }
      if (g.type === 'exit') {
        // exit gate connects to next zone's entrance gate
        const nextEntrance = nextZone?.gates.find((ng: any) => ng.type === 'entrance');
        return { ...g, connectedGateId: nextEntrance?.id ?? null };
      }
      // bidirectional: connect to prev exit or next entrance
      return { ...g, connectedGateId: prevZone?.gates.find((pg: any) => pg.type === 'exit')?.id ?? null };
    });

    return { ...zone, gates };
  });
}

function ZoneListDragDrop() {
  const zones = useStore((s) => s.zones);
  const scenario = useStore((s) => s.scenario);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // Entrance = first, Exit = last — only middle zones are draggable
  const isDraggable = (idx: number) => {
    const z = zones[idx];
    return z.type !== 'entrance' && z.type !== 'exit';
  };

  // Valid drop targets: between first entrance and last exit
  const isValidDrop = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return false;
    const target = zones[toIdx];
    if (target.type === 'entrance' || target.type === 'exit') return false;
    return true;
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    if (!isDraggable(idx)) { e.preventDefault(); return; }
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Make drag image semi-transparent
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || !isValidDrop(dragIdx, idx)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || !scenario) return;
    if (!isValidDrop(dragIdx, toIdx)) return;

    const newZones = [...zones];
    const [moved] = newZones.splice(dragIdx, 1);
    newZones.splice(toIdx, 0, moved);

    // Re-chain gate connections to match new order
    const rechained = rechainGates(newZones);
    useStore.getState().setScenario({ ...scenario, zones: rechained });
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Zones ({zones.length})
      </h2>
      <div className="space-y-0.5 max-h-[50vh] overflow-y-auto px-1 py-1">
        {zones.map((zone, idx) => {
          const isSelected = (zone.id as string) === useStore.getState().selectedZoneId;
          const isEntrance = zone.type === 'entrance';
          const isExit = zone.type === 'exit';
          const canDrag = isDraggable(idx);
          const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;

          return (
            <div
              key={zone.id as string}
              draggable={canDrag}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragLeave={() => { if (overIdx === idx) setOverIdx(null); }}
              onDrop={(e) => handleDrop(e, idx)}
              onClick={(e) => { useStore.getState().selectZone(zone.id as string); (e.currentTarget as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all
                ${isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-secondary/50'}
                ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
                ${isOver ? 'border-t-2 border-primary' : 'border-t-2 border-transparent'}
                ${dragIdx === idx ? 'opacity-50' : ''}
              `}
            >
              {/* Drag handle */}
              {canDrag ? (
                <span className="text-muted-foreground text-[10px] select-none" title="드래그하여 순서 변경">⠿</span>
              ) : (
                <span className="w-3" />
              )}
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
