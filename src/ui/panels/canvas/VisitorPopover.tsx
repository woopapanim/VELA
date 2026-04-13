import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/stores';
import type { Visitor } from '@/domain';

interface PopoverState {
  visitor: Visitor | null;
  screenX: number;
  screenY: number;
}

export function VisitorPopover({ canvasRef, managerRef }: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  managerRef: React.MutableRefObject<any>;
}) {
  const [popover, setPopover] = useState<PopoverState>({ visitor: null, screenX: 0, screenY: 0 });
  const zones = useStore((s) => s.zones);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handleMouseMove(e: MouseEvent) {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        const manager = managerRef.current;
        if (!manager) return;

        const rect = canvas!.getBoundingClientRect();
        const world = manager.camera.screenToWorld(
          e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height,
        );

        // Find closest visitor within 10px
        const store = useStore.getState();
        let closest: Visitor | null = null;
        let closestDist = 100; // 10px squared radius

        for (const v of store.visitors) {
          if (!v.isActive) continue;
          const dx = v.position.x - world.x;
          const dy = v.position.y - world.y;
          const dist = dx * dx + dy * dy;
          if (dist < closestDist) {
            closestDist = dist;
            closest = v;
          }
        }

        if (closest) {
          setPopover({ visitor: closest, screenX: e.clientX, screenY: e.clientY });
        } else {
          setPopover({ visitor: null, screenX: 0, screenY: 0 });
        }
      }, 150);
    }

    function handleMouseLeave() {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPopover({ visitor: null, screenX: 0, screenY: 0 });
    }

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [canvasRef, managerRef]);

  if (!popover.visitor) return null;

  const v = popover.visitor;
  const zone = zones.find((z) => z.id === v.currentZoneId);

  return (
    <div
      className="fixed z-50 pointer-events-none glass rounded-xl border border-border shadow-lg p-2 min-w-36"
      style={{ left: popover.screenX + 12, top: popover.screenY - 60 }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <span className="text-[9px] font-data font-medium">{v.id as string}</span>
        <span className={`text-[8px] px-1 rounded ${
          v.currentAction === 'WATCHING' ? 'bg-[var(--status-success)]/20 text-[var(--status-success)]' :
          v.currentAction === 'WAITING' ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]' :
          'bg-secondary text-muted-foreground'
        }`}>{v.currentAction}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8px]">
        <span className="text-muted-foreground">Profile</span>
        <span className="font-data">{v.profile.type}</span>
        <span className="text-muted-foreground">Engagement</span>
        <span className="font-data">{v.profile.engagementLevel}</span>
        <span className="text-muted-foreground">Fatigue</span>
        <span className={`font-data ${v.fatigue > 0.7 ? 'text-[var(--status-danger)]' : ''}`}>
          {Math.round(v.fatigue * 100)}%
        </span>
        <span className="text-muted-foreground">Zone</span>
        <span className="font-data">{zone?.name ?? '—'}</span>
        <span className="text-muted-foreground">Visited</span>
        <span className="font-data">{v.visitedZoneIds.length} zones</span>
        {v.groupId && (
          <>
            <span className="text-muted-foreground">Group</span>
            <span className="font-data">{v.isGroupLeader ? '★ Leader' : 'Member'}</span>
          </>
        )}
      </div>
    </div>
  );
}
