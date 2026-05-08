// ─────────────────────────────────────────────────────────────────────
// Regression validation harness — capture + diff KPI bundles across runs
// ─────────────────────────────────────────────────────────────────────
// `any` is used liberally inside this file because the harness reads from
// dynamically-attached globals (window.__simEngine, window.__store) and
// loosely-typed engine diagnostics. Strong typing here would couple the
// debug tool to engine internals and slow iteration; the lint rule is
// disabled at file scope as a deliberate trade-off.
/* eslint-disable @typescript-eslint/no-explicit-any */
//
// Use case: before changing the simulation engine (e.g. fixing 조기이탈),
// record a baseline KPI bundle. After the change, capture again and diff.
// The diff surfaces *intended* effects vs unintended regressions.
//
// Browser console usage:
//   1. Run simulation to completion (or to a consistent point) with fixed seed.
//   2. __regression.capture('baseline')         // snapshots current state
//   3. ...modify engine, restart sim with same seed, run again...
//   4. __regression.capture('after-fix')
//   5. __regression.diff('baseline', 'after-fix')
//
// Determinism prerequisite: VELA already routes all randomness through
// a seeded Mulberry32 PRNG (src/simulation/utils/random.ts). Same seed +
// same scenario = same outcome.

import type { KpiSnapshot } from '@/domain';

// ─── Types ───────────────────────────────────────────────────────────

interface ScenarioFingerprint {
  seed: number;
  durationMs: number;
  timeScale: number;
  simulationMode: string;
  totalVisitors: number | null;
  zoneCount: number;
  mediaCount: number;
}

interface RegressionBundle {
  /** Human label, also the localStorage key suffix. */
  label: string;
  /** ISO timestamp at capture. */
  capturedAt: string;
  /** Inputs that, if changed, invalidate the comparison. */
  scenario: ScenarioFingerprint;
  /** Sim-time + tick markers. */
  time: { elapsedMs: number; tickCount: number; phase: string };
  /** Top-line flow counters. */
  flow: { totalSpawned: number; totalExited: number; activeCount: number };
  /** Entry/exit gate distribution — for "Entry/Exit 64:36" issue. */
  spawnByNode: Record<string, number>;
  exitByNode: Record<string, number>;
  /** Per-zone utilization summary — for bottleneck regression. */
  zoneUtilizations: Array<{
    zoneId: string;
    peakOccupancy: number;
    capacity: number;
    ratio: number;
    cumulativeCongestedMs: number;
  }>;
  /** Top 5 bottleneck zones. */
  bottleneckTop5: Array<{ zoneId: string; score: number }>;
  /** Fatigue mean — for 조기이탈 issue. */
  fatigueMean: number;
  /** Skip rate analysis — for 스킵률 48% issue. */
  globalSkipRate: number;
  perMediaSkip: Array<{
    mediaId: string;
    skipCount: number;
    totalApproaches: number;
    rate: number;
  }>;
  /** MOVING timeout cumulative — for MOVING timeout 95건 issue. */
  congestion: {
    total: number;
    byIntType: Record<string, number>;
    top5Media: Array<{ mediaId: string; count: number }>;
    top5Zones: Array<{ zoneId: string; count: number }>;
  };
  /** Early exit bucket distribution — for 조기이탈 45% issue. */
  earlyExit: {
    total: number;
    /** Sim-wide canExit trigger distribution (post-hoc inference). */
    triggerCounts: Record<string, number>;
    buckets: Array<{
      label: string;
      count: number;
      pct: number;
      avgFatigue: number;
      avgMediaVisited: number;
      /** Per-bucket trigger distribution. */
      triggerDist: Record<string, number>;
    }>;
  };
  /** Current visitor action distribution at capture time. */
  actionCounts: Record<string, number>;
  /** Aggregate KpiSnapshot for completeness (read-only). */
  kpiSnapshot: KpiSnapshot | null;
}

interface DiffEntry {
  path: string;
  a: number | string;
  b: number | string;
  delta?: number;
  pct?: number;
}

interface DiffOptions {
  /** Absolute epsilon below which deltas are ignored. */
  absEps?: number;
  /** Relative epsilon (0~1) below which deltas are ignored. */
  relEps?: number;
}

// ─── Storage ─────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'vela:regression:';

function storageKey(label: string): string {
  return STORAGE_PREFIX + label;
}

function listStoredLabels(): string[] {
  const labels: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) {
      labels.push(k.slice(STORAGE_PREFIX.length));
    }
  }
  return labels.sort();
}

// ─── Capture ─────────────────────────────────────────────────────────

