/**
 * BuildLayout — Build 단계 (공간 구성) 화면 (2026-04-28 IA 재구성)
 *
 *   ┌────────────┬─────────────────────────────┐
 *   │ Task       │                             │
 *   │ accordion  │      Canvas                 │
 *   │ (4 cards)  │                             │
 *   │            │                             │
 *   ├────────────┴─────────────────────────────┤
 *   │  Bottom inspector (선택 객체 편집)         │
 *   └──────────────────────────────────────────┘
 *
 * 좌측 task accordion (도면 / 영역 / 전시물 / 동선) 은 현재 진행 상태에
 * 따라 자동으로 활성. 사용자가 클릭으로도 전환 가능. 활성 카드만 expand.
 *
 * 캔버스에서 객체를 선택하면 하단 inspector 가 해당 객체 편집 UI 노출
 * (zone / media / waypoint). 선택 없으면 통계만.
 *
 * 우측 패널은 의도적으로 없음 — Build 는 task 흐름 + 캔버스에 집중.
 *
 * 진입 문서: docs/plans/ux-ia-restructure.md §3 IA 원칙
 */

import { useState, useMemo } from 'react';
import { ChevronRight, ImageIcon, Square, Sparkles, Spline } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { ProjectManager } from '../panels/build/ProjectManager';
import { RegionsPanel } from '../panels/build/RegionsPanel';
import { BuildTools } from '../panels/build/BuildTools';
import { ZoneEditor } from '../panels/build/ZoneEditor';
import { MediaEditor } from '../panels/build/MediaEditor';
import { WaypointInspector } from '../panels/build/WaypointInspector';

type BuildTask = 'floor' | 'zones' | 'exhibits' | 'flow';

interface Props {
  onContinueToSimulate: () => void;
}

export function BuildLayout({ onContinueToSimulate }: Props) {
  const t = useT();
  const floors = useStore((s) => s.floors);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const selectedMediaId = useStore((s) => s.selectedMediaId);
  const selectedWaypointId = useStore((s) => s.selectedWaypointId);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);

  const hasFloorImage = floors.some((f) => !!f.canvas.backgroundImage);
  const hasZones = zones.length > 0;
  const hasMedia = media.length > 0;

  // 자동 추천 task — 사용자가 명시적으로 클릭하지 않은 동안만 적용
  const autoTask: BuildTask = !hasFloorImage
    ? 'floor'
    : !hasZones
      ? 'zones'
      : !hasMedia
        ? 'exhibits'
        : 'flow';

  const [overrideTask, setOverrideTask] = useState<BuildTask | null>(null);
  const activeTask = overrideTask ?? autoTask;

  const hasSelection = !!(selectedZoneId || selectedMediaId || selectedWaypointId || selectedEdgeId);
  const buildReady = hasZones && hasMedia;

  const tasks = useMemo<Array<{
    id: BuildTask;
    icon: typeof ImageIcon;
    label: string;
    sub: string;
    done: boolean;
  }>>(() => [
    { id: 'floor', icon: ImageIcon, label: t('build.task.floor.label'), sub: t('build.task.floor.sub'), done: hasFloorImage },
    { id: 'zones', icon: Square, label: t('build.task.zones.label'), sub: t('build.task.zones.sub'), done: hasZones },
    { id: 'exhibits', icon: Sparkles, label: t('build.task.exhibits.label'), sub: t('build.task.exhibits.sub'), done: hasMedia },
    { id: 'flow', icon: Spline, label: t('build.task.flow.label'), sub: t('build.task.flow.sub'), done: false },
  ], [t, hasFloorImage, hasZones, hasMedia]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* ── 좌: Task accordion ─────────────────── */}
        <aside className="w-72 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {tasks.map((task) => {
              const isActive = task.id === activeTask;
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  isActive={isActive}
                  onActivate={() => setOverrideTask(task.id)}
                >
                  {task.id === 'floor' && <RegionsPanel />}
                  {task.id === 'zones' && (
                    <div className="space-y-3">
                      <BuildTools />
                    </div>
                  )}
                  {task.id === 'exhibits' && (
                    <div className="space-y-3">
                      <BuildTools />
                    </div>
                  )}
                  {task.id === 'flow' && (
                    <div className="text-xs text-muted-foreground leading-relaxed px-1 py-2">
                      {t('build.task.flow.sub')}
                    </div>
                  )}
                </TaskCard>
              );
            })}
          </div>

          {/* 좌측 최하단: Project (저장/불러오기/Recent) */}
          <div className="border-t border-border p-3">
            <ProjectManager />
          </div>
        </aside>

        {/* ── 중앙: Canvas ─────────────────────── */}
        <main className="flex-1 bg-background overflow-hidden relative flex flex-col">
          <div className="flex-1 relative">
            <CanvasPanel />
          </div>
        </main>
      </div>

      {/* ── 하단: Inspector (선택 객체) / 통계 ─ */}
      <div className="h-36 border-t border-border bg-[var(--surface)] flex items-stretch">
        <div className="flex-1 overflow-y-auto p-3">
          {hasSelection ? (
            <div className="max-w-2xl">
              {selectedZoneId && <ZoneEditor />}
              {selectedMediaId && <MediaEditor />}
              {(selectedWaypointId || selectedEdgeId) && <WaypointInspector />}
            </div>
          ) : (
            <BuildStats
              floors={floors.length}
              zones={zones.length}
              media={media.length}
              t={t}
            />
          )}
        </div>

        {/* 진행 단계 표시 + Simulate 진입 버튼 */}
        <div className="border-l border-border flex flex-col items-stretch justify-center px-5 gap-2 min-w-[220px]">
          <button
            onClick={onContinueToSimulate}
            disabled={!buildReady}
            className={`text-sm font-medium px-4 py-2.5 rounded-xl transition-all
              ${buildReady
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-muted/30 text-muted-foreground/60 cursor-not-allowed'
              }`}
          >
            {t('build.next')}
          </button>
          {!buildReady && (
            <p className="text-[10px] text-muted-foreground/70 text-center leading-snug">
              {!hasZones ? t('build.task.zones.sub') : t('build.task.exhibits.sub')}
            </p>
          )}
        </div>
      </div>
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
  task: { id: BuildTask; icon: typeof ImageIcon; label: string; sub: string; done: boolean };
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

// ── Build 통계 (선택 객체 없을 때 하단에 표시) ──────────────────────
function BuildStats({
  floors,
  zones,
  media,
  t,
}: {
  floors: number;
  zones: number;
  media: number;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground/70 mb-2">
        {t('build.bottom.empty')}
      </p>
      <div className="flex items-center gap-4 text-xs font-data">
        <span className="text-muted-foreground">{t('build.bottom.statsFloors', { f: floors })}</span>
        <span className="text-muted-foreground/30">·</span>
        <span className="text-muted-foreground">{t('build.bottom.statsZones', { z: zones })}</span>
        <span className="text-muted-foreground/30">·</span>
        <span className="text-muted-foreground">{t('build.bottom.statsExhibits', { m: media })}</span>
      </div>
    </div>
  );
}
