import { Grid3x3, Tag, Eye, EyeOff, Thermometer, Pin } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { useToast } from '@/ui/components/Toast';
import { pinCurrentMoment } from '@/analytics';
import { SIMULATION_PHASE } from '@/domain';

interface CanvasToolbarProps {
  /** Build 단계에서는 시뮬 컨텍스트 도구(Heatmap/Pin) 숨김. */
  isBuildScreen?: boolean;
}

export function CanvasToolbar({ isBuildScreen = false }: CanvasToolbarProps = {}) {
  const t = useT();
  const { toast } = useToast();
  const showGrid = useStore((s) => s.showGrid);
  const showLabels = useStore((s) => s.showLabels);
  const showBackground = useStore((s) => s.showBackground);
  const toggleGrid = useStore((s) => s.toggleGrid);
  const toggleLabels = useStore((s) => s.toggleLabels);
  const toggleBackground = useStore((s) => s.toggleBackground);
  const camera = useStore((s) => s.camera);
  const scenario = useStore((s) => s.scenario);
  const activeFloorId = useStore((s) => s.activeFloorId);
  const overlayMode = useStore((s) => s.overlayMode);
  const setOverlayMode = useStore((s) => s.setOverlayMode);
  const phase = useStore((s) => s.phase);
  const isReplaying = useStore((s) => s.isReplaying);
  const pinCount = useStore((s) => s.pins.length);
  const hasBackground = !!scenario?.floors.find(
    (f) => (f.id as string) === activeFloorId,
  )?.canvas.backgroundImage;

  const heatmapActive = overlayMode === 'heatmap';
  const pinDisabled = phase === SIMULATION_PHASE.IDLE;

  const toggleHeatmap = () => setOverlayMode(heatmapActive ? 'none' : 'heatmap');
  const handlePin = () => {
    const store = useStore.getState();
    const totalS = Math.max(0, Math.round(store.timeState.elapsed / 1000));
    const mm = Math.floor(totalS / 60);
    const ss = totalS % 60;
    const time = `${mm}:${String(ss).padStart(2, '0')}`;
    const pin = pinCurrentMoment(store, t('pinpoint.defaultLabel', { time }));
    if (!pin) {
      toast('warning', t('pinpoint.toast.noSnapshot'));
      return;
    }
    toast('success', t('pinpoint.toast.created', { time }));
  };

  return (
    <div className="absolute top-3 right-3 flex gap-1 z-10">
      <ToolbarBtn active={showGrid} onClick={toggleGrid} icon={Grid3x3} label="Grid" />
      <ToolbarBtn active={showLabels} onClick={toggleLabels} icon={Tag} label="Labels" />
      {hasBackground && (
        <ToolbarBtn active={showBackground} onClick={toggleBackground} icon={showBackground ? Eye : EyeOff} label="Background" />
      )}
      {!isBuildScreen && (
        <>
          {/* Sim 컨텍스트 도구는 시각적으로 분리 — 라벨 chip 형태로 prominent.
              "히트맵, 핀 안 띄임" 피드백 (2026-04-28) 으로 아이콘 only → 라벨 chip 으로 격상. */}
          <div className="w-px bg-border/50 mx-1 self-stretch" aria-hidden />
          <ToolbarBtn
            active={heatmapActive}
            onClick={isReplaying ? undefined : toggleHeatmap}
            icon={Thermometer}
            label={t('canvasToolbar.heatmap')}
            disabled={isReplaying}
            title={isReplaying ? t('canvasToolbar.heatmap.replayDisabled') : t('canvasToolbar.heatmap')}
            prominent
          />
          <ToolbarBtn
            onClick={pinDisabled ? undefined : handlePin}
            icon={Pin}
            label={t('canvasToolbar.pin')}
            disabled={pinDisabled}
            badge={pinCount > 0 ? pinCount : undefined}
            prominent
          />
        </>
      )}
      <div className="flex items-center px-2 text-[9px] font-data text-muted-foreground glass rounded-lg">
        {Math.round(camera.zoom * 100)}%
      </div>
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  icon: Icon,
  label,
  title,
  disabled,
  badge,
  prominent = false,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** 호버 tooltip — 미지정 시 label. disable 사유 등 다른 문구 노출에 사용. */
  title?: string;
  disabled?: boolean;
  badge?: number;
  /** prominent=true 면 라벨이 항상 보이는 chip 형태 (시뮬 컨텍스트 도구용). */
  prominent?: boolean;
}) {
  const hoverTitle = title ?? label;
  if (prominent) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={hoverTitle}
        className={`relative flex items-center gap-1.5 h-7 px-2.5 rounded-lg transition-all text-[11px] font-medium ${
          disabled
            ? 'glass text-muted-foreground opacity-40 cursor-not-allowed'
            : active
              ? 'bg-primary/15 text-primary border border-primary/40'
              : 'glass text-foreground/80 hover:text-foreground border border-transparent hover:border-border'
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
        {badge !== undefined && (
          <span className="ml-0.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[9px] font-data font-semibold rounded-full bg-primary text-primary-foreground">
            {badge}
          </span>
        )}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hoverTitle}
      className={`relative flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
        disabled
          ? 'glass text-muted-foreground opacity-30 cursor-not-allowed'
          : active
            ? 'glass text-primary'
            : 'glass text-muted-foreground opacity-50 hover:opacity-100'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 flex items-center justify-center text-[9px] font-data font-semibold rounded-full bg-primary text-primary-foreground border border-background">
          {badge}
        </span>
      )}
    </button>
  );
}
