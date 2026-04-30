import { useRef, useCallback, useState } from 'react';
import { Play, Pause, Square, Thermometer, AlertTriangle, Pin } from 'lucide-react';
import { useStore } from '@/stores';
import { selectScenarioDirty } from '@/stores/selectors';
import { SimulationEngine, SimulationLoop } from '@/simulation';
import { SIMULATION_PHASE, KPI_SAMPLE_INTERVAL_MS } from '@/domain';
import { assembleKpiSnapshot, pinCurrentMoment } from '@/analytics';
import { useToast } from '@/ui/components/Toast';
import { resetPeakOccupancy } from '@/analytics/calculators/utilization';
import { resetCongestionTracking } from '@/analytics/calculators/congestion';
import type { OverlayMode } from '@/stores';
import { useT } from '@/i18n';

// djb2-style short hash → 6 hex chars. Deterministic for identical scenario shape.
function hashSignature(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

function makeRunId(scenario: { zones: unknown[]; media: unknown[]; waypointGraph?: { nodes: unknown[]; edges: unknown[] }; visitorDistribution: { totalCount: number } }): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  // Structural signature — same shape → same hash, so reruns of identical scenarios
  // share the suffix while timestamps differentiate individual runs.
  const sig = [
    scenario.zones.length,
    scenario.media.length,
    scenario.waypointGraph?.nodes.length ?? 0,
    scenario.waypointGraph?.edges.length ?? 0,
    scenario.visitorDistribution.totalCount,
  ].join('|');
  return `run_${ts}_${hashSignature(sig)}`;
}

