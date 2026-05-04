import { useMemo, useState, useEffect } from 'react';
import {
  Activity, Zap, Eye, Download, Flame, ChevronRight,
} from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { AppShell, StageRail, UnifiedHeader } from './shell';
import { ChapterNav, type Chapter } from './analyze/ChapterNav';
import { HotspotsRail } from './analyze/HotspotsRail';
import { DrilldownSheet } from './analyze/DrilldownSheet';
import { ActionCard, type CockpitAction } from './analyze/ActionCard';
import { RunSwitcher } from './analyze/RunSwitcher';
import type { ZoneId, MediaId, RunRecord } from '@/domain';
import { useToast } from '@/ui/components/Toast';
import { PerspectiveGrid, PatternBlock, SpatialHeatmap, CapacityRecommendationCard } from '@/ui/panels/analytics/v2';
import { computeTimeSlices } from '@/analytics/patterns/timeSlices';
import { computeZoneSlices } from '@/analytics/patterns/zoneSlices';
import { computeZoneBreakdown } from '@/analytics/breakdown/zoneBreakdown';
import { computeMediaBreakdown } from '@/analytics/breakdown/mediaBreakdown';
import { computeTimeBreakdown } from '@/analytics/breakdown/timeBreakdown';
import { computePersonaBreakdown } from '@/analytics/breakdown/personaBreakdown';
import { computeCapacityRecommendation } from '@/analytics/recommendations/capacityRecommendation';
import type { VisitorProfileType } from '@/domain';
import { summarizeEngagementByProfile } from '@/stores/slices/analyticsSlice';

interface Props {
  onBackToSimulate: () => void;
  onBackToBuild: () => void;
}

