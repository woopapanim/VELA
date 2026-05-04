import { useCallback, useState } from 'react';
import { Circle, GitBranch, Sparkles } from 'lucide-react';
import { useStore } from '@/stores';
import type { ZoneConfig, ZoneId, MediaId, FloorId, MediaPlacement, WaypointType } from '@/domain';
import { ZONE_COLORS, MEDIA_PRESETS, MEDIA_SCALE, INTERNATIONAL_DENSITY_STANDARD } from '@/domain';
import { AnalyzeFloorPlan } from './AnalyzeFloorPlan';

const NODE_TYPES: ReadonlyArray<{
  type: WaypointType;
  label: string;
  color: string;
  desc: string;
}> = [
  { type: 'entry',     label: 'Entry',     color: '#22c55e', desc: 'Spawn point' },
  { type: 'exit',      label: 'Exit',      color: '#ef4444', desc: 'Exit point' },
  { type: 'zone',      label: 'Zone',      color: '#3b82f6', desc: 'Exhibition stop' },
  { type: 'attractor', label: 'Attractor', color: '#f59e0b', desc: 'High-attraction target' },
  { type: 'hub',       label: 'Hub',       color: '#8b5cf6', desc: 'Junction / branch' },
  { type: 'rest',      label: 'Rest',      color: '#f59e0b', desc: 'Rest / buffer' },
  { type: 'portal',    label: 'Portal',    color: '#06b6d4', desc: 'Cross-floor / building transit hub' },
];

const ZONE_TYPES = [
  { type: 'lobby',      label: 'Lobby',      color: '#14b8a6' },
  { type: 'exhibition', label: 'Exhibition', color: '#3b82f6' },
  { type: 'corridor',   label: 'Corridor',   color: '#6b7280' },
  { type: 'rest',       label: 'Rest',       color: '#f59e0b' },
  { type: 'stage',      label: 'Stage',      color: '#a855f7' },
] as const;

const MEDIA_LABELS: Record<string, string> = {
  artifact:           'Artifact',
  diorama:            'Diorama',
  documents:          'Documents',
  graphic_sign:       'Graphic Sign',
  media_wall:         'Media Wall',
  video_wall:         'Video Wall',
  projection_mapping: 'Projection',
  single_display:     'Display',
  kiosk:              'Kiosk',
  touch_table:        'Touch Table',
  interaction_media:  'Interactive',
  hands_on_model:     'Hands-on',
  vr_ar_station:      'VR/AR',
  immersive_room:     'Immersive Room',
  simulator_4d:       '4D Simulator',
};

