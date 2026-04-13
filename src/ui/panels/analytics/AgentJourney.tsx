import { useStore } from '@/stores';

export function AgentJourney() {
  const followAgentId = useStore((s) => s.followAgentId);
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);

  if (!followAgentId) return null;

  const agent = visitors.find((v) => (v.id as string) === followAgentId);
  if (!agent || agent.visitedZoneIds.length === 0) return null;

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Journey: {agent.id as string}
      </h2>
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
  );
}
