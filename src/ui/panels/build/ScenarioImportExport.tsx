import { useCallback, useRef } from 'react';
import { Upload, Download } from 'lucide-react';
import { useStore } from '@/stores';
import type { Scenario } from '@/domain';

export function ScenarioImportExport() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const resetSim = useStore((s) => s.resetSim);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    if (!scenario) return;
    const json = JSON.stringify(scenario, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aion-scenario-${scenario.meta.name.replace(/\s+/g, '-')}-v${scenario.meta.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [scenario]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string) as Scenario;
        if (data.meta && data.zones && data.simulationConfig) {
          resetSim();
          setScenario(data);
        }
      } catch {
        // Invalid JSON
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setScenario, resetSim]);

  return (
    <div className="flex gap-1">
      <button
        onClick={handleExport}
        disabled={!scenario}
        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] rounded-xl bg-secondary hover:bg-accent disabled:opacity-40 transition-colors"
      >
        <Download className="w-3 h-3" /> Export
      </button>
      <button
        onClick={() => inputRef.current?.click()}
        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] rounded-xl bg-secondary hover:bg-accent transition-colors"
      >
        <Upload className="w-3 h-3" /> Import
      </button>
      <input ref={inputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
    </div>
  );
}