function buildBundle(label: string): RegressionBundle {
  const eng = (window as any).__simEngine;
  const store = (window as any).__store;
  if (!eng) throw new Error('__simEngine not found. Start a simulation first.');
  if (!store) throw new Error('__store not found.');

  const state = store.getState();
  const world = eng.world;
  const cfg = world?.config ?? {};
  const ts = state.timeState ?? eng.getState?.()?.timeState ?? {};
  const phase = state.phase ?? eng.getState?.()?.phase ?? '?';

  // ── Scenario fingerprint
  const scenario: ScenarioFingerprint = {
    seed: cfg.seed ?? 0,
    durationMs: cfg.duration ?? 0,
    timeScale: cfg.timeScale ?? 1,
    simulationMode: cfg.simulationMode ?? 'time',
    totalVisitors: world?.totalVisitors ?? null,
    zoneCount: state.zones?.length ?? 0,
    mediaCount: state.media?.length ?? 0,
  };

  // ── Action counts (single pass over visitors)
  const actionCounts: Record<string, number> = {};
  let activeCount = 0;
  for (const v of state.visitors ?? []) {
    if (!v.isActive) continue;
    activeCount++;
    const a = v.currentAction ?? '?';
    actionCounts[a] = (actionCounts[a] ?? 0) + 1;
  }

  // ── Diagnostics
  const congestionRaw = typeof eng.diagnoseCongestion === 'function'
    ? eng.diagnoseCongestion()
    : { cumulativeTimeouts: { total: 0, byIntType: {}, byMedia: [], byZone: [] } };
  const earlyExitRaw = typeof eng.diagnoseEarlyExit === 'function'
    ? eng.diagnoseEarlyExit()
    : { total: 0, buckets: [] };

  // ── KPI snapshot pieces
  const snap: KpiSnapshot | null = state.latestSnapshot ?? null;
  const zoneUtilizations = (snap?.zoneUtilizations ?? []).map((u: any) => ({
    zoneId: String(u.zoneId),
    peakOccupancy: u.peakOccupancy ?? 0,
    capacity: u.capacity ?? 0,
    ratio: u.ratio ?? 0,
    cumulativeCongestedMs: u.cumulativeCongestedMs ?? 0,
  }));
  const bottleneckTop5 = [...(snap?.bottlenecks ?? [])]
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5)
    .map((b: any) => ({ zoneId: String(b.zoneId), score: b.score }));
  const perMediaSkip = (snap?.skipRate?.perMedia ?? []).map((m: any) => ({
    mediaId: String(m.mediaId),
    skipCount: m.skipCount,
    totalApproaches: m.totalApproaches,
    rate: m.rate,
  }));

  // ── Map → object (Maps don't survive JSON)
  const mapToObj = (m: ReadonlyMap<string, number> | undefined): Record<string, number> => {
    const out: Record<string, number> = {};
    if (!m) return out;
    for (const [k, v] of m) out[String(k)] = v;
    return out;
  };

  return {
    label,
    capturedAt: new Date().toISOString(),
    scenario,
    time: {
      elapsedMs: ts.elapsed ?? 0,
      tickCount: ts.tickCount ?? 0,
      phase: String(phase),
    },
    flow: {
      totalSpawned: state.totalSpawned ?? 0,
      totalExited: state.totalExited ?? 0,
      activeCount,
    },
    spawnByNode: mapToObj(state.spawnByNode),
    exitByNode: mapToObj(state.exitByNode),
    zoneUtilizations,
    bottleneckTop5,
    fatigueMean: snap?.fatigueDistribution?.mean ?? 0,
    globalSkipRate: snap?.skipRate?.globalSkipRate ?? 0,
    perMediaSkip,
    congestion: {
      total: congestionRaw.cumulativeTimeouts?.total ?? 0,
      byIntType: { ...(congestionRaw.cumulativeTimeouts?.byIntType ?? {}) },
      top5Media: (congestionRaw.cumulativeTimeouts?.byMedia ?? [])
        .slice(0, 5)
        .map((m: any) => ({ mediaId: String(m.mediaId), count: m.count })),
      top5Zones: (congestionRaw.cumulativeTimeouts?.byZone ?? [])
        .slice(0, 5)
        .map((z: any) => ({ zoneId: String(z.zoneId), count: z.count })),
    },
    earlyExit: {
      total: earlyExitRaw.total ?? 0,
      triggerCounts: { ...(earlyExitRaw.triggerCounts ?? {}) },
      buckets: (earlyExitRaw.buckets ?? []).map((b: any) => ({
        label: String(b.label),
        count: b.count,
        pct: b.pct,
        avgFatigue: b.avgFatigue,
        avgMediaVisited: b.avgMediaVisited,
        triggerDist: { ...(b.triggerDist ?? {}) },
      })),
    },
    actionCounts,
    kpiSnapshot: snap,
  };
}

