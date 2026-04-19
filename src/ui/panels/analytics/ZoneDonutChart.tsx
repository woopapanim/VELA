import { useMemo } from 'react';
import { useStore } from '@/stores';

export function ZoneDonutChart() {
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);

  const data = useMemo(() => {
    const active = visitors.filter((v) => v.isActive);
    if (active.length === 0) return [];

    const counts = new Map<string, number>();
    for (const v of active) {
      if (!v.currentZoneId) continue;
      const key = v.currentZoneId as string;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return zones
      .map((z) => ({
        id: z.id as string,
        name: z.name,
        color: z.color,
        count: counts.get(z.id as string) ?? 0,
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [visitors, zones]);

  const total = data.reduce((s, d) => s + d.count, 0);

  if (data.length === 0) return null;

  // Build SVG donut segments
  const radius = 40;
  const cx = 50;
  const cy = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  let accOffset = 0;
  const segments = data.map((d) => {
    const pct = d.count / total;
    const dashLen = circumference * pct;
    const dashGap = circumference - dashLen;
    const offset = -accOffset;
    accOffset += dashLen;
    return { ...d, pct, dashLen, dashGap, offset };
  });

  return (
    <div className="bento-box p-4">
      <h2 className="panel-section mb-3">
        Zone Distribution
      </h2>
      <div className="flex items-center gap-4">
        {/* Donut SVG */}
        <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90">
          {segments.map((seg) => (
            <circle
              key={seg.id}
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.dashLen} ${seg.dashGap}`}
              strokeDashoffset={seg.offset}
              strokeLinecap="round"
            />
          ))}
          {/* Center text */}
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
            className="fill-foreground rotate-90 origin-center"
            style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
            {total}
          </text>
        </svg>

        {/* Legend */}
        <div className="flex-1 space-y-1">
          {segments.slice(0, 6).map((seg) => (
            <div key={seg.id} className="flex items-center gap-1.5 text-[9px]">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="truncate flex-1">{seg.name}</span>
              <span className="font-data text-muted-foreground">{seg.count}</span>
              <span className="font-data w-8 text-right">{Math.round(seg.pct * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
