import { useRef, useCallback, useState, useMemo } from 'react';
import { Play, Pause, Square, Thermometer, AlertTriangle, Pin } from 'lucide-react';
import { useStore } from '@/stores';
import { SimulationEngine, SimulationLoop } from '@/simulation';
import { SIMULATION_PHASE, KPI_SAMPLE_INTERVAL_MS } from '@/domain';
import { assembleKpiSnapshot, pinCurrentMoment } from '@/analytics';
import { useToast } from '@/ui/components/Toast';
import { resetPeakOccupancy } from '@/analytics/calculators/utilization';
import type { OverlayMode } from '@/stores';
import { useT } from '@/i18n';
import { ReplayScrubber } from '@/ui/panels/canvas/ReplayScrubber';

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
  const sig = [
    scenario.zones.length,
    scenario.media.length,
    scenario.waypointGraph?.nodes.length ?? 0,
    scenario.waypointGraph?.edges.length ?? 0,
    scenario.visitorDistribution.totalCount,
  ].join('|');
  return `run_${ts}_${hashSignature(sig)}`;
}

// Simulate 하단 horizontal bar. Timeline + 재생 컨트롤 + Speed + Heatmap/Pin.
// 기존 SimulationControls (column) + Timeline 을 한 줄로 합친 것 — floating chrome 폐기.
export function ControlBar() {
  const t = useT();
  const loopRef = useRef<SimulationLoop | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const { toast } = useToast();
  const milestonesHit = useRef(new Set<number>());
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [speed, setSpeed] = useState(1);

  const phase = useStore((s) => s.phase);
  const elapsed = useStore((s) => s.timeState.elapsed);
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
  const pushReplayFrame = useStore((s) => s.pushReplayFrame);
  const clearReplay = useStore((s) => s.clearReplay);
  const clearHistory = useStore((s) => s.clearHistory);
  const clearPins = useStore((s) => s.clearPins);
  const setRunId = useStore((s) => s.setRunId);
  const replayCount = useStore((s) => s.replayFrames.length);
  const duration = useStore((s) => s.scenario?.simulationConfig.duration ?? 0);
  const kpiHistory = useStore((s) => s.kpiHistory);

  const activeCount = visitors.filter((v) => v.isActive).length;
  const isReplayable = (phase === 'completed' || phase === 'paused') && replayCount > 0;

  // Bottleneck 마커 — kpiHistory walk
  const markers = useMemo(() => {
    if (!duration) return [];
    const seen = new Set<string>();
    const out: { t: number }[] = [];
    for (const entry of kpiHistory as any[]) {
      for (const bn of entry.snapshot?.bottlenecks ?? []) {
        const key = bn.zoneId as string;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ t: entry.timestamp });
        }
      }
    }
    return out;
  }, [kpiHistory, duration]);

  const handleStart = useCallback(() => {
    const store = useStore.getState();
    if (!store.scenario) return;

    if (store.phase === 'completed') resetSim();

    const hasGraph = store.waypointGraph && store.waypointGraph.nodes.length > 0;
    if (hasGraph) {
      const entries = store.waypointGraph!.nodes.filter(n => n.type === 'entry');
      const exits = store.waypointGraph!.nodes.filter(n => n.type === 'exit');
      if (entries.length === 0) { toast('warning', t('sim.toast.entryNeeded')); return; }
      if (exits.length === 0) { toast('warning', t('sim.toast.exitNeeded')); return; }
      if (store.waypointGraph!.edges.length === 0) { toast('warning', t('sim.toast.edgeNeeded')); return; }
    } else {
      toast('warning', t('sim.toast.nodesAndEdgesNeeded')); return;
    }

    const flowMode = store.scenario.globalFlowMode ?? 'free';
    const guidedIdx = store.scenario.guidedUntilIndex ?? 0;

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

    let lastSnapshotTime = 0;
    let frameSkip = 0;
    const loop = new SimulationLoop(engine);
    loop.setOnTick((eng) => {
      const state = eng.getState();
      frameSkip++;

      if (frameSkip % 2 !== 0 && state.phase === 'running') return;

      const activeVisitors = eng.getActiveVisitors();
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

      if (state.phase === 'completed' || state.phase !== 'running') {
        if (state.phase === 'completed' && !milestonesHit.current.has(-1)) {
          milestonesHit.current.add(-1);
          setDensityGrids(eng.getDensityGrids());
          toast('success', '✅ Simulation completed!');
        }
      }

      const count = activeVisitors.length;
      for (const m of [50, 100, 150, 200, 300, 500]) {
        if (count >= m && !milestonesHit.current.has(m)) {
          milestonesHit.current.add(m);
          toast('success', `🏆 ${m} agents reached!`);
        }
      }

      const elapsedNow = state.timeState.elapsed;
      if (elapsedNow - lastSnapshotTime >= KPI_SAMPLE_INTERVAL_MS) {
        lastSnapshotTime = elapsedNow;
        setDensityGrids(eng.getDensityGrids());
        const currentStore = useStore.getState();
        const snapshot = assembleKpiSnapshot(
          currentStore.zones,
          currentStore.media,
          eng.getVisitors(),
          elapsedNow,
          eng.getTotalExited(),
        );
        pushSnapshot(snapshot);

        for (const bn of snapshot.bottlenecks) {
          if (bn.score > 0.85) {
            const key = `bn_${bn.zoneId as string}_${Math.floor(elapsedNow / 60000)}`;
            if (!milestonesHit.current.has(key as any)) {
              milestonesHit.current.add(key as any);
              const zone = currentStore.zones.find((z) => z.id === bn.zoneId);
              toast('warning', `⚠️ ${zone?.name ?? '?'} bottleneck (${Math.round(bn.score * 100)})`);
            }
          }
        }

        if (Math.floor(elapsedNow / 30000) > Math.floor((elapsedNow - KPI_SAMPLE_INTERVAL_MS) / 30000)) {
          const scen = currentStore.scenario;
          if (scen) {
            try { localStorage.setItem('vela-autosave', JSON.stringify({ scenario: scen, timestamp: Date.now() })); } catch {}
          }
        }

        pushReplayFrame({
          visitors: activeVisitors,
          groups: eng.getGroups(),
          timeState: state.timeState,
          timestamp: elapsedNow,
        });
      }
    });

    clearReplay();
    resetPeakOccupancy();
    milestonesHit.current.clear();
    loopRef.current = loop;
    setRunId(makeRunId(store.scenario));
    loop.start();
    setPhase(SIMULATION_PHASE.RUNNING);
  }, [updateSimState, setPhase, t, toast, resetSim, setShaftQueues, setDensityGrids, pushSnapshot, pushReplayFrame, clearReplay, setRunId]);

  const handlePause = useCallback(() => {
    loopRef.current?.stop();
    setPhase(SIMULATION_PHASE.PAUSED);
  }, [setPhase]);

  const handleResume = useCallback(() => {
    loopRef.current?.resume();
    setPhase(SIMULATION_PHASE.RUNNING);
  }, [setPhase]);

  const requestStop = useCallback(() => setShowStopConfirm(true), []);
  const cancelStop = useCallback(() => setShowStopConfirm(false), []);

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

  const pct = duration > 0 ? Math.min(1, elapsed / duration) * 100 : 0;
  const mm = Math.floor(elapsed / 60000);
  const ss = Math.floor((elapsed % 60000) / 1000);
  const tm = Math.floor(duration / 60000);
  const ts = Math.floor((duration % 60000) / 1000);

  return (
    <div className="border-t border-border bg-[var(--surface)] flex items-center gap-3 px-4 h-14 flex-shrink-0">
      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {(phase === SIMULATION_PHASE.IDLE || phase === SIMULATION_PHASE.COMPLETED) && (
          <button
            onClick={handleStart}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--status-success)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Play className="w-3.5 h-3.5" /> Start
          </button>
        )}
        {phase === SIMULATION_PHASE.RUNNING && (
          <button
            onClick={handlePause}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--status-warning)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Pause className="w-3.5 h-3.5" /> Pause
          </button>
        )}
        {phase === SIMULATION_PHASE.PAUSED && (
          <button
            onClick={handleResume}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--status-success)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Play className="w-3.5 h-3.5" /> Resume
          </button>
        )}
        {(phase === SIMULATION_PHASE.RUNNING || phase === SIMULATION_PHASE.PAUSED) && (
          <button
            onClick={requestStop}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--status-danger)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Time + progress */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground font-data tabular-nums flex-shrink-0">
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          {isReplayable ? (
            <ReplayScrubber />
          ) : phase !== 'idle' && duration > 0 ? (
            <div className="relative h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${pct}%` }} />
              {markers.map((m, i) => {
                const x = Math.min(100, (m.t / duration) * 100);
                return (
                  <div
                    key={i}
                    className="absolute top-0 w-0.5 h-full bg-[var(--status-warning)]"
                    style={{ left: `${x}%` }}
                    title={`병목 — ${Math.floor(m.t / 60000)}:${String(Math.floor((m.t % 60000) / 1000)).padStart(2, '0')}`}
                  />
                );
              })}
            </div>
          ) : (
            <div className="h-1.5 rounded-full bg-secondary/30" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-data tabular-nums flex-shrink-0">
          {String(tm).padStart(2, '0')}:{String(ts).padStart(2, '0')}
        </span>
      </div>

      {/* Speed selector */}
      {(phase === SIMULATION_PHASE.RUNNING || phase === SIMULATION_PHASE.PAUSED) && (
        <div className="flex items-center gap-1 flex-shrink-0 border-l border-border pl-3">
          <span className="text-[9px] text-muted-foreground">Speed</span>
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
                className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                  active ? 'bg-primary text-primary-foreground font-semibold' : 'bg-secondary hover:bg-accent'
                }`}
                aria-pressed={active}
              >{spd}x</button>
            );
          })}
        </div>
      )}

      {/* Active count + utility buttons */}
      <div className="flex items-center gap-2 flex-shrink-0 border-l border-border pl-3">
        <div className="text-[10px] font-data tabular-nums text-muted-foreground">
          <span className="text-primary font-semibold">{activeCount}</span> active
        </div>
        <button
          onClick={toggleHeatmap}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors active:scale-95 ${
            overlayMode === 'heatmap' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
          title="Toggle Heatmap"
        >
          <Thermometer className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handlePin}
          disabled={phase === SIMULATION_PHASE.IDLE}
          className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
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
