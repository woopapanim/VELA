import { useState, useCallback } from 'react';
import { Plus, Save, FolderOpen, Trash2, Clock } from 'lucide-react';
import { useStore } from '@/stores';
import { useToast } from '@/ui/components/Toast';
import { DEFAULT_PHYSICS, DEFAULT_SKIP_THRESHOLD } from '@/domain';
import type { Scenario } from '@/domain';

const HISTORY_KEY = 'aion-project-history';

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

export function ProjectManager() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const resetSim = useStore((s) => s.resetSim);
  const clearHistory = useStore((s) => s.clearHistory);
  const clearReplay = useStore((s) => s.clearReplay);
  const phase = useStore((s) => s.phase);
  const { toast } = useToast();

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

  // Save = localStorage 저장 + JSON 파일 다운로드 (두 곳 모두 저장)
  const handleSave = useCallback(async () => {
    const store = useStore.getState();
    const s = store.scenario;
    if (!s) return;

    const updated: Scenario = {
      ...s,
      zones: store.zones,
      media: store.media,
      floors: store.floors,
      meta: { ...s.meta, updatedAt: Date.now(), version: s.meta.version + 1 },
    };
    setScenario(updated);

    // ── localStorage에 저장 (Recent 목록용) ──
    const entry: ProjectEntry = {
      id: updated.meta.id as string,
      name: updated.meta.name,
      scenario: updated,
      savedAt: Date.now(),
    };
    const existing = loadHistory();
    const idx = existing.findIndex((e) => e.id === entry.id);
    if (idx >= 0) existing[idx] = entry;
    else existing.push(entry);
    saveHistory(existing);
    setHistory(existing);

    const json = JSON.stringify(updated, null, 2);
    const fileName = `${updated.meta.name.replace(/\s+/g, '-')}.json`;

    // ── File System Access API: 저장 위치 직접 선택 (Chrome/Edge 지원) ──
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'AION Project', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        toast('success', `"${updated.meta.name}" v${updated.meta.version} 저장됨`);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // 취소
        // 실패 시 fallback
      }
    }

    // ── Fallback: 다운로드 (Safari 등) ──
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast('success', `"${updated.meta.name}" v${updated.meta.version} 저장됨`);
  }, [scenario, setScenario, toast]);

  // Open JSON file
  const handleOpen = useCallback(async () => {
    const loadFile = async (file: File) => {
      const text = await file.text();
      const data = JSON.parse(text) as Scenario;
      if (!data.meta || !data.zones || !data.simulationConfig) {
        toast('error', '유효하지 않은 프로젝트 파일');
        return;
      }
      resetSim(); clearHistory(); clearReplay();
      setScenario(data);
      toast('success', `"${data.meta.name}" 열림`);
    };

    // ── File System Access API (Chrome/Edge) ──
    if ('showOpenFilePicker' in window) {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'AION Project', accept: { 'application/json': ['.json'] } }],
          multiple: false,
        });
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
      try { await loadFile(file); } catch { toast('error', '파일 파싱 오류'); }
    };
    input.oncancel = () => { if (document.body.contains(input)) document.body.removeChild(input); };
    input.click();
  }, [setScenario, resetSim, clearHistory, clearReplay, toast]);

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
          title="JSON 파일 열기"
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
            onChange={(e) => {
              if (scenario) setScenario({ ...scenario, meta: { ...scenario.meta, name: e.target.value } });
            }}
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
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
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
