import { useMemo } from 'react';
import { FileText, Download } from 'lucide-react';
import { useStore } from '@/stores';
import { generateInsights } from '@/analytics';
import type { StructuredReport, ReportSummary, SpaceAnalysisEntry } from '@/domain';
import { ExportSummary } from './ExportSummary';
import { CsvExport } from './CsvExport';
import { INTERNATIONAL_DENSITY_STANDARD } from '@/domain';

export function CompletionReport() {
  const phase = useStore((s) => s.phase);
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const scenario = useStore((s) => s.scenario);
  const timeState = useStore((s) => s.timeState);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const kpiHistory = useStore((s) => s.kpiHistory);

  const report = useMemo<StructuredReport | null>(() => {
    if (!scenario || !latestSnapshot) return null;
    if (phase !== 'completed' && phase !== 'paused' && kpiHistory.length < 5) return null;

    const allVisitors = visitors;
    const exited = allVisitors.filter((v) => !v.isActive);
    const active = allVisitors.filter((v) => v.isActive);

    const totalTime = timeState.elapsed;
    const avgDwell = exited.length > 0
      ? exited.reduce((s, v) => s + (totalTime - v.enteredAt), 0) / exited.length
      : 0;

    const summary: ReportSummary = {
      totalVisitors: allVisitors.length,
      avgDwellTimeMs: avgDwell,
      peakCongestionRatio: Math.max(...latestSnapshot.zoneUtilizations.map((u) => u.ratio), 0),
      bottleneckCount: latestSnapshot.bottlenecks.filter((b) => b.score > 0.5).length,
      globalSkipRate: latestSnapshot.skipRate.globalSkipRate,
      completionRate: exited.length > 0
        ? exited.filter((v) => v.visitedZoneIds.length >= 3).length / exited.length
        : 0,
    };

    const spaceAnalysis: SpaceAnalysisEntry[] = zones.map((z) => {
      const occ = active.filter((v) => v.currentZoneId === z.id).length;
      const peakUtil = latestSnapshot.zoneUtilizations.find((u) => u.zoneId === z.id);
      const areaPerPerson = occ > 0 ? z.area / occ : z.area;
      let grade: 'A' | 'B' | 'C' | 'D' | 'F';
      if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 2) grade = 'A';
      else if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD) grade = 'B';
      else if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 0.7) grade = 'C';
      else if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 0.4) grade = 'D';
      else grade = 'F';

      return {
        zoneId: z.id,
        zoneName: z.name,
        areaPerPerson,
        comfortGrade: grade,
        peakOccupancy: peakUtil?.peakOccupancy ?? occ,
        avgDwellTimeMs: 0,
        bottleneckDuration: 0,
      };
    });

    const mediaStats = useStore.getState().mediaStats;
    const groups = useStore.getState().groups;
    const insights = generateInsights(latestSnapshot, zones, media, mediaStats, visitors, groups);

    // Build experience analysis from mediaStats
    const experienceAnalysis = media.map((m) => {
      const stats = mediaStats.get(m.id as string);
      const total = (stats?.watchCount ?? 0) + (stats?.skipCount ?? 0);
      return {
        mediaId: m.id,
        mediaType: m.type,
        totalInteractions: stats?.watchCount ?? 0,
        avgEngagementTimeMs: stats && stats.watchCount > 0 ? stats.totalWatchMs / stats.watchCount : 0,
        skipRate: total > 0 ? (stats?.skipCount ?? 0) / total : 0,
        avgQueueTimeMs: stats && stats.waitCount > 0 ? stats.totalWaitMs / stats.waitCount : 0,
        queueEfficiencyIndex: stats && stats.totalWaitMs > 0 ? stats.totalWatchMs / stats.totalWaitMs : 0,
      };
    }).filter(e => e.totalInteractions > 0);

    return {
      scenarioMeta: scenario.meta,
      generatedAt: Date.now(),
      summary,
      spaceAnalysis,
      experienceAnalysis,
      insights,
    };
  }, [phase, visitors, zones, media, scenario, timeState, latestSnapshot, kpiHistory]);

  if (!report) return null;

  const { summary } = report;
  const minutes = Math.floor(timeState.elapsed / 60000);
  const seconds = Math.floor((timeState.elapsed % 60000) / 1000);

  const handleExport = () => {
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vela-report-${report.scenarioMeta.name.replace(/\s+/g, '-')}-v${report.scenarioMeta.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bento-box p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Report
        </h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        >
          <Download className="w-3 h-3" /> Export JSON
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <MiniStat label="Total Visitors" value={summary.totalVisitors} />
        <MiniStat label="Duration" value={`${minutes}m ${seconds}s`} />
        <MiniStat label="Completion" value={`${Math.round(summary.completionRate * 100)}%`} />
        <MiniStat label="Peak Load" value={`${Math.round(summary.peakCongestionRatio * 100)}%`}
          color={summary.peakCongestionRatio > 0.9 ? 'text-[var(--status-danger)]' : undefined} />
        <MiniStat label="Bottlenecks" value={summary.bottleneckCount}
          color={summary.bottleneckCount > 0 ? 'text-[var(--status-warning)]' : undefined} />
        <MiniStat label="Skip Rate" value={`${Math.round(summary.globalSkipRate * 100)}%`} />
      </div>

      {/* Space Comfort Grades */}
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Space Comfort</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {report.spaceAnalysis.map((sa) => {
          const gradeColor = {
            A: 'bg-[var(--status-success)]/20 text-[var(--status-success)]',
            B: 'bg-primary/20 text-primary',
            C: 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]',
            D: 'bg-[var(--status-danger)]/20 text-[var(--status-danger)]',
            F: 'bg-[var(--status-danger)]/30 text-[var(--status-danger)]',
          }[sa.comfortGrade];
          return (
            <span
              key={sa.zoneId as string}
              className={`px-1.5 py-0.5 rounded text-[9px] font-data ${gradeColor}`}
            >
              {sa.zoneName}: {sa.comfortGrade}
            </span>
          );
        })}
      </div>

      {/* Top Insights Summary */}
      {report.insights.length > 0 && (
        <>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">
            Key Findings ({report.insights.length})
          </p>
          <div className="space-y-1">
            {report.insights.slice(0, 3).map((ins, i) => (
              <p key={i} className="text-[10px]">
                <span className={
                  ins.severity === 'critical' ? 'text-[var(--status-danger)]' :
                  ins.severity === 'warning' ? 'text-[var(--status-warning)]' :
                  'text-[var(--status-info)]'
                }>
                  {ins.severity === 'critical' ? '●' : ins.severity === 'warning' ? '▲' : 'ℹ'}
                </span>
                {' '}{ins.problem}
              </p>
            ))}
          </div>
        </>
      )}

      {/* Exports */}
      <div className="mt-3 space-y-1">
        <ExportSummary />
        <CsvExport />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-xs font-semibold font-data ${color ?? 'text-foreground'}`}>{value}</div>
      <div className="text-[8px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}
