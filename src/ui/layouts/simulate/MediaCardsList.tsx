import { useMemo } from 'react';
import { Flame, Eye, SkipForward } from 'lucide-react';
import { useStore } from '@/stores';
import type { MediaId } from '@/domain';

interface MediaSummary {
  id: MediaId;
  name: string;
  zoneColor: string;
  zoneName: string;
  capacity: number;
  watching: number;       // 현재 관람 중
  waiting: number;        // 현재 대기 중
  watchCount: number;     // 누적 관람 완료
  skipCount: number;
  skipRate: number;       // 0-1
  peakViewers: number;
  avgWatchSec: number;
  isHot: boolean;
}

// Per-media live cards. 인기/스킵/관람중 한눈에. 정렬: 핫 → 관람중 → 누적.
// "전시물 관점" — zone 만으로는 보이지 않는 미디어 단위 신호.
export function MediaCardsList() {
  const phase = useStore((s) => s.phase);
  const media = useStore((s) => s.media);
  const zones = useStore((s) => s.zones);
  const mediaStats = useStore((s) => s.mediaStats);
  const visitors = useStore((s) => s.visitors);
  const latest = useStore((s) => s.latestSnapshot);

  const summaries = useMemo<MediaSummary[]>(() => {
    return media.map((m) => {
      const zone = zones.find((z) => z.id === m.zoneId);
      const stats = mediaStats.get(m.id as string) ?? {
        watchCount: 0, skipCount: 0, waitCount: 0, totalWatchMs: 0, totalWaitMs: 0, peakViewers: 0,
      };
      // 라이브 관람/대기 — visitors 에서 직접 count
      let watching = 0;
      let waiting = 0;
      for (const v of visitors) {
        if (!v.isActive || v.targetMediaId !== m.id) continue;
        if (v.currentAction === 'WATCHING') watching++;
        else if (v.currentAction === 'WAITING') waiting++;
      }
      // skipRate: snapshot 의 perMedia 가 권위 있는 분모 (totalApproaches)
      const skipEntry = latest?.skipRate.perMedia.find((p) => p.mediaId === m.id);
      const skipRate = skipEntry?.rate ?? (stats.watchCount + stats.skipCount > 0
        ? stats.skipCount / (stats.watchCount + stats.skipCount)
        : 0);
      const avgWatchMs = stats.watchCount > 0 ? stats.totalWatchMs / stats.watchCount : 0;

      const totalEngaged = stats.watchCount + stats.skipCount + stats.waitCount;
      const isHot = stats.peakViewers >= m.capacity * 0.8 && totalEngaged > 5;

      return {
        id: m.id,
        name: m.name,
        zoneColor: zone?.color ?? '#888',
        zoneName: zone?.name ?? '?',
        capacity: m.capacity,
        watching,
        waiting,
        watchCount: stats.watchCount,
        skipCount: stats.skipCount,
        skipRate,
        peakViewers: stats.peakViewers,
        avgWatchSec: Math.round(avgWatchMs / 1000),
        isHot,
      };
    });
  }, [media, zones, mediaStats, visitors, latest]);

  // 정렬: hot 우선 → 현재 관람 중 인원 → 누적 관람 수
  const sorted = useMemo(() => {
    return [...summaries].sort((a, b) => {
      if (a.isHot !== b.isHot) return a.isHot ? -1 : 1;
      if (a.watching !== b.watching) return b.watching - a.watching;
      return b.watchCount - a.watchCount;
    });
  }, [summaries]);

  if (phase === 'idle') {
    return (
      <section
        className="rounded-xl bg-[var(--surface)] border border-border p-3"
        aria-labelledby="exhibits-heading"
      >
        <h3
          id="exhibits-heading"
          className="text-[11px] uppercase tracking-wider font-semibold text-foreground/80 mb-2"
        >
          Exhibits
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Per-exhibit watch/skip metrics appear after start.
        </p>
      </section>
    );
  }

  if (sorted.length === 0) return null;

  return (
    <section
      className="rounded-xl bg-[var(--surface)] border border-border p-3"
      aria-labelledby="exhibits-heading"
    >
      <div className="flex items-baseline justify-between mb-2">
        <h3
          id="exhibits-heading"
          className="text-[11px] uppercase tracking-wider font-semibold text-foreground/80"
        >
          Exhibits
        </h3>
        <span className="text-[10px] text-muted-foreground font-data" aria-label={`${sorted.length} exhibits`}>
          {sorted.length}
        </span>
      </div>
      <ul className="space-y-1.5" role="list">
        {sorted.map((m) => (
          <MediaRow key={m.id as string} m={m} />
        ))}
      </ul>
    </section>
  );
}

