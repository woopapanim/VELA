import { useState, useEffect, useCallback } from 'react';
import { Trash2, Eye, EyeOff, Square, Monitor, Circle, GitBranch, ChevronRight } from 'lucide-react';
import { useStore } from '@/stores';
import { ZONE_COLORS, MEDIA_PRESETS, MEDIA_SCALE, INTERNATIONAL_DENSITY_STANDARD } from '@/domain';
import type { ZoneId, MediaId } from '@/domain';

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  zoneId: string | null;
}

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, worldX: 0, worldY: 0, zoneId: null });

  const show = useCallback((x: number, y: number, worldX: number, worldY: number, zoneId: string | null) => {
    setMenu({ visible: true, x, y, worldX, worldY, zoneId });
  }, []);

  const hide = useCallback(() => {
    setMenu((m) => ({ ...m, visible: false }));
  }, []);

  useEffect(() => {
    if (menu.visible) {
      const handler = () => hide();
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [menu.visible, hide]);

  return { menu, show, hide };
}

const ZONE_TYPES = [
  { type: 'lobby', label: 'Lobby', color: '#14b8a6' },
  { type: 'exhibition', label: 'Exhibition', color: '#3b82f6' },
  { type: 'corridor', label: 'Corridor', color: '#6b7280' },
  { type: 'rest', label: 'Rest', color: '#f59e0b' },
  { type: 'stage', label: 'Stage', color: '#a855f7' },
];

const MEDIA_CATEGORIES = [
  { label: 'Analog', color: '#a78bfa', items: [
    { type: 'artifact', label: 'Artifact' },
    { type: 'diorama', label: 'Diorama' },
    { type: 'documents', label: 'Documents' },
    { type: 'graphic_sign', label: 'Graphic Sign' },
  ]},
  { label: 'Passive', color: '#3b82f6', items: [
    { type: 'media_wall', label: 'Media Wall' },
    { type: 'video_wall', label: 'Video Wall' },
    { type: 'projection_mapping', label: 'Projection' },
    { type: 'single_display', label: 'Single Display' },
  ]},
  { label: 'Active', color: '#f59e0b', items: [
    { type: 'kiosk', label: 'Kiosk' },
    { type: 'touch_table', label: 'Touch Table' },
    { type: 'interaction_media', label: 'Interaction' },
    { type: 'hands_on_model', label: 'Hands-on Model' },
  ]},
  { label: 'Immersive', color: '#ec4899', items: [
    { type: 'vr_ar_station', label: 'VR/AR Station' },
    { type: 'immersive_room', label: 'Immersive Room' },
    { type: 'simulator_4d', label: '4D Simulator' },
  ]},
];

const NODE_TYPES = [
  { type: 'entry', label: 'Entry', color: '#22c55e' },
  { type: 'exit', label: 'Exit', color: '#ef4444' },
  { type: 'zone', label: 'Zone', color: '#3b82f6' },
  { type: 'attractor', label: 'Attractor', color: '#f59e0b' },
  { type: 'hub', label: 'Hub', color: '#8b5cf6' },
  { type: 'rest', label: 'Rest', color: '#9ca3af' },
];

let _ctxZoneCounter = 200;
let _ctxMediaCounter = 200;

function createZoneAtPosition(zoneType: string, worldX: number, worldY: number) {
  const store = useStore.getState();
  // Sync counter
  for (const z of store.zones) {
    const m = (z.id as string).match(/^z_user_(\d+)$/);
    if (m) _ctxZoneCounter = Math.max(_ctxZoneCounter, parseInt(m[1]) + 1);
  }
  const id = `z_user_${_ctxZoneCounter++}` as ZoneId;
  const zoneW = 150, zoneH = 120;
  let x = Math.round(worldX - zoneW / 2);
  let y = Math.round(worldY - zoneH / 2);

  // Overlap avoidance
  const isOverlapping = (tx: number, ty: number) =>
    store.zones.some((z) => {
      const b = z.bounds;
      return tx < b.x + b.w + 20 && tx + zoneW + 20 > b.x && ty < b.y + b.h + 20 && ty + zoneH + 20 > b.y;
    });
  if (isOverlapping(x, y)) {
    outer: for (let ring = 1; ring <= 5; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const tx = x + dx * (zoneW + 20);
          const ty = y + dy * (zoneH + 20);
          if (!isOverlapping(tx, ty)) { x = tx; y = ty; break outer; }
        }
      }
    }
  }

  store.addZone({
    id,
    name: `${zoneType.charAt(0).toUpperCase() + zoneType.slice(1)} ${_ctxZoneCounter}`,
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
  } as any);
  store.selectZone(id as string);
}

