import { useStore } from '@/stores';

export function AgentJourney() {
  const followAgentId = useStore((s) => s.followAgentId);
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const graph = useStore((s) => s.waypointGraph);

  if (!followAgentId) return null;

  const agent = visitors.find((v) => (v.id as string) === followAgentId);
  if (!agent) return null;

  const hasPathLog = agent.pathLog && agent.pathLog.length > 0;
  const hasZoneJourney = agent.visitedZoneIds.length > 0;

  if (!hasPathLog && !hasZoneJourney) return null;

  return (
    <div className="bento-box p-4">
      <h2 className="panel-section mb-2">
        Journey: {(agent.id as string).slice(0, 12)}
      </h2>

      {/* ── PathLog (node-by-node, Graph mode) ── */}
      {hasPathLog && graph && (
        <div className="mb-3">
          <p className="text-[9px] text-muted-foreground mb-1.5 font-semibold uppercase">Node Path</p>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {agent.pathLog.map((entry, i) => {
              const node = graph.nodes.find(n => n.id === entry.nodeId);
              const label = node?.label || node?.type || '?';
              const isActive = entry.exitTime === 0;
              const durSec = isActive
                ? '...'
                : `${(entry.duration / 1000).toFixed(1)}s`;
              const entryMin = Math.floor(entry.entryTime / 60000);
              const entrySec = Math.floor((entry.entryTime % 60000) / 1000);
              const timeStr = `${String(entryMin).padStart(2, '0')}:${String(entrySec).padStart(2, '0')}`;

              return (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-data ${
                    isActive
                      ? 'bg-primary/15 ring-1 ring-primary/30'
                      : 'bg-secondary/50'
                  }`}
                >
                  <span className="w-4 text-muted-foreground text-right">{i + 1}</span>
                  <NodeTypeDot type={node?.type ?? 'zone'} />
                  <span className="flex-1 truncate font-medium">{label}</span>
                  <span className="text-muted-foreground">{timeStr}</span>
                  <span className={`w-10 text-right ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {durSec}
                  </span>
                </div>
              );
            })}
          </div>

          {/* PathLog Summary */}
          <div className="mt-2 grid grid-cols-3 gap-1 text-[8px] text-muted-foreground font-data">
            <div className="text-center">
              <div className="text-[11px] font-semibold text-foreground">{agent.pathLog.length}</div>
              <div>nodes</div>
            </div>
            <div className="text-center">
              <div className="text-[11px] font-semibold text-foreground">
                {(agent.pathLog.reduce((sum, e) => sum + e.duration, 0) / 1000).toFixed(0)}s
              </div>
              <div>total dwell</div>
            </div>
            <div className="text-center">
              <div className="text-[11px] font-semibold text-foreground">
                {(() => {
                  const dwelled = agent.pathLog.filter(e => e.duration > 0);
                  return dwelled.length > 0
                    ? (dwelled.reduce((sum, e) => sum + e.duration, 0) / dwelled.length / 1000).toFixed(1)
                    : '—';
                })()}s
              </div>
              <div>avg dwell</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Zone Journey (legacy/zone mode) ── */}
      {hasZoneJourney && (
        <div>
          {hasPathLog && (
            <p className="text-[9px] text-muted-foreground mb-1.5 font-semibold uppercase">Zone Path</p>
          )}
          <div className="flex items-center gap-0.5 flex-wrap">
            {agent.visitedZoneIds.map((zid, i) => {
              const zone = zones.find((z) => z.id === zid);
              const isCurrent = agent.currentZoneId === zid;
              return (
                <div key={i} className="flex items-center gap-0.5">
                  {i > 0 && <span className="text-[8px] text-muted-foreground">→</span>}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] font-data ${
                      isCurrent
                        ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-sm mr-0.5"
                      style={{ backgroundColor: zone?.color ?? '#888' }} />
                    {zone?.name?.slice(0, 12) ?? '?'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-[8px] text-muted-foreground font-data">
            {agent.visitedZoneIds.length} zones visited · {agent.visitedMediaIds.length} media viewed
          </div>
        </div>
      )}
    </div>
  );
}

function NodeTypeDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    entry: '#22c55e',
    exit: '#ef4444',
    attractor: '#f59e0b',
    hub: '#8b5cf6',
    rest: '#06b6d4',
    zone: '#6b7280',
    bend: '#64748b',
  };
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: colors[type] ?? '#6b7280' }}
    />
  );
}
