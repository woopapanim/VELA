/**
 * Regression harness export/import tests.
 *
 * Focus: pure JSON shape — validation, conflict detection, relabel,
 * bulk-roundtrip. Skip the DOM-side download() since it just glues to
 * Blob + anchor.click and offers little to mock-test.
 *
 * Tests run under vitest's default node env, so we mock localStorage
 * with a minimal in-memory shim before each test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHarness, type RegressionHarness } from './harness';

// ─── localStorage mock ───────────────────────────────────────────────

class MemoryStorage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

// ─── Bundle fixtures ─────────────────────────────────────────────────

function makeBundle(label: string, totalSpawned = 100) {
  return {
    label,
    capturedAt: '2026-05-09T00:00:00.000Z',
    scenario: {
      seed: 42,
      durationMs: 7_200_000,
      timeScale: 30,
      simulationMode: 'time',
      totalVisitors: totalSpawned,
      zoneCount: 5,
      mediaCount: 10,
    },
    time: { elapsedMs: 7_200_000, tickCount: 100_000, phase: 'completed' },
    flow: { totalSpawned, totalExited: totalSpawned, activeCount: 0 },
    spawnByNode: { entry_a: totalSpawned },
    exitByNode: { exit_a: totalSpawned },
    zoneUtilizations: [],
    bottleneckTop5: [],
    fatigueMean: 0.3,
    globalSkipRate: 0.5,
    perMediaSkip: [],
    congestion: { total: 0, byIntType: {}, top5Media: [], top5Zones: [] },
    earlyExit: { total: 0, triggerCounts: {}, buckets: [] },
    actionCounts: {},
    kpiSnapshot: null,
  };
}

// Prime the store with a bundle as if capture() had run.
function seed(_harness: RegressionHarness, label: string, totalSpawned = 100) {
  const json = JSON.stringify(makeBundle(label, totalSpawned));
  localStorage.setItem(`vela:regression:${label}`, json);
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('regression harness — exportJSON / load', () => {
  it('round-trips a stored bundle through exportJSON → load', () => {
    const h = createHarness();
    seed(h, 'baseline', 200);
    const json = h.exportJSON('baseline');
    const parsed = JSON.parse(json);
    expect(parsed.label).toBe('baseline');
    expect(parsed.flow.totalSpawned).toBe(200);
  });

  it('throws when label is unknown', () => {
    const h = createHarness();
    expect(() => h.exportJSON('does-not-exist')).toThrow(/not found/);
  });
});

describe('regression harness — exportAll', () => {
  it('produces a bulk envelope with all stored bundles', () => {
    const h = createHarness();
    seed(h, 'a');
    seed(h, 'b');
    const bulk = JSON.parse(h.exportAll());
    expect(bulk.source).toBe('vela-regression-harness');
    expect(bulk.version).toBe(1);
    expect(typeof bulk.exportedAt).toBe('string');
    expect(Object.keys(bulk.bundles).sort()).toEqual(['a', 'b']);
    expect(bulk.bundles.a.label).toBe('a');
  });

  it('returns an empty bundles object when nothing is stored', () => {
    const h = createHarness();
    const bulk = JSON.parse(h.exportAll());
    expect(bulk.bundles).toEqual({});
  });
});

describe('regression harness — importJSON (single bundle)', () => {
  it('imports a fresh single bundle', () => {
    const h = createHarness();
    const json = JSON.stringify(makeBundle('imported'));
    const written = h.importJSON(json);
    expect(written).toEqual(['imported']);
    expect(h.list()).toContain('imported');
    expect(h.load('imported')?.label).toBe('imported');
  });

  it('rejects malformed JSON', () => {
    const h = createHarness();
    expect(() => h.importJSON('{ this is not json')).toThrow(/invalid JSON/);
  });

  it('rejects an object that is not a bundle shape', () => {
    const h = createHarness();
    expect(() => h.importJSON(JSON.stringify({ foo: 'bar' }))).toThrow(/not a regression bundle/);
  });

  it('blocks overwrite by default and lists conflicts', () => {
    const h = createHarness();
    seed(h, 'baseline');
    const json = JSON.stringify(makeBundle('baseline', 999));
    expect(() => h.importJSON(json)).toThrow(/baseline/);
    // Original untouched
    expect(h.load('baseline')?.flow.totalSpawned).toBe(100);
  });

  it('overwrites when explicitly requested', () => {
    const h = createHarness();
    seed(h, 'baseline');
    const json = JSON.stringify(makeBundle('baseline', 999));
    h.importJSON(json, { overwrite: true });
    expect(h.load('baseline')?.flow.totalSpawned).toBe(999);
  });

  it('relabel renames a single bundle on import', () => {
    const h = createHarness();
    const json = JSON.stringify(makeBundle('original'));
    h.importJSON(json, { relabel: 'renamed' });
    expect(h.list()).toContain('renamed');
    expect(h.list()).not.toContain('original');
    // The label inside the stored bundle matches the storage key after relabel.
    expect(h.load('renamed')?.label).toBe('renamed');
  });
});

describe('regression harness — importJSON (bulk envelope)', () => {
  it('imports every bundle from a bulk export', () => {
    const h = createHarness();
    seed(h, 'a');
    seed(h, 'b');
    const bulk = h.exportAll();
    h.clear();
    expect(h.list()).toEqual([]);
    const written = h.importJSON(bulk);
    expect(written.sort()).toEqual(['a', 'b']);
  });

  it('rejects bulk import that would conflict on any label', () => {
    const h = createHarness();
    seed(h, 'a');
    seed(h, 'b');
    const bulk = h.exportAll();
    seed(h, 'c'); // extra unrelated bundle
    // Conflicts on a + b
    expect(() => h.importJSON(bulk)).toThrow(/a, b/);
    // Nothing was overwritten — c is still there.
    expect(h.list().sort()).toEqual(['a', 'b', 'c']);
  });

  it('rejects bulk envelope with a malformed inner bundle', () => {
    const h = createHarness();
    const bad = {
      source: 'vela-regression-harness',
      version: 1,
      exportedAt: new Date().toISOString(),
      bundles: { malformed: { label: 'malformed' } },
    };
    expect(() => h.importJSON(JSON.stringify(bad))).toThrow(/invalid shape/);
  });

  it('exportAll → clear → importJSON yields equivalent state', () => {
    const h = createHarness();
    seed(h, 'a', 100);
    seed(h, 'b', 200);
    const before = JSON.parse(h.exportAll());
    h.clear();
    h.importJSON(JSON.stringify(before));
    const after = JSON.parse(h.exportAll());
    // exportedAt differs; everything else should match.
    expect(after.bundles).toEqual(before.bundles);
  });
});
