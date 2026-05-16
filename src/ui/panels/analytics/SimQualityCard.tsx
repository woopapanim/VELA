import { useState, useMemo } from 'react';
import { useStore } from '@/stores';
import { ChevronDown, ChevronRight, Target } from 'lucide-react';
import type { MediaId } from '@/domain';

// Threshold for "warn" vs "bad" — tuned against sample_0420_1 baseline (≈111 stuck
// at 200 vis / 106 min). Anything > 50 means KPIs are getting noticeably skewed
// by escape-valve events; > 150 means the scenario or engine is fighting itself.
const WARN_THRESHOLD = 10;
const BAD_THRESHOLD = 50;

// Per-media stuck-rate severity (stuck events / approach attempts).
// Used to surface "this media fails X% of approaches" — much more actionable
// than absolute counts since hot media naturally get more approaches.
const RATE_HIGH = 0.20; // > 20% of approaches stuck → critical
const RATE_MED = 0.10;  // > 10% → warn

const INT_TYPE_LABEL: Record<string, string> = {
  active: 'Active',
  analog: 'Analog',
  passive: 'Passive',
  staged: 'Staged',
};

interface MediaSuggestion {
  /** 1 sentence actionable suggestion in Korean. */
  readonly text: string;
}

/** Suggestion based on stuck pattern. After 6 attempts at engine fixes (only PR
 *  #41 landed), the lever is on the scenario side — capacity/spacing/visitor count.
 *  These suggestions teach users where to act. */
function suggestionFor(intType: string, stuckRate: number): MediaSuggestion {
  if (intType === 'active' || intType === 'staged') {
    return { text: 'Per-device 모델 — Duplicate (또는 Ctrl+C/V) 로 디바이스 더 배치하세요' };
  }
  if (stuckRate > RATE_HIGH) {
    return { text: '미디어 크기를 키우거나 (cap ↑), 인접 zone 으로 분산 배치' };
  }
  if (stuckRate > RATE_MED) {
    return { text: 'Engagement 시간 단축 또는 cap 약간 ↑ 검토' };
  }
  return { text: '주변 visitor 밀도 정상 — 부분 부하' };
}

interface Props {
  /** Optional — when provided, clicking a media row navigates to Build phase
   *  (selection + camera focus already applied to store). Without it, the card
   *  still updates store but user has to navigate manually. */
  readonly onNavigateToBuild?: () => void;
}

export function SimQualityCard({ onNavigateToBuild }: Props = {}) {
  const diag = useStore((s) => s.congestionDiag);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const selectMedia = useStore((s) => s.selectMedia);
  const setFocusTarget = useStore((s) => s.setFocusTarget);
  const media = useStore((s) => s.media);
  const [expanded, setExpanded] = useState(false);

  // Approach counts come from the skipRate slice of latestSnapshot — same
  // counter the `recordMediaApproach` calls in SimEngine feed. Allows us to
  // compute stuck-rate (stuck / approaches) per media without storing it twice.
  const approachByMedia = useMemo(() => {
    const m = new Map<string, number>();
    for (const entry of latestSnapshot?.skipRate?.perMedia ?? []) {
      m.set(entry.mediaId as string, entry.totalApproaches);
    }
    return m;
  }, [latestSnapshot]);

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

  // Per-media row with computed stuck rate for actionable insight.
  const mediaRows = diag.stuckByMedia.map((m) => {
    const approaches = approachByMedia.get(m.mediaId) ?? 0;
    const rate = approaches > 0 ? m.count / approaches : 0;
    return { ...m, approaches, rate };
  });

  const handleMediaClick = (mediaId: string) => {
    selectMedia(mediaId as MediaId);
    const target = media.find((x) => (x.id as string) === mediaId);
    if (target) setFocusTarget({ x: target.position.x, y: target.position.y, zoom: 2 });
    // Auto-navigate to Build so the user immediately sees the hotspot in
    // canvas instead of needing to switch pages manually (the click-to-focus
    // effect only manifests on a mounted CanvasPanel).
    onNavigateToBuild?.();
  };

  return (
    <div className="bento-box p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 cursor-pointer"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
        <span className="flex-1 text-left text-[11px] font-medium text-muted-foreground">
          {summaryText}
        </span>
        {status !== 'ok' && (
          <span className="text-[10px] font-data text-muted-foreground/70">
            {total >= BAD_THRESHOLD ? 'BAD' : 'WARN'}
          </span>
        )}
        {expanded
          ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
      </button>

      {status !== 'ok' && !expanded && (
        <p className="mt-1.5 text-[10px] text-muted-foreground/80 leading-snug">
          Visitors that physics/routing escaped via 30s/60s timeouts. KPIs may be
          skewed where these concentrate — click to see hotspots.
        </p>
      )}

      {expanded && (
        <div className="mt-3 space-y-3">
          {status === 'ok' ? (
            <p className="text-[10px] text-muted-foreground/80 leading-snug">
              ✓ No stuck events recorded. All visitor arrivals succeeded within the
              30s threshold. KPIs reflect actual visitor behavior.
            </p>
          ) : (
            <>
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

              {mediaRows.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase mb-1">Top Media (click to inspect)</div>
                  <div className="space-y-1.5">
                    {mediaRows.map((m) => {
                      const target = media.find((x) => (x.id as string) === m.mediaId);
                      const intType = target?.interactionType ?? 'passive';
                      const suggestion = suggestionFor(intType, m.rate);
                      const rateColor =
                        m.rate > RATE_HIGH ? 'text-[var(--status-danger)]'
                        : m.rate > RATE_MED ? 'text-[var(--status-warning)]'
                        : 'text-muted-foreground';
                      return (
                        <button
                          key={m.mediaId}
                          type="button"
                          onClick={() => handleMediaClick(m.mediaId)}
                          className="w-full text-left rounded-md p-1.5 hover:bg-secondary/50 transition-colors group"
                        >
                          <div className="flex items-center gap-2 text-[10px]">
                            <Target className="w-2.5 h-2.5 text-muted-foreground opacity-60 group-hover:opacity-100" />
                            <span className="flex-1 truncate text-foreground">{m.mediaName}</span>
                            <span className="font-data text-muted-foreground">{m.count} stuck</span>
                            {m.approaches > 0 && (
                              <span className={`font-data ${rateColor}`}>
                                {(m.rate * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 ml-4 text-[9px] text-muted-foreground/70 leading-tight">
                            {suggestion.text}
                          </p>
                        </button>
                      );
                    })}
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
                💡 Click a media to focus the canvas on it. After 6 engine-side
                attempts to reduce stuck globally, the most effective lever is
                scenario-side: cap, engagement time, spacing, or visitor count.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
