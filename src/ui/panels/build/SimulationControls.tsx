import { useRef, useCallback } from 'react';
import { Play, Pause, Square, Thermometer, Camera, SkipForward, Maximize } from 'lucide-react';
import { useStore } from '@/stores';
import { SimulationEngine, SimulationLoop } from '@/simulation';
import { SIMULATION_PHASE, KPI_SAMPLE_INTERVAL_MS } from '@/domain';
import { assembleKpiSnapshot } from '@/analytics';
import { useToast } from '@/ui/components/Toast';
import { resetPeakOccupancy } from '@/analytics/calculators/utilization';
import type { OverlayMode } from '@/stores';

export function SimulationControls() {
  const loopRef = useRef<SimulationLoop | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const { toast } = useToast();
  const milestonesHit = useRef(new Set<number>());

  const phase = useStore((s) => s.phase);
  const timeState = useStore((s) => s.timeState);
  const visitors = useStore((s) => s.visitors);
  const updateSimState = useStore((s) => s.updateSimState);
  const setPhase = useStore((s) => s.setPhase);
  const resetSim = useStore((s) => s.resetSim);
  const overlayMode = useStore((s) => s.overlayMode);
  const setOverlayMode = useStore((s) => s.setOverlayMode);
  const pushSnapshot = useStore((s) => s.pushSnapshot);
  const pushReplayFrame = useStore((s) => s.pushReplayFrame);
  const clearReplay = useStore((s) => s.clearReplay);

  const activeCount = visitors.filter((v) => v.isActive).length;

  const handleStart = useCallback(() => {
    const store = useStore.getState();
    if (!store.scenario) return;

    // Reset previous sim state if completed
    if (store.phase === 'completed') resetSim();

    // ── Validation ──
    const hasGraph = store.waypointGraph && store.waypointGraph.nodes.length > 0;
    if (hasGraph) {
      // Graph mode: need at least 1 ENTRY and 1 EXIT node
      const entries = store.waypointGraph!.nodes.filter(n => n.type === 'entry');
      const exits = store.waypointGraph!.nodes.filter(n => n.type === 'exit');
      if (entries.length === 0) { toast('warning', 'ENTRY 노드가 필요합니다'); return; }
      if (exits.length === 0) { toast('warning', 'EXIT 노드가 필요합니다'); return; }
      // Check edges exist
      if (store.waypointGraph!.edges.length === 0) { toast('warning', 'Edge가 최소 1개 필요합니다'); return; }
    } else {
      toast('warning', 'Node와 Edge를 배치하세요'); return;
    }

    const flowMode = store.scenario.globalFlowMode ?? 'free';
    const guidedIdx = store.scenario.guidedUntilIndex ?? 0;

    // ── Create engine (handles ALL navigation natively) ──
    const world = {
      floors: store.floors,
      zones: [...store.zones],
      media: store.media,
      config: store.scenario.simulationConfig,
      globalFlowMode: flowMode,
      guidedUntilIndex: guidedIdx,
      waypointGraph: store.waypointGraph ?? undefined,
    };
    const engine = new SimulationEngine(world);
    engineRef.current = engine;
    (engine as any).world.globalFlowMode = flowMode;
    (engine as any).world.guidedUntilIndex = guidedIdx;
    console.log('[SIM START] mode=' + flowMode + ' guidedIdx=' + guidedIdx);

    // ── Simulation loop — onTick handles UI updates only ──
    let lastSnapshotTime = 0;
    let frameSkip = 0;
    const loop = new SimulationLoop(engine);
    loop.setOnTick((eng) => {
      const state = eng.getState();
      frameSkip++;

      // Throttle UI updates: every 2nd frame for perf
      if (frameSkip % 2 !== 0 && state.phase === 'running') return;

      const activeVisitors = eng.getActiveVisitors();

      updateSimState(
        eng.getActiveVisitors(),
        eng.getGroups(),
        state.timeState,
        state.phase,
        eng.getTotalSpawned(),
        eng.getTotalExited(),
        eng.getMediaStats(),
      );

      // Completion detection
      if (state.phase === 'completed' || state.phase !== 'running') {
        if (state.phase === 'completed' && !milestonesHit.current.has(-1)) {
          milestonesHit.current.add(-1);
          toast('success', '✅ Simulation completed!');
        }
      }

      // Milestone toasts
      const count = activeVisitors.length;
      for (const m of [50, 100, 150, 200, 300, 500]) {
        if (count >= m && !milestonesHit.current.has(m)) {
          milestonesHit.current.add(m);
          toast('success', `🏆 ${m} agents reached!`);
        }
      }

      // Push KPI snapshot at intervals
      const elapsed = state.timeState.elapsed;
      if (elapsed - lastSnapshotTime >= KPI_SAMPLE_INTERVAL_MS) {
        lastSnapshotTime = elapsed;
        const currentStore = useStore.getState();
        const snapshot = assembleKpiSnapshot(
          currentStore.zones,
          currentStore.media,
          activeVisitors,
          elapsed,
          eng.getTotalExited(),
        );
        pushSnapshot(snapshot);

        // Bottleneck alert toasts
        for (const bn of snapshot.bottlenecks) {
          if (bn.score > 0.85) {
            const key = `bn_${bn.zoneId as string}_${Math.floor(elapsed / 10000)}`;
            if (!milestonesHit.current.has(key as any)) {
              milestonesHit.current.add(key as any);
              const zone = currentStore.zones.find((z) => z.id === bn.zoneId);
              toast('warning', `⚠️ ${zone?.name ?? '?'} bottleneck (${Math.round(bn.score * 100)})`);
            }
          }
        }

        // Auto-save checkpoint every 30s sim time
        if (Math.floor(elapsed / 30000) > Math.floor((elapsed - KPI_SAMPLE_INTERVAL_MS) / 30000)) {
          const scen = currentStore.scenario;
          if (scen) {
            try { localStorage.setItem('aion-autosave', JSON.stringify({ scenario: scen, timestamp: Date.now() })); } catch {}
          }
        }

        // Record replay frame
        pushReplayFrame({
          visitors: activeVisitors,
          groups: eng.getGroups(),
          timeState: state.timeState,
          timestamp: elapsed,
        });
      }
    });

    clearReplay();
    resetPeakOccupancy();
    milestonesHit.current.clear();
    loopRef.current = loop;
    loop.start();
    setPhase(SIMULATION_PHASE.RUNNING);
  }, [updateSimState, setPhase]);

  const handlePause = useCallback(() => {
    loopRef.current?.stop();
    setPhase(SIMULATION_PHASE.PAUSED);
  }, [setPhase]);

  const handleResume = useCallback(() => {
    loopRef.current?.resume();
    setPhase(SIMULATION_PHASE.RUNNING);
  }, [setPhase]);

  const handleStop = useCallback(() => {
    if (loopRef.current) {
      loopRef.current.destroy();
      loopRef.current = null;
    }
    resetSim();
    setTimeout(() => setPhase('idle' as any), 50);
  }, [resetSim, setPhase]);

  const toggleHeatmap = useCallback(() => {
    const next: OverlayMode = overlayMode === 'heatmap' ? 'none' : 'heatmap';
    setOverlayMode(next);
  }, [overlayMode, setOverlayMode]);

  const elapsed = timeState.elapsed;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex gap-2">
        {(phase === SIMULATION_PHASE.IDLE || phase === SIMULATION_PHASE.COMPLETED) && (
          <button
            onClick={handleStart}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-success)] text-white hover:opacity-90"
          >
            <Play className="w-3.5 h-3.5" /> Start
          </button>
        )}
        {phase === SIMULATION_PHASE.RUNNING && (
          <button
            onClick={handlePause}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-warning)] text-white hover:opacity-90"
          >
            <Pause className="w-3.5 h-3.5" /> Pause
          </button>
        )}
        {phase === SIMULATION_PHASE.PAUSED && (
          <button
            onClick={handleResume}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-success)] text-white hover:opacity-90"
          >
            <Play className="w-3.5 h-3.5" /> Resume
          </button>
        )}
        {(phase === SIMULATION_PHASE.RUNNING || phase === SIMULATION_PHASE.PAUSED) && (
          <button
            onClick={handleStop}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-danger)] text-white hover:opacity-90"
          >
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        )}
        <button
          onClick={toggleHeatmap}
          className={`flex items-center justify-center px-2.5 py-2 text-xs rounded-xl transition-colors ${
            overlayMode === 'heatmap' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
          title="Toggle Heatmap"
        >
          <Thermometer className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Speed */}
      {(phase === SIMULATION_PHASE.RUNNING || phase === SIMULATION_PHASE.PAUSED) && (
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-muted-foreground">Speed</span>
          {[1, 3, 5, 10, 20].map((spd) => (
            <button
              key={spd}
              onClick={() => {
                if (engineRef.current) {
                  (engineRef.current.getWorld() as any).config.timeScale = spd;
                }
              }}
              className="px-1.5 py-0.5 text-[9px] rounded bg-secondary hover:bg-accent"
            >{spd}x</button>
          ))}
        </div>
      )}

      {/* Status */}
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <div className="flex justify-between px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-muted-foreground">Phase</span>
          <span className="font-data font-medium uppercase">{phase}</span>
        </div>
        <div className="flex justify-between px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-muted-foreground">Elapsed</span>
          <span className="font-data font-medium">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
        </div>
        <div className="flex justify-between px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-muted-foreground">Active Agents</span>
          <span className="font-data font-medium text-primary">{activeCount}</span>
        </div>
        <div className="flex justify-between px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-muted-foreground">Tick</span>
          <span className="font-data font-medium">{timeState.tickCount}</span>
        </div>
      </div>
    </div>
  );
}
