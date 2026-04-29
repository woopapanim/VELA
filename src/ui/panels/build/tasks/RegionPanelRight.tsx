/**
 * RegionPanelRight — Build > 공간 task 의 우측(300px) 패널.
 *
 * 좌·우 대칭 IA (2026-04-28 v3):
 *   좌(좁음): 안내 + "+ 공간 추가" 만 — 다른 task 의 BuildTools 자리
 *   우(넓음): 리전 리스트 + 활성 리전 인스펙터 + 도면 에디터 — 다른 task 의 List/Editor 자리
 *
 * v2 에서 좌측에 4단 중첩(task → row → 인라인 도면 에디터 → 캘리브레이션 모드)을
 * 욱여넣은 게 비대칭 + 폭 부족으로 답답했음. 이 컴포넌트가 그 무게를 우측으로 이동.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Pencil, Check, Eye, EyeOff, ChevronUp, ChevronDown,
  Image as ImageIcon, Upload, Ruler, Lock, Unlock,
} from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';

export function RegionPanelRight() {
  const t = useT();
  const floors = useStore((s) => s.floors);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const setActiveFloor = useStore((s) => s.setActiveFloor);
  const renameFloor = useStore((s) => s.renameFloor);
  const setFloorHidden = useStore((s) => s.setFloorHidden);
  const moveFloorLevel = useStore((s) => s.moveFloorLevel);
  const removeFloor = useStore((s) => s.removeFloor);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  // 활성 리전 변경 → 이전 리전 도면 자동 잠금 (Done 버튼 대체)
  const prevActiveIdRef = useRef<string | null>(activeFloorId);
  useEffect(() => {
    const prev = prevActiveIdRef.current;
    if (prev && prev !== activeFloorId) {
      const s = useStore.getState();
      const prevFloor = s.floors.find((f) => (f.id as string) === prev);
      if (prevFloor && prevFloor.canvas.backgroundImage && !prevFloor.canvas.bgLocked) {
        s.updateFloorCanvas(prev, { bgLocked: true });
      }
    }
    prevActiveIdRef.current = activeFloorId;
  }, [activeFloorId]);

  const ordered = [...floors].sort((a, b) => b.level - a.level);
  const multiFloor = floors.length > 1;
  const activeFloor =
    floors.find((f) => (f.id as string) === activeFloorId) ?? null;

  if (floors.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground/70 leading-relaxed px-1 py-2">
        {t('build.region.rightEmpty')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── 리스트 ───────────────────────────────────── */}
      <section>
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-1 mb-1.5">
          {t('build.region.listTitle', { n: floors.length })}
        </h3>
        <ul className="space-y-0.5">
          {ordered.map((floor, listIdx) => {
            const id = floor.id as string;
            const isActive = id === activeFloorId;
            const isEditingName = id === editingId;
            const isHidden = floor.hidden === true;
            const zoneCount = floor.zoneIds.length;
            const isTop = listIdx === 0;
            const isBottom = listIdx === ordered.length - 1;
            const hasOverlay = !!floor.canvas.backgroundImage;
            const isBgHidden = floor.canvas.bgHidden === true;
            const overlayDot = hasOverlay
              ? (isBgHidden ? 'bg-primary/40' : 'bg-primary')
              : 'bg-muted-foreground/30';

            return (
              <li key={id}>
                <div
                  onClick={() => setActiveFloor(isActive ? null : id)}
                  className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                    isActive ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-secondary/50'
                  } ${isHidden ? 'opacity-50' : ''}`}
                >
                  <span className="font-data text-[9px] text-muted-foreground w-6 text-center shrink-0">
                    {floor.level >= 0 ? `L${floor.level + 1}` : `B${-floor.level}`}
                  </span>

                  {isEditingName ? (
                    <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (draftName.trim()) renameFloor(id, draftName.trim());
                            setEditingId(null);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        className="flex-1 text-[11px] bg-background border border-border rounded px-1 py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (draftName.trim()) renameFloor(id, draftName.trim());
                          setEditingId(null);
                        }}
                        className="text-[var(--status-success)] hover:opacity-80"
                        title="Save"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className={`flex-1 truncate ${isActive ? 'font-medium' : ''}`}>
                        {floor.name}
                      </span>
                      <span className="text-muted-foreground font-data text-[9px] w-12 text-right shrink-0 tabular-nums">
                        {zoneCount} {zoneCount === 1 ? t('build.region.zone') : t('build.region.zones')}
                      </span>

                      {/* 도면 상태 dot — 인스펙터 전환 안 하고 정보만 */}
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${overlayDot}`}
                        title={hasOverlay ? (isBgHidden ? t('build.region.overlayHidden') : t('build.region.overlayOn')) : t('build.region.overlayOff')}
                      />

                      {/* 인라인 hover 액션 — 빠른 토글 */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFloorHidden(id, !isHidden); }}
                        className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity text-muted-foreground"
                        title={isHidden ? t('build.region.show') : t('build.region.hide')}
                      >
                        {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (!isTop) moveFloorLevel(id, 'up'); }}
                        disabled={isTop}
                        className={`${isTop ? 'invisible pointer-events-none' : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'} transition-opacity text-muted-foreground`}
                        title={t('build.region.moveUp')}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (!isBottom) moveFloorLevel(id, 'down'); }}
                        disabled={isBottom}
                        className={`${isBottom ? 'invisible pointer-events-none' : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'} transition-opacity text-muted-foreground`}
                        title={t('build.region.moveDown')}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── 활성 리전 인스펙터 ────────────────────────── */}
      {activeFloor && (
        <RegionInspector
          floor={activeFloor}
          multiFloor={multiFloor}
          onRename={() => {
            setDraftName(activeFloor.name);
            setEditingId(activeFloor.id as string);
          }}
          onDelete={() => {
            if (confirm(t('build.region.confirmDelete', { name: activeFloor.name }))) {
              removeFloor(activeFloor.id as string);
            }
          }}
        />
      )}
    </div>
  );
}

