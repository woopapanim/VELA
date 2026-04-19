import { useState, useCallback } from 'react';
import { Plus, Save, FolderOpen, Trash2, Clock } from 'lucide-react';
import { useStore } from '@/stores';
import { useToast } from '@/ui/components/Toast';
import { DEFAULT_PHYSICS, DEFAULT_SKIP_THRESHOLD } from '@/domain';
import type { Scenario } from '@/domain';
import { useT } from '@/i18n';

const HISTORY_KEY = 'vela-project-history';

interface ProjectEntry {
  id: string;
  name: string;
  scenario: Scenario;
  savedAt: number;
}

function loadHistory(): ProjectEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: ProjectEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-20))); // keep last 20
  } catch {}
}

// Keep fileHandle across saves so repeat saves go to the same file
let _lastFileHandle: any = null;

export function ProjectManager() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const updateScenarioMeta = useStore((s) => s.updateScenarioMeta);
  const resetSim = useStore((s) => s.resetSim);
  const clearHistory = useStore((s) => s.clearHistory);
  const clearReplay = useStore((s) => s.clearReplay);
  const phase = useStore((s) => s.phase);
  const { toast } = useToast();
  const t = useT();

  const [history, setHistory] = useState<ProjectEntry[]>(() => loadHistory());

  // New blank project
  const handleNew = useCallback(() => {
    resetSim();
    clearHistory();
    clearReplay();

    const blank: Scenario = {
      meta: {
        id: `project_${Date.now()}` as any,
        name: 'New Project',
        description: '',
        version: 1,
        parentId: null,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      floors: [{
        id: 'floor_1f' as any,
        name: '1F',
        level: 0,
        canvas: { width: 1200, height: 800, gridSize: 40, backgroundImage: null, scale: 0.025 },
        zoneIds: [],
        metadata: {},
      }],
      zones: [],
      media: [],
      visitorDistribution: {
        totalCount: 200,
        profileWeights: { general: 60, vip: 15, child: 10, elderly: 10, disabled: 5 },
        engagementWeights: { quick: 30, explorer: 40, immersive: 30 },
        groupRatio: 0.3,
        spawnRatePerSecond: 0.2,
      },
      simulationConfig: {
        fixedDeltaTime: 1000 / 60,
        duration: 3_600_000,
        timeScale: 10,
        maxVisitors: 500,
        seed: Math.floor(Math.random() * 99999),
        physics: DEFAULT_PHYSICS,
        skipThreshold: DEFAULT_SKIP_THRESHOLD,
        timeSlots: [{
          startTimeMs: 0, endTimeMs: 3_600_000,
          spawnRatePerSecond: 0.2,
          profileDistribution: { general: 60, vip: 15, child: 10, elderly: 10, disabled: 5 },
          engagementDistribution: { quick: 30, explorer: 40, immersive: 30 },
          groupRatio: 0.3,
        }],
      },
    };
    setScenario(blank);
    toast('info', 'New project created');
  }, [resetSim, clearHistory, clearReplay, setScenario, toast]);

  // Save = JSON 파일 다운로드 성공 후 localStorage 저장
  const handleSave = useCallback(async () => {
    const store = useStore.getState();
    const s = store.scenario;
    if (!s) return;

    const buildScenario = (name: string): Scenario => ({
      ...s,
      zones: store.zones,
      media: store.media,
      floors: store.floors,
      shafts: store.shafts,
      waypointGraph: store.waypointGraph ?? undefined,
      meta: { ...s.meta, name, updatedAt: Date.now(), version: s.meta.version + 1 },
    });

    const initialName = s.meta.name;
    const suggestedFileName = `${initialName.replace(/\s+/g, '-')}.json`;

    // localStorage 저장 헬퍼 (파일 저장 성공 후 호출)
    const commitToHistory = (scn: Scenario) => {
      const entry: ProjectEntry = {
        id: scn.meta.id as string,
        name: scn.meta.name,
        scenario: scn,
        savedAt: Date.now(),
      };
      const existing = loadHistory();
      const idx = existing.findIndex((e) => e.id === entry.id);
      if (idx >= 0) existing[idx] = entry;
      else existing.push(entry);
      saveHistory(existing);
      setHistory(existing);
    };

    // ── File System Access API (Chrome/Edge) ──
    if ('showSaveFilePicker' in window) {
      try {
        // Reuse previous file handle if available (same file, no dialog)
        let fileHandle = _lastFileHandle;
        let pickedNewHandle = false;
        if (!fileHandle) {
          fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: suggestedFileName,
            types: [{ description: 'VELA Project', accept: { 'application/json': ['.json'] } }],
          });
          _lastFileHandle = fileHandle;
          pickedNewHandle = true;
        }
        // When user picked a new file, adopt its filename as the project name.
        const finalName = pickedNewHandle
          ? (fileHandle.name as string).replace(/\.json$/i, '') || initialName
          : initialName;
        const finalScenario = buildScenario(finalName);
        setScenario(finalScenario);
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(finalScenario, null, 2));
        await writable.close();
        commitToHistory(finalScenario);
        toast('success', t('project.toast.saved', { name: finalScenario.meta.name, version: finalScenario.meta.version }));
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        // Handle revoked/invalid handle — clear and retry with picker
        _lastFileHandle = null;
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: suggestedFileName,
            types: [{ description: 'VELA Project', accept: { 'application/json': ['.json'] } }],
          });
          _lastFileHandle = fileHandle;
          const finalName = (fileHandle.name as string).replace(/\.json$/i, '') || initialName;
          const finalScenario = buildScenario(finalName);
          setScenario(finalScenario);
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(finalScenario, null, 2));
          await writable.close();
          commitToHistory(finalScenario);
          toast('success', t('project.toast.saved', { name: finalScenario.meta.name, version: finalScenario.meta.version }));
          return;
        } catch (e2: any) {
          if (e2?.name === 'AbortError') return;
        }
      }
    }

    // ── Fallback: 다운로드 (Safari 등) ──
    const finalScenario = buildScenario(initialName);
    setScenario(finalScenario);
    const blob = new Blob([JSON.stringify(finalScenario, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedFileName;
    a.click();
    URL.revokeObjectURL(url);
    commitToHistory(finalScenario);
    toast('success', t('project.toast.saved', { name: finalScenario.meta.name, version: finalScenario.meta.version }));
  }, [scenario, setScenario, toast, t]);

  // Open JSON file
  const handleOpen = useCallback(async () => {
    const loadFile = async (file: File) => {
      const text = await file.text();
      const data = JSON.parse(text) as Scenario;
      if (!data.meta || !data.zones || !data.simulationConfig) {
        toast('error', t('project.toast.invalid'));
        return;
      }
      // 파일명에서 프로젝트 이름 설정
      const nameFromFile = file.name.replace(/\.json$/i, '');
      data.meta = { ...data.meta, name: nameFromFile };
      resetSim(); clearHistory(); clearReplay();
      setScenario(data);
      // Recent에 추가
      const entry: ProjectEntry = {
        id: data.meta.id as string,
        name: nameFromFile,
        scenario: data,
        savedAt: Date.now(),
      };
      const existing = loadHistory();
      const idx = existing.findIndex((e) => e.id === entry.id);
      if (idx >= 0) existing[idx] = entry;
      else existing.push(entry);
      saveHistory(existing);
      setHistory(existing);
      toast('success', t('project.toast.opened', { name: nameFromFile }));
    };

    // ── File System Access API (Chrome/Edge) ──
    if ('showOpenFilePicker' in window) {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'VELA Project', accept: { 'application/json': ['.json'] } }],
          multiple: false,
        });
        _lastFileHandle = fileHandle; // Remember handle so Save writes to same file
        const file = await fileHandle.getFile();
        await loadFile(file);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // ── Fallback: 동적 input ──
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return;
      try { await loadFile(file); } catch { toast('error', t('project.toast.parseError')); }
    };
    input.oncancel = () => { if (document.body.contains(input)) document.body.removeChild(input); };
    input.click();
  }, [setScenario, resetSim, clearHistory, clearReplay, toast, t]);

  // Export JSON
  const handleExport = useCallback(() => {
    if (!scenario) return;
    const json = JSON.stringify(scenario, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.meta.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('info', 'Project exported');
  }, [scenario, toast]);

  // Load from history
  const handleLoadHistory = useCallback((entry: ProjectEntry) => {
    resetSim();
    clearHistory();
    clearReplay();
    setScenario(entry.scenario);
    toast('info', `Loaded "${entry.name}"`);
  }, [resetSim, clearHistory, clearReplay, setScenario, toast]);

  // Delete from history
  const handleDeleteHistory = useCallback((id: string) => {
    const updated = loadHistory().filter((e) => e.id !== id);
    saveHistory(updated);
    setHistory(updated);
  }, []);

  const isRunning = phase !== 'idle';

  return (
    <div className="space-y-3">
      {/* Project Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={handleNew}
          disabled={isRunning}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
        <button
          onClick={handleSave}
          disabled={!scenario}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-secondary text-secondary-foreground hover:bg-accent disabled:opacity-40 transition-colors"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </button>
        <button
          onClick={handleOpen}
          title={t('project.openTitle')}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-xl bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Project Info */}
      {scenario && (
        <div className="flex items-center justify-between text-[10px]">
          <input
            value={scenario.meta.name}
            onChange={(e) => updateScenarioMeta({ name: e.target.value })}
            className="flex-1 px-2 py-1 font-medium rounded-lg bg-transparent border border-border hover:bg-secondary/50 focus:bg-secondary transition-colors"
            placeholder="Project name"
          />
          <button
            onClick={handleExport}
            className="ml-1 text-muted-foreground hover:text-foreground text-[9px] font-data"
            title="Export JSON"
          >
            ↗
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="panel-label mb-1.5 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Recent
          </p>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {history
              .sort((a, b) => b.savedAt - a.savedAt)
              .slice(0, 5)
              .map((entry) => {
                const ago = getTimeAgo(entry.savedAt);
                const isActive = scenario && (scenario.meta.id as string) === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-[10px] transition-colors ${
                      isActive ? 'bg-primary/10' : 'hover:bg-secondary/50'
                    }`}
                    onClick={() => handleLoadHistory(entry)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.name}</p>
                      <p className="text-[8px] text-muted-foreground font-data">{ago}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteHistory(entry.id); }}
                      className="p-0.5 rounded hover:bg-[var(--status-danger)]/20 shrink-0"
                    >
                      <Trash2 className="w-2.5 h-2.5 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
