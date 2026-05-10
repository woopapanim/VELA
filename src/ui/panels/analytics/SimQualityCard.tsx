import { useState } from 'react';
import { useStore } from '@/stores';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Threshold for "warn" vs "bad" — tuned against sample_0420_1 baseline (≈111 stuck
// at 200 vis / 106 min). Anything > 50 means KPIs are getting noticeably skewed
// by escape-valve events; > 150 means the scenario or engine is fighting itself.
const WARN_THRESHOLD = 10;
const BAD_THRESHOLD = 50;

const INT_TYPE_LABEL: Record<string, string> = {
  active: 'Active',
  analog: 'Analog',
  passive: 'Passive',
  staged: 'Staged',
};

export function SimQualityCard() {
  const diag = useStore((s) => s.congestionDiag);
  const [expanded, setExpanded] = useState(false);

  if (!diag) return null;

  const total = diag.totalStuck;
  const status: 'ok' | 'warn' | 'bad' =
    total >= BAD_THRESHOLD ? 'bad' : total >= WARN_THRESHOLD ? 'warn' : 'ok';

  const dotColor =
    status === 'bad' ? 'bg-[var(--status-danger)]'
    : status === 'warn' ? 'bg-[var(--status-warning)]'
    : 'bg-[var(--status-success)]';

  const summaryText =
    status === 'ok' ? 'Sim Quality: OK'
    : `Sim Quality: ${total} stuck event${total === 1 ? '' : 's'}`;

  const intTypes = Object.entries(diag.stuckByIntType).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bento-box p-3">
      <button
        type="button"
        onClick={() => status !== 'ok' && setExpanded((v) => !v)}
        className={`w-full flex items-center gap-2 ${status === 'ok' ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
        <span className="flex-1 text-left text-[11px] font-medium text-muted-foreground">
          {summaryText}
        </span>
        {status !== 'ok' && (
          expanded
            ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
      </button>

      {status !== 'ok' && (
        <p className="mt-1.5 text-[10px] text-muted-foreground/80 leading-snug">
          Visitors that physics/routing escaped via 30s/60s timeouts. Not a behavior
          category — KPIs may be skewed where these concentrate.
        </p>
      )}

      {expanded && status !== 'ok' && (
        <div className="mt-3 space-y-3">
          {intTypes.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase mb-1">By Type</div>
              <div className="space-y-0.5">
                {intTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2 text-[10px]">
                    <span className="w-14 text-muted-foreground">{INT_TYPE_LABEL[type] ?? type}</span>
                    <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--status-warning)]"
                        style={{ width: `${Math.min(100, (count / Math.max(total, 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="w-7 text-right font-data text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diag.stuckByMedia.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase mb-1">Top Media</div>
              <div className="space-y-0.5">
                {diag.stuckByMedia.map((m) => (
                  <div key={m.mediaId} className="flex items-center gap-2 text-[10px]">
                    <span className="flex-1 truncate text-muted-foreground">{m.mediaName}</span>
                    <span className="font-data text-muted-foreground">{m.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diag.stuckByZone.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase mb-1">Top Zones</div>
              <div className="space-y-0.5">
                {diag.stuckByZone.map((z) => (
                  <div key={z.zoneId} className="flex items-center gap-2 text-[10px]">
                    <span className="flex-1 truncate text-muted-foreground">{z.zoneName}</span>
                    <span className="font-data text-muted-foreground">{z.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/70 leading-snug pt-1 border-t border-border">
            Adjust capacity, engagement time, or visitor count for the listed
            media/zones to reduce stuck events.
          </p>
        </div>
      )}
    </div>
  );
}