// ─── Diff ────────────────────────────────────────────────────────────

const DEFAULT_DIFF: Required<DiffOptions> = { absEps: 1, relEps: 0.01 };

function isSignificant(a: number, b: number, opts: Required<DiffOptions>): boolean {
  const delta = b - a;
  if (Math.abs(delta) < opts.absEps) return false;
  const denom = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.abs(delta) / denom >= opts.relEps;
}

function compareNumber(path: string, a: number, b: number, opts: Required<DiffOptions>, out: DiffEntry[]) {
  if (!isSignificant(a, b, opts)) return;
  const delta = b - a;
  const denom = Math.abs(a) > 1e-9 ? a : Math.abs(b) > 1e-9 ? b : 1;
  out.push({ path, a, b, delta, pct: delta / denom });
}

function compareRecord(path: string, a: Record<string, number>, b: Record<string, number>, opts: Required<DiffOptions>, out: DiffEntry[]) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    compareNumber(`${path}.${k}`, a[k] ?? 0, b[k] ?? 0, opts, out);
  }
}

function diffBundles(a: RegressionBundle, b: RegressionBundle, opts: DiffOptions = {}): {
  scenarioMatch: boolean;
  scenarioDiffs: DiffEntry[];
  changes: DiffEntry[];
} {
  const merged = { ...DEFAULT_DIFF, ...opts };
  const out: DiffEntry[] = [];
  const scenarioOut: DiffEntry[] = [];

  // Scenario fingerprint (any change here invalidates direct comparison)
  for (const k of Object.keys(a.scenario) as Array<keyof ScenarioFingerprint>) {
    const av = a.scenario[k];
    const bv = b.scenario[k];
    if (av !== bv) {
      scenarioOut.push({ path: `scenario.${String(k)}`, a: String(av), b: String(bv) });
    }
  }

  // Time markers
  compareNumber('time.elapsedMs', a.time.elapsedMs, b.time.elapsedMs, merged, out);
  compareNumber('time.tickCount', a.time.tickCount, b.time.tickCount, merged, out);
  if (a.time.phase !== b.time.phase) {
    out.push({ path: 'time.phase', a: a.time.phase, b: b.time.phase });
  }

  // Flow
  compareNumber('flow.totalSpawned', a.flow.totalSpawned, b.flow.totalSpawned, merged, out);
  compareNumber('flow.totalExited', a.flow.totalExited, b.flow.totalExited, merged, out);
  compareNumber('flow.activeCount', a.flow.activeCount, b.flow.activeCount, merged, out);

  // Entry/Exit balance
  compareRecord('spawnByNode', a.spawnByNode, b.spawnByNode, merged, out);
  compareRecord('exitByNode', a.exitByNode, b.exitByNode, merged, out);

  // Action distribution
  compareRecord('actionCounts', a.actionCounts, b.actionCounts, merged, out);

  // Aggregates
  compareNumber('fatigueMean', a.fatigueMean, b.fatigueMean,
    { ...merged, absEps: 0.005 }, out); // ratio metric — finer threshold
  compareNumber('globalSkipRate', a.globalSkipRate, b.globalSkipRate,
    { ...merged, absEps: 0.005 }, out);

  // Congestion totals
  compareNumber('congestion.total', a.congestion.total, b.congestion.total, merged, out);
  compareRecord('congestion.byIntType', a.congestion.byIntType, b.congestion.byIntType, merged, out);

  // Early exit totals + per-trigger distribution
  compareNumber('earlyExit.total', a.earlyExit.total, b.earlyExit.total, merged, out);
  compareRecord('earlyExit.triggerCounts', a.earlyExit.triggerCounts, b.earlyExit.triggerCounts, merged, out);

  // Per-zone utilization (compare by zoneId)
  const zoneA = new Map(a.zoneUtilizations.map((z) => [z.zoneId, z]));
  const zoneB = new Map(b.zoneUtilizations.map((z) => [z.zoneId, z]));
  const zoneIds = new Set([...zoneA.keys(), ...zoneB.keys()]);
  for (const id of zoneIds) {
    const za = zoneA.get(id) ?? { peakOccupancy: 0, ratio: 0, cumulativeCongestedMs: 0 };
    const zb = zoneB.get(id) ?? { peakOccupancy: 0, ratio: 0, cumulativeCongestedMs: 0 };
    compareNumber(`zone[${id}].peakOccupancy`, za.peakOccupancy, zb.peakOccupancy, merged, out);
    compareNumber(`zone[${id}].ratio`, za.ratio, zb.ratio, { ...merged, absEps: 0.01 }, out);
    compareNumber(`zone[${id}].cumulativeCongestedMs`, za.cumulativeCongestedMs, zb.cumulativeCongestedMs,
      { ...merged, absEps: 1000 }, out); // 1 sec
  }

  // Per-media skip (compare by mediaId)
  const mediaA = new Map(a.perMediaSkip.map((m) => [m.mediaId, m]));
  const mediaB = new Map(b.perMediaSkip.map((m) => [m.mediaId, m]));
  const mediaIds = new Set([...mediaA.keys(), ...mediaB.keys()]);
  for (const id of mediaIds) {
    const ma = mediaA.get(id) ?? { skipCount: 0, totalApproaches: 0, rate: 0 };
    const mb = mediaB.get(id) ?? { skipCount: 0, totalApproaches: 0, rate: 0 };
    compareNumber(`media[${id}].skipCount`, ma.skipCount, mb.skipCount, merged, out);
    compareNumber(`media[${id}].rate`, ma.rate, mb.rate, { ...merged, absEps: 0.01 }, out);
  }

  return {
    scenarioMatch: scenarioOut.length === 0,
    scenarioDiffs: scenarioOut,
    changes: out.sort((x, y) => Math.abs(y.pct ?? 0) - Math.abs(x.pct ?? 0)),
  };
}

