import { useCallback, useState } from 'react';
import { Plus, Monitor, MousePointer2, Circle, GitBranch, Sparkles } from 'lucide-react';
import { useStore } from '@/stores';
import type { ZoneConfig, ZoneId, MediaId, FloorId, MediaPlacement, WaypointType } from '@/domain';
import { ZONE_COLORS, MEDIA_PRESETS, MEDIA_SCALE, INTERNATIONAL_DENSITY_STANDARD } from '@/domain';
import { useT } from '@/i18n';
import { AnalyzeFloorPlan } from './AnalyzeFloorPlan';

const ZONE_TYPES = [
  { type: 'lobby',      label: '로비',   color: '#14b8a6' },
  { type: 'exhibition', label: '전시실', color: '#3b82f6' },
  { type: 'corridor',   label: '복도',   color: '#6b7280' },
  { type: 'rest',       label: '휴게',   color: '#f59e0b' },
  { type: 'stage',      label: '스테이지', color: '#a855f7' },
] as const;

// 미디어 타입 → 한국어 라벨. domain/types/media.ts 의 주석을 명시적 라벨로 승격.
const MEDIA_LABEL_KO: Record<string, string> = {
  artifact:           '실물 전시',
  diorama:            '디오라마',
  documents:          '문서·도서',
  graphic_sign:       '그래픽 사인',
  media_wall:         '미디어 월',
  video_wall:         '비디오 월',
  projection_mapping: '프로젝션',
  single_display:     '단일 디스플레이',
  kiosk:              '키오스크',
  touch_table:        '터치 테이블',
  interaction_media:  '인터랙션 미디어',
  hands_on_model:     '핸즈온 모형',
  vr_ar_station:      'VR/AR 스테이션',
  immersive_room:     '몰입형 룸',
  simulator_4d:       '4D 시뮬레이터',
};

