import { useStore } from '@/stores';

const PROFILE_COLORS: Record<string, { color: string; label: string }> = {
  general: { color: '#60a5fa', label: 'General' },
  vip: { color: '#fbbf24', label: 'VIP' },
  child: { color: '#4ade80', label: 'Child' },
  elderly: { color: '#f97316', label: 'Elderly' },
  disabled: { color: '#a78bfa', label: 'Disabled' },
};

const ENGAGEMENT_COLORS: Record<string, { color: string; label: string }> = {
  quick: { color: '#f87171', label: 'Quick' },
  explorer: { color: '#60a5fa', label: 'Explorer' },
  immersive: { color: '#c084fc', label: 'Immersive' },
};

export function ProfileLegend() {
  const visitors = useStore((s) => s.visitors);
  const active = visitors.filter((v) => v.isActive);

  if (active.length === 0) return null;

  // Count by profile
  const profileCounts = new Map<string, number>();
  const engagementCounts = new Map<string, number>();
  for (const v of active) {
    const pKey = v.profile.type;
    profileCounts.set(pKey, (profileCounts.get(pKey) ?? 0) + 1);
    const eKey = v.profile.engagementLevel;
    engagementCounts.set(eKey, (engagementCounts.get(eKey) ?? 0) + 1);
  }

  // Count groups
  const groupCount = active.filter((v) => v.groupId !== undefined).length;

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Visitor Profiles
      </h2>

      {/* Profile type breakdown */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        {Object.entries(PROFILE_COLORS).map(([key, { color, label }]) => {
          const count = profileCounts.get(key) ?? 0;
          if (count === 0) return null;
          return (
            <div key={key} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] font-data">{count}</span>
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Engagement level breakdown */}
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Engagement</p>
      <div className="flex gap-1 mb-2">
        {Object.entries(ENGAGEMENT_COLORS).map(([key, { color, label }]) => {
          const count = engagementCounts.get(key) ?? 0;
          const pct = active.length > 0 ? Math.round((count / active.length) * 100) : 0;
          return (
            <div key={key} className="flex-1 text-center">
              <div
                className="h-1.5 rounded-full mb-1"
                style={{
                  backgroundColor: color,
                  opacity: 0.3 + (pct / 100) * 0.7,
                  width: `${Math.max(20, pct)}%`,
                  marginInline: 'auto',
                }}
              />
              <span className="text-[9px] font-data">{pct}%</span>
              <span className="text-[8px] text-muted-foreground block">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Group stats */}
      <div className="flex items-center justify-between text-[10px] pt-2 border-t border-border">
        <span className="text-muted-foreground">In Groups</span>
        <span className="font-data">{groupCount} / {active.length} ({active.length > 0 ? Math.round((groupCount / active.length) * 100) : 0}%)</span>
      </div>
    </div>
  );
}
