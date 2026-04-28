/**
 * BuildLayout — Build 단계 (공간 구성) 화면 (2026-04-28 IA 재구성, nav 통일 v2)
 *
 *   ┌────────────┬──────────────────┬─────────────┐
 *   │ 좌: Task   │                  │ 우: Task    │
 *   │ accordion  │      Canvas      │ context     │
 *   │ (4 cards)  │                  │ (목록 /     │
 *   │ + Project  │                  │  인스펙터)  │
 *   └────────────┴──────────────────┴─────────────┘
 *
 * 좌(260px): 도구만. 활성 task 의 도구만 expand.
 * 우(300px): task 컨텍스트. 객체 선택되면 인스펙터, 아니면 task 별 목록.
 * 하단 inspector 제거 — 폼이 잘리는 문제 해결 (2026-04-28).
 *
 * 단계 진행 = 헤더 stepper 가 단일 control. 화면 내부에 next 버튼 없음 (2026-04-28 nav 통일).
 *
 * 진입 문서: docs/plans/ux-ia-restructure.md §3 IA 원칙
 */

import { useState, useMemo } from 'react';
import { ChevronRight, LayoutGrid, Square, Sparkles, Spline } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { ProjectManager } from '../panels/build/ProjectManager';
import { RegionTask } from '../panels/build/tasks/RegionTask';
import { TaskContextPanel, type BuildTaskId } from '../panels/build/tasks/TaskContextPanel';
import { BuildTools } from '../panels/build/BuildTools';

export function BuildLayout() {
  const t = useT();
  const floors = useStore((s) => s.floors);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);

  // 리전이 부모, 도면은 옵션 — 도면 없이도 다음 task 진행 가능.
  // 리전 1개 이상이면 'region' task 는 충족된 것으로 간주.
  const hasRegions = floors.length > 0;
  const hasZones = zones.length > 0;
  const hasMedia = media.length > 0;

  // 첫 진입 시점의 작업 진행도로 초기 task 결정 — 이후엔 사용자 클릭만 따름.
  // (zone 1개 만들었다고 자동으로 exhibits 로 점프하지 않게)
  const [activeTask, setActiveTask] = useState<BuildTaskId>(() => {
    if (!hasRegions) return 'region';
    if (!hasZones) return 'zones';
    if (!hasMedia) return 'exhibits';
    return 'flow';
  });

  const tasks = useMemo<Array<{
    id: BuildTaskId;
    icon: typeof LayoutGrid;
    label: string;
    sub: string;
    done: boolean;
  }>>(() => [
    { id: 'region', icon: LayoutGrid, label: t('build.task.region.label'), sub: t('build.task.region.sub'), done: hasRegions },
    { id: 'zones', icon: Square, label: t('build.task.zones.label'), sub: t('build.task.zones.sub'), done: hasZones },
    { id: 'exhibits', icon: Sparkles, label: t('build.task.exhibits.label'), sub: t('build.task.exhibits.sub'), done: hasMedia },
    { id: 'flow', icon: Spline, label: t('build.task.flow.label'), sub: t('build.task.flow.sub'), done: false },
  ], [t, hasRegions, hasZones, hasMedia]);

  return (
    <div className="flex flex-1 overflow-hidden bg-background text-foreground">
      {/* ── 좌: Task accordion (288px = w-72, Simulate 와 통일) ─────── */}
      <aside className="w-72 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0">
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tasks.map((task) => {
            const isActive = task.id === activeTask;
            return (
              <TaskCard
                key={task.id}
                task={task}
                isActive={isActive}
                onActivate={() => setActiveTask(task.id)}
              >
                {task.id === 'region' && <RegionTask />}
                {task.id === 'zones' && (
                  <div className="space-y-3">
                    <BuildTools task="zones" />
                  </div>
                )}
                {task.id === 'exhibits' && (
                  <div className="space-y-3">
                    <BuildTools task="exhibits" />
                  </div>
                )}
                {task.id === 'flow' && (
                  <div className="space-y-3">
                    <BuildTools task="flow" />
                  </div>
                )}
              </TaskCard>
            );
          })}
        </div>

        <div className="border-t border-border p-3">
          <ProjectManager />
        </div>
      </aside>

      {/* ── 중앙: Canvas ────────────────────────── */}
      <main className="flex-1 bg-background overflow-hidden relative flex flex-col">
        <div className="flex-1 relative">
          <CanvasPanel activeBuildTask={activeTask} />
        </div>
      </main>

      {/* ── 우: Task context (320px = w-80, Simulate 와 통일) ──────── */}
      <aside className="w-80 border-l border-border bg-[var(--surface)] flex flex-col flex-shrink-0">
        <TaskContextPanel activeTask={activeTask} />
      </aside>
    </div>
  );
}

// ── Task accordion card ─────────────────────────────────────────────
function TaskCard({
  task,
  isActive,
  onActivate,
  children,
}: {
  task: { id: BuildTaskId; icon: typeof ImageIcon; label: string; sub: string; done: boolean };
  isActive: boolean;
  onActivate: () => void;
  children: React.ReactNode;
}) {
  const Icon = task.icon;
  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden
        ${isActive ? 'border-primary/40 bg-secondary/30' : 'border-border bg-secondary/10 hover:border-border/80'}`}
    >
      <button
        type="button"
        onClick={onActivate}
        aria-expanded={isActive}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
            ${isActive
              ? 'bg-primary text-primary-foreground'
              : task.done
                ? 'bg-primary/20 text-primary'
                : 'bg-muted/30 text-muted-foreground/70'
            }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium leading-tight ${isActive ? 'text-foreground' : task.done ? '' : 'text-muted-foreground'}`}>
            {task.label}
          </div>
          {!isActive && (
            <div className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
              {task.sub}
            </div>
          )}
        </div>
        <ChevronRight
          className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform flex-shrink-0
            ${isActive ? 'rotate-90' : ''}`}
        />
      </button>
      {isActive && (
        <div className="px-3 pb-3 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}
