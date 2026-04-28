/**
 * LivePulse — Simulate 단계 우측 패널 (2026-04-28, 데이터 보강 v2).
 *
 * 목적: "잘 돌고 있나? 어디가 막히나? 어디로 흐르나?" 세 질문에 답한다.
 * 분석 깊이는 Analyze 단계 (`AnalyticsPanel` post 탭) 가 담당.
 *
 * 우선순위 — 스크롤 없이 모두 보여야 함 (320px × ~viewport):
 *   1) 진행도 (큰 숫자 + bar)
 *   2) 핵심 KPI 4 (Active / Peak Load / Fatigue / Skip) + spark
 *   3) Status row — 한 줄 진단
 *   4) Top zones (점유율 상위 3) — 어디가 차는지 (NEW)
 *   5) Top media (현재 viewer 상위 3) — 어디로 흐르는지 (NEW)
 *
 * 진입 문서: docs/plans/ux-ia-restructure.md §6 Stage B
 */

import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { Sparkline } from '@/ui/components/Sparkline';
import { CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import type { KpiTimeSeriesEntry, Visitor } from '@/domain';

const SPARK_WINDOW = 30;

export function LivePulse() {
  const t = useT();
  const phase = useStore((s) => s.phase);
  const scenario = useStore((s) => s.scenario);
  const visitors = useStore((s) => s.visitors);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const totalExited = useStore((s) => s.totalExited);
  const timeState = useStore((s) => s.timeState);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const kpiHistory = useStore((s) => s.kpiHistory);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);

  if (!scenario || phase === 'idle') {
    return <IdleHint t={t} />;
  }

  // ── 진행도 ────────────────────────────────────────────
  const totalCount = scenario.visitorDistribution.totalCount ?? 0;
  const duration = scenario.simulationConfig.duration;
  const simMode = scenario.simulationConfig.simulationMode ?? 'time';
  const isPersonMode = simMode === 'person';
  const elapsed = timeState.elapsed;
  const progress = isPersonMode
    ? (totalCount > 0 ? Math.min(1, (totalSpawned + totalExited) / (totalCount * 2)) : 0)
    : (duration > 0 ? Math.min(1, elapsed / duration) : 0);
  const progressPct = Math.round(progress * 100);

  // ── 활성 / 행동 ───────────────────────────────────────
  const activeCount = visitors.filter((v) => v.isActive).length;
  const watchingCount = visitors.filter((v) => v.isActive && v.currentAction === 'WATCHING').length;
  const waitingCount = visitors.filter((v) => v.isActive && v.currentAction === 'WAITING').length;

  // ── 만족도 / Skip ────────────────────────────────────
  const fatigue = latestSnapshot?.fatigueDistribution.mean ?? 0;
  const skipRate = latestSnapshot?.skipRate.globalSkipRate ?? 0;
  const fatiguePct = Math.round(fatigue * 100);
  const skipPct = Math.round(skipRate * 100);

  // ── 혼잡 / 병목 ──────────────────────────────────────
  const peakUtil = latestSnapshot
    ? Math.max(0, ...latestSnapshot.zoneUtilizations.map((u) => u.ratio))
    : 0;
  const peakUtilPct = Math.round(peakUtil * 100);
  const peakZone = latestSnapshot?.zoneUtilizations.reduce(
    (max, u) => (u.ratio > max.ratio ? u : max),
    { ratio: 0, zoneId: '' as unknown },
  );
  const peakZoneName = peakZone && (peakZone as any).zoneId
    ? zones.find((z) => z.id === (peakZone as any).zoneId)?.name ?? '—'
    : '—';
  const bottleneckCount = latestSnapshot
    ? latestSnapshot.bottlenecks.filter((b) => b.score > 0.5).length
    : 0;

  // ── Spark series ────────────────────────────────────
  const sparkSlice = kpiHistory.slice(-SPARK_WINDOW);
  const fatigueSpark = sparkSlice.map((e: KpiTimeSeriesEntry) => e.snapshot.fatigueDistribution.mean * 100);
  const skipSpark = sparkSlice.map((e: KpiTimeSeriesEntry) => e.snapshot.skipRate.globalSkipRate * 100);
  const peakSpark = sparkSlice.map((e: KpiTimeSeriesEntry) =>
    Math.max(0, ...e.snapshot.zoneUtilizations.map((u) => u.ratio)) * 100,
  );

  // ── Status ──────────────────────────────────────────
  let statusKind: 'ok' | 'warn' | 'danger' = 'ok';
  let statusMsg = t('pulse.status.ok');
  if (bottleneckCount > 0) {
    statusKind = 'danger';
    statusMsg = t('pulse.status.bottleneck', { n: bottleneckCount });
  } else if (peakUtilPct > 80) {
    statusKind = 'warn';
    statusMsg = t('pulse.status.crowded', { zone: peakZoneName, pct: peakUtilPct });
  }

  // ── Top zones (점유율 상위 3) ─────────────────────────
  // 어디가 차고 있나 — currentOccupancy>0 인 영역만, ratio 내림차순.
  const topZones = (latestSnapshot?.zoneUtilizations ?? [])
    .filter((u) => u.currentOccupancy > 0)
    .slice()
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3)
    .map((u) => ({
      id: u.zoneId,
      name: zones.find((z) => z.id === u.zoneId)?.name ?? '—',
      occ: u.currentOccupancy,
      cap: u.capacity,
      ratio: u.ratio,
    }));

  // ── Top media (현재 viewer 상위 3) ────────────────────
  // 어디로 흐르나 — WATCHING 상태인 visitor 를 targetMediaId 로 그룹.
  const viewerCount = new Map<string, number>();
  for (const v of visitors as Visitor[]) {
    if (!v.isActive || v.currentAction !== 'WATCHING' || !v.targetMediaId) continue;
    viewerCount.set(v.targetMediaId, (viewerCount.get(v.targetMediaId) ?? 0) + 1);
  }
  const topMedia = Array.from(viewerCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({
      id,
      name: media.find((m) => m.id === id)?.name ?? '—',
      viewers: n,
    }));

  return (
    <div className="p-3 space-y-3">
      {/* 진행도 */}
      <div className="bento-box p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="panel-title">{t('pulse.progress.title')}</h2>
          <span className="text-[10px] text-muted-foreground font-data">
            {phase === 'paused' ? t('pulse.progress.paused') : t('pulse.progress.running')}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-semibold font-data text-primary">{progressPct}%</span>
          <span className="text-[11px] text-muted-foreground">
            {isPersonMode
              ? t('pulse.progress.personSub', { spawned: totalSpawned, exited: totalExited, total: totalCount })
              : t('pulse.progress.timeSub', { elapsed: formatElapsed(elapsed), total: formatDuration(duration) })}
          </span>
        </div>
        <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 4 KPI tiles */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCell
          label={t('pulse.kpi.active')}
          value={activeCount}
          sub={t('pulse.kpi.activeSub', { watching: watchingCount, waiting: waitingCount })}
          tone="primary"
        />
        <KpiCell
          label={t('pulse.kpi.peak')}
          value={`${peakUtilPct}%`}
          sub={peakZoneName}
          tone={peakUtilPct > 80 ? 'danger' : peakUtilPct > 60 ? 'warning' : 'muted'}
          spark={peakSpark}
          sparkColor="#f59e0b"
        />
        <KpiCell
          label={t('pulse.kpi.fatigue')}
          value={`${fatiguePct}%`}
          tone={fatiguePct > 60 ? 'danger' : 'muted'}
          spark={fatigueSpark}
          sparkColor="#a855f7"
        />
        <KpiCell
          label={t('pulse.kpi.skip')}
          value={`${skipPct}%`}
          tone={skipPct > 30 ? 'danger' : skipPct > 15 ? 'warning' : 'muted'}
          spark={skipSpark}
          sparkColor="#ef4444"
        />
      </div>

      {/* Status row */}
      <StatusRow kind={statusKind} message={statusMsg} />

      {/* Top zones — 어디가 차나 */}
      <TopList
        title={t('pulse.zones.title')}
        empty={t('pulse.zones.empty')}
        rows={topZones.map((z) => ({
          key: z.id,
          name: z.name,
          ratio: z.ratio,
          right: `${z.occ}/${z.cap}`,
          tone: z.ratio > 0.8 ? 'danger' : z.ratio > 0.6 ? 'warning' : 'muted',
        }))}
      />

      {/* Top media — 어디로 흐르나 */}
      <TopList
        title={t('pulse.media.title')}
        empty={t('pulse.media.empty')}
        rows={topMedia.map((m) => ({
          key: m.id,
          name: m.name,
          ratio: 0,
          right: t('pulse.media.viewers', { n: m.viewers }),
          tone: 'primary',
          showBar: false,
        }))}
      />

      {/* 안내 */}
      {phase === 'completed' ? null : (
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed px-1">
          {t('pulse.hint.afterEnd')}
        </p>
      )}
    </div>
  );
}

