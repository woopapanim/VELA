import type { Visitor, VisitorGroup } from '@/domain';
import { VISITOR_ACTION } from '@/domain';

let _visitorAnimFrame = 0;

// Category-based colors
const CATEGORY_COLORS: Record<string, string> = {
  solo: '#60a5fa',         // blue
  small_group: '#34d399',  // emerald
  guided_tour: '#f472b6',  // pink
  vip_expert: '#fbbf24',   // gold
};

// Fallback to profile colors for legacy visitors without category
const PROFILE_COLORS: Record<string, string> = {
  general: '#60a5fa',
  vip: '#fbbf24',
  child: '#4ade80',
  elderly: '#f97316',
  disabled: '#a78bfa',
};

const ACTION_COLORS: Record<string, string> = {
  WATCHING: '#22c55e',
  WAITING: '#f59e0b',
  RESTING: '#06b6d4',
  EXITING: '#ef4444',
};

export function renderVisitors(
  ctx: CanvasRenderingContext2D,
  visitors: readonly Visitor[],
  groups: readonly VisitorGroup[],
  isDark: boolean,
  showCohesionLines: boolean = true,
  followAgentId: string | null = null,
) {
  // Draw tour group boundary circles first (behind everything)
  renderTourBoundaries(ctx, visitors, groups, isDark);

  // Draw cohesion lines (behind agents)
  if (showCohesionLines) {
    renderCohesionLines(ctx, visitors, groups, isDark);
  }

  _visitorAnimFrame++;

  // Draw agents
  for (const visitor of visitors) {
    if (!visitor.isActive) continue;

    const { position, profile, currentAction, isGroupLeader, category } = visitor;
    const fatigue = visitor.fatigue;

    // Base color from category (fallback to profile)
    let baseColor = CATEGORY_COLORS[category] ?? PROFILE_COLORS[profile.type] ?? '#60a5fa';
    if (fatigue > 0.5) {
      const t = Math.min(1, (fatigue - 0.5) * 2);
      baseColor = lerpColor(baseColor, '#ef4444', t * 0.6);
    }
    const actionColor = ACTION_COLORS[currentAction];

    ctx.save();

    // Category-specific rendering
    if (category === 'guided_tour' && isGroupLeader) {
      // Tour guide: diamond shape, larger
      renderDiamond(ctx, position.x, position.y, 7, baseColor, isDark, currentAction, actionColor);
    } else if (category === 'vip_expert') {
      // VIP: diamond shape with gold border
      renderDiamond(ctx, position.x, position.y, 5, baseColor, isDark, currentAction, actionColor);
    } else if (category === 'guided_tour') {
      // Tour member: smaller circle
      renderCircle(ctx, position.x, position.y, 3, baseColor, isDark, currentAction, actionColor, false);
    } else if (category === 'small_group') {
      // Group member: slightly larger circle
      renderCircle(ctx, position.x, position.y, isGroupLeader ? 5 : 4, baseColor, isDark, currentAction, actionColor, isGroupLeader);
    } else {
      // Solo: default circle
      renderCircle(ctx, position.x, position.y, 3.5, baseColor, isDark, currentAction, actionColor, false);
    }

    // Watching progress arc
    if (currentAction === VISITOR_ACTION.WATCHING) {
      const radius = category === 'guided_tour' && isGroupLeader ? 7 : category === 'vip_expert' ? 5 : 3.5;
      const angle = (_visitorAnimFrame * 0.03) % (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius + 3, angle, angle + Math.PI * 1.5);
      ctx.strokeStyle = isDark ? 'rgba(34,197,94,0.5)' : 'rgba(22,163,74,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Waiting pulse
    if (currentAction === VISITOR_ACTION.WAITING) {
      const radius = 3.5;
      const pulse = (Math.sin(_visitorAnimFrame * 0.1 + (position.x * 0.1)) + 1) * 0.5;
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius + 2 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245,158,11,${0.2 + pulse * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Velocity direction line
    if (currentAction === VISITOR_ACTION.MOVING || currentAction === VISITOR_ACTION.EXITING) {
      const vx = visitor.velocity.x;
      const vy = visitor.velocity.y;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > 1) {
        const nx = vx / speed;
        const ny = vy / speed;
        ctx.beginPath();
        ctx.moveTo(position.x, position.y);
        ctx.lineTo(position.x + nx * 8, position.y + ny * 8);
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // Follow highlight ring
    if (followAgentId && (visitor.id as string) === followAgentId) {
      ctx.beginPath();
      ctx.arc(position.x, position.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${visitor.id as string}`, position.x, position.y - 14);
    }

    ctx.restore();
  }
}

// ---- Shape renderers ----

function renderCircle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  baseColor: string, isDark: boolean,
  action: string, actionColor: string | undefined,
  isLeader: boolean,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  if (action === VISITOR_ACTION.WATCHING || action === VISITOR_ACTION.WAITING) {
    ctx.fillStyle = actionColor ?? baseColor;
  } else {
    ctx.fillStyle = isDark ? hexToRgba(baseColor, 0.6) : hexToRgba(baseColor, 0.7);
  }
  ctx.fill();

  ctx.strokeStyle = isDark ? hexToRgba(baseColor, 0.9) : hexToRgba(baseColor, 0.8);
  ctx.lineWidth = isLeader ? 1.5 : 0.8;
  ctx.stroke();
}

function renderDiamond(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  baseColor: string, isDark: boolean,
  action: string, actionColor: string | undefined,
) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.7, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.7, y);
  ctx.closePath();

  if (action === VISITOR_ACTION.WATCHING || action === VISITOR_ACTION.WAITING) {
    ctx.fillStyle = actionColor ?? baseColor;
  } else {
    ctx.fillStyle = isDark ? hexToRgba(baseColor, 0.7) : hexToRgba(baseColor, 0.8);
  }
  ctx.fill();

  ctx.strokeStyle = baseColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ---- Tour boundary circles ----

function renderTourBoundaries(
  ctx: CanvasRenderingContext2D,
  visitors: readonly Visitor[],
  groups: readonly VisitorGroup[],
  isDark: boolean,
) {
  const visitorMap = new Map<string, Visitor>();
  for (const v of visitors) {
    if (v.isActive) visitorMap.set(v.id as string, v);
  }

  for (const group of groups) {
    if (group.type !== 'guided') continue;
    const leader = visitorMap.get(group.leaderId as string);
    if (!leader) continue;

    const radius = group.effectiveCollisionRadius ?? 60;

    ctx.save();
    ctx.beginPath();
    ctx.arc(leader.position.x, leader.position.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(244,114,182,0.06)' : 'rgba(244,114,182,0.08)';
    ctx.fill();
    ctx.strokeStyle = isDark ? 'rgba(244,114,182,0.2)' : 'rgba(244,114,182,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// ---- Cohesion lines (category-colored) ----

function renderCohesionLines(
  ctx: CanvasRenderingContext2D,
  visitors: readonly Visitor[],
  groups: readonly VisitorGroup[],
  isDark: boolean,
) {
  const visitorMap = new Map<string, Visitor>();
  for (const v of visitors) {
    if (v.isActive) visitorMap.set(v.id as string, v);
  }

  for (const group of groups) {
    const members = group.memberIds
      .map((id) => visitorMap.get(id as string))
      .filter((v): v is Visitor => v !== undefined);

    if (members.length < 2) continue;

    const leader = members.find((m) => m.isGroupLeader);
    if (!leader) continue;

    // Color based on group type
    const isGuided = group.type === 'guided';
    const lineColor = isGuided
      ? (isDark ? 'rgba(244,114,182,0.2)' : 'rgba(244,114,182,0.15)')
      : (isDark ? 'rgba(52,211,153,0.2)' : 'rgba(52,211,153,0.15)');

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = isGuided ? 0.8 : 0.5;
    ctx.setLineDash(isGuided ? [3, 4] : [2, 3]);

    for (const member of members) {
      if (member === leader) continue;
      // Skip cross-floor cohesion lines — they span the inter-floor gap on the
      // shared canvas and look like noise during portal transitions.
      if ((member.currentFloorId as string | null) !== (leader.currentFloorId as string | null)) continue;
      ctx.beginPath();
      ctx.moveTo(leader.position.x, leader.position.y);
      ctx.lineTo(member.position.x, member.position.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ---- Utilities ----

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}
