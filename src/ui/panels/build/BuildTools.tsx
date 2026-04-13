import { useCallback } from 'react';
import { Plus, Route, Monitor, MousePointer2 } from 'lucide-react';
import { useStore } from '@/stores';
import type { ZoneConfig, Gate, ZoneId, GateId, MediaId, FloorId, MediaPlacement } from '@/domain';
import { ZONE_COLORS, MEDIA_PRESETS } from '@/domain';
import { ZoneTemplates } from './ZoneTemplates';
import { BackgroundUpload } from './BackgroundUpload';

const ZONE_TYPES = [
  { type: 'entrance', label: 'Entrance', color: '#22c55e' },
  { type: 'exhibition', label: 'Exhibition', color: '#3b82f6' },
  { type: 'corridor', label: 'Corridor', color: '#64748b' },
  { type: 'rest', label: 'Rest', color: '#f59e0b' },
  { type: 'stage', label: 'Stage', color: '#a855f7' },
  { type: 'exit', label: 'Exit', color: '#ef4444' },
] as const;

const MEDIA_QUICK = [
  'led_wall', 'touchscreen_kiosk', 'vr_booth', 'ar_station',
  'interactive_table', 'product_display', 'info_panel', 'seating_area',
] as const;

let _zoneCounter = 100;
let _gateCounter = 100;
let _mediaCounter = 100;

