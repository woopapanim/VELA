import type { Visitor, VisitorGroup } from '@/domain';
import { VISITOR_ACTION } from '@/domain';

let _visitorAnimFrame = 0;

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
  // Draw cohesion lines first (behind agents)
  if (showCohesionLines) {
    renderCohesionLines(ctx, visitors, groups, isDark);
  }

  _visitorAnimFrame++;

  // Draw agents
  for (const visitor of visitors) {
    if (!visitor.isActive) continue;

    const { position, profile, currentAction, isGroupLeader } = visitor;
    const fatigue = visitor.fatigue;
    // Blend base color toward red as fatigue increases
    let baseColor = PROFILE_COLORS[profile.type] ?? '#60a5fa';
    if (fatigue > 0.5) {
      const t = Math.min(1, (fatigue - 0.5) * 2); // 0-1 as fatigue goes 0.5-1.0
      baseColor = lerpColor(baseColor, '#ef4444', t * 0.6);
    }
    const actionColor = ACTION_COLORS[currentAction];
    const radius = isGroupLeader ? 5 : 3.5;

    ctx.save();

    // Agent body
    ctx.beginPath();
    ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);

    if (currentAction === VISITOR_ACTION.WATCHING || currentAction === VISITOR_ACTION.WAITING) {
      // Stationary — filled with action color
      ctx.fillStyle = actionColor ?? baseColor;
      ctx.fill();
    } else {
      // Moving — outlined
      ctx.fillStyle = isDark
        ? hexToRgba(baseColor, 0.6)
        : hexToRgba(baseColor, 0.7);
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = isDark
      ? hexToRgba(baseColor, 0.9)
      : hexToRgba(baseColor, 0.8);
    ctx.lineWidth = isGroupLeader ? 1.5 : 0.8;
    ctx.stroke();

    // Watching progress arc (spinning indicator)
    if (currentAction === VISITOR_ACTION.WATCHING) {
      const angle = (_visitorAnimFrame * 0.03) % (Math.PI * 2);
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius + 3, angle, angle + Math.PI * 1.5);
      ctx.strokeStyle = isDark ? 'rgba(34,197,94,0.5)' : 'rgba(22,163,74,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Waiting pulse animation
    if (currentAction === VISITOR_ACTION.WAITING) {
      const pulse = (Math.sin(_visitorAnimFrame * 0.1 + (position.x * 0.1)) + 1) * 0.5;
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius + 2 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245,158,11,${0.2 + pulse * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Leader star indicator
    if (isGroupLeader) {
      ctx.beginPath();
      ctx.arc(position.x, position.y - radius - 3, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
    }

    // Velocity direction line (for moving agents)
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
      ctx.arc(position.x, position.y, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${visitor.id as string}`, position.x, position.y - radius - 8);
    }

    ctx.restore();
  }
}

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

    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 3]);

    // Connect members to leader
    const leader = members.find((m) => m.isGroupLeader);
    if (leader) {
      for (const member of members) {
        if (member === leader) continue;
        ctx.beginPath();
        ctx.moveTo(leader.position.x, leader.position.y);
        ctx.lineTo(member.position.x, member.position.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

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