const MEDIA_QUICK_CATEGORIES = [
  { label: 'Analog',    color: '#a78bfa', items: ['artifact', 'diorama', 'documents', 'graphic_sign'] },
  { label: 'Passive',   color: '#3b82f6', items: ['media_wall', 'video_wall', 'projection_mapping', 'single_display'] },
  { label: 'Active',    color: '#f59e0b', items: ['kiosk', 'touch_table', 'interaction_media', 'hands_on_model'] },
  { label: 'Immersive', color: '#ec4899', items: ['vr_ar_station', 'immersive_room', 'simulator_4d'] },
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

type BuildTask = 'zones' | 'exhibits' | 'flow';

interface BuildToolsProps {
  task?: BuildTask;
}

export function BuildTools({ task }: BuildToolsProps = {}) {
  const editorMode = useStore((s) => s.editorMode);
  const setEditorMode = useStore((s) => s.setEditorMode);
  const addMedia = useStore((s) => s.addMedia);
  const zones = useStore((s) => s.zones);
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const phase = useStore((s) => s.phase);
  const pendingWaypointType = useStore((s) => s.pendingWaypointType);
  const [showAnalyzer, setShowAnalyzer] = useState(false);

  const isSimRunning = phase === 'running'; // paused = editable

  const handleCreateZone = useCallback((zoneType: string) => {
    ensureCounters();
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
      floorId,
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
  }, [selectedZoneId, zones, addMedia]);

  // task 별 표시할 도구 분기. task 미지정 (legacy 호출) 시 기존 통합 모드.
  const showZoneTool  = task === undefined || task === 'zones';
  const showMediaTool = task === undefined || task === 'exhibits';
  const showGraphTool = task === undefined || task === 'flow';

  return (
    <div className="space-y-3">
      {/* Zones — chips always visible */}
      {showZoneTool && !isSimRunning && (
        <div>
          <p className="panel-label mb-1.5">Add Zone</p>
          <div className="grid grid-cols-2 gap-1">
            {ZONE_TYPES.map(({ type, label, color }) => (
              <Chip
                key={type}
                onClick={() => handleCreateZone(type)}
                color={color}
                label={label}
              />
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">
            Zone = media placement area. Use Node/Edge for flow.
          </p>
        </div>
      )}

      {/* Exhibits — chips always visible (require zone selection) */}
      {showMediaTool && !isSimRunning && (
        selectedZoneId ? (
          <div className="space-y-2.5">
            <p className="panel-label">Place exhibit in selected zone</p>
            {MEDIA_QUICK_CATEGORIES.map(({ label, color, items }) => (
              <div key={label}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="panel-label">{label}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {items.map((type) => (
                    <Chip
                      key={type}
                      onClick={() => handlePlaceMedia(type)}
                      color={color}
                      label={MEDIA_LABELS[type] ?? type.replace(/_/g, ' ')}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Select a zone first.
          </p>
        )
      )}

      {/* Flow — Node / Edge mode toggle (canvas behavior depends on mode) */}
      {showGraphTool && (
        <>
          <div>
            <p className="panel-label mb-1.5">Mode</p>
            <div className="grid grid-cols-2 gap-1">
              <Chip
                onClick={() => setEditorMode('place-waypoint')}
                color="#3b82f6"
                label="Node"
                icon={Circle}
                active={editorMode === 'place-waypoint'}
                disabled={isSimRunning}
              />
              <Chip
                onClick={() => setEditorMode('connect-waypoint')}
                color="#6366f1"
                label="Edge"
                icon={GitBranch}
                active={editorMode === 'connect-waypoint'}
                disabled={isSimRunning}
              />
            </div>
          </div>

          {editorMode === 'place-waypoint' && !isSimRunning && (
            <div>
              <p className="panel-label mb-1.5">Add Node</p>
              <div className="grid grid-cols-2 gap-1">
                {NODE_TYPES.map(({ type, label, color, desc }) => (
                  <Chip
                    key={type}
                    onClick={() => useStore.getState().setPendingWaypointType(type)}
                    color={color}
                    label={label}
                    title={desc}
                    active={pendingWaypointType === type}
                  />
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">Click canvas to place node</p>
            </div>
          )}

          {editorMode === 'connect-waypoint' && !isSimRunning && (
            <div className="px-2.5 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[10px]">
              <p className="font-medium text-indigo-400 mb-1">Edge connection mode</p>
              <p className="text-muted-foreground">Click first node → click second node to connect</p>
            </div>
          )}
        </>
      )}

      {isSimRunning && (
        <p className="text-[10px] text-[var(--status-warning)]">
          Editing is available when the simulation is stopped.
        </p>
      )}

      {!isSimRunning && task === 'zones' && (
        <div>
          <p className="panel-label mb-1.5">AI Auto-Setup</p>
          <button
            onClick={() => setShowAnalyzer(true)}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-xl bg-primary/15 hover:bg-primary/25 text-primary transition-colors ring-1 ring-primary/30"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analyze Floor Plan
          </button>
        </div>
      )}

      {showAnalyzer && (
        <AnalyzeFloorPlan
          onClose={() => setShowAnalyzer(false)}
          onLoaded={() => setShowAnalyzer(false)}
        />
      )}
    </div>
  );
}

function Chip({
  onClick,
  color,
  label,
  icon: Icon,
  active,
  disabled,
  title,
}: {
  onClick: () => void;
  color: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg transition-colors border ${
        active
          ? 'bg-primary/15 border-primary/60 text-foreground'
          : disabled
            ? 'bg-secondary/40 border-transparent text-muted-foreground opacity-50 cursor-not-allowed'
            : 'bg-secondary/60 border-transparent hover:bg-accent hover:border-border'
      }`}
      style={!active && !disabled ? { backgroundImage: `linear-gradient(90deg, ${color}18 0%, transparent 60%)` } : undefined}
    >
      {Icon ? (
        <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
      ) : (
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}
