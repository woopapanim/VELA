import { useCallback } from 'react';
import { Plus, Monitor, MousePointer2, Circle, GitBranch } from 'lucide-react';
import { useStore } from '@/stores';
import type { ZoneConfig, ZoneId, MediaId, FloorId, MediaPlacement, WaypointType } from '@/domain';
import { ZONE_COLORS, MEDIA_PRESETS, MEDIA_SCALE, INTERNATIONAL_DENSITY_STANDARD } from '@/domain';
import { BackgroundUpload } from './BackgroundUpload';

const ZONE_TYPES = [
  { type: 'lobby', label: 'Lobby', color: '#14b8a6' },
  { type: 'exhibition', label: 'Exhibition', color: '#3b82f6' },
  { type: 'corridor', label: 'Corridor', color: '#6b7280' },
  { type: 'rest', label: 'Rest', color: '#f59e0b' },
  { type: 'stage', label: 'Stage', color: '#a855f7' },
] as const;

const MEDIA_QUICK_CATEGORIES = [
  { label: 'Analog', color: '#a78bfa', items: ['artifact', 'diorama', 'documents', 'graphic_sign'] },
  { label: 'Passive', color: '#3b82f6', items: ['media_wall', 'video_wall', 'projection_mapping', 'single_display'] },
  { label: 'Active', color: '#f59e0b', items: ['kiosk', 'touch_table', 'interaction_media', 'hands_on_model'] },
  { label: 'Immersive', color: '#ec4899', items: ['vr_ar_station', 'immersive_room', 'simulator_4d'] },
] as const;

let _zoneCounter = 100;
let _mediaCounter = 100;

export function BuildTools() {
  const editorMode = useStore((s) => s.editorMode);
  const setEditorMode = useStore((s) => s.setEditorMode);
  const addMedia = useStore((s) => s.addMedia);
  const zones = useStore((s) => s.zones);
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const phase = useStore((s) => s.phase);
  const pendingWaypointType = useStore((s) => s.pendingWaypointType);

  const isSimRunning = phase === 'running'; // paused = editable

  const handleCreateZone = useCallback((zoneType: string) => {
    const id = `z_user_${_zoneCounter++}` as ZoneId;
    const floorId = (activeFloorId ?? 'floor_1f') as FloorId;

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

    const zoneW = 150, zoneH = 120;
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
    if (!selectedZoneId) return;
    const zone = zones.find((z) => (z.id as string) === selectedZoneId);
    if (!zone) return;
    if (zone.type === 'corridor') return; // Corridors are transit-only, no media

    const preset = MEDIA_PRESETS[mediaType as keyof typeof MEDIA_PRESETS];
    if (!preset) return;

    const id = `m_user_${_mediaCounter++}` as MediaId;
    // Determine interactionType from category
    const interactionType = preset.category === 'immersive' ? 'staged' as const
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
      attractiveness: 0.7,
      attractionRadius: preset.attractionRadius,
      interactionType,
      queueBehavior: preset.queueBehavior,
      groupFriendly: preset.groupFriendly,
    };

    addMedia(media);
  }, [selectedZoneId, zones, addMedia]);

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Build</h2>

      {/* Editor Mode — hierarchical layout */}
      <div className="space-y-1">
        {/* Row 1: Select (full width) */}
        <ModeBtn
          active={editorMode === 'select'}
          onClick={() => setEditorMode('select')}
          icon={MousePointer2}
          label="Select"
          fullWidth
        />
        {/* Row 2: Spatial layers */}
        <div className="grid grid-cols-2 gap-1">
          <ModeBtn
            active={editorMode === 'create-zone'}
            onClick={() => setEditorMode('create-zone')}
            icon={Plus}
            label="Zone"
            disabled={isSimRunning}
          />
          <ModeBtn
            active={editorMode === 'place-media'}
            onClick={() => setEditorMode('place-media')}
            icon={Monitor}
            label="Media"
            disabled={isSimRunning}
          />
        </div>
        {/* Row 3: Graph layers */}
        <div className="grid grid-cols-2 gap-1">
          <ModeBtn
            active={editorMode === 'place-waypoint'}
            onClick={() => setEditorMode('place-waypoint')}
            icon={Circle}
            label="Node"
            disabled={isSimRunning}
          />
          <ModeBtn
            active={editorMode === 'connect-waypoint'}
            onClick={() => setEditorMode('connect-waypoint')}
            icon={GitBranch}
            label="Edge"
            disabled={isSimRunning}
          />
        </div>
      </div>

      {/* Waypoint Node Placement */}
      {editorMode === 'place-waypoint' && !isSimRunning && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Add Node</p>
          <div className="grid grid-cols-2 gap-1">
            {([
              { type: 'entry' as WaypointType, label: 'Entry', color: '#22c55e', desc: '스폰 지점' },
              { type: 'exit' as WaypointType, label: 'Exit', color: '#ef4444', desc: '퇴장 지점' },
              { type: 'zone' as WaypointType, label: 'Zone', color: '#3b82f6', desc: '전시 거점' },
              { type: 'attractor' as WaypointType, label: 'Attractor', color: '#f59e0b', desc: '고인력 타겟' },
              { type: 'hub' as WaypointType, label: 'Hub', color: '#8b5cf6', desc: '교차로/분기점' },
              { type: 'rest' as WaypointType, label: 'Rest', color: '#9ca3af', desc: '휴게/버퍼' },
            ]).map(({ type, label, color, desc }) => (
              <button
                key={type}
                onClick={() => useStore.getState().setPendingWaypointType(type)}
                className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg transition-colors ${
                  pendingWaypointType === type ? 'bg-primary/20 ring-1 ring-primary' : 'bg-secondary hover:bg-accent'
                }`}
                title={desc}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">캔버스 클릭하여 노드 배치</p>
        </div>
      )}

      {/* Edge Connection Guide */}
      {editorMode === 'connect-waypoint' && !isSimRunning && (
        <div className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[10px]">
          <p className="font-medium text-indigo-400 mb-1">Edge 연결 모드</p>
          <p className="text-muted-foreground">첫 노드 클릭 → 두 번째 노드 클릭으로 연결</p>
        </div>
      )}

      {/* Zone Creation — 미디어 배치 영역 */}
      {editorMode === 'create-zone' && !isSimRunning && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Add Zone</p>
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
          <p className="text-[9px] text-muted-foreground mt-1">Zone = 미디어 배치 영역. 동선은 Node/Edge로.</p>
        </div>
      )}

      {/* Media Placement — categorized */}
      {editorMode === 'place-media' && selectedZoneId && !isSimRunning && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Add Media to Selected Zone
          </p>
          {MEDIA_QUICK_CATEGORIES.map(({ label, color, items }) => (
            <div key={label}>
              <div className="flex items-center gap-1 mb-1">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {items.map((type) => (
                  <button
                    key={type}
                    onClick={() => handlePlaceMedia(type)}
                    className="px-2 py-1.5 text-[10px] rounded-lg bg-secondary hover:bg-accent transition-colors text-left truncate"
                    style={{ borderLeft: `2px solid ${color}` }}
                  >
                    {type.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editorMode === 'place-media' && !selectedZoneId && (
        <p className="text-[10px] text-muted-foreground">
          Select a zone first to place media
        </p>
      )}

      {isSimRunning && editorMode !== 'select' && (
        <p className="text-[10px] text-[var(--status-warning)]">
          Stop simulation to edit layout
        </p>
      )}

      {/* Background Upload */}
      {!isSimRunning && <BackgroundUpload />}
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
      className={`${fullWidth ? 'w-full' : 'flex-1'} flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] rounded-xl transition-all ${
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