function createMediaAtPosition(mediaType: string, worldX: number, worldY: number) {
  const store = useStore.getState();
  const preset = MEDIA_PRESETS[mediaType as keyof typeof MEDIA_PRESETS];
  if (!preset) return;

  // Find the zone that contains this position
  const zone = store.zones.find((z) => {
    const b = z.bounds;
    return worldX >= b.x && worldX <= b.x + b.w && worldY >= b.y && worldY <= b.y + b.h;
  });
  if (!zone) return; // Media must be inside a zone

  // Sync counter
  for (const m of store.media) {
    const match = (m.id as string).match(/^m_user_(\d+)$/);
    if (match) _ctxMediaCounter = Math.max(_ctxMediaCounter, parseInt(match[1]) + 1);
  }
  const id = `m_user_${_ctxMediaCounter++}` as MediaId;

  const interactionType = preset.category === 'immersive' ? 'staged' as const
    : preset.category === 'analog' ? 'analog' as const
    : preset.isInteractive ? 'active' as const
    : 'passive' as const;

  // Clamp position inside zone
  const pw = preset.defaultSize.width * MEDIA_SCALE;
  const ph = preset.defaultSize.height * MEDIA_SCALE;
  const margin = 10;
  const cx = Math.max(zone.bounds.x + pw / 2 + margin, Math.min(zone.bounds.x + zone.bounds.w - pw / 2 - margin, worldX));
  const cy = Math.max(zone.bounds.y + ph / 2 + margin, Math.min(zone.bounds.y + zone.bounds.h - ph / 2 - margin, worldY));

  store.addMedia({
    id,
    name: preset.type.replace(/_/g, ' '),
    type: mediaType as any,
    category: preset.category,
    zoneId: zone.id,
    position: { x: cx, y: cy },
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
  } as any);
  store.selectMedia(id as string);
}