function TopList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: ReadonlyArray<{
    key: string;
    name: string;
    ratio: number;
    right: string;
    tone: 'primary' | 'danger' | 'warning' | 'muted';
    showBar?: boolean;
  }>;
}) {
  return (
    <div className="bento-box p-3">
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium mb-1.5">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/60 py-1">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => {
            const barColor =
              r.tone === 'danger' ? 'bg-[var(--status-danger)]'
              : r.tone === 'warning' ? 'bg-[var(--status-warning)]'
              : r.tone === 'primary' ? 'bg-primary'
              : 'bg-muted-foreground/40';
            const textColor =
              r.tone === 'danger' ? 'text-[var(--status-danger)]'
              : r.tone === 'warning' ? 'text-[var(--status-warning)]'
              : 'text-foreground';
            return (
              <li key={r.key} className="flex items-center gap-2 text-[11px]">
                <span className="flex-1 truncate text-foreground/90">{r.name}</span>
                {r.showBar !== false && (
                  <div className="w-12 h-1 bg-secondary/60 rounded-full overflow-hidden shrink-0">
                    <div
                      className={`h-full ${barColor} transition-all`}
                      style={{ width: `${Math.min(100, Math.round(r.ratio * 100))}%` }}
                    />
                  </div>
                )}
                <span className={`font-data tabular-nums shrink-0 ${textColor}`}>{r.right}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function KpiCell({
  label,
  value,
  sub,
  tone = 'muted',
  spark,
  sparkColor = '#3b82f6',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'primary' | 'danger' | 'warning' | 'muted';
  spark?: number[];
  sparkColor?: string;
}) {
  const valColor =
    tone === 'danger' ? 'text-[var(--status-danger)]'
    : tone === 'warning' ? 'text-[var(--status-warning)]'
    : tone === 'primary' ? 'text-primary'
    : 'text-foreground';
  return (
    <div className="bento-box-elevated p-3">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
          {label}
        </span>
        {spark && spark.length >= 2 && (
          <Sparkline data={spark} width={42} height={14} color={sparkColor} />
        )}
      </div>
      <div className={`text-xl font-semibold font-data leading-tight ${valColor}`}>{value}</div>
      {sub && (
        <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{sub}</div>
      )}
    </div>
  );
}

function StatusRow({ kind, message }: { kind: 'ok' | 'warn' | 'danger'; message: string }) {
  const cfg =
    kind === 'danger'
      ? { Icon: AlertOctagon, bg: 'bg-[var(--status-danger)]/10', border: 'border-[var(--status-danger)]/30', text: 'text-[var(--status-danger)]' }
      : kind === 'warn'
        ? { Icon: AlertTriangle, bg: 'bg-[var(--status-warning)]/10', border: 'border-[var(--status-warning)]/30', text: 'text-[var(--status-warning)]' }
        : { Icon: CheckCircle, bg: 'bg-[var(--status-success)]/10', border: 'border-[var(--status-success)]/30', text: 'text-[var(--status-success)]' };
  const { Icon } = cfg;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${cfg.bg} ${cfg.border}`}>
      <Icon className={`w-4 h-4 ${cfg.text} shrink-0`} />
      <span className={`text-xs leading-tight ${cfg.text}`}>{message}</span>
    </div>
  );
}

function IdleHint({ t }: { t: (key: string) => string }) {
  return (
    <div className="p-6 text-center text-xs text-muted-foreground/70 leading-relaxed">
      {t('pulse.idle')}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