function MediaRow({ m }: { m: MediaSummary }) {
  const skipPct = Math.round(m.skipRate * 100);
  const isHighSkip = skipPct >= 50 && m.watchCount + m.skipCount >= 5;

  const ariaLabel = [
    m.zoneName,
    m.name,
    m.isHot ? 'Popular' : null,
    `Watching ${m.watching}/${m.capacity}`,
    m.watchCount + m.skipCount > 0 ? `Skip rate ${skipPct}%` : null,
    m.watchCount > 0 ? `Total ${m.watchCount}` : null,
    m.waiting > 0 ? `Waiting ${m.waiting}` : null,
  ].filter(Boolean).join(', ');

  return (
    <li className="rounded-lg bg-secondary/40 px-2 py-2" aria-label={ariaLabel}>
      {/* Header — zone color · name · hot badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-2 h-2 rounded-sm flex-shrink-0"
          style={{ backgroundColor: m.zoneColor }}
          aria-hidden="true"
        />
        <span className="text-[11px] font-medium truncate flex-1 text-foreground" aria-hidden="true">{m.name}</span>
        {m.isHot && (
          <span
            className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-[var(--status-warning)]/20 text-[var(--status-warning)]"
            aria-label="Popular exhibit"
          >
            <Flame className="w-2.5 h-2.5" /> HOT
          </span>
        )}
      </div>

      {/* Stats row — current viewing / skip / watch count */}
      <div className="grid grid-cols-3 gap-1 text-[10px]">
        <Stat
          icon={<Eye className="w-2.5 h-2.5" aria-hidden="true" />}
          label="Watch"
          value={`${m.watching}/${m.capacity}`}
          tone={m.watching >= m.capacity * 0.8 ? 'warn' : 'normal'}
          srLabel={`Watching ${m.watching}, capacity ${m.capacity}`}
        />
        <Stat
          icon={<SkipForward className="w-2.5 h-2.5" aria-hidden="true" />}
          label="Skip"
          value={m.watchCount + m.skipCount > 0 ? `${skipPct}%` : '–'}
          tone={isHighSkip ? 'danger' : 'normal'}
          srLabel={`Skip rate ${skipPct}%`}
        />
        <Stat
          label="Total"
          value={m.watchCount.toString()}
          tone="normal"
          srLabel={`Total watched ${m.watchCount}${m.avgWatchSec > 0 ? `, avg ${m.avgWatchSec}s` : ''}`}
        />
      </div>

      {/* Sub-row — avg watch time, waiting */}
      {(m.avgWatchSec > 0 || m.waiting > 0) && (
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground font-data">
          {m.avgWatchSec > 0 && <span>avg {m.avgWatchSec}s</span>}
          {m.waiting > 0 && <span className="text-[var(--status-warning)]">wait {m.waiting}</span>}
        </div>
      )}
    </li>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
  srLabel,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone: 'normal' | 'warn' | 'danger';
  srLabel: string;
}) {
  const valueColor =
    tone === 'danger'
      ? 'text-[var(--status-danger)]'
      : tone === 'warn'
      ? 'text-[var(--status-warning)]'
      : 'text-foreground';
  return (
    <div className="rounded bg-secondary/50 px-1.5 py-1" aria-label={srLabel}>
      <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground/90 uppercase tracking-wider leading-none mb-0.5">
        {icon}
        <span aria-hidden="true">{label}</span>
      </div>
      <div className={`text-[11px] font-data font-semibold tabular-nums leading-none ${valueColor}`} aria-hidden="true">
        {value}
      </div>
    </div>
  );
}