// ── 활성 리전 인스펙터 (이름 / 레벨 / 가시성 / 삭제 / 도면 에디터) ──────────
function RegionInspector({
  floor,
  multiFloor,
  onRename,
  onDelete,
}: {
  floor: import('@/domain').FloorConfig;
  multiFloor: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const id = floor.id as string;
  const setFloorHidden = useStore((s) => s.setFloorHidden);
  const moveFloorLevel = useStore((s) => s.moveFloorLevel);
  const updateFloorCanvas = useStore((s) => s.updateFloorCanvas);

  const isHidden = floor.hidden === true;
  const hasOverlay = !!floor.canvas.backgroundImage;
  const isLocked = floor.canvas.bgLocked === true;

  return (
    <section className="bento-box p-3 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-data text-[10px] text-muted-foreground shrink-0">
            {floor.level >= 0 ? `L${floor.level + 1}` : `B${-floor.level}`}
          </span>
          <h3 className="text-sm font-semibold truncate">{floor.name}</h3>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onRename}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={t('build.region.rename')}
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setFloorHidden(id, !isHidden)}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={isHidden ? t('build.region.show') : t('build.region.hide')}
          >
            {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          {hasOverlay && (
            <button
              type="button"
              onClick={() => updateFloorCanvas(id, { bgLocked: !isLocked })}
              className={`p-1 rounded-md hover:bg-accent transition-colors ${
                isLocked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={isLocked ? t('build.floor.edit') : t('build.floor.done')}
            >
              {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
          )}
          {multiFloor && (
            <>
              <button
                type="button"
                onClick={() => moveFloorLevel(id, 'up')}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title={t('build.region.moveUp')}
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => moveFloorLevel(id, 'down')}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title={t('build.region.moveDown')}
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                title={t('build.region.delete')}
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 도면 에디터 */}
      <FloorPlanEditor floorId={id} floor={floor} />
    </section>
  );
}

// ── 도면 에디터 (없음 / 편집 / 캘리브레이션 / 잠금 4 mode) ─────────────────
function FloorPlanEditor({
  floorId,
  floor,
}: {
  floorId: string;
  floor: import('@/domain').FloorConfig;
}) {
  const t = useT();
  const updateFloorCanvas = useStore((s) => s.updateFloorCanvas);
  const setActiveFloor = useStore((s) => s.setActiveFloor);
  const bgCalRuler = useStore((s) => s.bgCalRuler);
  const setBgCalRuler = useStore((s) => s.setBgCalRuler);
  const pushUndo = useStore((s) => s.pushUndo);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const waypointGraph = useStore((s) => s.waypointGraph);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasOverlay = !!floor.canvas.backgroundImage;
  const isLocked = floor.canvas.bgLocked ?? false;
  const isBgHidden = floor.canvas.bgHidden === true;
  const isCalibrating = bgCalRuler != null;

  // 도면이 잠기거나 사라지면 캘리브레이션 자동 종료
  useEffect(() => {
    if (isCalibrating && (!hasOverlay || isLocked)) setBgCalRuler(null);
  }, [isCalibrating, hasOverlay, isLocked, setBgCalRuler]);

  const onPickFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const fl = useStore.getState().floors.find((f) => (f.id as string) === floorId);
        const bx = fl?.bounds?.x ?? 0;
        const by = fl?.bounds?.y ?? 0;
        const bw = fl?.bounds?.w ?? fl?.canvas.width ?? 1200;
        const bh = fl?.bounds?.h ?? fl?.canvas.height ?? 800;
        const fitScale = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
        updateFloorCanvas(floorId, {
          backgroundImage: dataUrl,
          bgOffsetX: bx, bgOffsetY: by, bgScale: fitScale,
          bgLocked: false, bgHidden: false,
        });
        if (useStore.getState().activeFloorId !== floorId) setActiveFloor(floorId);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [floorId, updateFloorCanvas, setActiveFloor]);

  const handleRemove = useCallback(() => {
    setBgCalRuler(null);
    updateFloorCanvas(floorId, {
      backgroundImage: null, bgOffsetX: 0, bgOffsetY: 0,
      bgScale: 1, bgRotation: 0, bgLocked: false, bgHidden: false,
    });
  }, [floorId, updateFloorCanvas, setBgCalRuler]);

  const startCalibration = useCallback(() => {
    const c = floor.canvas;
    const mpu = (c as { scale?: number }).scale && (c as { scale?: number }).scale! > 0
      ? (c as { scale?: number }).scale!
      : 0.025;
    const grid = 5 / mpu; // 5m grid in world units
    const cx = c.bgOffsetX + (c.width ?? 0) / 2;
    const cy = c.bgOffsetY + (c.height ?? 0) / 2;
    // 그리드 5m 라인에 정확히 일치 — 한 칸 폭(5m), 격자선 위에 a/b
    const ax = Math.round((cx - grid / 2) / grid) * grid;
    const ay = Math.round(cy / grid) * grid;
    setBgCalRuler({
      a: { x: ax, y: ay },
      b: { x: ax + grid, y: ay },
    });
  }, [floor, setBgCalRuler]);

  const cancelCalibration = useCallback(() => setBgCalRuler(null), [setBgCalRuler]);

  const applyCalibration = useCallback(() => {
    if (!bgCalRuler) return;
    const c = floor.canvas;
    const dx = bgCalRuler.b.x - bgCalRuler.a.x;
    const dy = bgCalRuler.b.y - bgCalRuler.a.y;
    const rulerWorldLen = Math.sqrt(dx * dx + dy * dy);
    if (rulerWorldLen < 1) return;
    const mpu = (c as { scale?: number }).scale && (c as { scale?: number }).scale! > 0
      ? (c as { scale?: number }).scale!
      : 0.025;
    const targetWorldLen = 5 / mpu;
    const factor = targetWorldLen / rulerWorldLen;
    const sOld = c.bgScale;
    const sNew = Math.max(0.05, sOld * factor);
    const pAx = (bgCalRuler.a.x - c.bgOffsetX) / sOld;
    const pAy = (bgCalRuler.a.y - c.bgOffsetY) / sOld;
    const newOffX = bgCalRuler.a.x - pAx * sNew;
    const newOffY = bgCalRuler.a.y - pAy * sNew;
    pushUndo(zones, media, waypointGraph);
    updateFloorCanvas(floorId, { bgScale: sNew, bgOffsetX: newOffX, bgOffsetY: newOffY });
    setBgCalRuler(null);
  }, [bgCalRuler, floor, floorId, updateFloorCanvas, setBgCalRuler, pushUndo, zones, media, waypointGraph]);

  const sectionLabel = (
    <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
      {t('build.region.overlayLabel')}
    </h4>
  );

  return (
    <div className="space-y-2">
      {sectionLabel}

      {!hasOverlay ? (
        // (1) 도면 없음 → 큰 드롭존
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Upload className="w-5 h-5" />
          <span className="text-[11px] leading-snug text-center px-3">
            {t('build.floor.dropHint')}
          </span>
        </button>
      ) : (
        <>
          {/* 썸네일 */}
          <div className={`relative rounded-xl overflow-hidden border bg-secondary/30 aspect-video
            ${!isLocked ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'}`}
          >
            <img
              src={floor.canvas.backgroundImage as string}
              alt=""
              style={{ transform: `rotate(${floor.canvas.bgRotation ?? 0}deg)` }}
              className={`w-full h-full object-contain transition-opacity ${isBgHidden ? 'opacity-30' : 'opacity-100'}`}
            />
          </div>

          {isLocked ? (
            <ActionRow
              onReplace={() => fileInputRef.current?.click()}
              onToggleHidden={() => updateFloorCanvas(floorId, { bgHidden: !isBgHidden })}
              onRemove={handleRemove}
              isBgHidden={isBgHidden}
            />
          ) : isCalibrating ? (
            <div className="space-y-2">
              <div className="rounded-xl bg-primary/8 border border-primary/30 p-2.5 text-[11px] leading-snug">
                <div className="flex items-center gap-1.5 font-medium text-primary mb-1">
                  <Ruler className="w-3.5 h-3.5" />
                  {t('build.floor.cal.title')}
                </div>
                <p className="text-muted-foreground">{t('build.floor.cal.hint')}</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={cancelCalibration}
                  className="px-3 py-2 text-xs rounded-xl bg-secondary hover:bg-accent transition-colors"
                >
                  {t('build.floor.cal.cancel')}
                </button>
                <button
                  type="button"
                  onClick={applyCalibration}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {t('build.floor.cal.apply')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2 text-[10px] text-muted-foreground leading-snug">
                {t('build.floor.editHint')}
              </div>
              <button
                type="button"
                onClick={startCalibration}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-xl bg-secondary hover:bg-accent transition-colors"
              >
                <Ruler className="w-3.5 h-3.5" />
                {t('build.floor.cal.start')}
              </button>
              <ActionRow
                onReplace={() => fileInputRef.current?.click()}
                onToggleHidden={() => updateFloorCanvas(floorId, { bgHidden: !isBgHidden })}
                onRemove={handleRemove}
                isBgHidden={isBgHidden}
              />
            </>
          )}
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onPickFile}
        className="hidden"
      />
    </div>
  );
}

function ActionRow({
  onReplace, onToggleHidden, onRemove, isBgHidden,
}: { onReplace: () => void; onToggleHidden: () => void; onRemove: () => void; isBgHidden: boolean }) {
  const t = useT();
  return (
    <div className="grid grid-cols-3 gap-1">
      <Mini icon={<ImageIcon className="w-3.5 h-3.5" />} label={t('build.floor.replace')} onClick={onReplace} />
      <Mini
        icon={isBgHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        label={isBgHidden ? t('build.floor.show') : t('build.floor.hide')}
        onClick={onToggleHidden}
      />
      <Mini icon={<X className="w-3.5 h-3.5" />} label={t('build.floor.removeAria')} onClick={onRemove} danger />
    </div>
  );
}

function Mini({
  icon, label, onClick, danger,
}: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-lg bg-secondary text-muted-foreground transition-colors
        ${danger ? 'hover:bg-destructive/15 hover:text-destructive' : 'hover:bg-accent hover:text-foreground'}`}
    >
      {icon}
      <span className="text-[9px] leading-none">{label}</span>
    </button>
  );
}
