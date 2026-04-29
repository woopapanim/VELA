import { useState, useMemo } from 'react';
import {
  ChevronLeft, CheckCircle2, AlertTriangle, AlertOctagon, Info,
  Activity, Zap, MoveHorizontal, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { HelpButton } from '../components/HelpOverlay';
import { AnalyticsPanel } from '../panels/analytics/AnalyticsPanel';
import type { KpiSnapshot } from '@/domain';

interface Props {
  onBackToSimulate: () => void;
  onBackToBuild: () => void;
}

type VerdictLevel = 'success' | 'warning' | 'critical' | 'empty';

interface Verdict {
  readonly level: VerdictLevel;
  readonly headline: string;
  readonly detail: string;
}

function deriveVerdict(snap: KpiSnapshot | null, totalSpawned: number, t: (k: string) => string): Verdict {
  if (!snap || totalSpawned === 0) {
    return {
      level: 'empty',
      headline: t('analyze.verdict.empty'),
      detail: t('analyze.verdict.empty.detail'),
    };
  }
  const peak = Math.max(
    0,
    ...snap.zoneUtilizations.map((u) => (u.capacity > 0 ? u.peakOccupancy / u.capacity : 0)),
  );
  const skip = snap.skipRate.globalSkipRate;
  const completion = snap.flowEfficiency.completionRate;
  const detail = `${Math.round(peak * 100)}% peak · ${Math.round(skip * 100)}% skip · ${Math.round(completion * 100)}% complete`;

  // Critical = 실제 운영 위험 신호 (혼잡/대량 이탈). 단순 미완료는 critical 이 아니다.
  const overcrowded = peak > 0.9;
  const massSkip = skip > 0.5;
  if (overcrowded || massSkip) {
    return { level: 'critical', headline: t('analyze.verdict.critical'), detail };
  }
  // Warning = 주의 (혼잡 임박 / 스킵 누적 / 완주 부진).
  if (peak > 0.7 || skip > 0.3 || completion < 0.4) {
    return { level: 'warning', headline: t('analyze.verdict.warning'), detail };
  }
  // 미세한 완주 부진은 그냥 success 옆에 detail 로 노출.
  return { level: 'success', headline: t('analyze.verdict.success'), detail };
}

const VERDICT_STYLE: Record<VerdictLevel, { bg: string; ring: string; text: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: 'bg-[var(--status-success)]/10', ring: 'border-[var(--status-success)]/30', text: 'text-[var(--status-success)]', Icon: CheckCircle2 },
  warning: { bg: 'bg-[var(--status-warning)]/10', ring: 'border-[var(--status-warning)]/30', text: 'text-[var(--status-warning)]', Icon: AlertTriangle },
  critical: { bg: 'bg-[var(--status-danger)]/10', ring: 'border-[var(--status-danger)]/30', text: 'text-[var(--status-danger)]', Icon: AlertOctagon },
  empty: { bg: 'bg-secondary/40', ring: 'border-border', text: 'text-muted-foreground', Icon: Info },
};

