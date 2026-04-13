import { useStore } from '@/stores';
import { User, MapPin, Footprints, Zap, Clock } from 'lucide-react';

export function FollowedAgentCard() {
  const followAgentId = useStore((s) => s.followAgentId);
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const timeState = useStore((s) => s.timeState);
  const setFollowAgent = useStore((s) => s.setFollowAgent);

  if (!followAgentId) return null;

  const agent = visitors.find((v) => (v.id as string) === followAgentId);
  if (!agent) return null;

  const currentZone = zones.find((z) => z.id === agent.currentZoneId);
  const targetZone = zones.find((z) => z.id === agent.targetZoneId);
  const elapsed = timeState.elapsed - agent.enteredAt;
  const elapsedMin = Math.floor(elapsed / 60000);
  const elapsedSec = Math.floor((elapsed % 60000) / 1000);

  const speedMag = Math.sqrt(agent.velocity.x ** 2 + agent.velocity.y ** 2);

  return (
    <div className="bento-box p-4 border-[#fbbf24]/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#fbbf24]/20 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-[#fbbf24]" />
          </div>
          <div>
            <p className="text-xs font-semibold font-data">{agent.id as string}</p>
            <p className="text-[9px] text-muted-foreground">{agent.profile.type} · {agent.profile.engagementLevel}</p>
          </div>
        </div>
        <button
          onClick={() => setFollowAgent(null)}
          className="text-[9px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary"
        >
          Unfollow
        </button>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-data ${
          agent.currentAction === 'WATCHING' ? 'bg-[var(--status-success)]/20 text-[var(--status-success)]' :
          agent.currentAction === 'WAITING' ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]' :
          agent.currentAction === 'EXITING' ? 'bg-[var(--status-danger)]/20 text-[var(--status-danger)]' :
          'bg-primary/20 text-primary'
        }`}>{agent.currentAction}</span>
        {agent.groupId && (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-data bg-secondary">
            {agent.isGroupLeader ? '★ Leader' : '👥 Group'}
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatRow icon={MapPin} label="Zone" value={currentZone?.name ?? '—'} />
        <StatRow icon={Footprints} label="Target" value={targetZone?.name ?? '—'} />
        <StatRow icon={Zap} label="Speed" value={`${speedMag.toFixed(0)} px/s`} />
        <StatRow icon={Clock} label="Time In" value={`${elapsedMin}m ${elapsedSec}s`} />
      </div>

      {/* Fatigue bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[9px] mb-0.5">
          <span className="text-muted-foreground">Fatigue</span>
          <span className={`font-data ${agent.fatigue > 0.7 ? 'text-[var(--status-danger)]' : ''}`}>
            {Math.round(agent.fatigue * 100)}%
          </span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${agent.fatigue * 100}%`,
              backgroundColor: agent.fatigue > 0.7 ? 'var(--status-danger)' : agent.fatigue > 0.4 ? 'var(--status-warning)' : 'var(--status-success)',
            }}
          />
        </div>
      </div>

      {/* Visited zones */}
      <div>
        <p className="text-[9px] text-muted-foreground mb-1">
          Visited ({agent.visitedZoneIds.length} zones)
        </p>
        <div className="flex flex-wrap gap-1">
          {agent.visitedZoneIds.map((zid, i) => {
            const z = zones.find((zone) => zone.id === zid);
            return (
              <span key={i} className="px-1.5 py-0.5 text-[8px] font-data rounded bg-secondary truncate max-w-20">
                {z?.name ?? (zid as string)}
              </span>
            );
          })}
        </div>
      </div>

      {/* Position */}
      <div className="mt-2 text-[8px] font-data text-muted-foreground">
        pos: ({Math.round(agent.position.x)}, {Math.round(agent.position.y)}) · floor: {agent.currentFloorId as string}
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <div>
        <p className="text-[8px] text-muted-foreground">{label}</p>
        <p className="text-[10px] font-data truncate max-w-20">{value}</p>
      </div>
    </div>
  );
}
