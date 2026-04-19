import { useMemo } from 'react';
import { useStore } from '@/stores';

export function ZoneGraphViz() {
  const zones = useStore((s) => s.zones);
  const visitors = useStore((s) => s.visitors);

  const graph = useMemo(() => {
    if (zones.length === 0) return null;

    // Build adjacency from gate connections
    const links: Array<{ from: string; to: string; flow: number }> = [];
    const flowMap = new Map<string, number>();

    // Count actual visitor flows
    for (const v of visitors) {
      if (!v.isActive || !v.currentZoneId || !v.targetZoneId) continue;
      if (v.currentZoneId === v.targetZoneId) continue;
      const key = `${v.currentZoneId as string}->${v.targetZoneId as string}`;
      flowMap.set(key, (flowMap.get(key) ?? 0) + 1);
    }

    // Build links from gate connections
    const seen = new Set<string>();
    for (const zone of zones) {
      for (const gate of zone.gates) {
        if (!gate.connectedGateId) continue;
        const targetZone = zones.find((z) =>
          z.gates.some((g) => (g.id as string) === (gate.connectedGateId as string))
        );
        if (!targetZone) continue;
        const pair = [zone.id as string, targetZone.id as string].sort().join('<>');
        if (seen.has(pair)) continue;
        seen.add(pair);

        const flowAB = flowMap.get(`${zone.id as string}->${targetZone.id as string}`) ?? 0;
        const flowBA = flowMap.get(`${targetZone.id as string}->${zone.id as string}`) ?? 0;
        links.push({ from: zone.id as string, to: targetZone.id as string, flow: flowAB + flowBA });
      }
    }

    return { links };
  }, [zones, visitors]);

  if (!graph || zones.length === 0) return null;

  // Layout: arrange nodes in a circle
  const nodeCount = zones.length;
  const svgSize = 200;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const radius = 70;

  const nodePositions = new Map<string, { x: number; y: number }>();
  zones.forEach((z, i) => {
    const angle = (i / nodeCount) * Math.PI * 2 - Math.PI / 2;
    nodePositions.set(z.id as string, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  });

  const maxFlow = Math.max(...graph.links.map((l) => l.flow), 1);

  return (
    <div className="bento-box p-4">
      <h2 className="panel-section mb-2">
        Zone Graph
      </h2>
      <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-40">
        {/* Links */}
        {graph.links.map((link, i) => {
          const from = nodePositions.get(link.from);
          const to = nodePositions.get(link.to);
          if (!from || !to) return null;
          const thickness = 0.5 + (link.flow / maxFlow) * 3;
          const opacity = 0.15 + (link.flow / maxFlow) * 0.4;
          return (
            <line key={i}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="#3b82f6" strokeWidth={thickness} opacity={opacity}
            />
          );
        })}
        {/* Nodes */}
        {zones.map((z) => {
          const pos = nodePositions.get(z.id as string);
          if (!pos) return null;
          const occ = visitors.filter((v) => v.isActive && v.currentZoneId === z.id).length;
          const nodeRadius = 6 + Math.min(8, occ * 0.3);
          return (
            <g key={z.id as string}>
              <circle cx={pos.x} cy={pos.y} r={nodeRadius} fill={z.color} opacity={0.7}
                stroke={z.color} strokeWidth={1} />
              <text x={pos.x} y={pos.y + nodeRadius + 8}
                textAnchor="middle" fontSize="5" fill="currentColor" opacity={0.5}
                className="fill-foreground">
                {z.name.slice(0, 10)}
              </text>
              {occ > 0 && (
                <text x={pos.x} y={pos.y + 2}
                  textAnchor="middle" fontSize="6" fontWeight="bold" fill="white">
                  {occ}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
