import { useMemo, useCallback } from 'react';
import { FileText, Download, TableProperties, FileDown } from 'lucide-react';
import { useStore } from '@/stores';
import { generateInsights } from '@/analytics';
import type { StructuredReport, ReportSummary, SpaceAnalysisEntry } from '@/domain';
import { INTERNATIONAL_DENSITY_STANDARD } from '@/domain';
import { useT } from '@/i18n';

const GRADE_STYLE: Record<'A' | 'B' | 'C' | 'D' | 'F', { badge: string; text: string }> = {
  A: { badge: 'bg-[var(--status-success)]/20 text-[var(--status-success)]', text: 'text-[var(--status-success)]' },
  B: { badge: 'bg-primary/20 text-primary', text: 'text-primary' },
  C: { badge: 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]', text: 'text-[var(--status-warning)]' },
  D: { badge: 'bg-[var(--status-danger)]/20 text-[var(--status-danger)]', text: 'text-[var(--status-danger)]' },
  F: { badge: 'bg-[var(--status-danger)]/30 text-[var(--status-danger)]', text: 'text-[var(--status-danger)]' },
};

export function CompletionReport() {
  const t = useT();
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const scenario = useStore((s) => s.scenario);
  const timeState = useStore((s) => s.timeState);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const kpiHistory = useStore((s) => s.kpiHistory);

  const report = useMemo<StructuredReport | null>(() => {
    if (!scenario || !latestSnapshot) return null;

    const exited = visitors.filter((v) => !v.isActive);
    const active = visitors.filter((v) => v.isActive);

    const totalTime = timeState.elapsed;
    const avgDwell = exited.length > 0
      ? exited.reduce((s, v) => s + (totalTime - v.enteredAt), 0) / exited.length
      : 0;

    const summary: ReportSummary = {
      totalVisitors: visitors.length,
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
    }).filter((e) => e.totalInteractions > 0);

    return {
      scenarioMeta: scenario.meta,
      generatedAt: Date.now(),
      summary,
      spaceAnalysis,
      experienceAnalysis,
      insights,
    };
  }, [visitors, zones, media, scenario, timeState, latestSnapshot]);

  const handleExportJson = useCallback(() => {
    if (!report) return;
    download(
      JSON.stringify(report, null, 2),
      'application/json',
      `vela-report-${report.scenarioMeta.name.replace(/\s+/g, '-')}-v${report.scenarioMeta.version}.json`,
    );
  }, [report]);

  const handleExportZone = useCallback(() => {
    if (kpiHistory.length === 0) return;
    const zoneNames = new Map(zones.map((z) => [z.id as string, z.name]));
    const zoneIds = zones.map((z) => z.id as string);
    let csv = 'time_s,' + zoneIds.map((id) => `"${zoneNames.get(id) ?? id}_occ"`).join(',');
    csv += ',' + zoneIds.map((id) => `"${zoneNames.get(id) ?? id}_util%"`).join(',');
    csv += ',avg_fatigue%,bottleneck_count,skip_rate%\n';
    for (const entry of kpiHistory) {
      const s = entry.snapshot;
      const utilMap = new Map(s.zoneUtilizations.map((u) => [u.zoneId as string, u]));
      const occCols = zoneIds.map((id) => utilMap.get(id)?.currentOccupancy ?? 0);
      const utilCols = zoneIds.map((id) => Math.round((utilMap.get(id)?.ratio ?? 0) * 100));
      const fatigue = Math.round(s.fatigueDistribution.mean * 100);
      const bottlenecks = s.bottlenecks.filter((b) => b.score > 0.5).length;
      const skipRate = Math.round(s.skipRate.globalSkipRate * 100);
      csv += `${Math.round(entry.timestamp / 1000)},${occCols.join(',')},${utilCols.join(',')},${fatigue},${bottlenecks},${skipRate}\n`;
    }
    download(csv, 'text/csv;charset=utf-8', `vela-zone-${scenario?.meta.name ?? 'export'}.csv`, true);
  }, [kpiHistory, zones, scenario]);

  const handleExportVisitor = useCallback(() => {
    let csv = 'id,profile,engagement,fatigue%,action,zone,visited_zones,group_leader,entered_at_s\n';
    for (const v of visitors) {
      const zone = zones.find((z) => z.id === v.currentZoneId);
      csv += [
        v.id as string,
        v.profile.type,
        v.profile.engagementLevel,
        Math.round(v.fatigue * 100),
        v.currentAction,
        zone?.name ?? '—',
        v.visitedZoneIds.length,
        v.isGroupLeader ? 'Y' : v.groupId ? 'N' : '—',
        Math.round(v.enteredAt / 1000),
      ].join(',') + '\n';
    }
    download(csv, 'text/csv;charset=utf-8', `vela-visitors-${scenario?.meta.name ?? 'export'}.csv`, true);
  }, [visitors, zones, scenario]);

  const handleExportMedia = useCallback(() => {
    const stats = useStore.getState().mediaStats;
    let csv = 'id,name,type,interaction,capacity,engagement_s,watched,skipped,skip_rate%,avg_watch_s,waited,avg_wait_s,peak_viewers\n';
    for (const m of media) {
      const st = stats.get(m.id as string);
      const name = (m as any).name || m.type;
      const intType = (m as any).interactionType || 'passive';
      const avgWatch = st && st.watchCount > 0 ? Math.round(st.totalWatchMs / st.watchCount / 1000) : 0;
      const avgWait = st && st.waitCount > 0 ? Math.round(st.totalWaitMs / st.waitCount / 1000) : 0;
      const skipRate = st && (st.watchCount + st.skipCount) > 0
        ? Math.round(st.skipCount / (st.watchCount + st.skipCount) * 100) : 0;
      csv += [
        m.id as string,
        `"${name}"`,
        m.type,
        intType,
        m.capacity,
        Math.round(m.avgEngagementTimeMs / 1000),
        st?.watchCount ?? 0,
        st?.skipCount ?? 0,
        skipRate,
        avgWatch,
        st?.waitCount ?? 0,
        avgWait,
        st?.peakViewers ?? 0,
      ].join(',') + '\n';
    }
    download(csv, 'text/csv;charset=utf-8', `vela-media-${scenario?.meta.name ?? 'export'}.csv`, true);
  }, [media, scenario]);

  if (!report) {
    return (
      <div className="bento-box p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
          <FileText className="w-3.5 h-3.5" /> Report
        </h2>
        <p className="text-[10px] text-muted-foreground">
          Run simulation to generate report.
        </p>
      </div>
    );
  }

  const { summary, spaceAnalysis, insights } = report;
  const minutes = Math.floor(timeState.elapsed / 60000);
  const seconds = Math.floor((timeState.elapsed % 60000) / 1000);
  const hasHistory = kpiHistory.length >= 2;

  return (
    <div className="bento-box p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
        <FileText className="w-3.5 h-3.5" /> Report
      </h2>

      {/* Export row */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        <ExportBtn label="JSON" icon={FileDown} onClick={handleExportJson} primary />
        <ExportBtn label="Zone" icon={TableProperties} onClick={handleExportZone} disabled={!hasHistory} />
        <ExportBtn label="Visitor" icon={TableProperties} onClick={handleExportVisitor} />
        <ExportBtn label="Media" icon={TableProperties} onClick={handleExportMedia} />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-border">
        <MiniStat label="Visitors" value={summary.totalVisitors} />
        <MiniStat label="Duration" value={`${minutes}m ${seconds}s`} />
        <MiniStat label="Completion" value={`${Math.round(summary.completionRate * 100)}%`} />
        <MiniStat
          label="Peak Load"
          value={`${Math.round(summary.peakCongestionRatio * 100)}%`}
          color={summary.peakCongestionRatio > 0.9 ? 'text-[var(--status-danger)]' : undefined}
        />
        <MiniStat
          label="Bottlenecks"
          value={summary.bottleneckCount}
          color={summary.bottleneckCount > 0 ? 'text-[var(--status-warning)]' : undefined}
        />
        <MiniStat label="Skip Rate" value={`${Math.round(summary.globalSkipRate * 100)}%`} />
      </div>

      {/* Space Comfort */}
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Space Comfort</p>
      <div className="space-y-1 mb-3">
        {spaceAnalysis.map((sa) => {
          const style = GRADE_STYLE[sa.comfortGrade];
          return (
            <div
              key={sa.zoneId as string}
              className="flex items-center gap-2 p-1.5 rounded-md bg-secondary/30"
            >
              <span
                className={`w-6 h-6 flex items-center justify-center rounded font-data font-bold text-xs shrink-0 ${style.badge}`}
              >
                {sa.comfortGrade}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] truncate">{sa.zoneName}</p>
                <p className="text-[9px] text-muted-foreground font-data">
                  {sa.areaPerPerson.toFixed(1)} m²/{t('report.perPerson')} · peak {sa.peakOccupancy}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Key Findings */}
      {insights.length > 0 && (
        <>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">
            Key Findings ({insights.length})
          </p>
          <div className="space-y-1">
            {insights.slice(0, 5).map((ins, i) => {
              const dot =
                ins.severity === 'critical'
                  ? 'text-[var(--status-danger)]'
                  : ins.severity === 'warning'
                    ? 'text-[var(--status-warning)]'
                    : 'text-[var(--status-info)]';
              return (
                <div key={i} className="text-[10px] flex items-start gap-1.5">
                  <span className={`${dot} shrink-0 mt-0.5`}>●</span>
                  <span className="flex-1">{ins.problem}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
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

function ExportBtn({
  label,
  icon: Icon,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  icon: typeof Download;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[9px] font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        primary
          ? 'bg-primary text-primary-foreground hover:opacity-90'
          : 'bg-secondary hover:bg-accent'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

function download(content: string, mime: string, filename: string, bom = false) {
  const blob = new Blob(bom ? ['\uFEFF' + content] : [content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
