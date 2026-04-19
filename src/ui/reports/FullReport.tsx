import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  Legend,
  type ChartOptions,
} from 'chart.js';
import { useStore } from '@/stores';
import { generateInsights, extractKeyMoments } from '@/analytics';
import { INTERNATIONAL_DENSITY_STANDARD } from '@/domain';
import { useT } from '@/i18n';
import { exportElementToPdf } from './pdfExport';
import { FloorDensityGrid } from './FloorDensityGrid';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler, Legend);

export function FullReport({ onClose }: { onClose: () => void }) {
  const t = useT();
  const scenario = useStore((s) => s.scenario);
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const floors = useStore((s) => s.floors);
  const media = useStore((s) => s.media);
  const timeState = useStore((s) => s.timeState);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const kpiHistory = useStore((s) => s.kpiHistory);
  const mediaStats = useStore((s) => s.mediaStats);
  const groups = useStore((s) => s.groups);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const totalExited = useStore((s) => s.totalExited);

  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [heatmapImage, setHeatmapImage] = useState<string | null>(null);

  // Capture current canvas as heatmap snapshot when report opens.
  useEffect(() => {
    try {
      const canvas = document.querySelector('canvas');
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        setHeatmapImage(canvas.toDataURL('image/png'));
      }
    } catch {
      /* canvas may be tainted — skip */
    }
  }, []);

  const data = useMemo(() => {
    if (!scenario || !latestSnapshot) return null;

    const exited = visitors.filter((v) => !v.isActive);
    const active = visitors.filter((v) => v.isActive);
    const durationMs = timeState.elapsed;

    const avgDwellMs = exited.length > 0
      ? exited.reduce((s, v) => s + ((v.exitedAt ?? durationMs) - v.enteredAt), 0) / exited.length
      : 0;

    // Peak ratio uses peakOccupancy (running max from utilization.ts), not current ratio.
    // latestSnapshot.zoneUtilizations[i].ratio is the active-only current value — 0 at sim end.
    const peakRatioByZone = new Map<string, number>();
    for (const u of latestSnapshot.zoneUtilizations) {
      const cap = u.capacity > 0 ? u.capacity : 1;
      peakRatioByZone.set(u.zoneId as string, u.peakOccupancy / cap);
    }
    const peakUtilRatio = Math.max(0, ...peakRatioByZone.values());
    const peakZone = latestSnapshot.zoneUtilizations.reduce(
      (best, u) => {
        const r = (peakRatioByZone.get(u.zoneId as string) ?? 0);
        const bestR = best ? (peakRatioByZone.get(best.zoneId as string) ?? -1) : -1;
        return r > bestR ? u : best;
      },
      latestSnapshot.zoneUtilizations[0] ?? null,
    );
    const peakZoneName = peakZone
      ? zones.find((z) => z.id === peakZone.zoneId)?.name ?? '—'
      : '—';

    // Per-zone cumulative max bottleneck (kpiHistory entries are { timestamp, snapshot }).
    const peakBottleneckByZone = new Map<string, { score: number; avgQueueTime: number; flowInRate: number; flowOutRate: number; groupContribution: number; isGroupInduced: boolean }>();
    for (const entry of kpiHistory) {
      for (const b of entry.snapshot.bottlenecks) {
        const k = b.zoneId as string;
        const prev = peakBottleneckByZone.get(k);
        if (!prev || b.score > prev.score) peakBottleneckByZone.set(k, b);
      }
    }

    const zoneBreakdown = zones.map((z) => {
      const util = latestSnapshot.zoneUtilizations.find((u) => u.zoneId === z.id);
      const bn = peakBottleneckByZone.get(z.id as string);
      const visit = latestSnapshot.visitDurations.find((v) => v.zoneId === z.id);
      const currentActive = active.filter((v) => v.currentZoneId === z.id).length;
      const peak = util?.peakOccupancy ?? currentActive;
      const ratio = z.capacity > 0 ? peak / z.capacity : 0;  // peak ratio, not current
      const areaPerPerson = peak > 0 ? z.area / peak : z.area;
      let grade: 'A' | 'B' | 'C' | 'D' | 'F';
      if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 2) grade = 'A';
      else if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD) grade = 'B';
      else if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 0.7) grade = 'C';
      else if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 0.4) grade = 'D';
      else grade = 'F';
      return {
        id: z.id as string,
        name: z.name,
        color: z.color,
        type: z.type,
        area: z.area,
        capacity: z.capacity,
        currentActive,
        peak,
        ratio,
        areaPerPerson,
        grade,
        bottleneckScore: bn?.score ?? 0,
        avgQueueTimeMs: bn?.avgQueueTime ?? 0,
        flowInRate: bn?.flowInRate ?? 0,
        flowOutRate: bn?.flowOutRate ?? 0,
        groupContribution: bn?.groupContribution ?? 0,
        avgDwellMs: visit?.meanDurationMs ?? 0,
        medianDwellMs: visit?.medianDurationMs ?? 0,
        watchingCount: util?.watchingCount ?? 0,
        waitingCount: util?.waitingCount ?? 0,
      };
    });

    // Cumulative zone-visit distribution: how many visitors ever entered each zone.
    // Replaces "real-time active" donut which becomes empty/single-zone post-sim.
    const zoneVisitCount = new Map<string, number>();
    for (const v of visitors) {
      for (const zid of v.visitedZoneIds) {
        const k = zid as string;
        zoneVisitCount.set(k, (zoneVisitCount.get(k) ?? 0) + 1);
      }
    }
    const zoneDistribution = zoneBreakdown
      .map((z) => ({ id: z.id, name: z.name, color: z.color, count: zoneVisitCount.get(z.id) ?? 0 }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);

    const gradeDist: Record<'A' | 'B' | 'C' | 'D' | 'F', number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const z of zoneBreakdown) gradeDist[z.grade]++;

    const mediaPerf = media.map((m) => {
      const stat = mediaStats.get(m.id as string);
      const zone = zones.find((z) => z.id === m.zoneId);
      const watchCount = stat?.watchCount ?? 0;
      const skipCount = stat?.skipCount ?? 0;
      const waitCount = stat?.waitCount ?? 0;
      const totalApproaches = watchCount + skipCount;
      const engagementRate = totalApproaches > 0 ? watchCount / totalApproaches : 0;
      const avgWatchMs = watchCount > 0 ? (stat?.totalWatchMs ?? 0) / watchCount : 0;
      const avgWaitMs = waitCount > 0 ? (stat?.totalWaitMs ?? 0) / waitCount : 0;
      const peakViewers = stat?.peakViewers ?? 0;
      const utilRatio = m.capacity > 0 ? peakViewers / m.capacity : 0;
      return {
        id: m.id as string,
        name: m.name,
        type: m.type,
        interactionType: m.interactionType,
        zoneName: zone?.name ?? '—',
        zoneColor: zone?.color ?? '#94a3b8',
        capacity: m.capacity,
        watchCount,
        skipCount,
        waitCount,
        totalApproaches,
        engagementRate,
        avgWatchMs,
        avgWaitMs,
        peakViewers,
        utilRatio,
        totalWatchMs: stat?.totalWatchMs ?? 0,
      };
    });

    const totalWatches = mediaPerf.reduce((s, m) => s + m.watchCount, 0);
    const totalSkips = mediaPerf.reduce((s, m) => s + m.skipCount, 0);
    const totalWaits = mediaPerf.reduce((s, m) => s + m.waitCount, 0);
    const totalWatchMs = mediaPerf.reduce((s, m) => s + m.totalWatchMs, 0);
    const mediaEngagedCount = mediaPerf.filter((m) => m.watchCount > 0).length;

    const mediaRanked = [...mediaPerf].sort((a, b) => b.engagementRate - a.engagementRate);
    const topMedia = mediaRanked.filter((m) => m.totalApproaches >= 3).slice(0, 3);
    const bottomMedia = mediaRanked.filter((m) => m.totalApproaches >= 3).slice(-3).reverse();

    const catDist: Record<string, number> = {};
    for (const v of visitors) catDist[v.category] = (catDist[v.category] ?? 0) + 1;

    const completion = { zero: 0, low: 0, mid: 0, high: 0 };
    for (const v of exited) {
      const n = v.visitedZoneIds.length;
      if (n === 0) completion.zero++;
      else if (n <= 2) completion.low++;
      else if (n <= 4) completion.mid++;
      else completion.high++;
    }

    // Fatigue computed from full visitor list (active + exited keep their final fatigue value).
    // latestSnapshot.fatigueDistribution filters active-only and goes empty at sim end.
    const fatigueValues = visitors.map((v) => v.fatigue).sort((a, b) => a - b);
    const fN = fatigueValues.length;
    const avgFatigueCum = fN > 0 ? fatigueValues.reduce((s, f) => s + f, 0) / fN : 0;
    const medianFatigueCum = fN > 0 ? fatigueValues[Math.floor(fN / 2)] : 0;
    const p90FatigueCum = fN > 0 ? fatigueValues[Math.floor(fN * 0.9)] : 0;
    const p99FatigueCum = fN > 0 ? fatigueValues[Math.min(fN - 1, Math.floor(fN * 0.99))] : 0;
    const histogram = Array.from({ length: 10 }, (_, i) => {
      const rangeMin = i / 10;
      const rangeMax = (i + 1) / 10;
      const count = fatigueValues.filter((f) => f >= rangeMin && f < rangeMax).length;
      return { rangeMin, rangeMax, count };
    });
    const histMax = Math.max(1, ...histogram.map((b) => b.count));

    // Cumulative skip rate from mediaStats (totalSkips already summed above).
    const globalSkipRateCum = (totalWatches + totalSkips) > 0
      ? totalSkips / (totalWatches + totalSkips)
      : 0;

    // Cumulative completion / total time from full visitor list.
    const wellVisited = visitors.filter((v) => v.visitedZoneIds.length >= 3).length;
    const completionRateCum = visitors.length > 0 ? wellVisited / visitors.length : 0;
    let totalTimeSum = 0;
    let totalTimeCount = 0;
    for (const v of exited) {
      if (v.exitedAt != null && v.enteredAt > 0) {
        totalTimeSum += v.exitedAt - v.enteredAt;
        totalTimeCount++;
      }
    }
    const averageTotalTimeMsCum = totalTimeCount > 0 ? totalTimeSum / totalTimeCount : avgDwellMs;
    const minutesElapsed = durationMs / 60000;
    const throughputPerMinuteCum = minutesElapsed > 0 ? totalExited / minutesElapsed : 0;

    const insights = generateInsights(latestSnapshot, zones, media, mediaStats, visitors, groups, t);
    const criticalInsights = insights.filter((i) => i.severity === 'critical');
    const warningInsights = insights.filter((i) => i.severity === 'warning');

    // Bottleneck count = zones that ever crossed score>0.5 anywhere in kpiHistory.
    const everBottlenecked = new Set<string>();
    const everGroupInduced = new Set<string>();
    for (const entry of kpiHistory) {
      for (const b of entry.snapshot.bottlenecks) {
        if (b.score > 0.5) everBottlenecked.add(b.zoneId as string);
        if (b.isGroupInduced) everGroupInduced.add(b.zoneId as string);
      }
    }
    const totalBottlenecks = everBottlenecked.size;
    const groupInducedBottlenecks = everGroupInduced.size;

    // Key narrative moments for spatial heatmap section.
    const keyMoments = extractKeyMoments(kpiHistory);

    return {
      totalVisitors: visitors.length,
      activeVisitors: active.length,
      exitedVisitors: exited.length,
      totalGroups: groups.length,
      durationMs,
      avgDwellMs,
      peakUtilRatio,
      peakZoneName,
      peakZoneRatio: peakZone ? (peakRatioByZone.get(peakZone.zoneId as string) ?? 0) : 0,
      avgFatigue: avgFatigueCum,
      medianFatigue: medianFatigueCum,
      p90Fatigue: p90FatigueCum,
      p99Fatigue: p99FatigueCum,
      globalSkipRate: globalSkipRateCum,
      bottleneckCount: totalBottlenecks,
      groupInducedBottlenecks,
      completionRate: completionRateCum,
      throughputPerMinute: throughputPerMinuteCum,
      averageTotalTimeMs: averageTotalTimeMsCum,
      zoneBreakdown,
      zoneDistribution,
      gradeDist,
      mediaPerf,
      topMedia,
      bottomMedia,
      totalWatches,
      totalSkips,
      totalWaits,
      totalWatchMs,
      mediaEngagedCount,
      catDist,
      completion,
      insights,
      criticalInsights,
      warningInsights,
      histogram,
      histMax,
      keyMoments,
    };
  }, [scenario, visitors, zones, media, timeState, latestSnapshot, kpiHistory, mediaStats, groups, totalExited, t]);

  const handleExport = useCallback(async () => {
    if (!reportRef.current || !scenario) return;
    setExporting(true);
    try {
      const safeName = scenario.meta.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
      const dateStr = new Date().toISOString().slice(0, 10);
      await exportElementToPdf(reportRef.current, `vela-report-${safeName}-${dateStr}.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
      alert('PDF export failed. See console for details.');
    } finally {
      setExporting(false);
    }
  }, [scenario]);

  const hasSimData = totalSpawned > 0 || visitors.length > 0;

  if (!scenario) {
    return (
      <Overlay onClose={onClose}>
        <div className="bg-white text-slate-900 p-12 text-center">
          <p className="text-sm text-slate-500">시나리오를 먼저 로드해주세요.</p>
        </div>
      </Overlay>
    );
  }

  if (!data || !hasSimData) {
    return (
      <Overlay onClose={onClose}>
        <div className="bg-white text-slate-900 p-16 text-center max-w-md mx-auto my-20 rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto mb-4 flex items-center justify-center">
            <X className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-base font-semibold mb-2 text-slate-900">시뮬레이션 데이터 없음</p>
          <p className="text-sm text-slate-500 leading-relaxed">
            이 시나리오에서는 아직 시뮬레이션이 실행되지 않았습니다.<br />
            ▶ 시뮬레이션을 실행한 후 다시 열어주세요.
          </p>
        </div>
      </Overlay>
    );
  }

  const durationMin = Math.floor(data.durationMs / 60000);
  const durationSec = Math.floor((data.durationMs % 60000) / 1000);
  const generatedDate = new Date().toISOString().slice(0, 10);
  const generatedTime = new Date().toTimeString().slice(0, 5);

  return (
    <Overlay onClose={onClose}>
      {/* Floating toolbar */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          <span className="font-semibold text-slate-900">{scenario.meta.name}</span>
          <span className="mx-2">·</span>
          <span>{generatedDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? '생성 중…' : 'PDF 다운로드'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF-captured content */}
      <div ref={reportRef} className="bg-white text-slate-900">
        {/* ===== Cover ===== */}
        <header className="px-14 pt-14 pb-10 border-b border-slate-200">
          <p className="text-[10px] uppercase tracking-[0.24em] text-blue-600 font-semibold mb-4">
            VELA · Spatial Simulation Report
          </p>
          <h1 className="text-4xl font-bold tracking-tight mb-3 text-slate-900">
            {scenario.meta.name}
          </h1>
          <p className="text-sm text-slate-500 mb-8">
            전시관 관람객 동선 · 체험 품질 · 콘텐츠 운영 분석 보고서
          </p>
          <div className="grid grid-cols-4 gap-6">
            <HeaderMeta label="Generated" value={`${generatedDate} ${generatedTime}`} />
            <HeaderMeta label="Duration" value={`${durationMin}m ${durationSec}s`} />
            <HeaderMeta label="Visitors" value={`${data.totalVisitors}`} />
            <HeaderMeta label="Version" value={`v${scenario.meta.version}`} />
          </div>
        </header>

        {/* ===== Section 1 — Executive Summary ===== */}
        <section className="px-14 py-12">
          <SectionHeader no="01" label="Executive Summary" title="핵심 요약" />

          {/* KPI grid — simulation-complete modal style */}
          <div className="mt-10 grid grid-cols-4 gap-x-2 gap-y-8 py-6 border-y border-slate-200">
            <KpiStat label="총 관람객" value={`${data.totalVisitors}`} sub={`활동 ${data.activeVisitors} · 퇴장 ${data.exitedVisitors}`} />
            <KpiStat
              label="최대 혼잡도"
              value={`${Math.round(data.peakUtilRatio * 100)}%`}
              sub={data.peakZoneName}
              tone={data.peakUtilRatio > 1 ? 'danger' : data.peakUtilRatio > 0.8 ? 'warning' : 'default'}
            />
            <KpiStat
              label="평균 체류"
              value={`${(data.avgDwellMs / 60000).toFixed(1)}m`}
              sub={`완료율 ${Math.round(data.completionRate * 100)}%`}
            />
            <KpiStat
              label="평균 피로도"
              value={`${Math.round(data.avgFatigue * 100)}%`}
              sub={`P90 ${Math.round(data.p90Fatigue * 100)}%`}
              tone={data.avgFatigue > 0.6 ? 'warning' : 'default'}
            />
            <KpiStat
              label="글로벌 Skip율"
              value={`${Math.round(data.globalSkipRate * 100)}%`}
              sub={`관람 ${data.totalWatches} · 스킵 ${data.totalSkips}`}
              tone={data.globalSkipRate > 0.3 ? 'warning' : 'default'}
            />
            <KpiStat
              label="병목 지점"
              value={`${data.bottleneckCount}`}
              sub={`그룹 유발 ${data.groupInducedBottlenecks}`}
              tone={data.bottleneckCount > 2 ? 'danger' : data.bottleneckCount > 0 ? 'warning' : 'default'}
            />
            <KpiStat
              label="처리량"
              value={`${data.throughputPerMinute.toFixed(1)}`}
              sub="명/분"
            />
            <KpiStat
              label="미디어 활성률"
              value={`${media.length > 0 ? Math.round((data.mediaEngagedCount / media.length) * 100) : 0}%`}
              sub={`${data.mediaEngagedCount}/${media.length} 사용`}
              tone={media.length > 0 && data.mediaEngagedCount / media.length < 0.5 ? 'warning' : 'default'}
            />
          </div>

          {/* 핵심 결과 요약 */}
          <div className="mt-12">
            <SubHeader>핵심 결과 요약</SubHeader>
            <div className="mt-4 grid grid-cols-2 gap-x-10 gap-y-2.5 text-sm text-slate-700">
              <Finding metric="Peak 혼잡" body={`${data.peakZoneName}에서 정원 대비 ${Math.round(data.peakZoneRatio * 100)}% 도달`} />
              <Finding metric="공간 등급" body={`A ${data.gradeDist.A} · B ${data.gradeDist.B} · C ${data.gradeDist.C} · D ${data.gradeDist.D} · F ${data.gradeDist.F}`} />
              <Finding metric="콘텐츠 노출" body={`총 ${data.totalWatches}회 관람 · 평균 ${(data.totalWatchMs / 60000 / Math.max(1, data.totalWatches)).toFixed(1)}분 시청`} />
              <Finding metric="대기 현황" body={`대기 이벤트 ${data.totalWaits}회 · 그룹 ${data.totalGroups}팀`} />
              <Finding metric="피로도 분포" body={`평균 ${Math.round(data.avgFatigue * 100)}% · 중앙값 ${Math.round(data.medianFatigue * 100)}% · P99 ${Math.round(data.p99Fatigue * 100)}%`} />
              <Finding metric="동선 완주도" body={`≥3존 방문 ${data.completion.mid + data.completion.high}명 · ≤2존 이탈 ${data.completion.zero + data.completion.low}명`} />
            </div>
          </div>

          {/* 주요 문제 */}
          <div className="mt-10">
            <SubHeader>주요 문제</SubHeader>
            {(data.criticalInsights.length + data.warningInsights.length) > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[...data.criticalInsights, ...data.warningInsights].slice(0, 3).map((ins, i) => (
                  <IssueCard key={i} index={i + 1} severity={ins.severity} title={ins.problem} body={ins.cause} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">치명적 문제가 감지되지 않았습니다.</p>
            )}
          </div>

          {/* 핵심 개선 방향 */}
          <div className="mt-10">
            <SubHeader>핵심 개선 방향</SubHeader>
            {data.insights.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {data.insights.slice(0, 3).map((ins, i) => (
                  <ActionCard key={i} index={i + 1} title={categoryLabel(ins.category)} body={ins.recommendation} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">현재 설정 유지 권장.</p>
            )}
          </div>
        </section>

        {/* ===== Section 2 — Spatial Density ===== */}
        <section className="px-14 py-12 border-t border-slate-200">
          <SectionHeader no="02" label="Spatial Density" title="핵심 순간별 층 밀도" />
          <p className="text-sm text-slate-500 mt-4 mb-6">
            시뮬레이션 진행 중 의미 있는 시점({data.keyMoments.length}개)을 자동 추출해, 각 시점의 층별 존 밀도를 비교합니다.
            각 셀은 정원 대비 점유율(%)이며, 색이 붉을수록 과밀입니다.
          </p>
          {data.keyMoments.length > 0 ? (
            <div className="space-y-8">
              {data.keyMoments.map((m) => (
                <div key={`${m.kind}-${m.entryIndex}`}>
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-blue-600">{m.label}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{formatTimeMs(m.timestampMs)}</span>
                    <span className="text-xs text-slate-700 flex-1">{m.caption}</span>
                  </div>
                  <FloorDensityGrid
                    floors={floors}
                    zones={zones}
                    snapshot={kpiHistory[m.entryIndex].snapshot}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
              <p className="text-sm text-slate-500">시계열 데이터가 충분하지 않습니다.</p>
            </div>
          )}
          {heatmapImage && (
            <div className="mt-8">
              <SubHeader>참고: 종료 시점 누적 히트맵</SubHeader>
              <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <img src={heatmapImage} alt="Heatmap snapshot" className="w-full h-auto block" />
              </div>
            </div>
          )}
          <div className="mt-6 flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(96,165,250,0.30)' }} /> &lt;30%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(250,204,21,0.45)' }} /> 30–60%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(251,146,60,0.55)' }} /> 60–85%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(248,113,113,0.65)' }} /> 85–100%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(220,38,38,0.80)' }} /> 정원 초과</span>
          </div>
        </section>

        {/* ===== Section 3 — Timeline ===== */}
        <section className="px-14 py-12 border-t border-slate-200 bg-slate-50/60">
          <SectionHeader no="03" label="Timeline" title="시간대별 변화 추이" />
          <p className="text-sm text-slate-500 mt-4 mb-6">
            시뮬레이션 경과에 따른 최대 혼잡도 · 평균 피로도 · 활성 관람객 수 변화. 언제 병목이 발생했고, 어느 구간에서 경험 품질이 꺾였는지 확인합니다.
          </p>
          {kpiHistory.length >= 3 ? (
            <>
              <TimelineChart history={kpiHistory} keyMoments={data.keyMoments} />
              <div className="mt-10">
                <SubHeader>존별 점유 추이 (Stacked)</SubHeader>
                <p className="text-sm text-slate-500 mt-2 mb-4">
                  각 존이 동시에 얼마나 채워졌는지 누적 영역으로 비교합니다. 특정 시점에 어느 존이 부담을 떠안고 있었는지 한눈에 확인합니다.
                </p>
                <ZoneOccupancyTimeline history={kpiHistory} zones={zones} keyMoments={data.keyMoments} />
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-sm text-slate-500">
                시계열 데이터가 충분하지 않습니다. (샘플 {kpiHistory.length}개 — 최소 3개 필요)<br />
                <span className="text-[11px]">시뮬레이션을 30초 이상 실행한 후 다시 열어주세요.</span>
              </p>
            </div>
          )}
        </section>

        {/* ===== Section 4 — System Overview ===== */}
        <section className="px-14 py-12 border-t border-slate-200 bg-white">
          <SectionHeader no="04" label="System Overview" title="공간 구성 및 분포" />

          <div className="grid grid-cols-5 gap-10 mt-10">
            <div className="col-span-2">
              <SubHeader>존별 누적 방문 분포</SubHeader>
              <div className="mt-4"><ZoneDonut data={data.zoneDistribution} /></div>
              <p className="text-xs text-slate-500 mt-4 text-center">
                방문된 존 {data.zoneDistribution.length}개 · 누적 방문 {data.zoneDistribution.reduce((s, z) => s + z.count, 0)}회
              </p>
            </div>

            <div className="col-span-3">
              <SubHeader>구성 요약</SubHeader>
              <table className="w-full text-sm mt-3">
                <tbody className="divide-y divide-slate-200">
                  <MetaRow label="존 수" value={`${zones.length}개`} />
                  <MetaRow label="미디어 수" value={`${media.length}개`} />
                  <MetaRow label="총 면적" value={`${zones.reduce((s, z) => s + z.area, 0).toFixed(1)} m²`} />
                  <MetaRow label="정원 합계" value={`${zones.reduce((s, z) => s + z.capacity, 0)}명`} />
                  <MetaRow label="미디어 총정원" value={`${media.reduce((s, m) => s + m.capacity, 0)}명`} />
                  <MetaRow label="평균 혼잡 (실시간)" value={`${Math.round((data.zoneBreakdown.reduce((s, z) => s + z.ratio, 0) / Math.max(1, data.zoneBreakdown.length)) * 100)}%`} />
                  <MetaRow label="이동 시간 평균" value={`${(data.averageTotalTimeMs / 60000).toFixed(1)}분`} />
                  <MetaRow label="분당 처리량" value={`${data.throughputPerMinute.toFixed(1)}명/분`} />
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-12">
            <SubHeader>존별 상세</SubHeader>
            <table className="w-full text-sm mt-4 table-fixed">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-2 text-left font-semibold w-[24%]">Zone</th>
                  <th className="py-3 px-2 text-right font-semibold w-[12%] whitespace-nowrap">면적/정원</th>
                  <th className="py-3 px-2 text-right font-semibold w-[11%] whitespace-nowrap">Peak</th>
                  <th className="py-3 px-2 text-right font-semibold w-[11%]">Util.</th>
                  <th className="py-3 px-2 text-right font-semibold w-[10%] whitespace-nowrap">m²/인</th>
                  <th className="py-3 px-2 text-right font-semibold w-[11%] whitespace-nowrap">평균 체류</th>
                  <th className="py-3 px-2 text-right font-semibold w-[10%] whitespace-nowrap">병목</th>
                  <th className="py-3 px-2 text-right font-semibold w-[11%]">등급</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.zoneBreakdown.map((z) => (
                  <tr key={z.id}>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: z.color }} />
                        <div className="min-w-0">
                          <div className="text-slate-900 font-medium truncate">{z.name}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{z.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right text-slate-700 tabular-nums whitespace-nowrap">
                      {z.area.toFixed(0)}<span className="text-slate-500">m²</span>
                      <div className="text-[10px] text-slate-500">정원 {z.capacity}</div>
                    </td>
                    <td className="py-3 px-2 text-right text-slate-900 tabular-nums font-semibold whitespace-nowrap">{z.peak}</td>
                    <td className={`py-3 px-2 text-right tabular-nums font-semibold whitespace-nowrap ${
                      z.ratio > 1 ? 'text-red-600'
                      : z.ratio > 0.8 ? 'text-amber-600'
                      : 'text-slate-700'
                    }`}>{Math.round(z.ratio * 100)}%</td>
                    <td className="py-3 px-2 text-right text-slate-700 tabular-nums whitespace-nowrap">{z.areaPerPerson.toFixed(1)}</td>
                    <td className="py-3 px-2 text-right text-slate-700 tabular-nums whitespace-nowrap">{(z.avgDwellMs / 60000).toFixed(1)}m</td>
                    <td className={`py-3 px-2 text-right tabular-nums whitespace-nowrap ${
                      z.bottleneckScore > 0.7 ? 'text-red-600 font-semibold'
                      : z.bottleneckScore > 0.5 ? 'text-amber-600'
                      : 'text-slate-400'
                    }`}>{z.bottleneckScore > 0 ? z.bottleneckScore.toFixed(2) : '—'}</td>
                    <td className="py-3 px-2 text-right"><GradeBadge grade={z.grade} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 p-5 rounded-xl bg-slate-50 border border-slate-200">
            <SubHeader>해석</SubHeader>
            <p className="text-sm text-slate-700 mt-3 leading-relaxed">
              {data.peakUtilRatio > 1
                ? <><b className="text-slate-900">시스템이 설계 정원을 초과했습니다.</b> {data.peakZoneName}에서 정원 대비 {Math.round(data.peakZoneRatio * 100)}%에 도달해, 일시적 이벤트가 아닌 구조적 과밀이 관측되었습니다. 안전 한계(국제 기준 {INTERNATIONAL_DENSITY_STANDARD}m²/인)를 넘는 존이 {data.gradeDist.D + data.gradeDist.F}개로, 체험 품질 저하와 이탈 리스크가 동시에 높아집니다.</>
                : data.peakUtilRatio > 0.8
                  ? <><b className="text-slate-900">시스템은 정원에 근접합니다.</b> {data.peakZoneName}가 {Math.round(data.peakZoneRatio * 100)}%로 피크를 찍어 한계선에 머물러 있습니다. 관람객 유입이 10~20%만 늘어도 과밀로 전환될 수 있어, 흐름 제어(Guided Until, Spawn Rate)의 조정이 필요합니다.</>
                  : <><b className="text-slate-900">시스템에 여유가 있습니다.</b> 피크 {Math.round(data.peakUtilRatio * 100)}%로 설계 정원을 여유롭게 소화하고 있어, 추가 콘텐츠 배치나 체류시간 강화가 가능합니다.</>}
            </p>
            {data.gradeDist.F > 0 && (
              <p className="text-sm text-slate-700 mt-3 leading-relaxed">
                공간 등급 F(위험)에 해당하는 존이 <b className="text-red-600">{data.gradeDist.F}개</b> 있어 우선 개입이 필요합니다.
              </p>
            )}
          </div>
        </section>

        {/* ===== Section 3 — Flow Analysis ===== */}
        <section className="px-14 py-12 border-t border-slate-200">
          <SectionHeader no="05" label="Flow Analysis" title="동선 및 병목 분석" />

          <div className="grid grid-cols-2 gap-10 mt-10">
            <div>
              <SubHeader>동선 효율 KPI</SubHeader>
              <table className="w-full text-sm mt-3">
                <tbody className="divide-y divide-slate-200">
                  <MetaRow label="총 완료 관람객" value={`${latestSnapshot!.flowEfficiency.totalVisitorsProcessed}`} />
                  <MetaRow label="평균 전체 소요시간" value={`${(data.averageTotalTimeMs / 60000).toFixed(2)}분`} />
                  <MetaRow label="분당 처리량" value={`${data.throughputPerMinute.toFixed(2)}명/분`} />
                  <MetaRow label="완료율 (≥3존)" value={`${Math.round(data.completionRate * 100)}%`} />
                  <MetaRow label="이탈률 (≤2존)" value={`${data.exitedVisitors > 0 ? Math.round(((data.completion.zero + data.completion.low) / data.exitedVisitors) * 100) : 0}%`} />
                  <MetaRow label="그룹 유발 병목 비율" value={`${data.bottleneckCount > 0 ? Math.round((data.groupInducedBottlenecks / data.bottleneckCount) * 100) : 0}%`} />
                </tbody>
              </table>
            </div>
            <div>
              <SubHeader>완주도 분포</SubHeader>
              <div className="mt-3 space-y-3">
                <CompletionBar label="0 zones (즉시 이탈)" count={data.completion.zero} total={data.exitedVisitors} color="#ef4444" />
                <CompletionBar label="1–2 zones (조기 이탈)" count={data.completion.low} total={data.exitedVisitors} color="#f59e0b" />
                <CompletionBar label="3–4 zones (중간)" count={data.completion.mid} total={data.exitedVisitors} color="#3b82f6" />
                <CompletionBar label="5+ zones (완주)" count={data.completion.high} total={data.exitedVisitors} color="#10b981" />
              </div>
            </div>
          </div>

          <div className="mt-12">
            <SubHeader>병목 지점 상세</SubHeader>
            {latestSnapshot!.bottlenecks.filter((b) => b.score > 0.3).length > 0 ? (
              <table className="w-full text-sm mt-4 table-fixed">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-2 text-left font-semibold w-[22%]">Zone</th>
                    <th className="py-3 px-2 text-right font-semibold w-[11%]">Score</th>
                    <th className="py-3 px-2 text-right font-semibold w-[12%] whitespace-nowrap">평균 대기</th>
                    <th className="py-3 px-2 text-right font-semibold w-[14%] whitespace-nowrap">유입/유출</th>
                    <th className="py-3 px-2 text-right font-semibold w-[12%] whitespace-nowrap">Δ Flow</th>
                    <th className="py-3 px-2 text-right font-semibold w-[14%] whitespace-nowrap">그룹 기여</th>
                    <th className="py-3 px-2 text-right font-semibold w-[15%]">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {latestSnapshot!.bottlenecks
                    .filter((b) => b.score > 0.3)
                    .slice()
                    .sort((a, b) => b.score - a.score)
                    .map((b) => {
                      const zone = zones.find((z) => z.id === b.zoneId);
                      const flowDelta = b.flowInRate - b.flowOutRate;
                      return (
                        <tr key={b.zoneId as string}>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: zone?.color ?? '#94a3b8' }} />
                              <span className="text-slate-900 font-medium truncate">{zone?.name ?? '—'}</span>
                            </div>
                          </td>
                          <td className={`py-3 px-2 text-right tabular-nums font-semibold whitespace-nowrap ${
                            b.score > 0.7 ? 'text-red-600' : b.score > 0.5 ? 'text-amber-600' : 'text-slate-700'
                          }`}>{b.score.toFixed(2)}</td>
                          <td className="py-3 px-2 text-right text-slate-700 tabular-nums whitespace-nowrap">{(b.avgQueueTime / 1000).toFixed(1)}s</td>
                          <td className="py-3 px-2 text-right text-slate-700 tabular-nums whitespace-nowrap text-xs">
                            {b.flowInRate.toFixed(2)}<span className="text-slate-500">/</span>{b.flowOutRate.toFixed(2)}
                          </td>
                          <td className={`py-3 px-2 text-right tabular-nums whitespace-nowrap ${flowDelta > 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                            {flowDelta > 0 ? '+' : ''}{flowDelta.toFixed(2)}
                          </td>
                          <td className="py-3 px-2 text-right text-slate-700 tabular-nums whitespace-nowrap">{Math.round(b.groupContribution * 100)}%</td>
                          <td className="py-3 px-2 text-right text-xs whitespace-nowrap">
                            {b.isGroupInduced
                              ? <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">GROUP</span>
                              : <span className="text-slate-400">SOLO</span>}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : (
              <p className="mt-3 text-sm text-slate-500">유의미한 병목이 감지되지 않았습니다.</p>
            )}
          </div>
        </section>

        {/* ===== Section 4 — Behavior Analysis ===== */}
        <section className="px-14 py-12 border-t border-slate-200 bg-slate-50/60">
          <SectionHeader no="06" label="Behavior Analysis" title="관람객 행동 분석" />

          <div className="grid grid-cols-2 gap-10 mt-10">
            <div>
              <SubHeader>피로도 분포</SubHeader>
              <div className="mt-4 rounded-xl bg-white border border-slate-200 p-5">
                <div className="flex items-end gap-1 h-32">
                  {data.histogram.map((bucket, i) => {
                    const h = (bucket.count / data.histMax) * 100;
                    const midFatigue = (bucket.rangeMin + bucket.rangeMax) / 2;
                    const color = midFatigue > 0.7 ? '#f87171' : midFatigue > 0.4 ? '#fbbf24' : '#34d399';
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="flex-1 w-full flex items-end">
                          <div className="w-full rounded-t transition-all"
                            style={{ height: `${h}%`, backgroundColor: color, minHeight: bucket.count > 0 ? '2px' : 0 }} />
                        </div>
                        <span className="text-[9px] text-slate-400 tabular-nums">{Math.round(bucket.rangeMin * 100)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-3 tabular-nums">
                  <span>평균 {Math.round(data.avgFatigue * 100)}%</span>
                  <span>중앙값 {Math.round(latestSnapshot!.fatigueDistribution.median * 100)}%</span>
                  <span>P90 {Math.round(data.p90Fatigue * 100)}%</span>
                  <span>P99 {Math.round(data.p99Fatigue * 100)}%</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                P90가 80%를 넘으면 후반부 존의 체험 품질이 구조적으로 훼손됩니다.
              </p>
            </div>

            <div>
              <SubHeader>관람객 구성</SubHeader>
              <div className="mt-4 space-y-2.5">
                {Object.entries(data.catDist).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <CategoryBar key={cat} label={categoryLabelKo(cat)} count={count} total={data.totalVisitors} />
                ))}
              </div>
              <div className="mt-5 p-4 rounded-lg bg-white border border-slate-200">
                <p className="text-xs text-slate-700 leading-relaxed">
                  <b className="text-slate-900">그룹 관람객 {data.totalGroups}팀</b>이 전체 동선에 영향을 미치며, 병목 중 {data.bottleneckCount > 0 ? Math.round((data.groupInducedBottlenecks / data.bottleneckCount) * 100) : 0}%가 그룹에 의해 유발되었습니다.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <SubHeader>존별 평균 체류시간</SubHeader>
            <div className="mt-4 space-y-2">
              {data.zoneBreakdown
                .filter((z) => z.avgDwellMs > 0)
                .sort((a, b) => b.avgDwellMs - a.avgDwellMs)
                .map((z) => {
                  const maxDwell = Math.max(1, ...data.zoneBreakdown.map((zz) => zz.avgDwellMs));
                  const w = (z.avgDwellMs / maxDwell) * 100;
                  return (
                    <div key={z.id} className="flex items-center gap-3 text-xs">
                      <div className="w-32 truncate text-slate-700 font-medium">{z.name}</div>
                      <div className="flex-1 h-5 rounded bg-white border border-slate-200 overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${w}%`, backgroundColor: z.color }} />
                      </div>
                      <div className="w-28 text-right text-slate-500 tabular-nums">
                        {(z.avgDwellMs / 60000).toFixed(1)}m · n={latestSnapshot!.visitDurations.find((v) => v.zoneId === z.id)?.sampleCount ?? 0}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </section>

        {/* ===== Section 5 — Media Experience ===== */}
        <section className="px-14 py-12 border-t border-slate-200">
          <SectionHeader no="07" label="Media Experience" title="⭐ 미디어 체험 분석" />

          <div className="mt-10">
            <h3 className="text-xl font-semibold text-slate-900 mb-1">7.1 콘텐츠 성과</h3>
            <p className="text-sm text-slate-500 mb-6">접근 → 관람/Skip 비율, 평균 관람시간, 대기 이벤트</p>

            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-2 text-left font-semibold w-[22%]">Media</th>
                  <th className="py-3 px-2 text-left font-semibold w-[14%]">Zone</th>
                  <th className="py-3 px-2 text-right font-semibold w-[11%] whitespace-nowrap">Peak/정원</th>
                  <th className="py-3 px-2 text-right font-semibold w-[9%]">Util.</th>
                  <th className="py-3 px-2 text-right font-semibold w-[12%] whitespace-nowrap">관람/Skip</th>
                  <th className="py-3 px-2 text-right font-semibold w-[10%]">참여율</th>
                  <th className="py-3 px-2 text-right font-semibold w-[11%] whitespace-nowrap">Avg 관람</th>
                  <th className="py-3 px-2 text-right font-semibold w-[11%] whitespace-nowrap">Avg 대기</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.mediaPerf.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 px-2 text-slate-900 font-medium truncate">
                      <div className="truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-500 uppercase mt-0.5">{m.interactionType}</div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: m.zoneColor }} />
                        <span className="text-slate-500 text-xs truncate">{m.zoneName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right text-slate-900 tabular-nums font-semibold whitespace-nowrap">
                      {m.peakViewers}<span className="text-slate-500 font-normal">/{m.capacity}</span>
                    </td>
                    <td className={`py-3 px-2 text-right tabular-nums whitespace-nowrap ${
                      m.utilRatio > 1 ? 'text-red-600 font-semibold'
                      : m.utilRatio > 0.8 ? 'text-amber-600'
                      : m.utilRatio > 0.3 ? 'text-slate-700'
                      : 'text-slate-400'
                    }`}>{Math.round(m.utilRatio * 100)}%</td>
                    <td className="py-3 px-2 text-right tabular-nums whitespace-nowrap">
                      <span className="text-emerald-600 font-semibold">{m.watchCount}</span>
                      <span className="text-slate-500">/</span>
                      <span className={m.skipCount > m.watchCount && m.totalApproaches > 2 ? 'text-red-600 font-semibold' : 'text-slate-700'}>{m.skipCount}</span>
                    </td>
                    <td className={`py-3 px-2 text-right tabular-nums font-semibold whitespace-nowrap ${
                      m.totalApproaches === 0 ? 'text-slate-300'
                      : m.engagementRate > 0.8 ? 'text-emerald-600'
                      : m.engagementRate > 0.5 ? 'text-blue-600'
                      : m.engagementRate > 0.3 ? 'text-amber-600'
                      : 'text-red-600'
                    }`}>{m.totalApproaches > 0 ? `${Math.round(m.engagementRate * 100)}%` : '—'}</td>
                    <td className="py-3 px-2 text-right text-slate-700 tabular-nums whitespace-nowrap">{m.avgWatchMs > 0 ? `${(m.avgWatchMs / 1000).toFixed(0)}s` : '—'}</td>
                    <td className="py-3 px-2 text-right text-slate-700 tabular-nums whitespace-nowrap">{m.avgWaitMs > 0 ? `${(m.avgWaitMs / 1000).toFixed(0)}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12">
            <SubHeader>미디어 정원 활용률</SubHeader>
            <p className="text-xs text-slate-500 mt-1.5 mb-4">Peak 관람자 ÷ 설계 정원.</p>
            <div className="grid grid-cols-2 gap-x-10 gap-y-2">
              {data.mediaPerf.slice().sort((a, b) => b.utilRatio - a.utilRatio).map((m) => (
                <div key={m.id} className="flex items-center gap-3 text-xs">
                  <div className="w-36 truncate text-slate-700 font-medium">{m.name}</div>
                  <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden relative">
                    <div className={`h-full transition-all ${
                      m.utilRatio > 1 ? 'bg-red-500'
                      : m.utilRatio > 0.8 ? 'bg-amber-500'
                      : m.utilRatio > 0.3 ? 'bg-blue-600'
                      : 'bg-slate-300'
                    }`} style={{ width: `${Math.min(100, m.utilRatio * 100)}%` }} />
                    {m.utilRatio > 1 && (
                      <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-semibold">OVER</div>
                    )}
                  </div>
                  <div className="w-16 text-right text-slate-700 tabular-nums">{Math.round(m.utilRatio * 100)}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14">
            <h3 className="text-xl font-semibold text-slate-900 mb-1">7.2 핵심 인사이트</h3>
            <p className="text-sm text-slate-500 mb-6">성과 편차, 최고/최저 콘텐츠, 체험 균형</p>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold uppercase tracking-wider">Top</span>
                  <span className="text-sm font-semibold text-slate-900">참여율 상위</span>
                </div>
                {data.topMedia.length > 0 ? (
                  <div className="space-y-2">
                    {data.topMedia.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{m.zoneName} · {m.interactionType} · 관람 {m.watchCount}회</p>
                        </div>
                        <span className="text-lg font-bold text-emerald-600 tabular-nums ml-3">{Math.round(m.engagementRate * 100)}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">충분한 샘플이 없습니다 (≥3회 접근).</p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold uppercase tracking-wider">Low</span>
                  <span className="text-sm font-semibold text-slate-900">참여율 하위 / 개선 필요</span>
                </div>
                {data.bottomMedia.length > 0 ? (
                  <div className="space-y-2">
                    {data.bottomMedia.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{m.zoneName} · Skip {m.skipCount}회 / 관람 {m.watchCount}회</p>
                        </div>
                        <span className="text-lg font-bold text-red-600 tabular-nums ml-3">{Math.round(m.engagementRate * 100)}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">충분한 샘플이 없습니다.</p>
                )}
              </div>
            </div>

            <div className="mt-10 p-5 rounded-xl bg-slate-50 border border-slate-200">
              <SubHeader>콘텐츠 운영 요약</SubHeader>
              <div className="mt-4 grid grid-cols-4 gap-5">
                <SmallStat label="총 관람" value={`${data.totalWatches}`} sub="회" />
                <SmallStat label="총 Skip" value={`${data.totalSkips}`} sub="회" tone={data.totalSkips > data.totalWatches ? 'danger' : 'default'} />
                <SmallStat label="총 관람시간" value={`${Math.round(data.totalWatchMs / 60000)}`} sub="분" />
                <SmallStat label="콘텐츠 활성률" value={`${media.length > 0 ? Math.round((data.mediaEngagedCount / media.length) * 100) : 0}%`} sub={`${data.mediaEngagedCount}/${media.length}`} />
              </div>
              <p className="text-xs text-slate-700 mt-5 leading-relaxed">
                {data.mediaEngagedCount < media.length * 0.7
                  ? <><b className="text-slate-900">{media.length - data.mediaEngagedCount}개의 미디어가 사용되지 않았습니다.</b> 위치 재배치 또는 관심도 조정을 검토하세요.</>
                  : <>대부분의 미디어가 활성화되어 콘텐츠 분포가 건강한 상태입니다.</>}
              </p>
            </div>
          </div>
        </section>

        {/* ===== Section 6 — Recommendations ===== */}
        <section className="px-14 py-12 border-t border-slate-200 bg-slate-50/60">
          <SectionHeader no="08" label="Recommendations" title="개선 권장 사항" />
          {data.insights.length > 0 ? (
            <div className="mt-10 space-y-4">
              {data.insights.map((ins, i) => <InsightRow key={i} index={i + 1} insight={ins} />)}
            </div>
          ) : (
            <div className="mt-10 p-8 text-center rounded-xl bg-white border border-slate-200">
              <p className="text-sm text-slate-500">현재 시뮬레이션 결과에서 유의미한 개선 항목이 감지되지 않았습니다.</p>
            </div>
          )}
        </section>

        {/* ===== Section 7 — Key Insight ===== */}
        <section className="px-14 py-14 border-t border-slate-200">
          <div className="rounded-2xl p-10 border border-blue-200 bg-blue-50">
            <p className="text-[10px] uppercase tracking-[0.24em] text-blue-600 font-semibold mb-4">Key Insight</p>
            <h2 className="text-3xl font-bold leading-tight mb-5 text-slate-900">
              "사람 분산이 아니라 체험 분산이 해답입니다."
            </h2>
            <p className="text-sm leading-relaxed text-slate-700 max-w-2xl">
              본 시뮬레이션은 단순 관람객 수용 능력을 넘어, 각 존과 콘텐츠가 얼마나 균형 있게 활용되는지를 측정합니다.
              피크 <b className="text-slate-900">{Math.round(data.peakUtilRatio * 100)}%</b> · 미디어 활성률 <b className="text-slate-900">{media.length > 0 ? Math.round((data.mediaEngagedCount / media.length) * 100) : 0}%</b> · Skip <b className="text-slate-900">{Math.round(data.globalSkipRate * 100)}%</b>의 지표가 말해주는 것은,
              공간의 문제는 <b className="text-blue-600">정원 초과가 아니라 콘텐츠 편중</b>이라는 점입니다.
            </p>
          </div>
        </section>

        {/* ===== Appendix ===== */}
        <section className="px-14 py-10 border-t border-slate-200">
          <SubHeader>Appendix · 데이터 정의</SubHeader>
          <div className="mt-4 grid grid-cols-2 gap-x-10 gap-y-3 text-xs text-slate-500 leading-relaxed">
            <AppendixItem term="Peak Utilization" def="관측 기간 동안 존의 최대 동시 수용 수 ÷ 설계 정원." />
            <AppendixItem term="m²/인 (공간 등급)" def="Peak 시점 존 면적 ÷ 수용 인원. 국제 기준 2.5m²/인 이상이 안전권." />
            <AppendixItem term="Bottleneck Score" def="유입-유출 차이와 대기시간으로 산출된 0–1 정체 지수. 0.5 초과 시 병목." />
            <AppendixItem term="Completion Rate" def="3개 이상 존을 방문하고 정상 퇴장한 관람객 비율." />
            <AppendixItem term="Skip Rate" def="미디어 근처 도달 → 관람하지 않고 지나친 비율." />
            <AppendixItem term="참여율 (Engagement Rate)" def="미디어 관람 횟수 ÷ (관람+Skip) 총 접근." />
            <AppendixItem term="Fatigue P90 / P99" def="관람객 피로도 상위 10% / 1% 값." />
            <AppendixItem term="Group-Induced Bottleneck" def="그룹 관람객이 전체 정체의 50% 이상 기여한 병목." />
          </div>
        </section>

        <footer className="px-14 py-6 border-t border-slate-200">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <p>VELA — Spatial Simulation & Flow Analytics · Report v{scenario.meta.version}</p>
            <p>Generated {generatedDate} {generatedTime}</p>
          </div>
        </footer>
      </div>
    </Overlay>
  );
}

// ============ Helpers ============

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-w-[960px] mx-auto my-8 rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
        {children}
      </div>
    </div>
  );
}

function HeaderMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function SectionHeader({ no, label, title }: { no: string; label: string; title: string }) {
  return (
    <div className="flex items-end gap-5 pb-3 border-b border-slate-200">
      <p className="text-5xl font-bold text-slate-700 tabular-nums leading-none">{no}</p>
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-[0.24em] text-blue-600 font-semibold mb-1.5">{label}</p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">{title}</h2>
      </div>
    </div>
  );
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
      {children}
    </p>
  );
}

function KpiStat({ label, value, sub, tone = 'default' }: {
  label: string; value: string; sub?: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const color = tone === 'danger' ? 'text-red-600'
    : tone === 'warning' ? 'text-amber-600'
    : 'text-slate-900';
  return (
    <div className="text-center px-2">
      <p className={`text-3xl font-bold tracking-tight tabular-nums leading-none ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-2.5 font-semibold">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function Finding({ metric, body }: { metric: string; body: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-0.5 rounded-full bg-blue-600 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-0.5">{metric}</p>
        <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function IssueCard({ index, severity, title, body }: { index: number; severity: 'info' | 'warning' | 'critical'; title: string; body: string }) {
  const cls = severity === 'critical'
    ? 'bg-red-50 border-red-200 text-red-700'
    : severity === 'warning'
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-slate-50 border-slate-200 text-slate-500';
  return (
    <div className={`p-4 rounded-xl border ${cls}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl font-bold tabular-nums opacity-70">0{index}</span>
        <span className="text-[10px] uppercase tracking-wider font-semibold">
          {severity === 'critical' ? 'Critical' : severity === 'warning' ? 'Warning' : 'Info'}
        </span>
      </div>
      <p className="text-sm font-semibold text-slate-900 mb-2 leading-snug">{title}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
    </div>
  );
}

function ActionCard({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl font-bold tabular-nums text-blue-600">0{index}</span>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-600">{title}</span>
      </div>
      <p className="text-xs text-slate-700 leading-relaxed">{body}</p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-2.5 text-slate-500">{label}</td>
      <td className="py-2.5 text-right text-slate-900 font-semibold tabular-nums">{value}</td>
    </tr>
  );
}

function CompletionBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-40 text-slate-700">{label}</div>
      <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="w-24 text-right text-slate-500 tabular-nums">
        {count}명 ({Math.round(pct)}%)
      </div>
    </div>
  );
}

function CategoryBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-28 text-slate-700 font-medium">{label}</div>
      <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-20 text-right text-slate-500 tabular-nums">
        {count} ({Math.round(pct)}%)
      </div>
    </div>
  );
}

function SmallStat({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'danger' }) {
  const color = tone === 'danger' ? 'text-red-600' : 'text-slate-900';
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 font-semibold">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>
        {value} {sub && <span className="text-xs font-normal text-slate-500">{sub}</span>}
      </p>
    </div>
  );
}

function InsightRow({ index, insight }: { index: number; insight: ReturnType<typeof generateInsights>[number] }) {
  const sevCls = insight.severity === 'critical' ? 'bg-red-100 text-red-700'
    : insight.severity === 'warning' ? 'bg-amber-100 text-amber-700'
    : 'bg-blue-100 text-blue-600';
  return (
    <div className="p-5 rounded-xl bg-white border border-slate-200">
      <div className="flex items-start gap-5">
        <div className="flex flex-col items-center shrink-0">
          <span className="text-2xl font-bold text-slate-400 tabular-nums leading-none">
            {String(index).padStart(2, '0')}
          </span>
          <span className={`mt-2 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold ${sevCls}`}>
            {insight.severity}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">문제</p>
            <p className="text-base font-semibold text-slate-900 leading-snug">{insight.problem}</p>
          </div>
          <div className="grid grid-cols-2 gap-5 pt-3 border-t border-slate-200">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5">원인</p>
              <p className="text-sm text-slate-700 leading-relaxed">{insight.cause}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-blue-600 font-semibold mb-1.5">권장</p>
              <p className="text-sm text-slate-700 leading-relaxed">{insight.recommendation}</p>
            </div>
          </div>
        </div>
      </div>
      {insight.dataEvidence && (
        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-4 text-[11px] text-slate-500">
          <span className="uppercase tracking-wider font-semibold">Evidence</span>
          <span className="font-data">{insight.dataEvidence.metric}</span>
          <span className="tabular-nums text-slate-700">{insight.dataEvidence.value.toFixed(2)}</span>
          <span className="text-slate-400">threshold {insight.dataEvidence.threshold.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

function AppendixItem({ term, def }: { term: string; def: string }) {
  return (
    <div>
      <b className="text-slate-900">{term}</b>
      <span> — {def}</span>
    </div>
  );
}

const GRADE_BG: Record<'A' | 'B' | 'C' | 'D' | 'F', string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-blue-100 text-blue-600',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-orange-100 text-orange-700',
  F: 'bg-red-100 text-red-700',
};

function GradeBadge({ grade }: { grade: 'A' | 'B' | 'C' | 'D' | 'F' }) {
  return (
    <span className={`inline-flex w-6 h-6 items-center justify-center rounded text-[11px] font-bold ${GRADE_BG[grade]}`}>
      {grade}
    </span>
  );
}

function ZoneDonut({ data }: { data: { id: string; name: string; color: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <div className="text-xs text-slate-500 py-12 text-center">활성 관람객 없음</div>;
  }

  const radius = 70;
  const cx = 100;
  const cy = 100;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  let accOffset = 0;
  const segments = data.map((d) => {
    const pct = d.count / total;
    const dashLen = circumference * pct;
    const dashGap = circumference - dashLen;
    const offset = -accOffset;
    accOffset += dashLen;
    return { ...d, pct, dashLen, dashGap, offset };
  });

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {segments.map((seg) => (
          <circle
            key={seg.id}
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dashLen} ${seg.dashGap}`}
            strokeDashoffset={seg.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#0f172a" style={{ fontSize: 24, fontWeight: 700 }}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
          Active
        </text>
      </svg>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs w-full">
        {segments.map((seg) => (
          <div key={seg.id} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-slate-700 truncate max-w-[100px]">{seg.name}</span>
            <span className="text-slate-500 tabular-nums ml-auto">{Math.round(seg.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimeMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    congestion: '혼잡 분산', skip: '콘텐츠 재배치', fatigue: '동선 피로 완화',
    flow: '흐름 최적화', capacity: '정원 조정', space_roi: '공간 효율화',
    content_mix: '콘텐츠 믹스', group_impact: '그룹 동선 분리', content_fatigue: '체험 피로 완화',
  };
  return map[cat] ?? cat;
}

function categoryLabelKo(cat: string): string {
  const map: Record<string, string> = {
    solo: '개인', small_group: '소그룹', guided_tour: '단체관람', vip_expert: 'VIP/전문가',
  };
  return map[cat] ?? cat;
}

function TimelineChart({
  history,
  keyMoments,
}: {
  history: readonly { timestamp: number; snapshot: any }[];
  keyMoments: readonly { kind: string; label: string; timestampMs: number }[];
}) {
  const stepSize = Math.max(1, Math.floor(history.length / 60));
  const sampledIdx: number[] = [];
  for (let i = 0; i < history.length; i += stepSize) sampledIdx.push(i);
  const sampled = sampledIdx.map((i) => history[i]);

  const labels = sampled.map((e) => {
    const s = Math.floor(e.timestamp / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  });

  const peakUtil = sampled.map((e) => {
    const m = Math.max(0, ...e.snapshot.zoneUtilizations.map((u: any) => u.ratio));
    return Math.round(m * 100);
  });
  const fatigue = sampled.map((e) => Math.round((e.snapshot.fatigueDistribution?.mean ?? 0) * 100));
  const visitors = sampled.map((e) =>
    e.snapshot.zoneUtilizations.reduce((sum: number, u: any) => sum + u.currentOccupancy, 0),
  );

  const peakPoint = peakUtil.reduce((acc, v, i) => (v > acc.v ? { v, i } : acc), { v: -1, i: -1 });
  const peakLabel = peakPoint.i >= 0 ? labels[peakPoint.i] : null;

  // Map each keyMoment to nearest sampled index for marker positioning.
  const markers = keyMoments
    .map((km) => {
      let bestI = -1;
      let bestDist = Infinity;
      for (let i = 0; i < sampled.length; i++) {
        const d = Math.abs(sampled[i].timestamp - km.timestampMs);
        if (d < bestDist) { bestDist = d; bestI = i; }
      }
      return bestI >= 0 ? { index: bestI, label: km.label, kind: km.kind } : null;
    })
    .filter((m): m is { index: number; label: string; kind: string } => !!m);

  const chartData = {
    labels,
    datasets: [
      {
        label: '최대 혼잡도 %', data: peakUtil,
        borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.10)',
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
      },
      {
        label: '평균 피로도 %', data: fatigue,
        borderColor: '#f59e0b', backgroundColor: 'transparent',
        fill: false, tension: 0.3, pointRadius: 0, borderWidth: 2,
      },
      {
        label: '활성 관람객 수', data: visitors,
        borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)',
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2, yAxisID: 'y1',
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'top' as const,
        labels: { color: '#475569', font: { size: 11 }, boxWidth: 12, boxHeight: 2 },
      },
      tooltip: {
        backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#475569',
        borderColor: '#e2e8f0', borderWidth: 1, padding: 10,
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', font: { size: 10 }, maxTicksLimit: 12 },
        grid: { color: 'rgba(15,23,42,0.04)' },
      },
      y: {
        position: 'left' as const, min: 0, max: 100,
        title: { display: true, text: '% (혼잡도 · 피로도)', color: '#94a3b8', font: { size: 10 } },
        ticks: { color: '#94a3b8', font: { size: 10 }, stepSize: 25 },
        grid: { color: 'rgba(15,23,42,0.04)' },
      },
      y1: {
        position: 'right' as const, min: 0,
        title: { display: true, text: '관람객 수', color: '#94a3b8', font: { size: 10 } },
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { display: false },
      },
    },
  };

  const markerPlugin = {
    id: 'keyMomentMarkers',
    afterDatasetsDraw(chart: any) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales?.x) return;
      ctx.save();
      ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif';
      for (const m of markers) {
        const x = scales.x.getPixelForValue(m.index);
        if (!Number.isFinite(x)) continue;
        ctx.strokeStyle = 'rgba(15,23,42,0.35)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        const text = m.label;
        const tw = ctx.measureText(text).width + 10;
        const th = 14;
        const bx = Math.min(chartArea.right - tw - 2, Math.max(chartArea.left + 2, x - tw / 2));
        const by = chartArea.top + 2;
        ctx.fillStyle = 'rgba(15,23,42,0.85)';
        roundRect(ctx, bx, by, tw, th, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, bx + tw / 2, by + th / 2);
      }
      ctx.restore();
    },
  };

  return (
    <div>
      <div className="bg-white rounded-xl border border-slate-200 p-6" style={{ height: 320 }}>
        <Line data={chartData} options={options} plugins={[markerPlugin]} />
      </div>
      {peakLabel && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-4">
          <p className="text-[11px] uppercase tracking-[0.15em] text-red-600 font-semibold mb-1">Peak Moment</p>
          <p className="text-sm text-slate-900">
            <b>{peakLabel}</b> 시점에 최대 혼잡도 <b className="text-red-600">{peakPoint.v}%</b>로 피크를 기록했습니다.
          </p>
        </div>
      )}
    </div>
  );
}

function ZoneOccupancyTimeline({
  history,
  zones,
  keyMoments,
}: {
  history: readonly { timestamp: number; snapshot: any }[];
  zones: readonly { id: any; name: string }[];
  keyMoments: readonly { kind: string; label: string; timestampMs: number }[];
}) {
  const stepSize = Math.max(1, Math.floor(history.length / 60));
  const sampledIdx: number[] = [];
  for (let i = 0; i < history.length; i += stepSize) sampledIdx.push(i);
  const sampled = sampledIdx.map((i) => history[i]);

  // Show zones whose peakOccupancy ever exceeded 0 across the full (unsampled) history.
  // currentOccupancy is sparse — sampling can miss it. peakOccupancy is the running max
  // and reliably reflects whether a zone was ever utilized.
  const peakById = new Map<string, number>();
  for (const e of history) {
    for (const u of e.snapshot.zoneUtilizations) {
      const k = u.zoneId as string;
      peakById.set(k, Math.max(peakById.get(k) ?? 0, u.peakOccupancy ?? 0));
    }
  }
  const visibleZones = zones.filter((z) => (peakById.get(z.id as string) ?? 0) > 0);

  if (visibleZones.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">존 점유 데이터가 없습니다.</p>
      </div>
    );
  }

  const labels = sampled.map((e) => {
    const s = Math.floor(e.timestamp / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  });

  const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'];

  const datasets = visibleZones.map((z, i) => {
    const color = palette[i % palette.length];
    const data = sampled.map((e) => {
      const u = e.snapshot.zoneUtilizations.find((x: any) => x.zoneId === z.id);
      return u?.currentOccupancy ?? 0;
    });
    return {
      label: z.name,
      data,
      borderColor: color,
      backgroundColor: hexToRgba(color, 0.45),
      fill: true as const,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 1,
    };
  });

  const markers = keyMoments
    .map((km) => {
      let bestI = -1;
      let bestDist = Infinity;
      for (let i = 0; i < sampled.length; i++) {
        const d = Math.abs(sampled[i].timestamp - km.timestampMs);
        if (d < bestDist) { bestDist = d; bestI = i; }
      }
      return bestI >= 0 ? { index: bestI, label: km.label } : null;
    })
    .filter((m): m is { index: number; label: string } => !!m);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true, position: 'top' as const,
        labels: { color: '#475569', font: { size: 11 }, boxWidth: 10, boxHeight: 10 },
      },
      tooltip: {
        backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#475569',
        borderColor: '#e2e8f0', borderWidth: 1, padding: 10,
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8', font: { size: 10 }, maxTicksLimit: 12 },
        grid: { color: 'rgba(15,23,42,0.04)' },
        stacked: true,
      },
      y: {
        position: 'left' as const, min: 0, stacked: true,
        title: { display: true, text: '점유 인원 (누적)', color: '#94a3b8', font: { size: 10 } },
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { color: 'rgba(15,23,42,0.04)' },
      },
    },
  };

  const markerPlugin = {
    id: 'zoneStackMarkers',
    afterDatasetsDraw(chart: any) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales?.x) return;
      ctx.save();
      ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif';
      for (const m of markers) {
        const x = scales.x.getPixelForValue(m.index);
        if (!Number.isFinite(x)) continue;
        ctx.strokeStyle = 'rgba(15,23,42,0.30)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    },
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6" style={{ height: 320 }}>
      <Line data={{ labels, datasets }} options={options} plugins={[markerPlugin]} />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
