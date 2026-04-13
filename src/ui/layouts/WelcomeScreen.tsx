import { useState, useCallback, useRef } from 'react';
import { Plus, FolderOpen, Trash2, ArrowRight, Upload } from 'lucide-react';
import { useStore } from '@/stores';
import { DEFAULT_PHYSICS, DEFAULT_SKIP_THRESHOLD } from '@/domain';
import type { Scenario } from '@/domain';

const HISTORY_KEY = 'aion-project-history';

interface ProjectEntry {
  id: string;
  name: string;
  scenario: Scenario;
  savedAt: number;
  zoneCount: number;
}

function loadHistory(): ProjectEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function deleteFromHistory(id: string) {
  try {
    const entries = loadHistory().filter((e) => e.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {}
}

export function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  const setScenario = useStore((s) => s.setScenario);
  const [showNameInput, setShowNameInput] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [openError, setOpenError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [, forceUpdate] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── JSON 파싱 공통 ──
  const loadScenarioFromText = useCallback((text: string) => {
    const data = JSON.parse(text) as Scenario;
    if (!data.meta || !data.zones || !data.simulationConfig) {
      setOpenError('유효하지 않은 파일입니다 (meta / zones / simulationConfig 누락)');
      return;
    }
    setScenario(data);
    onEnter();
  }, [setScenario, onEnter]);

  // ── New blank project ──
  const handleNew = useCallback(() => {
    const name = projectName.trim() || 'Untitled Project';
    const scenario: Scenario = {
      meta: {
        id: `project_${Date.now()}` as any,
        name,
        description: '',
        version: 1,
        parentId: null,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      floors: [{
        id: 'floor_1f' as any, name: '1F', level: 0,
        canvas: { width: 1200, height: 800, gridSize: 40, backgroundImage: null, scale: 0.025 },
        zoneIds: [], metadata: {},
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
        fixedDeltaTime: 1000 / 60, duration: 3_600_000, timeScale: 3,
        maxVisitors: 500, seed: Math.floor(Math.random() * 99999),
        physics: DEFAULT_PHYSICS, skipThreshold: DEFAULT_SKIP_THRESHOLD,
        timeSlots: [{
          startTimeMs: 0, endTimeMs: 3_600_000, spawnRatePerSecond: 0.2,
          profileDistribution: { general: 60, vip: 15, child: 10, elderly: 10, disabled: 5 },
          engagementDistribution: { quick: 30, explorer: 40, immersive: 30 },
          groupRatio: 0.3,
        }],
      },
      globalFlowMode: 'free',
    };
    setScenario(scenario);
    onEnter();
  }, [projectName, setScenario, onEnter]);

  // ── Open File — showOpenFilePicker (모던 API) + fallback input ──
  const handleOpenFile = useCallback(async () => {
    setOpenError('');
    try {
      // 모던 File System Access API (Chrome 86+, Edge 86+)
      if ('showOpenFilePicker' in window) {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
          multiple: false,
        });
        const file = await handle.getFile();
        const text = await file.text();
        loadScenarioFromText(text);
      } else {
        // fallback: hidden input
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        // API 없거나 실패 시 fallback
        fileInputRef.current?.click();
      }
    }
  }, [loadScenarioFromText]);

  // ── fallback input onChange ──
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setOpenError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      loadScenarioFromText(text);
    } catch (err) {
      setOpenError(`파싱 오류: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [loadScenarioFromText]);

  // ── 드래그앤드롭 ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setOpenError('');
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setOpenError('.json 파일만 지원합니다');
      return;
    }
    try {
      const text = await file.text();
      loadScenarioFromText(text);
    } catch (err) {
      setOpenError(`파싱 오류: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [loadScenarioFromText]);

  // ── Load from history ──
  const handleLoad = useCallback((entry: ProjectEntry) => {
    setScenario(entry.scenario);
    onEnter();
  }, [setScenario, onEnter]);

  const handleDelete = useCallback((id: string) => {
    deleteFromHistory(id);
    forceUpdate((n) => n + 1);
  }, []);

  const history = loadHistory().sort((a, b) => b.savedAt - a.savedAt).slice(0, 8);

  return (
    <div
      className="fixed inset-0 bg-background flex items-center justify-center z-[300]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 드래그 오버레이 */}
      {isDragging && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-none pointer-events-none">
          <div className="text-center">
            <Upload className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="text-sm text-primary font-medium">JSON 파일을 여기에 놓으세요</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-md px-6">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            AION <span className="text-muted-foreground font-normal">mark01</span>
          </h1>
          <p className="text-xs text-muted-foreground font-data tracking-widest">ABOARD INTERACTIVE</p>
          <p className="text-xs text-muted-foreground mt-3">Exhibition Digital Twin &amp; Analytics Engine</p>
        </div>

        {/* New Project */}
        {!showNameInput ? (
          <button
            onClick={() => setShowNameInput(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-2xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity mb-3"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        ) : (
          <div className="mb-3">
            <div className="flex gap-2">
              <input
                autoFocus
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNew();
                  if (e.key === 'Escape') setShowNameInput(false);
                }}
                placeholder="Project name"
                className="flex-1 px-3 py-2.5 text-sm rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleNew}
                className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setShowNameInput(false)}
              className="text-xs text-muted-foreground mt-1.5 hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Open File — showOpenFilePicker + hidden input fallback + drag & drop */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          onClick={handleOpenFile}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-2xl bg-secondary text-secondary-foreground hover:bg-accent transition-colors mb-1 cursor-pointer"
        >
          <FolderOpen className="w-4 h-4" /> Open File...
        </button>
        <p className="text-[10px] text-muted-foreground text-center mb-3">
          또는 .json 파일을 화면에 드래그하여 열기
        </p>

        {openError && (
          <p className="text-[11px] text-red-400 text-center mb-3 px-2">{openError}</p>
        )}

        {/* Recent Projects */}
        {history.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Recent Projects</p>
            <div className="space-y-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => handleLoad(entry)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.name}</p>
                    <p className="text-[10px] text-muted-foreground font-data">
                      {entry.zoneCount ?? entry.scenario?.zones?.length ?? 0} zones · {getTimeAgo(entry.savedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[9px] text-muted-foreground mt-8">
          Built by ABOARD INTERACTIVE · 2026
        </p>
      </div>
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
  return `${Math.floor(hr / 24)}d ago`;
}