// ─── Pretty-print ────────────────────────────────────────────────────

function formatDiff(report: ReturnType<typeof diffBundles>, labelA: string, labelB: string): string {
  const lines: string[] = [];
  lines.push(`# Regression diff: ${labelA} → ${labelB}`);
  if (!report.scenarioMatch) {
    lines.push('');
    lines.push('⚠️  SCENARIO FINGERPRINT CHANGED — comparison may be invalid:');
    for (const e of report.scenarioDiffs) {
      lines.push(`   ${e.path}: ${e.a} → ${e.b}`);
    }
  }
  lines.push('');
  lines.push(`Significant changes: ${report.changes.length}`);
  if (report.changes.length === 0) {
    lines.push('   (none — KPIs match within thresholds)');
  } else {
    for (const c of report.changes) {
      const pctStr = c.pct !== undefined ? ` (${(c.pct * 100).toFixed(1)}%)` : '';
      const deltaStr = c.delta !== undefined ? ` Δ ${c.delta > 0 ? '+' : ''}${c.delta.toFixed(2)}` : '';
      lines.push(`   ${c.path}: ${c.a} → ${c.b}${deltaStr}${pctStr}`);
    }
  }
  return lines.join('\n');
}

// ─── Public API ──────────────────────────────────────────────────────

export interface RegressionHarness {
  capture: (label: string) => RegressionBundle;
  load: (label: string) => RegressionBundle | null;
  list: () => string[];
  diff: (labelA: string, labelB: string, opts?: DiffOptions) => void;
  diffData: (labelA: string, labelB: string, opts?: DiffOptions) => ReturnType<typeof diffBundles>;
  clear: (label?: string) => void;
  exportJSON: (label: string) => string;
}

export function createHarness(): RegressionHarness {
  return {
    capture(label: string) {
      const bundle = buildBundle(label);
      localStorage.setItem(storageKey(label), JSON.stringify(bundle));
      console.log(`[regression] captured "${label}" — sim ${(bundle.time.elapsedMs / 1000).toFixed(1)}s, ${bundle.flow.totalSpawned} spawned, ${bundle.flow.totalExited} exited`);
      return bundle;
    },
    load(label: string) {
      const raw = localStorage.getItem(storageKey(label));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as RegressionBundle;
      } catch {
        return null;
      }
    },
    list() {
      return listStoredLabels();
    },
    diffData(labelA, labelB, opts) {
      const a = this.load(labelA);
      const b = this.load(labelB);
      if (!a) throw new Error(`bundle "${labelA}" not found`);
      if (!b) throw new Error(`bundle "${labelB}" not found`);
      return diffBundles(a, b, opts);
    },
    diff(labelA, labelB, opts) {
      const report = this.diffData(labelA, labelB, opts);
      console.log(formatDiff(report, labelA, labelB));
    },
    clear(label?: string) {
      if (label) {
        localStorage.removeItem(storageKey(label));
      } else {
        for (const l of listStoredLabels()) {
          localStorage.removeItem(storageKey(l));
        }
      }
    },
    exportJSON(label) {
      const b = this.load(label);
      if (!b) throw new Error(`bundle "${label}" not found`);
      return JSON.stringify(b, null, 2);
    },
  };
}

// ─── Auto-attach in dev ──────────────────────────────────────────────

declare global {
  interface Window {
    __regression?: RegressionHarness;
  }
}

export function attachToWindow() {
  if (typeof window === 'undefined') return;
  if (!window.__regression) {
    window.__regression = createHarness();
    console.log('[regression] harness attached as window.__regression. Try: __regression.list()');
  }
}