export function AnalyzeLayout({ onBackToSimulate, onBackToBuild }: Props) {
  const t = useT();
  const { toast } = useToast();
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const floors = useStore((s) => s.floors);
  const shafts = useStore((s) => s.shafts);
  const liveVisitors = useStore((s) => s.visitors);
  const liveLatestSnapshot = useStore((s) => s.latestSnapshot);
  const liveKpiHistory = useStore((s) => s.kpiHistory);
  const liveTotalSpawned = useStore((s) => s.totalSpawned);
  const liveTotalExited = useStore((s) => s.totalExited);
  const liveSpawnByNode = useStore((s) => s.spawnByNode);
  const liveExitByNode = useStore((s) => s.exitByNode);
  const liveEntryQueue = useStore((s) => s.entryQueue);
  const graph = useStore((s) => s.waypointGraph);
  const liveDensityGrids = useStore((s) => s.densityGrids);
  const runRecords = useStore((s) => s.runRecords);
  const activeRunId = useStore((s) => s.activeRunId);
  const setActiveRunId = useStore((s) => s.setActiveRunId);
  const removeRunRecord = useStore((s) => s.removeRunRecord);
  const scenario = useStore((s) => s.scenario);
  const setOverlayMode = useStore((s) => s.setOverlayMode);

  // Analyze 진입 시 Simulate 에서 켜둔 heatmap/flow 오버레이 초기화 — Analyze 는 자체 시각화를
  // 가지므로 캔버스 오버레이가 남아있으면 해석 충돌. 마운트 시 한 번만 (2026-04-30).
  useEffect(() => {
    setOverlayMode('none');
  }, [setOverlayMode]);

  const activeRecord = useMemo<RunRecord | null>(
    () => (activeRunId ? runRecords.find((r) => r.id === activeRunId) ?? null : null),
    [activeRunId, runRecords],
  );

  // 데이터 소스 — active record 가 있으면 그 record, 없으면 라이브 store.
  const latestSnapshot = activeRecord ? activeRecord.latestSnapshot : liveLatestSnapshot;
  const kpiHistory = activeRecord ? activeRecord.kpiHistory : liveKpiHistory;
  const totalSpawned = activeRecord ? activeRecord.totalSpawned : liveTotalSpawned;
  const totalExited = activeRecord ? activeRecord.totalExited : liveTotalExited;
  const spawnByNode = useMemo<ReadonlyMap<string, number>>(
    () => activeRecord ? new Map(Object.entries(activeRecord.spawnByNode)) : liveSpawnByNode,
    [activeRecord, liveSpawnByNode],
  );
  const exitByNode = useMemo<ReadonlyMap<string, number>>(
    () => activeRecord ? new Map(Object.entries(activeRecord.exitByNode)) : liveExitByNode,
    [activeRecord, liveExitByNode],
  );

  // Step 2 (2026-04-30): entryQueue summary — active record (저장된 run) 우선, 없으면 라이브.
  // 외부 입장 큐가 활성이 아닌 시나리오는 totalArrived=0 으로 metric 자동 unknown 처리됨.
  const entryStats = useMemo(() => {
    if (activeRecord) {
      return {
        totalArrived: activeRecord.entryStats.totalArrived,
        totalAdmitted: activeRecord.entryStats.totalAdmitted,
        totalAbandoned: activeRecord.entryStats.totalAbandoned,
        avgAdmitWaitMs: activeRecord.entryStats.avgAdmitWaitMs,
        rejectionRate: activeRecord.entryStats.rejectionRate,
      };
    }
    const arrived = liveEntryQueue.totalArrived;
    return {
      totalArrived: arrived,
      totalAdmitted: liveEntryQueue.totalAdmitted,
      totalAbandoned: liveEntryQueue.totalAbandoned,
      avgAdmitWaitMs: liveEntryQueue.recentAdmitAvgWaitMs,
      rejectionRate: arrived > 0 ? liveEntryQueue.totalAbandoned / arrived : 0,
    };
  }, [activeRecord, liveEntryQueue]);

  const timeSlicePattern = useMemo(() => {
    const totalMs = latestSnapshot?.simulationTimeMs ?? 0;
    return computeTimeSlices(kpiHistory, totalMs);
  }, [kpiHistory, latestSnapshot]);

  const zoneSlicePattern = useMemo(
    () => computeZoneSlices(zones, latestSnapshot, kpiHistory),
    [zones, latestSnapshot, kpiHistory],
  );

  // Step 3 — drilldown 선택 상태. zone | media | time | persona.
  type DrilldownTarget =
    | { kind: 'zone'; id: string }
    | { kind: 'media'; id: string }
    | { kind: 'time'; index: number }
    | { kind: 'persona'; profile: VisitorProfileType };
  const [drilldownTarget, setDrilldownTarget] = useState<DrilldownTarget | null>(null);

  // active record 가 바뀌면 drilldown reset.
  useEffect(() => {
    setDrilldownTarget(null);
  }, [activeRunId]);

  const zoneBreakdown = useMemo(() => {
    if (!drilldownTarget || drilldownTarget.kind !== 'zone' || !latestSnapshot) return null;
    const zone = zones.find((z) => z.id === drilldownTarget.id);
    if (!zone) return null;
    return computeZoneBreakdown({
      zoneId: drilldownTarget.id,
      zone,
      latestSnapshot,
      kpiHistory,
      visitors: liveVisitors,
      media,
      totalExited,
    });
  }, [drilldownTarget, latestSnapshot, kpiHistory, zones, liveVisitors, media, totalExited]);

  const mediaBreakdown = useMemo(() => {
    if (!drilldownTarget || drilldownTarget.kind !== 'media' || !latestSnapshot) return null;
    const m = media.find((mm) => mm.id === drilldownTarget.id);
    if (!m) return null;
    const z = zones.find((zz) => zz.id === m.zoneId) ?? null;
    return computeMediaBreakdown({
      mediaId: drilldownTarget.id,
      media: m,
      zone: z,
      latestSnapshot,
      kpiHistory,
      visitors: liveVisitors,
    });
  }, [drilldownTarget, latestSnapshot, kpiHistory, zones, media, liveVisitors]);

  const timeBreakdown = useMemo(() => {
    if (!drilldownTarget || drilldownTarget.kind !== 'time' || !timeSlicePattern) return null;
    return computeTimeBreakdown({
      sliceIndex: drilldownTarget.index,
      pattern: timeSlicePattern,
      kpiHistory,
      zones,
      media,
    });
  }, [drilldownTarget, timeSlicePattern, kpiHistory, zones, media]);

  const toggleZoneDrilldown = (id: string) =>
    setDrilldownTarget((cur) =>
      cur?.kind === 'zone' && cur.id === id ? null : { kind: 'zone', id },
    );
  const toggleMediaDrilldown = (id: string) =>
    setDrilldownTarget((cur) =>
      cur?.kind === 'media' && cur.id === id ? null : { kind: 'media', id },
    );
  const toggleTimeDrilldown = (index: number) =>
    setDrilldownTarget((cur) =>
      cur?.kind === 'time' && cur.index === index ? null : { kind: 'time', index },
    );
  const togglePersonaDrilldown = (profile: VisitorProfileType) =>
    setDrilldownTarget((cur) =>
      cur?.kind === 'persona' && cur.profile === profile ? null : { kind: 'persona', profile },
    );

  const handleForkZoneToBuild = () => {
    if (!drilldownTarget || drilldownTarget.kind !== 'zone') return;
    const s = useStore.getState();
    s.selectZone(drilldownTarget.id as ZoneId);
    const z = s.zones.find((zz) => zz.id === drilldownTarget.id);
    if (z) {
      s.setFocusTarget({
        x: z.bounds.x + z.bounds.w / 2,
        y: z.bounds.y + z.bounds.h / 2,
        zoom: 1.4,
      });
    }
    toast('info', t('analyze.cockpit.action.saveReminder'));
    onBackToBuild();
  };

  const handleForkMediaToBuild = () => {
    if (!drilldownTarget || drilldownTarget.kind !== 'media') return;
    const s = useStore.getState();
    s.selectMedia(drilldownTarget.id as MediaId);
    const m = s.media.find((mm) => mm.id === drilldownTarget.id);
    if (m) {
      s.setFocusTarget({
        x: m.position.x,
        y: m.position.y,
        zoom: 1.6,
      });
    }
    toast('info', t('analyze.cockpit.action.saveReminder'));
    onBackToBuild();
  };

  // persona slice — record 우선, 없으면 라이브 visitors 에서 계산.
  const engagementByProfile = useMemo(() => {
    if (activeRecord) return activeRecord.engagementByProfile;
    return summarizeEngagementByProfile(liveVisitors, zones.length);
  }, [activeRecord, liveVisitors, zones.length]);

  const personaBreakdown = useMemo(() => {
    if (!drilldownTarget || drilldownTarget.kind !== 'persona') return null;
    return computePersonaBreakdown({
      profile: drilldownTarget.profile,
      engagementByProfile,
      visitors: liveVisitors,
      zones,
      media,
    });
  }, [drilldownTarget, engagementByProfile, liveVisitors, zones, media]);

  // Step 4a — 산식 기반 권장 동시 수용인원.
  // total area / 1.5m² (NFPA 101). 정책/관측 peak 와 비교해 status + reading 산출.
  const capacityRecommendation = useMemo(
    () => computeCapacityRecommendation({
      zones,
      kpiHistory,
      latestSnapshot,
      operations: scenario?.simulationConfig.operations,
    }),
    [zones, kpiHistory, latestSnapshot, scenario],
  );

  // Step 4c — sweep input. Card 가 자체 실행하므로 input 만 조립해 넘긴다.
  // graph/scenario 미설정 등 sweep 불가능 상태는 null 로 표시 → 카드가 sweep 섹션 숨김.
  const sweepInput = useMemo(() => {
    if (!scenario) return null;
    if (!graph || graph.nodes.length === 0 || graph.edges.length === 0) return null;
    return {
      floors,
      zones,
      media,
      config: scenario.simulationConfig,
      waypointGraph: graph,
      shafts,
      globalFlowMode: scenario.globalFlowMode ?? 'free',
      guidedUntilIndex: scenario.guidedUntilIndex ?? 0,
      totalVisitors: scenario.visitorDistribution.totalCount,
      categoryWeights: scenario.visitorDistribution.categoryWeights as
        Record<string, number> | undefined,
    };
  }, [scenario, graph, floors, zones, media, shafts]);

  const peakUtil = useMemo(() => {
    if (!latestSnapshot) return null;
    let best: { zoneId: string; ratio: number; peakOcc: number; capacity: number } | null = null;
    for (const u of latestSnapshot.zoneUtilizations) {
      const ratio = u.capacity > 0 ? u.peakOccupancy / u.capacity : 0;
      if (!best || ratio > best.ratio) {
        best = { zoneId: u.zoneId as string, ratio, peakOcc: u.peakOccupancy, capacity: u.capacity };
      }
    }
    return best;
  }, [latestSnapshot]);

  const peakZoneName = peakUtil?.zoneId
    ? zones.find((z) => z.id === peakUtil.zoneId)?.name ?? '—'
    : '—';

  const fatigueMean = useMemo(() => {
    if (activeRecord) return activeRecord.engagement.fatigueMean;
    const exited = liveVisitors.filter((v) => !v.isActive);
    const sample = exited.length > 0 ? exited : liveVisitors;
    if (sample.length === 0) return 0;
    const sum = sample.reduce((acc, v) => acc + (v.fatigue ?? 0), 0);
    return sum / sample.length;
  }, [activeRecord, liveVisitors]);

  const topBottlenecks = useMemo(() => {
    const peakByZone = new Map<string, number>();
    const sources = kpiHistory.length > 0
      ? kpiHistory.map((h) => h.snapshot)
      : latestSnapshot ? [latestSnapshot] : [];
    for (const snap of sources) {
      for (const b of snap.bottlenecks) {
        const prev = peakByZone.get(b.zoneId as string) ?? 0;
        if (b.score > prev) peakByZone.set(b.zoneId as string, b.score);
      }
    }
    return Array.from(peakByZone.entries())
      .filter(([, score]) => score > 0.3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([zoneId, score]) => ({
        name: zones.find((z) => z.id === zoneId)?.name ?? '—',
        score,
      }));
  }, [kpiHistory, latestSnapshot, zones]);

  const topSkipMedia = useMemo(() => {
    if (!latestSnapshot) return [];
    return [...latestSnapshot.skipRate.perMedia]
      .filter((m) => m.rate > 0.1 && m.totalApproaches >= 3)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5)
      .map((m) => ({
        id: m.mediaId as string,
        name: media.find((mm) => mm.id === m.mediaId)?.name ?? '—',
        rate: m.rate,
        skipCount: m.skipCount,
      }));
  }, [latestSnapshot, media]);

  const entryExitFlow = useMemo(() => {
    if (!graph) return { entries: [], exits: [], unaccountedExits: 0 };
    const entries = graph.nodes
      .filter((n) => n.type === 'entry')
      .map((n) => ({ name: n.label || 'Entry', count: spawnByNode.get(n.id as string) ?? 0 }));
    const exits = graph.nodes
      .filter((n) => n.type === 'exit')
      .map((n) => ({ name: n.label || 'Exit', count: exitByNode.get(n.id as string) ?? 0 }));
    const exitNodeTotal = exits.reduce((s, e) => s + e.count, 0);
    const unaccountedExits = Math.max(0, totalExited - exitNodeTotal);
    return { entries, exits, unaccountedExits };
  }, [graph, spawnByNode, exitByNode, totalExited]);

  const engagementSummary = useMemo(() => {
    if (activeRecord) {
      const e = activeRecord.engagement;
      return {
        avgZones: e.avgZones,
        avgMedia: e.avgMedia,
        fullCompletion: e.fullCompletion,
        avgDwellSec: e.avgDwellSec,
      };
    }
    const exited = liveVisitors.filter((v) => !v.isActive);
    if (exited.length === 0) return { avgZones: 0, avgMedia: 0, fullCompletion: 0, avgDwellSec: 0 };
    const sumZones = exited.reduce((s, v) => s + v.visitedZoneIds.length, 0);
    const sumMedia = exited.reduce((s, v) => s + (v.visitedMediaIds?.length ?? 0), 0);
    const full = exited.filter((v) => v.visitedZoneIds.length >= zones.length).length;
    const sumDwellMs = exited.reduce(
      (s, v) => s + Math.max(0, (v.exitedAt ?? 0) - (v.enteredAt ?? 0)),
      0,
    );
    return {
      avgZones: sumZones / exited.length,
      avgMedia: sumMedia / exited.length,
      fullCompletion: full / exited.length,
      avgDwellSec: sumDwellMs / exited.length / 1000,
    };
  }, [activeRecord, liveVisitors, zones]);

  const actions = useMemo<CockpitAction[]>(() => {
    const list: CockpitAction[] = [];
    if (peakUtil && peakUtil.ratio > 0.7) {
      list.push({
        id: `disperse-${peakUtil.zoneId}`,
        level: peakUtil.ratio > 0.9 ? 'critical' : 'warning',
        title: t('analyze.cockpit.action.dispersePeak', { zone: peakZoneName }),
        detail: t('analyze.cockpit.action.dispersePeak.detail', {
          ratio: Math.round(peakUtil.ratio * 100),
        }),
        zoneId: peakUtil.zoneId as ZoneId,
      });
    }
    const topSkip = topSkipMedia[0];
    if (topSkip && topSkip.rate > 0.2) {
      list.push({
        id: `skip-${topSkip.id}`,
        level: topSkip.rate > 0.5 ? 'critical' : 'warning',
        title: t('analyze.cockpit.action.skipMedia', { media: topSkip.name }),
        detail: t('analyze.cockpit.action.skipMedia.detail', {
          rate: Math.round(topSkip.rate * 100),
        }),
        mediaId: topSkip.id as MediaId,
      });
    }
    if (entryExitFlow.unaccountedExits > 5) {
      list.push({
        id: 'balance-exits',
        level: 'warning',
        title: t('analyze.cockpit.action.balanceExits'),
        detail: t('analyze.cockpit.action.balanceExits.detail', {
          count: entryExitFlow.unaccountedExits,
        }),
      });
    }
    return list.slice(0, 3);
  }, [peakUtil, peakZoneName, topSkipMedia, entryExitFlow, t]);

  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  const hasSpatialData = !!latestSnapshot && zones.length > 0;

  const chapters = useMemo<Chapter[]>(() => [
    { id: 'verdict',        label: '위험 신호',     Icon: Activity,    available: true },
    { id: 'spatial',        label: '공간 분포',     Icon: Flame,       available: hasSpatialData },
    { id: 'pattern',        label: '시간·공간 패턴', Icon: ChevronRight, available: true },
    { id: 'recommendation', label: '운영 권장',     Icon: Eye,         available: capacityRecommendation.recommendedConcurrent > 0 },
    { id: 'actions',        label: '액션',          Icon: Zap,         available: actions.length > 0 },
  ], [hasSpatialData, capacityRecommendation.recommendedConcurrent, actions.length]);

  const handleAction = (action: CockpitAction) => {
    const s = useStore.getState();
    if (action.zoneId) {
      s.selectZone(action.zoneId);
      const z = s.zones.find((zz) => zz.id === action.zoneId);
      if (z) {
        s.setFocusTarget({
          x: z.bounds.x + z.bounds.w / 2,
          y: z.bounds.y + z.bounds.h / 2,
          zoom: 1.4,
        });
      }
    } else if (action.mediaId) {
      s.selectMedia(action.mediaId);
      const m = s.media.find((mm) => mm.id === action.mediaId);
      if (m) {
        s.setFocusTarget({
          x: m.position.x,
          y: m.position.y,
          zoom: 1.6,
        });
      }
    }
    // 비교 가능한 run 묶음 유지를 위해 Save → Run 순서를 안내.
    toast('info', t('analyze.cockpit.action.saveReminder'));
    onBackToBuild();
  };

  return (
    <AppShell
      header={
        <UnifiedHeader
          current="analyze"
          nav={{ build: onBackToBuild, simulate: onBackToSimulate }}
          rightSlot={
            <div className="flex items-center gap-2">
              <RunSwitcher
                records={runRecords}
                activeRunId={activeRunId}
                onSelect={(id) => setActiveRunId(id)}
                onRemove={(id) => removeRunRecord(id)}
                t={t}
              />
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors"
                title="Export to PDF"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          }
        />
      }
      rail={
        <StageRail
          current="analyze"
          nav={{ build: onBackToBuild, simulate: onBackToSimulate }}
        />
      }
      left={<ChapterNav scrollRoot={scrollRoot} chapters={chapters} />}
      main={
        <div className="h-full overflow-hidden">
          <div
            ref={(el) => setScrollRoot(el)}
            className="h-full flex flex-col px-5 py-4 gap-4 max-w-[1280px] mx-auto overflow-y-auto scroll-smooth"
          >
            <section id="verdict" className="scroll-mt-4">
            <PerspectiveGrid
              snapshot={latestSnapshot}
              kpiHistory={kpiHistory}
              zones={zones}
              media={media}
              totalSpawned={totalSpawned}
              totalExited={totalExited}
              fatigueMean={fatigueMean}
              entryStats={entryStats}
              layout="auto"
            />
            </section>

            {/* SPATIAL HEATMAP — 도면 위 zone 별 점유율 시각화 (2026-04-30).
                중요한 자리에 큼지막하게 — verdict 와 PatternBlock 사이.
                live density 는 store 에서 직접 가져오지 않고 여기서 주입 (테스트성 + replay 일관성). */}
            {hasSpatialData && (
              <SpatialHeatmap
                zones={zones}
                snapshot={latestSnapshot}
                densityGrids={liveDensityGrids}
                waypointGraph={graph}
                onSelectZone={toggleZoneDrilldown}
                selectedZoneId={drilldownTarget?.kind === 'zone' ? drilldownTarget.id : null}
              />
            )}

            {/* MIDDLE — PATTERN (시간 슬라이스 + persona 분해) */}
            <section id="pattern" className="scroll-mt-4">
            <PatternBlock
              pattern={timeSlicePattern}
              zonePattern={zoneSlicePattern}
              engagementByProfile={engagementByProfile}
              zoneCount={zones.length}
              mediaCount={media.length}
              onSelectZone={toggleZoneDrilldown}
              selectedZoneId={drilldownTarget?.kind === 'zone' ? drilldownTarget.id : null}
              onSelectSlice={toggleTimeDrilldown}
              selectedSliceIndex={drilldownTarget?.kind === 'time' ? drilldownTarget.index : null}
              onSelectProfile={togglePersonaDrilldown}
              selectedProfile={drilldownTarget?.kind === 'persona' ? drilldownTarget.profile : null}
            />
            </section>

            {/* Drilldown 은 main 흐름 끊지 않게 우측 sheet 로 이동 (2026-04-30).
                여기 main 칼럼에는 더 이상 렌더하지 않음. */}

            {/* OPERATIONS RECOMMENDATION — 산식 기반 권장 capacity (Step 4a).
                full-width 차지하지 않도록 max-width 제한 (2026-04-30). */}
            {capacityRecommendation.recommendedConcurrent > 0 && (
              <section id="recommendation" className="scroll-mt-4 max-w-[920px]">
                <CapacityRecommendationCard
                  recommendation={capacityRecommendation}
                  sweepInput={sweepInput}
                />
              </section>
            )}

            {/* BOTTOM — ACTIONS (prominent buttons, 데이터 있을 때만) */}
            {actions.length > 0 && (
              <section id="actions" className="flex-shrink-0 scroll-mt-4">
                <h2 className="text-[10px] uppercase tracking-wider font-semibold text-foreground/80 mb-2 flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3 text-primary" />
                  {t('analyze.cockpit.actions.title')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {actions.map((a) => (
                    <ActionCard key={a.id} action={a} ctaLabel={t('analyze.cockpit.action.cta')} onClick={() => handleAction(a)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      }
      right={
        drilldownTarget ? (
          <DrilldownSheet
            kind={drilldownTarget.kind}
            zoneBreakdown={zoneBreakdown}
            mediaBreakdown={mediaBreakdown}
            timeBreakdown={timeBreakdown}
            personaBreakdown={personaBreakdown}
            onClose={() => setDrilldownTarget(null)}
            onForkZone={handleForkZoneToBuild}
            onForkMedia={handleForkMediaToBuild}
          />
        ) : (
          <HotspotsRail
            t={t}
            topBottlenecks={topBottlenecks}
            topSkipMedia={topSkipMedia}
            entryExitFlow={entryExitFlow}
            engagementSummary={engagementSummary}
            zoneCount={zones.length}
            mediaCount={media.length}
            totalExited={totalExited}
            selectedMediaId={null}
            onSelectMedia={toggleMediaDrilldown}
          />
        )
      }
    />
  );
}