export function CanvasContextMenu({ menu, onClose }: {
  menu: MenuState;
  onClose: () => void;
}) {
  const removeZone = useStore((s) => s.removeZone);
  const selectZone = useStore((s) => s.selectZone);
  const setEditorMode = useStore((s) => s.setEditorMode);
  const phase = useStore((s) => s.phase);
  const zones = useStore((s) => s.zones);
  const overlayMode = useStore((s) => s.overlayMode);
  const setOverlayMode = useStore((s) => s.setOverlayMode);
  const [openSub, setOpenSub] = useState<string | null>(null);

  if (!menu.visible) return null;

  const isIdle = phase === 'idle';
  const zone = menu.zoneId ? zones.find((z) => (z.id as string) === menu.zoneId) : null;
  const flipX = menu.x > window.innerWidth - 320;
  // Estimated main menu height: ~30px per item × ~10 items + padding
  const estMainH = 320;
  const flipY = menu.y > window.innerHeight - estMainH - 16;
  // Estimated submenu height (largest: Media with 4 categories + headers ≈ 380px)
  const estSubH = 380;
  const flipSubY = menu.y > window.innerHeight - estSubH - 16;

  // Check if right-click position is inside any zone (for media placement)
  const insideZone = zones.find((z) => {
    const b = z.bounds;
    return menu.worldX >= b.x && menu.worldX <= b.x + b.w && menu.worldY >= b.y && menu.worldY <= b.y + b.h;
  });

  return (
    <div
      className="fixed z-50 min-w-44 py-1 glass rounded-xl border border-border shadow-lg"
      style={{
        left: menu.x,
        ...(flipY
          ? { bottom: window.innerHeight - menu.y }
          : { top: menu.y }),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {zone && (
        <>
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground font-data border-b border-border">
            {zone.name}
          </div>
          <MenuItem
            label="Select Zone"
            onClick={() => { selectZone(zone.id as string); onClose(); }}
          />
          {isIdle && (
            <MenuItem
              label="Delete Zone"
              icon={Trash2}
              danger
              onClick={() => { removeZone(zone.id as string); selectZone(null); onClose(); }}
            />
          )}
          <div className="border-t border-border my-0.5" />
        </>
      )}
      {!zone && isIdle && (
        <>
          <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground/60">Add</div>

          {/* Zone — submenu: creates zone at click position */}
          <SubMenuItem
            label="Zone"
            icon={Square}
            shortcut="2"
            isOpen={openSub === 'zone'}
            onHover={() => setOpenSub('zone')}
            flipX={flipX}
            flipY={flipSubY}
            menuTop={menu.y}
          >
            {ZONE_TYPES.map(({ type, label, color }) => (
              <SubItem key={type} label={label} color={color} onClick={() => {
                createZoneAtPosition(type, menu.worldX, menu.worldY);
                onClose();
              }} />
            ))}
          </SubMenuItem>

          {/* Media — submenu: creates media at click position (only if inside a zone) */}
          <SubMenuItem
            label="Media"
            icon={Monitor}
            shortcut="3"
            isOpen={openSub === 'media'}
            onHover={() => setOpenSub('media')}
            flipX={flipX}
            flipY={flipSubY}
            menuTop={menu.y}
            disabled={!insideZone}
          >
            {!insideZone ? (
              <div className="px-3 py-2 text-[9px] text-muted-foreground">
                Right-click inside a zone to place media
              </div>
            ) : (
              MEDIA_CATEGORIES.map(({ label, color, items }) => (
                <div key={label}>
                  <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground/60 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </div>
                  {items.map(({ type, label: itemLabel }) => (
                    <SubItem key={type} label={itemLabel} color={color} onClick={() => {
                      createMediaAtPosition(type, menu.worldX, menu.worldY);
                      onClose();
                    }} />
                  ))}
                </div>
              ))
            )}
          </SubMenuItem>

          {/* Node — submenu: sets pending type for canvas click */}
          <SubMenuItem
            label="Node"
            icon={Circle}
            shortcut="4"
            isOpen={openSub === 'node'}
            onHover={() => setOpenSub('node')}
            flipX={flipX}
            flipY={flipSubY}
            menuTop={menu.y}
          >
            {NODE_TYPES.map(({ type, label, color }) => (
              <SubItem key={type} label={label} color={color} onClick={() => {
                setEditorMode('place-waypoint');
                useStore.getState().setPendingWaypointType(type as any);
                onClose();
              }} />
            ))}
          </SubMenuItem>

          <MenuItem
            label="Edge"
            icon={GitBranch}
            shortcut="5"
            onClick={() => { setEditorMode('connect-waypoint'); onClose(); }}
            onMouseEnter={() => setOpenSub(null)}
          />
          <div className="border-t border-border my-0.5" />
        </>
      )}
      <div onMouseEnter={() => setOpenSub(null)}>
        <MenuItem
          label={overlayMode === 'heatmap' ? 'Hide Heatmap' : 'Show Heatmap'}
          icon={overlayMode === 'heatmap' ? EyeOff : Eye}
          shortcut="H"
          onClick={() => { setOverlayMode(overlayMode === 'heatmap' ? 'none' : 'heatmap'); onClose(); }}
        />
        <MenuItem
          label={overlayMode === 'flow' ? 'Hide Flow' : 'Show Flow'}
          icon={overlayMode === 'flow' ? EyeOff : Eye}
          shortcut="F"
          onClick={() => { setOverlayMode(overlayMode === 'flow' ? 'none' : 'flow'); onClose(); }}
        />
      </div>
    </div>
  );
}

function MenuItem({ label, icon: Icon, shortcut, danger, onClick, onMouseEnter }: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-left hover:bg-secondary/50 transition-colors ${
        danger ? 'text-[var(--status-danger)]' : ''
      }`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[8px] text-muted-foreground font-data">{shortcut}</span>}
    </button>
  );
}

function SubMenuItem({ label, icon: Icon, shortcut, isOpen, onHover, flipX, flipY, menuTop, disabled, children }: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  isOpen: boolean;
  onHover: () => void;
  flipX: boolean;
  flipY: boolean;
  menuTop: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" onMouseEnter={onHover}>
      <button
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-left transition-colors ${
          disabled ? 'opacity-40' : ''
        } ${isOpen ? 'bg-secondary/50' : 'hover:bg-secondary/50'}`}
      >
        <Icon className="w-3 h-3" />
        <span className="flex-1">{label}</span>
        {shortcut && <span className="text-[8px] text-muted-foreground font-data mr-1">{shortcut}</span>}
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
      </button>
      {isOpen && (
        <div
          className="absolute z-50 min-w-36 py-1 glass rounded-xl border border-border shadow-lg"
          style={{
            ...(flipY ? { bottom: 0 } : { top: 0 }),
            ...(flipX ? { right: '100%', marginRight: 4 } : { left: '100%', marginLeft: 4 }),
            maxHeight: flipY
              ? `calc(${menuTop}px - 16px)`
              : `calc(100vh - ${menuTop}px - 16px)`,
            overflowY: 'auto',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function SubItem({ label, color, onClick }: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-left hover:bg-secondary/50 transition-colors"
    >
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </button>
  );
}
