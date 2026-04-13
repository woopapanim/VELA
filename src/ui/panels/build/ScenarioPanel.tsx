import { useState, useCallback } from 'react';
import { Save, FolderOpen, GitBranch, BarChart3, Trash2 } from 'lucide-react';
import { useStore } from '@/stores';
import { scenarioManager, type SavedScenario } from '@/scenario';
import { compareSnapshots } from '@/comparison';
import { ScenarioImportExport } from './ScenarioImportExport';
import type { ScenarioComparison, DeltaMetric, ScenarioId } from '@/domain';

export function ScenarioPanel() {
  const scenario = useStore((s) => s.scenario);
  const kpiHistory = useStore((s) => s.kpiHistory);
  const setScenario = useStore((s) => s.setScenario);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const zones = useStore((s) => s.zones);

  const [savedList, setSavedList] = useState<SavedScenario[]>(() => scenarioManager.getAll());
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [, setCompareTargetId] = useState<string | null>(null);

  const refreshList = useCallback(() => {
    setSavedList(scenarioManager.getAll());
  }, []);

  const handleSave = useCallback(() => {
    if (!scenario) return;
    scenarioManager.save(scenario, kpiHistory);
    refreshList();
  }, [scenario, kpiHistory, refreshList]);

  const handleLoad = useCallback((id: string) => {
    const saved = scenarioManager.load(id as ScenarioId);
    if (saved) {
      setScenario(saved.scenario);
    }
  }, [setScenario]);

  const handleBranch = useCallback(() => {
    if (!scenario) return;
    const name = `${scenario.meta.name} (Branch)`;
    const branched = scenarioManager.branch(scenario.meta.id, name);
    if (branched) {
      setScenario(branched);
      refreshList();
    }
  }, [scenario, setScenario, refreshList]);

  const handleDelete = useCallback((id: string) => {
    scenarioManager.delete(id as ScenarioId);
    refreshList();
  }, [refreshList]);

  const handleCompare = useCallback((targetId: string) => {
    if (!latestSnapshot || !scenario) return;
    const target = scenarioManager.load(targetId as ScenarioId);
    if (!target || target.kpiHistory.length === 0) return;

    const targetSnapshot = target.kpiHistory[target.kpiHistory.length - 1].snapshot;
    const result = compareSnapshots(latestSnapshot, targetSnapshot, zones, target.scenario.zones);

    setComparison({
      id: `cmp_${Date.now()}` as any,
      scenarioA: scenario.meta,
      scenarioB: target.scenario.meta,
      deltaKpis: result,
      createdAt: Date.now(),
    });
    setCompareTargetId(targetId);
  }, [latestSnapshot, scenario, zones]);

  return (
    <div className="space-y-3">
      {/* Save/Branch */}
      {scenario && (
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-primary text-primary-foreground hover:opacity-90"
          >
            <Save className="w-3.5 h-3.5" /> Save v{scenario.meta.version}
          </button>
          <button
            onClick={handleBranch}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-xl bg-secondary text-secondary-foreground hover:bg-accent"
          >
            <GitBranch className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Saved Scenarios */}
      {savedList.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Saved ({savedList.length})
          </p>
          {savedList.map(({ scenario: s, savedAt }) => (
            <div
              key={s.meta.id as string}
              className="bento-box-elevated p-2 flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{s.meta.name}</p>
                <p className="text-[10px] text-muted-foreground font-data">
                  v{s.meta.version} · {new Date(savedAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleLoad(s.meta.id as string)}
                  className="p-1 rounded hover:bg-secondary"
                  title="Load"
                >
                  <FolderOpen className="w-3 h-3 text-muted-foreground" />
                </button>
                {latestSnapshot && (
                  <button
                    onClick={() => handleCompare(s.meta.id as string)}
                    className="p-1 rounded hover:bg-secondary"
                    title="Compare with current"
                  >
                    <BarChart3 className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(s.meta.id as string)}
                  className="p-1 rounded hover:bg-secondary"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison Result */}
      {comparison && (
        <div className="bento-box-elevated p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            A/B Comparison
          </p>
          <div className="flex items-center gap-2 text-xs mb-2">
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-data">A: {comparison.scenarioA.name}</span>
            <span className="text-muted-foreground">vs</span>
            <span className="px-1.5 py-0.5 rounded bg-[var(--status-success)]/10 text-[var(--status-success)] font-data">B: {comparison.scenarioB.name}</span>
          </div>

          <DeltaRow label="Peak Congestion" d={comparison.deltaKpis.peakCongestion} suffix="%" mult={100} />
          <DeltaRow label="Skip Rate" d={comparison.deltaKpis.globalSkipRate} suffix="%" mult={100} />
          <DeltaRow label="Throughput" d={comparison.deltaKpis.flowEfficiency} suffix="/m" />
          <DeltaRow label="Bottlenecks" d={comparison.deltaKpis.bottleneckCount} />
          <DeltaRow label="Avg Fatigue" d={comparison.deltaKpis.avgFatigue} suffix="%" mult={100} />

          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium">
              추천: <span className={
                comparison.deltaKpis.recommendation === 'B' ? 'text-[var(--status-success)]' :
                comparison.deltaKpis.recommendation === 'A' ? 'text-primary' :
                'text-muted-foreground'
              }>
                시나리오 {comparison.deltaKpis.recommendation === 'neutral' ? '동일' : comparison.deltaKpis.recommendation}
              </span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">{comparison.deltaKpis.summary}</p>
          </div>
        </div>
      )}

      {/* Import/Export */}
      <ScenarioImportExport />
    </div>
  );
}

function DeltaRow({ label, d, suffix, mult }: {
  label: string;
  d: DeltaMetric;
  suffix?: string;
  mult?: number;
}) {
  const m = mult ?? 1;
  const valA = (d.valueA * m).toFixed(1);
  const valB = (d.valueB * m).toFixed(1);
  const pct = d.percentDelta.toFixed(0);
  const isGood = d.improvement;

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-24 text-muted-foreground">{label}</span>
      <span className="font-data w-12 text-right">{valA}{suffix}</span>
      <span className="text-muted-foreground">→</span>
      <span className="font-data w-12 text-right">{valB}{suffix}</span>
      <span className={`font-data w-12 text-right ${isGood ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}`}>
        {Number(pct) > 0 ? '+' : ''}{pct}%
      </span>
    </div>
  );
}
