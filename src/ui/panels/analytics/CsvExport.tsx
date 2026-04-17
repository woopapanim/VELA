import { useCallback } from 'react';
import { TableProperties } from 'lucide-react';
import { useStore } from '@/stores';

export function CsvExport() {
  const kpiHistory = useStore((s) => s.kpiHistory);
  const zones = useStore((s) => s.zones);
  const scenario = useStore((s) => s.scenario);

  const handleExportZoneUtilization = useCallback(() => {
    if (kpiHistory.length === 0) return;

    const zoneNames = new Map(zones.map((z) => [z.id as string, z.name]));
    const zoneIds = zones.map((z) => z.id as string);

    // Header
    let csv = 'time_s,' + zoneIds.map((id) => `"${zoneNames.get(id) ?? id}_occ"`).join(',');
    csv += ',' + zoneIds.map((id) => `"${zoneNames.get(id) ?? id}_util%"`).join(',');
    csv += ',avg_fatigue%,bottleneck_count,skip_rate%\n';

    // Rows
    for (const entry of kpiHistory) {
      const s = entry.snapshot;
      const timeSec = Math.round(entry.timestamp / 1000);
      const utilMap = new Map(s.zoneUtilizations.map((u) => [u.zoneId as string, u]));

      const occCols = zoneIds.map((id) => utilMap.get(id)?.currentOccupancy ?? 0);
      const utilCols = zoneIds.map((id) => Math.round((utilMap.get(id)?.ratio ?? 0) * 100));
      const fatigue = Math.round(s.fatigueDistribution.mean * 100);
      const bottlenecks = s.bottlenecks.filter((b) => b.score > 0.5).length;
      const skipRate = Math.round(s.skipRate.globalSkipRate * 100);

      csv += `${timeSec},${occCols.join(',')},${utilCols.join(',')},${fatigue},${bottlenecks},${skipRate}\n`;
    }

    downloadCsv(csv, `vela-zone-utilization-${scenario?.meta.name ?? 'export'}.csv`);
  }, [kpiHistory, zones, scenario]);

  const handleExportVisitorSummary = useCallback(() => {
    const store = useStore.getState();
    const visitors = store.visitors;

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

    downloadCsv(csv, `vela-visitors-${scenario?.meta.name ?? 'export'}.csv`);
  }, [zones, scenario]);

  const handleExportMediaStats = useCallback(() => {
    const store = useStore.getState();
    const media = store.media;
    const stats = store.mediaStats;

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

    downloadCsv(csv, `vela-media-${scenario?.meta.name ?? 'export'}.csv`);
  }, [scenario]);

  if (kpiHistory.length < 2) return null;

  return (
    <div className="flex gap-1 flex-wrap">
      <button
        onClick={handleExportZoneUtilization}
        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-medium rounded-xl bg-secondary hover:bg-accent transition-colors"
      >
        <TableProperties className="w-3 h-3" /> Zone CSV
      </button>
      <button
        onClick={handleExportVisitorSummary}
        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-medium rounded-xl bg-secondary hover:bg-accent transition-colors"
      >
        <TableProperties className="w-3 h-3" /> Visitor CSV
      </button>
      <button
        onClick={handleExportMediaStats}
        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-medium rounded-xl bg-secondary hover:bg-accent transition-colors"
      >
        <TableProperties className="w-3 h-3" /> Media CSV
      </button>
    </div>
  );
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