const MEDIA_QUICK_CATEGORIES = [
  { label: '아날로그', color: '#a78bfa', items: ['artifact', 'diorama', 'documents', 'graphic_sign'] },
  { label: '패시브',   color: '#3b82f6', items: ['media_wall', 'video_wall', 'projection_mapping', 'single_display'] },
  { label: '액티브',   color: '#f59e0b', items: ['kiosk', 'touch_table', 'interaction_media', 'hands_on_model'] },
  { label: '몰입형',   color: '#ec4899', items: ['vr_ar_station', 'immersive_room', 'simulator_4d'] },
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
  const t = useT();
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
      <h2 className="panel-section">도구</h2>

      <div className="space-y-1">
        <ModeBtn
          active={editorMode === 'select'}
          onClick={() => setEditorMode('select')}
          icon={MousePointer2}
          label="선택"
          fullWidth
        />
        {showZoneTool && showMediaTool && (
          <div className="grid grid-cols-2 gap-1">
            <ModeBtn
              active={editorMode === 'create-zone'}
              onClick={() => setEditorMode('create-zone')}
              icon={Plus}
              label="존"
              disabled={isSimRunning}
            />
            <ModeBtn
              active={editorMode === 'place-media'}
              onClick={() => setEditorMode('place-media')}
              icon={Monitor}
              label="미디어"
              disabled={isSimRunning}
            />
          </div>
        )}
        {showZoneTool && !showMediaTool && (
          <ModeBtn
            active={editorMode === 'create-zone'}
            onClick={() => setEditorMode('create-zone')}
            icon={Plus}
            label="존 추가"
            disabled={isSimRunning}
            fullWidth
          />
        )}
        {showMediaTool && !showZoneTool && (
          <ModeBtn
            active={editorMode === 'place-media'}
            onClick={() => setEditorMode('place-media')}
            icon={Monitor}
            label="미디어 배치"
            disabled={isSimRunning}
            fullWidth
          />
        )}
        {showGraphTool && (
          <div className="grid grid-cols-2 gap-1">
            <ModeBtn
              active={editorMode === 'place-waypoint'}
              onClick={() => setEditorMode('place-waypoint')}
              icon={Circle}
              label="노드"
              disabled={isSimRunning}
            />
            <ModeBtn
              active={editorMode === 'connect-waypoint'}
              onClick={() => setEditorMode('connect-waypoint')}
              icon={GitBranch}
              label="엣지"
              disabled={isSimRunning}
            />
          </div>
        )}
      </div>

      {/* Waypoint Node Placement */}
      {showGraphTool && editorMode === 'place-waypoint' && !isSimRunning && (
        <div>
          <p className="panel-label mb-1.5">노드 추가</p>
          <div className="grid grid-cols-2 gap-1">
            {([
              { type: 'entry' as WaypointType,     label: '입구',      color: '#22c55e', descKey: 'build.node.entry.desc' },
              { type: 'exit' as WaypointType,      label: '출구',      color: '#ef4444', descKey: 'build.node.exit.desc' },
              { type: 'zone' as WaypointType,      label: '존',        color: '#3b82f6', descKey: 'build.node.zone.desc' },
              { type: 'attractor' as WaypointType, label: '관심 포인트', color: '#f59e0b', descKey: 'build.node.attractor.desc' },
              { type: 'hub' as WaypointType,       label: '허브',      color: '#8b5cf6', descKey: 'build.node.hub.desc' },
              { type: 'rest' as WaypointType,      label: '휴게',      color: '#f59e0b', descKey: 'build.node.rest.desc' },
              { type: 'portal' as WaypointType,    label: '포털',      color: '#06b6d4', descKey: 'build.node.portal.desc' },
            ]).map(({ type, label, color, descKey }) => {
              const active = pendingWaypointType === type;
              return (
                <button
                  key={type}
                  onClick={() => useStore.getState().setPendingWaypointType(type)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg transition-colors border ${
                    active
                      ? 'bg-primary/15 border-primary/60 text-foreground'
                      : 'bg-secondary/60 border-transparent hover:bg-accent hover:border-border'
                  }`}
                  title={t(descKey)}
                  style={active ? undefined : {
                    backgroundImage: `linear-gradient(90deg, ${color}18 0%, transparent 60%)`,
                  }}
                >
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">{t('build.hint.placeNode')}</p>
        </div>
      )}

      {/* Edge Connection Guide */}
      {showGraphTool && editorMode === 'connect-waypoint' && !isSimRunning && (
        <div className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[10px]">
          <p className="font-medium text-indigo-400 mb-1">{t('build.hint.edgeMode.title')}</p>
          <p className="text-muted-foreground">{t('build.hint.edgeMode.body')}</p>
        </div>
      )}

      {/* Zone Creation — 미디어 배치 영역 */}
      {showZoneTool && editorMode === 'create-zone' && !isSimRunning && (
        <div>
          <p className="panel-label mb-1.5">존 추가</p>
          <div className="grid grid-cols-2 gap-1">
            {ZONE_TYPES.map(({ type, label, color }) => (
              <button
                key={type}
                onClick={() => handleCreateZone(type)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg transition-colors border border-transparent bg-secondary/60 hover:bg-accent hover:border-border"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${color}18 0%, transparent 60%)`,
                }}
              >
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                {label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">{t('build.hint.zoneArea')}</p>
        </div>
      )}

      {/* Media Placement — categorized */}
      {showMediaTool && editorMode === 'place-media' && selectedZoneId && !isSimRunning && (
        <div className="space-y-2.5">
          <p className="panel-label">선택한 존에 미디어 배치</p>
          {MEDIA_QUICK_CATEGORIES.map(({ label, color, items }) => (
            <div key={label}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="panel-label">{label}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {items.map((type) => (
                  <button
                    key={type}
                    onClick={() => handlePlaceMedia(type)}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg bg-secondary/60 hover:bg-accent transition-colors text-left border border-transparent hover:border-border"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${color}1a 0%, transparent 70%)`,
                    }}
                  >
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate">{MEDIA_LABEL_KO[type] ?? type.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showMediaTool && editorMode === 'place-media' && !selectedZoneId && (
        <p className="text-[10px] text-muted-foreground">
          먼저 존을 선택하세요.
        </p>
      )}

      {isSimRunning && editorMode !== 'select' && (
        <p className="text-[10px] text-[var(--status-warning)]">
          편집은 시뮬레이션 정지 후에 가능합니다.
        </p>
      )}

      {/* AI Auto-Setup — zones 단계에서만 표시 (도면 분석 = zone 자동 생성). */}
      {!isSimRunning && task === 'zones' && (
        <div>
          <p className="panel-label mb-1.5">AI 자동 설정</p>
          <button
            onClick={() => setShowAnalyzer(true)}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-xl bg-primary/15 hover:bg-primary/25 text-primary transition-colors ring-1 ring-primary/30"
          >
            <Sparkles className="w-3.5 h-3.5" />
            도면 분석 (AI)
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
