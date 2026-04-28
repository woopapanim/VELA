import { useRef, useCallback, useState } from 'react';
import { Play, Pause, Square, AlertTriangle, Sparkles, Check } from 'lucide-react';
import { useStore } from '@/stores';
import { SimulationEngine, SimulationLoop } from '@/simulation';
import {
  SIMULATION_PHASE,
  KPI_SAMPLE_INTERVAL_MS,
  computeRecommendedVisitorCount,
  experienceModeTier,
  VISITOR_COUNT_MIN,
  VISITOR_COUNT_MAX,
} from '@/domain';
import { assembleKpiSnapshot } from '@/analytics';
import { useToast } from '@/ui/components/Toast';
import { resetPeakOccupancy } from '@/analytics/calculators/utilization';
import type { EntryQueueState, EntryQueueNodeBucket } from '@/stores';
import { useT } from '@/i18n';

// djb2-style short hash → 6 hex chars. Deterministic for identical scenario shape.
function hashSignature(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

function makeRunId(scenario: {
  readonly zones: readonly unknown[];
  readonly media: readonly unknown[];
  readonly waypointGraph?: { readonly nodes: readonly unknown[]; readonly edges: readonly unknown[] };
  readonly visitorDistribution: { readonly totalCount: number };
}): string {
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
  const { toast } = useToast();
  const milestonesHit = useRef(new Set<number>());
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [speed, setSpeed] = useState(1);

  const phase = useStore((s) => s.phase);
  const scenario = useStore((s) => s.scenario);
  const timeState = useStore((s) => s.timeState);
  const visitors = useStore((s) => s.visitors);
  const updateSimState = useStore((s) => s.updateSimState);
  const setShaftQueues = useStore((s) => s.setShaftQueues);
  const setDensityGrids = useStore((s) => s.setDensityGrids);
  const setEntryQueue = useStore((s) => s.setEntryQueue);
  const setPhase = useStore((s) => s.setPhase);
  const resetSim = useStore((s) => s.resetSim);
  const pushSnapshot = useStore((s) => s.pushSnapshot);
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

      // Phase 1: outside entry queue snapshot — group peeked items by spawnEntryNodeId
      // so OutsideQueueRenderer can draw per-node dot rings + EntryQueueLive can show KPIs.
      // Cheap when policy is 'unlimited' (queue is always empty).
      const queueItems = eng.peekEntryQueue();
      const queueSnap = eng.getEntryQueueSnapshot();
      const totalAbandonedNow = eng.getTotalAbandoned();
      const elapsedNow = state.timeState.elapsed;
      const byNode = new Map<string, EntryQueueNodeBucket>();
      for (const item of queueItems) {
        const nodeId = (item.payload as any).spawnEntryNodeId as string | null;
        if (!nodeId) continue;
        const wait = Math.max(0, elapsedNow - item.arrivedAt);
        const cur = byNode.get(nodeId);
        if (cur) {
          byNode.set(nodeId, {
            count: cur.count + 1,
            oldestWaitMs: Math.max(cur.oldestWaitMs, wait),
          });
        } else {
          byNode.set(nodeId, { count: 1, oldestWaitMs: wait });
        }
      }
      const entryQueueState: EntryQueueState = {
        byNode,
        totalQueueLength: queueSnap.queueLength,
        oldestWaitMs: queueSnap.oldestWaitMs,
        totalAbandoned: totalAbandonedNow,
        avgQueueWaitMs: queueSnap.avgQueueWaitMs,
        recentAdmitAvgWaitMs: queueSnap.recentAdmitAvgWaitMs,
        totalAdmitted: queueSnap.totalAdmitted,
        totalArrived: queueSnap.totalArrived,
      };
      setEntryQueue(entryQueueState);

      // Completion detection
      if (state.phase === 'completed' || state.phase !== 'running') {
        if (state.phase === 'completed' && !milestonesHit.current.has(-1)) {
          milestonesHit.current.add(-1);
          setDensityGrids(eng.getDensityGrids());
          toast('success', '✅ Simulation completed!');

          // ── Policy A/B/C 자동 캡처
          //    1) activePolicySlotId 있으면 그 슬롯에 저장.
          //    2) 없으면 비교 가능한 정책 (non-unlimited) 일 때 가장 낮은 빈 슬롯 (A→B→C) 에 자동 저장
          //       → 사용자가 모드 모르고 실행해도 첫 run 부터 비교 데이터가 쌓임.
          const final = useStore.getState();
          const opsMode = final.scenario?.simulationConfig.operations?.entryPolicy.mode ?? 'unlimited';
          let targetSlotId = final.activePolicySlotId;
          let autoFilled = false;
          if (targetSlotId == null && opsMode !== 'unlimited') {
            const order: ('A' | 'B' | 'C')[] = ['A', 'B', 'C'];
            const empty = order.find((id) => final.policySlots[id].status === 'empty');
            if (empty) {
              const cap = final.scenario?.simulationConfig.operations?.entryPolicy.maxConcurrent;
              if (cap != null && cap > 0) {
                final.setPolicySlotCap(empty, cap);
                targetSlotId = empty;
                autoFilled = true;
              }
            }
          }
          if (targetSlotId) {
            const finalElapsed = state.timeState.elapsed;
            const finalSnapshot = assembleKpiSnapshot(
              final.zones,
              final.media,
              eng.getVisitors(),
              finalElapsed,
              eng.getTotalExited(),
            );
            final.capturePolicySlotResult(
              targetSlotId,
              finalSnapshot,
              eng.getTotalSpawned(),
              eng.getTotalExited(),
            );
            if (autoFilled) {
              toast('info', `📊 슬롯 ${targetSlotId} 에 결과 저장 — A/B/C 비교에 사용됩니다`);
            }
          }
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
              toast('warning', `⚠️ ${zone?.name ?? '?'} bottleneck (${Math.round(bn.score * 100)})`);
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
    milestonesHit.current.clear();
    loopRef.current = loop;
    setRunId(makeRunId(store.scenario));
    loop.start();
    setPhase(SIMULATION_PHASE.RUNNING);
  }, [updateSimState, setPhase, setEntryQueue, setShaftQueues, setDensityGrids, pushSnapshot, pushReplayFrame, setRunId, toast, t]);

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

  const elapsed = timeState.elapsed;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const durationMin = Math.floor(durationMs / 60000);
  const modeBadge =
    simMode === 'person'
      ? `👥 사람 기준 · ${totalCount}명 · 최대 ${durationMin}분`
      : `🕐 시간 기준 · ${durationMin}분 · 최대 ${totalCount}명`;

  // 검증 tier 는 좌측 패널에서 SpawnConfig 가 숨김 → SimulationControls 안에 인라인
  // 방문객 수 입력을 직접 노출. 운영 tier 는 SpawnConfig 가 이미 보임 → 배지만 노출.
  const expMode = scenario?.experienceMode;
  const tier = expMode ? experienceModeTier(expMode) : 'operations';
  const isValidationTier = tier === 'validation';
  const isIdleOrCompleted = phase === SIMULATION_PHASE.IDLE || phase === SIMULATION_PHASE.COMPLETED;

  return (
    <div className="space-y-3">
      {/* 운영 tier 모드 배지 — phase=idle|completed 일 때만 (실행 중엔 잠금) */}
      {isIdleOrCompleted && !isValidationTier && (
        <div className="px-2 py-1 rounded bg-secondary/50 text-[10px] text-muted-foreground text-center font-data">
          {modeBadge}
        </div>
      )}
      {/* Controls — Start / Pause+Stop / Resume+Stop. 원본 행 레이아웃 유지. */}
      <div className="flex gap-2">
        {(phase === SIMULATION_PHASE.IDLE || phase === SIMULATION_PHASE.COMPLETED) && (
          <button
            onClick={handleStart}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-success)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Play className="w-3.5 h-3.5" /> Start
          </button>
        )}
        {phase === SIMULATION_PHASE.RUNNING && (
          <button
            onClick={handlePause}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-warning)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Pause className="w-3.5 h-3.5" /> Pause
          </button>
        )}
        {phase === SIMULATION_PHASE.PAUSED && (
          <button
            onClick={handleResume}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-success)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Play className="w-3.5 h-3.5" /> Resume
          </button>
        )}
        {(phase === SIMULATION_PHASE.RUNNING || phase === SIMULATION_PHASE.PAUSED) && (
          <button
            onClick={requestStop}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[var(--status-danger)] text-white hover:opacity-90 active:scale-[0.98] transition-transform"
          >
            <Square className="w-3.5 h-3.5" /> Stop
          </button>
        )}
      </div>

      {/* 검증 tier 인라인 방문객 수 입력 — Start 버튼 아래 (시뮬 컨텍스트의 부속 입력).
          phase=idle|completed 일 때만 노출, running 중엔 잠금. */}
      {isIdleOrCompleted && isValidationTier && <VisitorLoadInline />}

      {/* Speed */}
      {(phase === SIMULATION_PHASE.RUNNING || phase === SIMULATION_PHASE.PAUSED) && (
        <div className="flex items-center gap-1">
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

// ── VisitorLoadInline — 검증 tier 의 인라인 방문객 수 입력 ────────────
// 검증 tier 는 좌측 SpawnConfig 패널을 숨기지만, "몇 명을 흘려보낼지" 는 반드시
// 사용자가 결정해야 함 (10평 vs 600평 의 적정 부하가 다름). 면적 기반 권장값을
// 자동 제시하고, 사용자가 override 가능한 작은 입력 카드를 SimulationControls
// 안에 직접 노출. simulationMode 는 'person' 으로 강제 (totalCount 도달 시 종료).
function VisitorLoadInline() {
  const t = useT();
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const zones = useStore((s) => s.zones);

  const totalAreaM2 = zones.reduce((sum, z) => sum + (z.area ?? 0), 0);
  const recommended = computeRecommendedVisitorCount(totalAreaM2);
  const totalCount = scenario?.visitorDistribution.totalCount ?? recommended;
  const totalAreaPyeong = totalAreaM2 / 3.3058;

  if (!scenario) return null;

  const setCount = (next: number) => {
    const clamped = Math.min(VISITOR_COUNT_MAX, Math.max(VISITOR_COUNT_MIN, Math.round(next)));
    setScenario({
      ...scenario,
      visitorDistribution: { ...scenario.visitorDistribution, totalCount: clamped },
      // 검증 tier 는 항상 'person' 모드 — totalCount 도달 시 자연 종료.
      simulationConfig: { ...scenario.simulationConfig, simulationMode: 'person' },
    });
  };

  const isApplied = totalCount === recommended;

  return (
    <div className="px-3 py-2.5 rounded-lg bg-secondary/50 border border-border/50 space-y-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground uppercase tracking-wider font-medium">
          {t('sim.visitorLoad.label')}
        </span>
        <span className="text-muted-foreground/60 font-data">
          {totalAreaPyeong.toFixed(0)}평 · {Math.round(totalAreaM2)}㎡
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={VISITOR_COUNT_MIN}
          max={VISITOR_COUNT_MAX}
          value={totalCount}
          onChange={(e) => setCount(Number(e.target.value) || recommended)}
          className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1 text-xs font-data font-medium focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-[10px] text-muted-foreground shrink-0">{t('sim.visitorLoad.unit')}</span>
      </div>
      {/* 추천값 — 항상 노출. 적용 후엔 "적용됨" 상태로 morph. */}
      <button
        type="button"
        onClick={() => !isApplied && setCount(recommended)}
        disabled={isApplied}
        title={t('sim.visitorLoad.recommendBasis', { area: Math.round(totalAreaM2), count: recommended })}
        className={`w-full flex items-center justify-center gap-1.5 px-2 py-1 text-[10px] rounded transition-colors ${
          isApplied
            ? 'bg-primary/5 text-primary/70 cursor-default'
            : 'bg-primary/10 text-primary hover:bg-primary/20'
        }`}
      >
        {isApplied ? (
          <>
            <Check className="w-3 h-3" />
            {t('sim.visitorLoad.recommendApplied')}
          </>
        ) : (
          <>
            <Sparkles className="w-3 h-3" />
            {t('sim.visitorLoad.recommendCta', { count: recommended })}
          </>
        )}
      </button>
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        {t('sim.visitorLoad.hint')}
      </p>
    </div>
  );
}
