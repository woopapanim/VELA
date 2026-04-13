import type { ZoneConfig, Rect } from '@/domain';

export interface SnapGuide {
  type: 'h' | 'v';
  position: number;
}

// Find alignment snap guides when dragging a zone
export function findSnapGuides(
  dragZoneId: string,
  dragBounds: Rect,
  allZones: readonly ZoneConfig[],
  threshold: number = 8,
): { guides: SnapGuide[]; snappedBounds: Rect } {
  const guides: SnapGuide[] = [];
  let { x, y, w, h } = dragBounds;

  const dragEdges = {
    left: x, right: x + w, centerX: x + w / 2,
    top: y, bottom: y + h, centerY: y + h / 2,
  };

  for (const zone of allZones) {
    if ((zone.id as string) === dragZoneId) continue;
    const b = zone.bounds;
    const edges = {
      left: b.x, right: b.x + b.w, centerX: b.x + b.w / 2,
      top: b.y, bottom: b.y + b.h, centerY: b.y + b.h / 2,
    };

    // Vertical snaps (x-axis alignment)
    for (const [dragEdge, dragVal] of [['left', dragEdges.left], ['right', dragEdges.right], ['centerX', dragEdges.centerX]] as const) {
      for (const [, refVal] of [['left', edges.left], ['right', edges.right], ['centerX', edges.centerX]] as const) {
        if (Math.abs(dragVal - refVal) < threshold) {
          guides.push({ type: 'v', position: refVal });
          if (dragEdge === 'left') x = refVal;
          else if (dragEdge === 'right') x = refVal - w;
          else x = refVal - w / 2;
        }
      }
    }

    // Horizontal snaps (y-axis alignment)
    for (const [dragEdge, dragVal] of [['top', dragEdges.top], ['bottom', dragEdges.bottom], ['centerY', dragEdges.centerY]] as const) {
      for (const [, refVal] of [['top', edges.top], ['bottom', edges.bottom], ['centerY', edges.centerY]] as const) {
        if (Math.abs(dragVal - refVal) < threshold) {
          guides.push({ type: 'h', position: refVal });
          if (dragEdge === 'top') y = refVal;
          else if (dragEdge === 'bottom') y = refVal - h;
          else y = refVal - h / 2;
        }
      }
    }
  }

  return { guides, snappedBounds: { x, y, w, h } };
}

export function renderSnapGuides(
  ctx: CanvasRenderingContext2D,
  guides: readonly SnapGuide[],
  canvasWidth: number,
  canvasHeight: number,
) {
  if (guides.length === 0) return;

  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([4, 4]);
  ctx.globalAlpha = 0.5;

  for (const guide of guides) {
    ctx.beginPath();
    if (guide.type === 'v') {
      ctx.moveTo(guide.position, 0);
      ctx.lineTo(guide.position, canvasHeight);
    } else {
      ctx.moveTo(0, guide.position);
      ctx.lineTo(canvasWidth, guide.position);
    }
    ctx.stroke();
  }

  ctx.restore();
}