export function SimulationControls() {
  const t = useT();
  const loopRef = useRef<SimulationLoop | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const runStartedAtRef = useRef<number>(0);
  const dirtyAtStartRef = useRef<boolean>(false);
  const { toast } = useToast();
  const milestonesHit = useRef(new Set<number>());
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [speed, setSpeed] = useState(1);

  const phase = useStore((s) => s.phase);
  const timeState = useStore((s) => s.timeState);
  const visitors = useStore((s) => s.visitors);
  const pinCount = useStore((s) => s.pins.length);
  const updateSimState = useStore((s) => s.updateSimState);
  const setShaftQueues = useStore((s) => s.setShaftQueues);
  const setDensityGrids = useStore((s) => s.setDensityGrids);
  const setPhase = useStore((s) => s.setPhase);
  const resetSim = useStore((s) => s.resetSim);
  const overlayMode = useStore((s) => s.overlayMode);
  const setOverlayMode = useStore((s) => s.setOverlayMode);
  const pushSnapshot = useStore((s) => s.pushSnapshot);
  const captureRun = useStore((s) => s.captureRun);
  const pushReplayFrame = useStore((s) => s.pushReplayFrame);
  const clearReplay = useStore((s) => s.clearReplay);
  const clearHistory = useStore((s) => s.clearHistory);
  const clearPins = useStore((s) => s.clearPins);
  const setRunId = useStore((s) => s.setRunId);
  const simMode = useStore((s) => s.scenario?.simulationConfig.simulationMode ?? 'time');
  const totalCount = useStore((s) => s.scenario?.visitorDistribution.totalCount ?? 0);
  const durationMs = useStore((s) => s.scenario?.simulationConfig.duration ?? 0);

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
      if (entries.length === 0) { toast('warning', t('sim.toast.entryNeeded')); return; }
      if (exits.length === 0) { toast('warning', t('sim.toast.exitNeeded')); return; }
      // Check edges exist
      if (store.waypointGraph!.edges.length === 0) { toast('warning', t('sim.toast.edgeNeeded')); return; }
    } else {
      toast('warning', t('sim.toast.nodesAndEdgesNeeded')); return;
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
      shafts: store.shafts,
      totalVisitors: store.scenario.visitorDistribution.totalCount,
      categoryWeights: store.scenario.visitorDistribution.categoryWeights,
    };
    const engine = new SimulationEngine(world);
    engineRef.current = engine;
    (engine as any).world.globalFlowMode = flowMode;
    (engine as any).world.guidedUntilIndex = guidedIdx;
    if (typeof window !== 'undefined') (window as any).__simEngine = engine;
    setSpeed(store.scenario.simulationConfig.timeScale ?? 1);

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

      // Push ALL visitors (active + exited) so analytics/report can read full lifecycle.
      // Renderers filter by isActive themselves.
      updateSimState(
        eng.getVisitors(),
        eng.getGroups(),
        state.timeState,
        state.phase,
        eng.getTotalSpawned(),
        eng.getTotalExited(),
        eng.getMediaStats(),
        eng.getSpawnByNode(),
        eng.getExitByNode(),
      );
      setShaftQueues(eng.getShaftQueueState());

      // Completion detection
      if (state.phase === 'completed' || state.phase !== 'running') {
        if (state.phase === 'completed' && !milestonesHit.current.has(-1)) {
          milestonesHit.current.add(-1);
          setDensityGrids(eng.getDensityGrids());
          toast('success', t('simControls.toast.completed'));
          // Final snapshot + run record capture (parity with ControlBar.tsx).
          const finalStore = useStore.getState();
          const finalSnapshot = assembleKpiSnapshot(
            finalStore.zones,
            finalStore.media,
            eng.getVisitors(),
            state.timeState.elapsed,
            eng.getTotalExited(),
          );
          pushSnapshot(finalSnapshot);
          const afterPush = useStore.getState();
          if (afterPush.scenario && afterPush.runId) {
            captureRun({
              runId: afterPush.runId,
              startedAt: runStartedAtRef.current || Date.now(),
              scenario: afterPush.scenario,
              dirtyAtCapture: dirtyAtStartRef.current,
              visitors: eng.getVisitors(),
              spawnByNode: eng.getSpawnByNode(),
              exitByNode: eng.getExitByNode(),
              totalSpawned: eng.getTotalSpawned(),
              totalExited: eng.getTotalExited(),
              latestSnapshot: finalSnapshot,
              kpiHistory: afterPush.kpiHistory,
              zoneCount: afterPush.zones.length,
              entryQueue: {
                totalArrived: afterPush.entryQueue.totalArrived,
                totalAdmitted: afterPush.entryQueue.totalAdmitted,
                totalAbandoned: afterPush.entryQueue.totalAbandoned,
                recentAdmitAvgWaitMs: afterPush.entryQueue.recentAdmitAvgWaitMs,
              },
            });
          }
        }
      }

      // Milestone toasts
      const count = activeVisitors.length;
      for (const m of [50, 100, 150, 200, 300, 500]) {
        if (count >= m && !milestonesHit.current.has(m)) {
          milestonesHit.current.add(m);
          toast('success', t('simControls.toast.milestone', { count: m }));
        }
      }

      // Push KPI snapshot at intervals
      const elapsed = state.timeState.elapsed;
      if (elapsed - lastSnapshotTime >= KPI_SAMPLE_INTERVAL_MS) {
        lastSnapshotTime = elapsed;
        setDensityGrids(eng.getDensityGrids());
        const currentStore = useStore.getState();
        // Pass ALL visitors (active + exited) so calculateFlowEfficiency's
        // completionRate = wellVisited/totalEver uses the full cohort; other
        // calculators (utilization/bottleneck/fatigue) already self-filter by isActive.
        const snapshot = assembleKpiSnapshot(
          currentStore.zones,
          currentStore.media,
          eng.getVisitors(),
          elapsed,
          eng.getTotalExited(),
        );
        pushSnapshot(snapshot);

        // Bottleneck alert toasts — once per zone per 60s sim-time so a
        // persistent hotspot doesn't dominate the toast stack.
        for (const bn of snapshot.bottlenecks) {
          if (bn.score > 0.85) {
            const key = `bn_${bn.zoneId as string}_${Math.floor(elapsed / 60000)}`;
            if (!milestonesHit.current.has(key as any)) {
              milestonesHit.current.add(key as any);
              const zone = currentStore.zones.find((z) => z.id === bn.zoneId);
              toast('warning', t('simControls.toast.bottleneck', { zone: zone?.name ?? '?', score: Math.round(bn.score * 100) }));
            }
          }
        }

        // Auto-save checkpoint every 30s sim time
        if (Math.floor(elapsed / 30000) > Math.floor((elapsed - KPI_SAMPLE_INTERVAL_MS) / 30000)) {
          const scen = currentStore.scenario;
          if (scen) {
            try { localStorage.setItem('vela-autosave', JSON.stringify({ scenario: scen, timestamp: Date.now() })); } catch {}
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
    resetCongestionTracking();
    milestonesHit.current.clear();
    loopRef.current = loop;
    setRunId(makeRunId(store.scenario));
    runStartedAtRef.current = Date.now();
    dirtyAtStartRef.current = selectScenarioDirty(store);
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

  const requestStop = useCallback(() => {
    setShowStopConfirm(true);
  }, []);

  const cancelStop = useCallback(() => {
    setShowStopConfirm(false);
  }, []);

  const confirmStop = useCallback(() => {
    if (loopRef.current) {
      loopRef.current.destroy();
      loopRef.current = null;
    }
    resetSim();
    clearHistory();
    clearReplay();
    clearPins();
    milestonesHit.current.clear();
    setShowStopConfirm(false);
    setTimeout(() => setPhase('idle' as any), 50);
  }, [resetSim, clearHistory, clearReplay, clearPins, setPhase]);

  const toggleHeatmap = useCallback(() => {
    const next: OverlayMode = overlayMode === 'heatmap' ? 'none' : 'heatmap';
    setOverlayMode(next);
  }, [overlayMode, setOverlayMode]);

  const handlePin = useCallback(() => {
    const store = useStore.getState();
    const totalS = Math.max(0, Math.round(store.timeState.elapsed / 1000));
    const mm = Math.floor(totalS / 60);
    const ss = totalS % 60;
    const time = `${mm}:${String(ss).padStart(2, '0')}`;
    const pin = pinCurrentMoment(store, t('pinpoint.defaultLabel', { time }));
    if (!pin) {
      toast('warning', t('pinpoint.toast.noSnapshot'));
      return;
    }
    toast('success', t('pinpoint.toast.created', { time }));
  }, [t, toast]);

  const elapsed = timeState.elapsed;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const durationMin = Math.floor(durationMs / 60000);
  const modeBadge =
    simMode === 'person'
      ? t('simControls.modeBadge.person', { count: totalCount, min: durationMin })
      : t('simControls.modeBadge.time', { count: totalCount, min: durationMin });

  return (
    <div className="space-y-3">
      {/* Mode summary badge */}
      {(phase === SIMULATION_PHASE.IDLE || phase === SIMULATION_PHASE.COMPLETED) && (
        <div className="px-2 py-1 rounded-lg bg-secondary/50 text-[10px] text-muted-foreground text-center font-data">
          {modeBadge}
        </div>
      )}
      {/* Controls — action row (Start/Pause/Resume + Stop) */}
      <div className="flex gap-2">
        {(phase === SIMULATION_PHASE.IDLE || phase === SIMULATION_PHASE.COMPLETED) && (
          <button
            onClick={handleStart}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-success)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Play className="w-3.5 h-3.5" /> {t('simControls.start')}
          </button>
        )}
        {phase === SIMULATION_PHASE.RUNNING && (
          <button
            onClick={handlePause}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-warning)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Pause className="w-3.5 h-3.5" /> {t('simControls.pause')}
          </button>
        )}
        {phase === SIMULATION_PHASE.PAUSED && (
          <button
            onClick={handleResume}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-success)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Play className="w-3.5 h-3.5" /> {t('simControls.resume')}
          </button>
        )}
        {(phase === SIMULATION_PHASE.RUNNING || phase === SIMULATION_PHASE.PAUSED) && (
          <button
            onClick={requestStop}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-danger)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Square className="w-3.5 h-3.5" /> {t('simControls.stop')}
          </button>
        )}
      </div>

      {/* Utility row — overlay + pin, predictable placement */}
      <div className="flex gap-2">
        <button
          onClick={toggleHeatmap}
          className={`shrink-0 flex items-center justify-center w-9 h-9 text-xs rounded-xl transition-colors active:scale-95 ${
            overlayMode === 'heatmap' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
          title={t('simControls.heatmap.toggle')}
        >
          <Thermometer className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handlePin}
          disabled={phase === SIMULATION_PHASE.IDLE}
          className="relative shrink-0 flex items-center justify-center w-9 h-9 text-xs rounded-xl bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
          title={`${t('pinpoint.action.pin')} (P)`}
        >
          <Pin className="w-3.5 h-3.5" />
          {pinCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[9px] font-data font-semibold rounded-full bg-primary text-primary-foreground border border-background">
              {pinCount}
            </span>
          )}
        </button>
      </div>

      {/* Speed */}
      {(phase === SIMULATION_PHASE.RUNNING || phase === SIMULATION_PHASE.PAUSED) && (
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-muted-foreground">{t('simControls.speed')}</span>
          {[1, 3, 5, 10, 20, 30].map((spd) => {
            const active = speed === spd;
            return (
              <button
                key={spd}
                onClick={() => {
                  if (engineRef.current) {
                    (engineRef.current.getWorld() as any).config.timeScale = spd;
                  }
                  setSpeed(spd);
                }}
                className={`px-1.5 py-0.5 text-[9px] rounded-md transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-secondary hover:bg-accent'
                }`}
                aria-pressed={active}
              >{spd}x</button>
            );
          })}
        </div>
      )}

      {/* Status */}
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <div className="flex justify-between px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-muted-foreground">{t('simControls.phase')}</span>
          <span className="font-data font-medium uppercase">{phase}</span>
        </div>
        <div className="flex justify-between px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-muted-foreground">{t('simControls.elapsed')}</span>
          <span className="font-data font-medium">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
        </div>
        <div className="flex justify-between px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-muted-foreground">{t('simControls.activeAgents')}</span>
          <span className="font-data font-medium text-primary">{activeCount}</span>
        </div>
        <div className="flex justify-between px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-muted-foreground">{t('simControls.tick')}</span>
          <span className="font-data font-medium">{timeState.tickCount}</span>
        </div>
      </div>

      {showStopConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={cancelStop}>
          <div className="glass rounded-2xl border border-border shadow-2xl w-80 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[var(--status-danger)]/10 p-5 text-center">
              <div className="w-10 h-10 rounded-2xl bg-[var(--status-danger)]/20 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-5 h-5 text-[var(--status-danger)]" />
              </div>
              <h2 className="text-sm font-semibold">{t('sim.stop.title')}</h2>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed whitespace-pre-line">
                {t('sim.stop.body')}
              </p>
            </div>
            <div className="p-4 flex gap-2">
              <button
                onClick={cancelStop}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-xl bg-secondary text-secondary-foreground hover:bg-accent"
              >
                {t('sim.stop.cancel')}
              </button>
              <button
                onClick={confirmStop}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-danger)] text-white hover:opacity-90"
              >
                {t('sim.stop.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
