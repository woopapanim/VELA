import { useCallback, useEffect } from 'react';
import { Plus, Monitor, MousePointer2, Circle, GitBranch } from 'lucide-react';
import { useStore } from '@/stores';
import type { ZoneConfig, ZoneId, MediaId, MediaPlacement, WaypointType } from '@/domain';
import { ZONE_COLORS, MEDIA_PRESETS, MEDIA_SCALE, INTERNATIONAL_DENSITY_STANDARD } from '@/domain';
import { useT } from '@/i18n';
import { useToast } from '@/ui/components/Toast';

const ZONE_TYPES = [
  { type: 'lobby', label: 'Lobby', color: '#14b8a6' },
  { type: 'exhibition', label: 'Exhibition', color: '#3b82f6' },
  { type: 'corridor', label: 'Corridor', color: '#6b7280' },
  { type: 'rest', label: 'Rest', color: '#f59e0b' },
  { type: 'stage', label: 'Stage', color: '#a855f7' },
] as const;

// Phase 0: 라벨은 i18n exhibit.kind.* 키로 매핑.
const EXHIBIT_QUICK_CATEGORIES = [
  { labelKey: 'exhibit.kind.artwork',    color: '#a78bfa', items: ['painting', 'artifact', 'sculpture', 'diorama', 'documents', 'graphic_sign'] },
  { labelKey: 'exhibit.kind.digital',    color: '#3b82f6', items: ['media_wall', 'video_wall', 'projection_mapping', 'single_display'] },
  { labelKey: 'exhibit.kind.interactive',color: '#f59e0b', items: ['kiosk', 'touch_table', 'interaction_media', 'hands_on_model'] },
  { labelKey: 'exhibit.kind.immersive',  color: '#ec4899', items: ['vr_ar_station', 'immersive_room', 'simulator_4d'] },
] as const;

let _zoneCounter = 100;
let _mediaCounter = 100;

function ensureCounters() {
  const state = useStore.getState();
  // Sync counters to be above any existing IDs
  let maxZ = _zoneCounter - 1;
  for (const z of state.zones) {
    const match = (z.id as string).match(/^z_user_(\d+)$/);
    if (match) maxZ = Math.max(maxZ, parseInt(match[1]));
  }
  _zoneCounter = maxZ + 1;

  let maxM = _mediaCounter - 1;
  for (const m of state.media) {
    const match = (m.id as string).match(/^m_user_(\d+)$/);
    if (match) maxM = Math.max(maxM, parseInt(match[1]));
  }
  _mediaCounter = maxM + 1;
}

type BuildToolsTask = 'zones' | 'exhibits' | 'flow';