export function BuildTools() {
  const editorMode = useStore((s) => s.editorMode);
  const setEditorMode = useStore((s) => s.setEditorMode);
  const addMedia = useStore((s) => s.addMedia);
  const zones = useStore((s) => s.zones);
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const phase = useStore((s) => s.phase);
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);

  const isSimRunning = phase === 'running'; // paused = editable
  const globalFlowMode = scenario?.globalFlowMode ?? 'free';
  const guidedUntilIndex = scenario?.guidedUntilIndex ?? 0;
  const nonUtilZones = zones.filter((z) => z.type !== 'entrance' && z.type !== 'exit');

  const handleCreateZone = useCallback((zoneType: string) => {
    // ── Entrance / Exit는 각 1개만 허용 ──
    if (zoneType === 'entrance' && zones.some((z) => z.type === 'entrance')) {
      alert('Entrance는 1개만 만들 수 있습니다.\n기존 Entrance를 삭제한 뒤 추가하세요.');
      return;
    }
    if (zoneType === 'exit' && zones.some((z) => z.type === 'exit')) {
      alert('Exit는 1개만 만들 수 있습니다.\n기존 Exit를 삭제한 뒤 추가하세요.');
      return;
    }

    const id = `z_user_${_zoneCounter++}` as ZoneId;
    const floorId = (activeFloorId ?? 'floor_1f') as FloorId;

    // Find non-overlapping position
    const zoneW = 150, zoneH = 120;
    let x = 100, y = 100;
    const isOverlapping = (tx: number, ty: number) =>
      zones.some((z) => {
        const b = z.bounds;
        return tx < b.x + b.w + 20 && tx + zoneW + 20 > b.x && ty < b.y + b.h + 20 && ty + zoneH + 20 > b.y;
      });
    outer: for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 8; col++) {
        const tx = 100 + col * (zoneW + 30);
        const ty = 100 + row * (zoneH + 30);
        if (!isOverlapping(tx, ty)) { x = tx; y = ty; break outer; }
      }
    }

    // ── Determine insertion position ──
    // Entrance → goes to position 0 (always first)
    // Exit → appends to end (always last)
    // All others → insert BEFORE the first exit zone (so Exit stays last)
    let insertIdx: number;
    if (zoneType === 'entrance') {
      insertIdx = 0;
    } else if (zoneType === 'exit') {
      insertIdx = zones.length;
    } else {
      const exitIdx = zones.findIndex((z) => z.type === 'exit');
      insertIdx = exitIdx >= 0 ? exitIdx : zones.length;
    }

    // Neighbours in final list: prevZone = zones[insertIdx-1], nextZone = zones[insertIdx]
    const prevZone = insertIdx > 0 ? zones[Math.min(insertIdx - 1, zones.length - 1)] : null;
    const nextZone = insertIdx < zones.length ? zones[insertIdx] : null;
    const prevExitGate = prevZone?.gates.find((g: any) => g.type === 'exit' || g.type === 'bidirectional');
    const nextEntrGate = nextZone?.gates.find((g: any) => g.type === 'entrance' || g.type === 'bidirectional');

    // ── Visual position swap ──
    // When inserting a new exhibition zone before Exit, swap their canvas positions
    // so the visual order on canvas always matches the list order (Exit visually last).
    const exitZoneToSwap = (nextZone && nextZone.type === 'exit' && zoneType !== 'entrance' && zoneType !== 'exit')
      ? nextZone : null;

    // The new zone takes Exit's current visual position; Exit moves to the grid-found slot
    const visualX = exitZoneToSwap ? exitZoneToSwap.bounds.x : x;
    const visualY = exitZoneToSwap ? exitZoneToSwap.bounds.y : y;
    const visualW = exitZoneToSwap ? exitZoneToSwap.bounds.w : zoneW;
    const visualH = exitZoneToSwap ? exitZoneToSwap.bounds.h : zoneH;

    const gateInId = `g_${_gateCounter++}` as GateId;
    const gateOutId = `g_${_gateCounter++}` as GateId;

    // All zones get entrance + exit gates (입구 왼쪽, 출구 오른쪽)
    const gateIn: Gate = {
      id: gateInId, zoneId: id, floorId,
      type: 'entrance',
      position: { x: visualX, y: visualY + visualH / 2 },
      width: 40,
      connectedGateId: prevExitGate ? (prevExitGate.id as GateId) : null,
      targetFloorId: null, targetGateId: null,
    };
    const gateOut: Gate = {
      id: gateOutId, zoneId: id, floorId,
      type: 'exit',
      position: { x: visualX + visualW, y: visualY + visualH / 2 },
      width: 40,
      connectedGateId: nextEntrGate ? (nextEntrGate.id as GateId) : null,
      targetFloorId: null, targetGateId: null,
    };

    const newZone: ZoneConfig = {
      id,
      name: `${zoneType.charAt(0).toUpperCase() + zoneType.slice(1)} ${_zoneCounter}`,
      type: zoneType as any,
      shape: 'rect',
      bounds: { x: visualX, y: visualY, w: visualW, h: visualH },
      polygon: null,
      area: 37.5,
      capacity: 30,
      flowType: 'free',
      gates: [gateIn, gateOut],
      mediaIds: [],
      color: ZONE_COLORS[zoneType] ?? '#3b82f6',
      attractiveness: 0.5,
      lRatioX: 0.5,
      lRatioY: 0.5,
      metadata: {},
    };

    // Build new zones array with zone inserted at correct position
    let newZones = [
      ...zones.slice(0, insertIdx),
      newZone,
      ...zones.slice(insertIdx),
    ];

    // If we swapped visual positions, relocate the Exit zone to the grid-found slot (x, y)
    if (exitZoneToSwap) {
      newZones = newZones.map((z) => {
        if ((z.id as string) !== (exitZoneToSwap.id as string)) return z;
        return {
          ...z,
          bounds: { x, y, w: zoneW, h: zoneH },
          gates: (z.gates as any[]).map((g: any) => {
            if (g.type === 'entrance' || g.type === 'bidirectional') {
              return { ...g, position: { x, y: y + zoneH / 2 } };
            }
            if (g.type === 'exit') {
              return { ...g, position: { x: x + zoneW, y: y + zoneH / 2 } };
            }
            return g;
          }),
        };
      });
    }

    // Re-chain gate connections: prevZone.exitGate → newZone, newZone → nextZone.entrGate
    if (prevZone && prevExitGate) {
      newZones = newZones.map((z) =>
        (z.id as string) === (prevZone.id as string)
          ? { ...z, gates: (z.gates as any[]).map((g: any) => (g.id as string) === (prevExitGate.id as string) ? { ...g, connectedGateId: gateInId } : g) }
          : z
      );
    }
    if (nextZone && nextEntrGate) {
      // For bidirectional zones, use gateInId (the only gate); for entrance/exit, use gateOutId
      const outId = gateOutId;
      newZones = newZones.map((z) =>
        (z.id as string) === (nextZone.id as string)
          ? { ...z, gates: (z.gates as any[]).map((g: any) => (g.id as string) === (nextEntrGate.id as string) ? { ...g, connectedGateId: outId } : g) }
          : z
      );
    }

    // Update floor zoneIds to reflect insertion order
    const store = useStore.getState();
    const newFloors = store.floors.map((f) => {
      if ((f.id as string) !== (floorId as string)) return f;
      const oldIds = f.zoneIds as string[];
      const exitZoneIdInFloor = oldIds.find((zid) => {
        const z = zones.find((nz) => (nz.id as string) === zid);
        return z?.type === 'exit';
      });
      if (exitZoneIdInFloor && zoneType !== 'exit') {
        const exitPosInFloor = oldIds.indexOf(exitZoneIdInFloor);
        const newIds = [...oldIds.slice(0, exitPosInFloor), id as string, ...oldIds.slice(exitPosInFloor)];
        return { ...f, zoneIds: newIds as any };
      }
      return { ...f, zoneIds: [...oldIds, id as string] as any };
    });

    const currentScenario = store.scenario;
    if (currentScenario) {
      store.setScenario({ ...currentScenario, zones: newZones as any, floors: newFloors, media: store.media });
    }
    store.selectZone(id as string);
  }, [zones, activeFloorId]);

  const handlePlaceMedia = useCallback((mediaType: string) => {
    if (!selectedZoneId) return;
    const zone = zones.find((z) => (z.id as string) === selectedZoneId);
    if (!zone) return;

    const preset = MEDIA_PRESETS[mediaType as keyof typeof MEDIA_PRESETS];
    if (!preset) return;

    const id = `m_user_${_mediaCounter++}` as MediaId;
    const media: MediaPlacement = {
      id,
      name: preset.type.replace(/_/g, ' '),
      type: mediaType as any,
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
      interactionType: preset.isInteractive ? 'active' : 'passive',
    };

    addMedia(media);
  }, [selectedZoneId, zones, addMedia]);

  return (
    <div className="space-y-3">
      {/* Editor Mode */}
      <div className="flex gap-1">
        <ModeBtn
          active={editorMode === 'select'}
          onClick={() => setEditorMode('select')}
          icon={MousePointer2}
          label="Select"
        />
        <ModeBtn
          active={editorMode === 'create-zone'}
          onClick={() => setEditorMode('create-zone')}
          icon={Plus}
          label="Zone"
          disabled={isSimRunning}
        />
        <ModeBtn
          active={editorMode === 'place-gate'}
          onClick={() => setEditorMode('place-gate')}
          icon={Route}
          label="Flow"
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

      {/* Zone Creation */}
      {editorMode === 'create-zone' && !isSimRunning && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Add Zone</p>
          <div className="grid grid-cols-2 gap-1">
            {ZONE_TYPES.map(({ type, label, color }) => {
              const alreadyExists =
                (type === 'entrance' && zones.some((z) => z.type === 'entrance')) ||
                (type === 'exit' && zones.some((z) => z.type === 'exit'));
              return (
                <button
                  key={type}
                  onClick={() => handleCreateZone(type)}
                  disabled={alreadyExists}
                  title={alreadyExists ? `${label}는 이미 존재합니다` : undefined}
                  className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg transition-colors ${
                    alreadyExists
                      ? 'bg-secondary/40 opacity-40 cursor-not-allowed'
                      : 'bg-secondary hover:bg-accent'
                  }`}
                >
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                  {label}
                  {alreadyExists && <span className="ml-auto text-[8px]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Media Placement */}
      {editorMode === 'place-media' && selectedZoneId && !isSimRunning && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">
            Add Media to Selected Zone
          </p>
          <div className="grid grid-cols-2 gap-1">
            {MEDIA_QUICK.map((type) => (
              <button
                key={type}
                onClick={() => handlePlaceMedia(type)}
                className="px-2 py-1.5 text-[10px] rounded-lg bg-secondary hover:bg-accent transition-colors text-left truncate"
              >
                {type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {editorMode === 'place-media' && !selectedZoneId && (
        <p className="text-[10px] text-muted-foreground">
          Select a zone first to place media
        </p>
      )}

      {/* Zone Templates */}
      {editorMode === 'create-zone' && !isSimRunning && (
        <ZoneTemplates />
      )}

      {/* Flow Settings */}
      {editorMode === 'place-gate' && !isSimRunning && (
        <div className="space-y-3">
          {/* Global Flow Mode */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Exhibition Flow</p>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1">
                {[
                  { value: 'free', label: 'Free', desc: 'Any order' },
                  { value: 'sequential', label: 'Sequential', desc: 'List order' },
                  { value: 'hybrid', label: 'Hybrid', desc: 'Guided→Free' },
                ].map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const s = useStore.getState().scenario;
                      if (s) setScenario({ ...s, zones: useStore.getState().zones, media: useStore.getState().media, globalFlowMode: opt.value as any });
                    }}
                    className={`px-2 py-1.5 rounded-lg text-center transition-all ${
                      globalFlowMode === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-accent'
                    }`}
                  >
                    <p className="text-[10px] font-medium">{opt.label}</p>
                    <p className="text-[7px] opacity-70">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* Hybrid: guided until slider */}
              {globalFlowMode === 'hybrid' && nonUtilZones.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[9px] mb-1">
                    <span className="text-muted-foreground">Guided until</span>
                    <span className="font-data font-medium">
                      {nonUtilZones[Math.min(guidedUntilIndex, nonUtilZones.length - 1)]?.name ?? '—'}
                    </span>
                  </div>
                  <input
                    type="range" min="0" max={nonUtilZones.length - 1}
                    value={Math.min(guidedUntilIndex, nonUtilZones.length - 1)}
                    onChange={(e) => {
                      const s2 = useStore.getState().scenario;
                      if (s2) setScenario({ ...s2, guidedUntilIndex: parseInt(e.target.value) });
                    }}
                    className="w-full h-1"
                  />
                  <div className="flex gap-0.5 mt-1">
                    {nonUtilZones.map((z, i) => (
                      <div key={z.id as string}
                        className={`flex-1 h-1 rounded-full ${i <= guidedUntilIndex ? 'bg-primary' : 'bg-secondary'}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sequential: order is determined by ZONES list (▲▼) below */}
              {globalFlowMode === 'sequential' && (
                <p className="text-[8px] text-muted-foreground">
                  아래 Zones 리스트의 ▲▼ 버튼으로 관람순서 변경
                </p>
              )}
            </div>
          </div>

          {zones.length === 0 && <p className="text-[9px] text-muted-foreground">Add zones first</p>}
        </div>
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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] rounded-xl transition-all ${
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