export function AnalyzeLayout({ onBackToSimulate, onBackToBuild }: Props) {
  const t = useT();
  const scenario = useStore((s) => s.scenario);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const visitors = useStore((s) => s.visitors);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const totalExited = useStore((s) => s.totalExited);
  const spawnByNode = useStore((s) => s.spawnByNode);
  const exitByNode = useStore((s) => s.exitByNode);
  const graph = useStore((s) => s.waypointGraph);
  const [showDetail, setShowDetail] = useState(false);

  const verdict = useMemo(
    () => deriveVerdict(latestSnapshot, totalSpawned, t),
    [latestSnapshot, totalSpawned, t],
  );

  const peakUtil = useMemo(() => {
    if (!latestSnapshot) return null;
    let best: { zoneId: string; ratio: number } | null = null;
    for (const u of latestSnapshot.zoneUtilizations) {
      const peakRatio = u.capacity > 0 ? u.peakOccupancy / u.capacity : 0;
      if (!best || peakRatio > best.ratio) best = { zoneId: u.zoneId as string, ratio: peakRatio };
    }
    return best;
  }, [latestSnapshot]);

  const peakZoneName = peakUtil?.zoneId
    ? zones.find((z) => z.id === peakUtil.zoneId)?.name ?? '—'
    : '—';

  const completionPct = Math.round((latestSnapshot?.flowEfficiency.completionRate ?? 0) * 100);
  const skipPct = Math.round((latestSnapshot?.skipRate.globalSkipRate ?? 0) * 100);
  const fatiguePct = Math.round((latestSnapshot?.fatigueDistribution.mean ?? 0) * 100);
  const throughput = latestSnapshot?.flowEfficiency.throughputPerMinute ?? 0;

  // Derived rows for bento cells
  const topBottlenecks = useMemo(() => {
    if (!latestSnapshot) return [];
    return [...latestSnapshot.bottlenecks]
      .filter((b) => b.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((b) => ({
        name: zones.find((z) => z.id === b.zoneId)?.name ?? '—',
        score: b.score,
      }));
  }, [latestSnapshot, zones]);

  const topSkipMedia = useMemo(() => {
    if (!latestSnapshot) return [];
    return [...latestSnapshot.skipRate.perMedia]
      .filter((m) => m.rate > 0.1 && m.totalApproaches >= 3)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 4)
      .map((m) => ({
        name: media.find((mm) => mm.id === m.mediaId)?.name ?? '—',
        rate: m.rate,
        skipCount: m.skipCount,
      }));
  }, [latestSnapshot, media]);

  const entryExitFlow = useMemo(() => {
    if (!graph) return { entries: [], exits: [], unaccountedExits: 0 };
    const entries = graph.nodes
      .filter((n) => n.type === 'entry')
      .map((n) => ({
        name: n.label || 'Entry',
        count: spawnByNode.get(n.id as string) ?? 0,
      }));
    const exits = graph.nodes
      .filter((n) => n.type === 'exit')
      .map((n) => ({
        name: n.label || 'Exit',
        count: exitByNode.get(n.id as string) ?? 0,
      }));
    const exitNodeTotal = exits.reduce((s, e) => s + e.count, 0);
    const unaccountedExits = Math.max(0, totalExited - exitNodeTotal);
    return { entries, exits, unaccountedExits };
  }, [graph, spawnByNode, exitByNode, totalExited]);

  const engagementSummary = useMemo(() => {
    const exited = visitors.filter((v) => !v.isActive);
    if (exited.length === 0) return { avgZones: 0, fullCompletion: 0 };
    const sumZones = exited.reduce((s, v) => s + v.visitedZoneIds.length, 0);
    const full = exited.filter((v) => v.visitedZoneIds.length >= zones.length).length;
    return {
      avgZones: sumZones / exited.length,
      fullCompletion: full / exited.length,
    };
  }, [visitors, zones]);

  const Style = VERDICT_STYLE[verdict.level];
  const VerdictIcon = Style.Icon;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-[var(--surface)] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToSimulate}
            className="flex items-center gap-1 px-2 h-7 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={t('analyze.back')}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Simulate
          </button>
          <h1 className="text-sm font-semibold tracking-tight">VELA</h1>
          {scenario && (
            <span className="text-xs text-muted-foreground italic truncate max-w-64">
              {scenario.meta.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={onBackToBuild}
            className="text-muted-foreground/80 hover:text-foreground transition-colors"
          >
            1 Build ✓
          </button>
          <span className="text-muted-foreground/60">→</span>
          <button
            type="button"
            onClick={onBackToSimulate}
            className="text-muted-foreground/80 hover:text-foreground transition-colors"
          >
            2 Simulate ✓
          </button>
          <span className="text-muted-foreground/60">→</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            3 Analyze
          </span>
        </div>

        <div className="flex items-center gap-2">
          <HelpButton />
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 space-y-4">
          {/* Verdict hero */}
          <section className={`rounded-2xl border ${Style.ring} ${Style.bg} p-5`}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${Style.bg} ${Style.ring} border`}>
                <VerdictIcon className={`w-5 h-5 ${Style.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={`text-lg font-semibold ${Style.text}`}>{verdict.headline}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{verdict.detail}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KpiTile
                label={t('analyze.kpi.completion')}
                value={`${completionPct}%`}
                tone={completionPct >= 60 ? 'good' : completionPct >= 40 ? 'warn' : 'bad'}
              />
              <KpiTile
                label={t('analyze.kpi.skip')}
                value={`${skipPct}%`}
                tone={skipPct <= 30 ? 'good' : skipPct <= 50 ? 'warn' : 'bad'}
              />
              <KpiTile
                label={t('analyze.kpi.peakLoad')}
                value={`${Math.round((peakUtil?.ratio ?? 0) * 100)}%`}
                hint={peakZoneName}
                tone={(peakUtil?.ratio ?? 0) <= 0.7 ? 'good' : (peakUtil?.ratio ?? 0) <= 0.9 ? 'warn' : 'bad'}
              />
              <KpiTile
                label={t('analyze.kpi.fatigue')}
                value={`${fatiguePct}%`}
                tone={fatiguePct <= 50 ? 'good' : fatiguePct <= 70 ? 'warn' : 'bad'}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
              <span>
                {totalSpawned} spawned · {totalExited} exited · {throughput.toFixed(1)} /min
              </span>
            </div>
          </section>

          {/* Bento grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BentoCard title={t('analyze.bento.bottlenecks')} Icon={Activity}>
              {topBottlenecks.length === 0 ? (
                <Empty t={t} />
              ) : (
                <ul className="space-y-1.5">
                  {topBottlenecks.map((b, i) => (
                    <li key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="flex-1 truncate">{b.name}</span>
                      <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-[var(--status-warning)]"
                          style={{ width: `${Math.round(b.score * 100)}%` }}
                        />
                      </div>
                      <span className="font-data tabular-nums w-9 text-right text-muted-foreground">
                        {Math.round(b.score * 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </BentoCard>

            <BentoCard title={t('analyze.bento.skipHotspots')} Icon={Zap}>
              {topSkipMedia.length === 0 ? (
                <Empty t={t} />
              ) : (
                <ul className="space-y-1.5">
                  {topSkipMedia.map((m, i) => (
                    <li key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="flex-1 truncate">{m.name}</span>
                      <span className="font-data tabular-nums text-muted-foreground">
                        {m.skipCount}회
                      </span>
                      <span className="font-data tabular-nums w-9 text-right text-[var(--status-danger)]">
                        {Math.round(m.rate * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </BentoCard>

            <BentoCard title={t('analyze.bento.entryExit')} Icon={MoveHorizontal}>
              {entryExitFlow.entries.length === 0 && entryExitFlow.exits.length === 0 ? (
                <Empty t={t} />
              ) : (
                <div className="space-y-1">
                  {entryExitFlow.entries.map((e, i) => (
                    <div key={`in-${i}`} className="flex items-center gap-2 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] shrink-0" />
                      <span className="flex-1 truncate">{e.name}</span>
                      <span className="font-data tabular-nums text-[var(--status-success)]">
                        {e.count} in
                      </span>
                    </div>
                  ))}
                  {entryExitFlow.exits.map((e, i) => (
                    <div key={`out-${i}`} className="flex items-center gap-2 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-danger)] shrink-0" />
                      <span className="flex-1 truncate">{e.name}</span>
                      <span className="font-data tabular-nums text-[var(--status-danger)]">
                        {e.count} out
                      </span>
                    </div>
                  ))}
                  {entryExitFlow.unaccountedExits > 0 && (
                    <div className="flex items-center gap-2 text-[11px] pt-1.5 mt-1.5 border-t border-border/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                      <span className="flex-1 truncate text-muted-foreground italic">
                        {t('analyze.bento.entryExit.sessionEnd')}
                      </span>
                      <span className="font-data tabular-nums text-muted-foreground">
                        {entryExitFlow.unaccountedExits}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </BentoCard>

            <BentoCard title={t('analyze.bento.engagement')} Icon={Eye}>
              {totalExited === 0 ? (
                <Empty t={t} />
              ) : (
                <div className="space-y-1.5 text-[11px]">
                  <Row label="Avg zones / visitor" value={engagementSummary.avgZones.toFixed(1)} />
                  <Row label="Full completion" value={`${Math.round(engagementSummary.fullCompletion * 100)}%`} />
                  <Row label="Avg fatigue" value={`${fatiguePct}%`} />
                  <Row label="Throughput" value={`${throughput.toFixed(1)} /min`} />
                </div>
              )}
            </BentoCard>
          </div>

          {/* Detailed analysis (collapsible — uses existing AnalyticsPanel) */}
          <section className="rounded-2xl border border-border bg-[var(--surface)] overflow-hidden">
            <button
              onClick={() => setShowDetail((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors"
            >
              <div className="text-left">
                <h3 className="text-sm font-semibold">{t('analyze.detail.title')}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t('analyze.detail.hint')}</p>
              </div>
              {showDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showDetail && (
              <div className="border-t border-border">
                <AnalyticsPanel />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label, value, hint, tone,
}: { label: string; value: string; hint?: string; tone: 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good'
    ? 'text-[var(--status-success)]'
    : tone === 'warn'
    ? 'text-[var(--status-warning)]'
    : 'text-[var(--status-danger)]';
  return (
    <div className="rounded-xl bg-background/60 border border-border/60 p-2.5">
      <div className={`text-lg font-semibold font-data tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
      {hint && <div className="text-[10px] text-foreground/70 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

function BentoCard({
  title, Icon, children,
}: { title: string; Icon: typeof Activity; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-[var(--surface)] p-3">
      <h3 className="text-[11px] uppercase tracking-wider font-semibold text-foreground/80 flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-primary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ t }: { t: (k: string) => string }) {
  return (
    <p className="text-[11px] text-muted-foreground italic py-2">{t('analyze.bento.empty')}</p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-data tabular-nums">{value}</span>
    </div>
  );
}