export function BuildTools({ task }: { task?: BuildToolsTask } = {}) {
  const editorMode = useStore((s) => s.editorMode);
  const setEditorMode = useStore((s) => s.setEditorMode);
  const addMedia = useStore((s) => s.addMedia);
  const zones = useStore((s) => s.zones);
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const phase = useStore((s) => s.phase);
  const pendingWaypointType = useStore((s) => s.pendingWaypointType);
  const t = useT();
  const { toast } = useToast();

  const isSimRunning = phase === 'running'; // paused = editable

  const handleCreateZone = useCallback((zoneType: string) => {
    ensureCounters();
    const id = `z_user_${_zoneCounter++}` as ZoneId;
    // floorId 는 store 의 createZone 액션 내부에서 activeFloorId 로 자동 attach.
    // (구 코드에서는 AI auto-setup 분기 위해 변수로 보관, 현재 미사용.)

    // 뷰포트 중앙 world 좌표 — canvas에서 직접 계산
    const canvasEl = document.querySelector('canvas');
    const cw = canvasEl?.clientWidth ?? 800;
    const ch = canvasEl?.clientHeight ?? 600;
    const { camera } = useStore.getState();
    // screenToWorld(cw/2, ch/2) = camera.x + cw/2, camera.y + ch/2
    const center = {
      x: (0) / camera.zoom + camera.x + cw / 2,
      y: (0) / camera.zoom + camera.y + ch / 2,
    };

    const zoneW = 320, zoneH = 260;
    let x = Math.round(center.x - zoneW / 2);
    let y = Math.round(center.y - zoneH / 2);
    // 겹침 회피: 중앙에 놓을 수 없으면 주변 탐색
    const isOverlapping = (tx: number, ty: number) =>
      zones.some((z) => {
        const b = z.bounds;
        return tx < b.x + b.w + 20 && tx + zoneW + 20 > b.x && ty < b.y + b.h + 20 && ty + zoneH + 20 > b.y;
      });
    if (isOverlapping(x, y)) {
      outer: for (let ring = 1; ring <= 5; ring++) {
        for (let dy = -ring; dy <= ring; dy++) {
          for (let dx = -ring; dx <= ring; dx++) {
            if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
            const tx = Math.round(center.x - zoneW / 2) + dx * (zoneW + 20);
            const ty = Math.round(center.y - zoneH / 2) + dy * (zoneH + 20);
            if (!isOverlapping(tx, ty)) { x = tx; y = ty; break outer; }
          }
        }
      }
    }

    // Zone = 미디어 배치 영역. Gate 없음 (동선은 Node/Edge로).
    const newZone: ZoneConfig = {
      id,
      name: `${zoneType.charAt(0).toUpperCase() + zoneType.slice(1)} ${_zoneCounter}`,
      type: zoneType as any,
      shape: 'rect',
      bounds: { x, y, w: zoneW, h: zoneH },
      polygon: null,
      area: Math.round(zoneW / MEDIA_SCALE * zoneH / MEDIA_SCALE * 100) / 100,
      capacity: Math.floor((zoneW / MEDIA_SCALE * zoneH / MEDIA_SCALE) / INTERNATIONAL_DENSITY_STANDARD),
      flowType: 'free',
      gates: [],
      mediaIds: [],
      color: ZONE_COLORS[zoneType] ?? '#3b82f6',
      attractiveness: 0.5,
      lRatioX: 0.5,
      lRatioY: 0.5,
      metadata: {},
    };

    const store = useStore.getState();
    store.addZone(newZone);
    store.selectZone(id as string);
  }, [zones, activeFloorId]);

  const handlePlaceMedia = useCallback((mediaType: string) => {
    ensureCounters();
    if (!selectedZoneId) return;
    const zone = zones.find((z) => (z.id as string) === selectedZoneId);
    if (!zone) return;
    if (zone.type === 'corridor') return; // Corridors are transit-only, no media

    const preset = MEDIA_PRESETS[mediaType as keyof typeof MEDIA_PRESETS];
    if (!preset) return;

    // Block placement when the exhibit's footprint can't fit inside the zone (with margin).
    const pw = preset.defaultSize.width * 20;
    const ph = preset.defaultSize.height * 20;
    const margin = 10;
    if (zone.bounds.w < pw + margin * 2 || zone.bounds.h < ph + margin * 2) {
      toast('warning', t('build.exhibit.tooLarge'));
      return;
    }

    const id = `m_user_${_mediaCounter++}` as MediaId;
    // Determine interactionType from category
    const interactionType = preset.category === 'immersive' ? 'staged' as const
      : preset.category === 'analog' ? 'analog' as const
      : preset.isInteractive ? 'active' as const
      : 'passive' as const;

    const media: MediaPlacement = {
      id,
      name: preset.type.replace(/_/g, ' '),
      type: mediaType as any,
      category: preset.category,
      zoneId: zone.id,
      position: (() => {
        const pw = preset.defaultSize.width * 20; // MEDIA_SCALE
        const ph = preset.defaultSize.height * 20;
        const margin = 10;
        const minX = zone.bounds.x + pw / 2 + margin;
        const maxX = zone.bounds.x + zone.bounds.w - pw / 2 - margin;
        const minY = zone.bounds.y + ph / 2 + margin;
        const maxY = zone.bounds.y + zone.bounds.h - ph / 2 - margin;
        return {
          x: Math.max(minX, Math.min(maxX, zone.bounds.x + zone.bounds.w / 2 + (Math.random() - 0.5) * 40)),
          y: Math.max(minY, Math.min(maxY, zone.bounds.y + zone.bounds.h / 2 + (Math.random() - 0.5) * 30)),
        };
      })(),
      size: preset.defaultSize,
      orientation: 0,
      capacity: preset.defaultCapacity,
      avgEngagementTimeMs: preset.avgEngagementTimeMs,
      attractiveness: preset.category === 'analog' ? 0.3 : 0.7,
      attractionRadius: preset.attractionRadius,
      interactionType,
      omnidirectional: (preset as any).omnidirectional ?? false,
      queueBehavior: preset.queueBehavior,
      groupFriendly: preset.groupFriendly,
    };

    addMedia(media);
    useStore.getState().selectMedia(id as string);
  }, [selectedZoneId, zones, addMedia, toast, t]);

  // task 별 토글 행 — task prop 있으면 그 task 도구만, 없으면 전체 (legacy)
  const showZoneTools = !task || task === 'zones';
  const showExhibitTools = !task || task === 'exhibits';
  const showFlowTools = !task || task === 'flow';

  return (
    <div className="space-y-3">
      {!task && <h2 className="panel-section">Build</h2>}

      {/* Editor Mode — task 별 분기. task 컨텍스트에서는 Select + 주 도구를 2열 한 줄로
          묶어서 SimulationControls (Pause+Stop) 와 동일한 행 레이아웃 유지. */}
      <div className="space-y-1">
        {task === 'zones' && (
          <div className="grid grid-cols-2 gap-1">
            <ModeBtn
              active={editorMode === 'select'}
              onClick={() => setEditorMode('select')}
              icon={MousePointer2}
              label={t('build.mode.select')}
            />
            <ModeBtn
              active={editorMode === 'create-zone'}
              onClick={() => setEditorMode('create-zone')}
              icon={Plus}
              label={t('build.mode.zone')}
              disabled={isSimRunning}
            />
          </div>
        )}
        {task === 'exhibits' && (
          <div className="grid grid-cols-2 gap-1">
            <ModeBtn
              active={editorMode === 'select'}
              onClick={() => setEditorMode('select')}
              icon={MousePointer2}
              label={t('build.mode.select')}
            />
            <ModeBtn
              active={editorMode === 'place-media'}
              onClick={() => setEditorMode('place-media')}
              icon={Monitor}
              label={t('build.mode.exhibit')}
              disabled={isSimRunning}
            />
          </div>
        )}
        {task === 'flow' && (
          <>
            <ModeBtn
              active={editorMode === 'select'}
              onClick={() => setEditorMode('select')}
              icon={MousePointer2}
              label={t('build.mode.select')}
              fullWidth
            />
            <div className="grid grid-cols-2 gap-1">
              <ModeBtn
                active={editorMode === 'place-waypoint'}
                onClick={() => setEditorMode('place-waypoint')}
                icon={Circle}
                label={t('build.mode.node')}
                disabled={isSimRunning}
              />
              <ModeBtn
                active={editorMode === 'connect-waypoint'}
                onClick={() => setEditorMode('connect-waypoint')}
                icon={GitBranch}
                label={t('build.mode.edge')}
                disabled={isSimRunning}
              />
            </div>
          </>
        )}
        {/* Legacy (no task prop) — 전체 도구 한꺼번에 노출 */}
        {!task && (
          <>
            <ModeBtn
              active={editorMode === 'select'}
              onClick={() => setEditorMode('select')}
              icon={MousePointer2}
              label={t('build.mode.select')}
              fullWidth
            />
            <div className="grid grid-cols-2 gap-1">
              <ModeBtn
                active={editorMode === 'create-zone'}
                onClick={() => setEditorMode('create-zone')}
                icon={Plus}
                label={t('build.mode.zone')}
                disabled={isSimRunning}
              />
              <ModeBtn
                active={editorMode === 'place-media'}
                onClick={() => setEditorMode('place-media')}
                icon={Monitor}
                label={t('build.mode.exhibit')}
                disabled={isSimRunning}
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <ModeBtn
                active={editorMode === 'place-waypoint'}
                onClick={() => setEditorMode('place-waypoint')}
                icon={Circle}
                label={t('build.mode.node')}
                disabled={isSimRunning}
              />
              <ModeBtn
                active={editorMode === 'connect-waypoint'}
                onClick={() => setEditorMode('connect-waypoint')}
                icon={GitBranch}
                label={t('build.mode.edge')}
                disabled={isSimRunning}
              />
            </div>
          </>
        )}
      </div>

      {/* Waypoint Node Placement */}
      {showFlowTools && editorMode === 'place-waypoint' && !isSimRunning && (
        <div>
          <p className="panel-label mb-1.5">Add Node</p>
          <div className="grid grid-cols-2 gap-1">
            {([
              { type: 'entry' as WaypointType, label: 'Entry', color: '#22c55e', descKey: 'build.node.entry.desc' },
              { type: 'exit' as WaypointType, label: 'Exit', color: '#ef4444', descKey: 'build.node.exit.desc' },
              { type: 'zone' as WaypointType, label: 'Zone', color: '#3b82f6', descKey: 'build.node.zone.desc' },
              { type: 'attractor' as WaypointType, label: 'Attractor', color: '#f59e0b', descKey: 'build.node.attractor.desc' },
              { type: 'hub' as WaypointType, label: 'Hub', color: '#8b5cf6', descKey: 'build.node.hub.desc' },
              { type: 'rest' as WaypointType, label: 'Rest', color: '#f59e0b', descKey: 'build.node.rest.desc' },
              { type: 'portal' as WaypointType, label: 'Portal', color: '#06b6d4', descKey: 'build.node.portal.desc' },
            ]).map(({ type, label, color, descKey }) => (
              <button
                key={type}
                onClick={() => useStore.getState().setPendingWaypointType(type)}
                className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg transition-colors ${
                  pendingWaypointType === type ? 'bg-primary/20 ring-1 ring-primary' : 'bg-secondary hover:bg-accent'
                }`}
                title={t(descKey)}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">{t('build.hint.placeNode')}</p>
        </div>
      )}

      {/* Edge Connection Guide */}
      {showFlowTools && editorMode === 'connect-waypoint' && !isSimRunning && (
        <div className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[10px]">
          <p className="font-medium text-indigo-400 mb-1">{t('build.hint.edgeMode.title')}</p>
          <p className="text-muted-foreground">{t('build.hint.edgeMode.body')}</p>
        </div>
      )}

      {/* Zone Creation — 미디어 배치 영역 */}
      {showZoneTools && editorMode === 'create-zone' && !isSimRunning && (
        <div>
          <p className="panel-label mb-1.5">Add Zone</p>
          <div className="grid grid-cols-2 gap-1">
            {ZONE_TYPES.map(({ type, label, color }) => (
              <button
                key={type}
                onClick={() => handleCreateZone(type)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg transition-colors bg-secondary hover:bg-accent"
              >
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                {label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">{t('build.hint.zoneArea')}</p>
        </div>
      )}

      {/* Exhibit Placement — categorized (Phase 0 vocabulary) */}
      {showExhibitTools && editorMode === 'place-media' && selectedZoneId && !isSimRunning && (
        <div className="space-y-2">
          <p className="panel-label">
            {t('exhibit.add')}
          </p>
          {EXHIBIT_QUICK_CATEGORIES.map(({ labelKey, color, items }) => (
            <div key={labelKey}>
              <div className="flex items-center gap-1 mb-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                <span className="panel-label">{t(labelKey)}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {items.map((type) => (
                  <button
                    key={type}
                    onClick={() => handlePlaceMedia(type)}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg bg-secondary hover:bg-accent transition-colors"
                  >
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate">{type.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showExhibitTools && editorMode === 'place-media' && !selectedZoneId && (
        <p className="text-[10px] text-muted-foreground">
          Select a zone first to place exhibit
        </p>
      )}

      {isSimRunning && editorMode !== 'select' && (
        <p className="text-[10px] text-[var(--status-warning)]">
          Stop simulation to edit layout
        </p>
      )}

    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  label,
  disabled,
  fullWidth,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${fullWidth ? 'w-full' : 'flex-1'} flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all ${
        active
          ? 'bg-primary text-primary-foreground'
          : disabled
            ? 'bg-secondary/50 text-muted-foreground opacity-50 cursor-not-allowed'
            : 'bg-secondary text-secondary-foreground hover:bg-accent'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
