import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Activity, Zap, MoveHorizontal, Eye, Download,
  ChevronRight, History, ChevronDown, X,
} from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { AppShell, StageRail, UnifiedHeader } from './shell';
import type { ZoneId, MediaId, RunRecord } from '@/domain';
import { useToast } from '@/ui/components/Toast';
import { PerspectiveGrid, PatternBlock, DrilldownPanel, MediaDrilldownPanel, TimeDrilldownPanel, PersonaDrilldownPanel, CapacityRecommendationCard } from '@/ui/panels/analytics/v2';
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

type T = (k: string, params?: Record<string, string | number>) => string;

interface CockpitAction {
  id: string;
  level: 'critical' | 'warning';
  title: string;
  detail: string;
  zoneId?: ZoneId;
  mediaId?: MediaId;
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
  const runRecords = useStore((s) => s.runRecords);
  const activeRunId = useStore((s) => s.activeRunId);
  const setActiveRunId = useStore((s) => s.setActiveRunId);
  const removeRunRecord = useStore((s) => s.removeRunRecord);
  const scenario = useStore((s) => s.scenario);

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
      main={
        <div className="h-full overflow-hidden">
          <div className="h-full flex flex-col p-4 gap-3 max-w-[1280px] mx-auto overflow-y-auto">
            <PerspectiveGrid
              snapshot={latestSnapshot}
              zones={zones}
              media={media}
              totalSpawned={totalSpawned}
              totalExited={totalExited}
              fatigueMean={fatigueMean}
              entryStats={entryStats}
              layout="auto"
            />

            {/* MIDDLE — PATTERN (시간 슬라이스 + persona 분해) */}
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

            {/* DRILLDOWN — zone 또는 media 분해 */}
            {zoneBreakdown && (
              <DrilldownPanel
                breakdown={zoneBreakdown}
                onClose={() => setDrilldownTarget(null)}
                onForkToBuild={handleForkZoneToBuild}
              />
            )}
            {mediaBreakdown && (
              <MediaDrilldownPanel
                breakdown={mediaBreakdown}
                onClose={() => setDrilldownTarget(null)}
                onForkToBuild={handleForkMediaToBuild}
              />
            )}
            {timeBreakdown && (
              <TimeDrilldownPanel
                breakdown={timeBreakdown}
                onClose={() => setDrilldownTarget(null)}
              />
            )}
            {personaBreakdown && (
              <PersonaDrilldownPanel
                breakdown={personaBreakdown}
                onClose={() => setDrilldownTarget(null)}
              />
            )}

            {/* OPERATIONS RECOMMENDATION — 산식 기반 권장 capacity (Step 4a) */}
            {capacityRecommendation.recommendedConcurrent > 0 && (
              <CapacityRecommendationCard
                recommendation={capacityRecommendation}
                sweepInput={sweepInput}
              />
            )}

            {/* BOTTOM — ACTIONS (prominent buttons, 데이터 있을 때만) */}
            {actions.length > 0 && (
              <section className="flex-shrink-0">
                <h2 className="text-xs uppercase tracking-wider font-semibold text-foreground/80 mb-2 flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-primary" />
                  {t('analyze.cockpit.actions.title')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
        <aside
          className="w-72 border-l border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-hidden"
          aria-label="Insights rail"
        >
          <div className="px-3 py-2.5 border-b border-border flex-shrink-0">
            <h2 className="text-sm font-semibold tracking-tight">{t('analyze.rail.title')}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {t('analyze.rail.hint')}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <RailCard title={t('analyze.bento.bottlenecks')} Icon={Activity}>
              {topBottlenecks.length === 0 ? (
                <Empty t={t} />
              ) : (
                <ul className="space-y-1.5">
                  {topBottlenecks.map((b, i) => (
                    <li key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="flex-1 truncate">{b.name}</span>
                      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-[var(--status-warning)]"
                          style={{ width: `${Math.round(b.score * 100)}%` }}
                        />
                      </div>
                      <span className="font-data tabular-nums w-9 text-right text-muted-foreground">
                        {Math.round(b.score * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RailCard>

            <RailCard title={t('analyze.bento.skipHotspots')} Icon={Zap}>
              {topSkipMedia.length === 0 ? (
                <Empty t={t} />
              ) : (
                <ul className="space-y-1">
                  {topSkipMedia.map((m) => {
                    const isSelected = drilldownTarget?.kind === 'media' && drilldownTarget.id === m.id;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => toggleMediaDrilldown(m.id)}
                          className={`w-full flex items-center gap-2 text-[11px] rounded-md px-1.5 py-1 transition-colors text-left ${
                            isSelected
                              ? 'bg-primary/10 ring-1 ring-primary/40'
                              : 'hover:bg-secondary/50 focus:bg-secondary/50 focus:outline-none focus:ring-1 focus:ring-primary/30'
                          }`}
                          aria-pressed={isSelected}
                        >
                          <span className="flex-1 truncate">{m.name}</span>
                          <span className="font-data tabular-nums text-muted-foreground">
                            {m.skipCount}회
                          </span>
                          <span className="font-data tabular-nums w-9 text-right text-[var(--status-danger)]">
                            {Math.round(m.rate * 100)}%
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </RailCard>

            <RailCard title={t('analyze.bento.entryExit')} Icon={MoveHorizontal}>
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
            </RailCard>

            <RailCard title={t('analyze.bento.engagement')} Icon={Eye}>
              {totalExited === 0 ? (
                <Empty t={t} />
              ) : (
                <div className="space-y-1.5 text-[11px]">
                  <Row
                    label={t('analyze.engagement.avgZones')}
                    value={`${engagementSummary.avgZones.toFixed(1)} / ${zones.length}`}
                  />
                  <Row
                    label={t('analyze.engagement.avgMedia')}
                    value={`${engagementSummary.avgMedia.toFixed(1)} / ${media.length}`}
                  />
                  <Row
                    label={t('analyze.engagement.avgDwell')}
                    value={`${engagementSummary.avgDwellSec.toFixed(0)}s`}
                  />
                  <Row
                    label={t('analyze.engagement.fullCompletion')}
                    value={`${Math.round(engagementSummary.fullCompletion * 100)}%`}
                  />
                </div>
              )}
            </RailCard>
          </div>
        </aside>
      }
    />
  );
}

function ActionCard({
  action, ctaLabel, onClick,
}: { action: CockpitAction; ctaLabel: string; onClick: () => void }) {
  const accent = action.level === 'critical'
    ? 'border-[var(--status-danger)]/40 bg-[var(--status-danger)]/5 hover:border-[var(--status-danger)] hover:bg-[var(--status-danger)]/10'
    : 'border-[var(--status-warning)]/40 bg-[var(--status-warning)]/5 hover:border-[var(--status-warning)] hover:bg-[var(--status-warning)]/10';
  const dot = action.level === 'critical'
    ? 'bg-[var(--status-danger)]'
    : 'bg-[var(--status-warning)]';
  const ctaColor = action.level === 'critical'
    ? 'text-[var(--status-danger)]'
    : 'text-[var(--status-warning)]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left rounded-xl border-2 p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 flex flex-col ${accent}`}
    >
      <div className="flex items-start gap-2.5 flex-1">
        <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${dot}`} />
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-foreground leading-snug">{action.title}</div>
          <p className="text-sm text-muted-foreground mt-1.5 leading-snug">
            {action.detail}
          </p>
        </div>
      </div>
      <div className={`mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs font-semibold uppercase tracking-wider ${ctaColor}`}>
        <span>{ctaLabel}</span>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}

function RailCard({
  title, Icon, children,
}: { title: string; Icon: typeof Activity; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-background/40 p-3">
      <h3 className="text-[10px] uppercase tracking-wider font-semibold text-foreground/80 flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 text-primary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ t }: { t: T }) {
  return <p className="text-[11px] text-muted-foreground italic py-2">{t('analyze.bento.empty')}</p>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-data tabular-nums">{value}</span>
    </div>
  );
}

// ── RunSwitcher ──────────────────────────────────────────────────────────
// 같은 시나리오 (id+version+contentHash) 끼리 묶어서 보여주는 드롭다운.
// dirty-at-capture run 은 별도 그룹 (= 다른 contentHash) 으로 자동 분리되며 "변경됨" 태그가 붙는다.
// 이렇게 해야 baseline 묶음 안에서만 비교가 의미 있다.
interface RunGroup {
  readonly key: string;
  readonly scenarioName: string;
  readonly version: number;
  readonly contentHash: string;
  readonly dirty: boolean;
  readonly records: readonly RunRecord[];
}

function groupRecords(records: readonly RunRecord[]): RunGroup[] {
  const map = new Map<string, RunGroup>();
  for (const r of records) {
    const key = `${r.scenarioId}|v${r.scenarioVersion}|${r.contentHash}`;
    const existing = map.get(key);
    if (existing) {
      (existing.records as RunRecord[]).push(r);
    } else {
      map.set(key, {
        key,
        scenarioName: r.scenarioName,
        version: r.scenarioVersion,
        contentHash: r.contentHash,
        dirty: r.dirtyAtCapture,
        records: [r],
      });
    }
  }
  // 그룹 내부 — 최신 run 먼저
  // 그룹 사이 — 가장 최근 run 시간이 늦은 그룹 먼저
  const groups = Array.from(map.values()).map((g) => ({
    ...g,
    records: [...g.records].sort((a, b) => b.endedAt - a.endedAt),
  }));
  groups.sort((a, b) => (b.records[0]?.endedAt ?? 0) - (a.records[0]?.endedAt ?? 0));
  return groups;
}

function formatRunTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function RunSwitcher({
  records, activeRunId, onSelect, onRemove, t,
}: {
  records: readonly RunRecord[];
  activeRunId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  t: T;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const activeRecord = activeRunId ? records.find((r) => r.id === activeRunId) ?? null : null;
  const groups = useMemo(() => groupRecords(records), [records]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (records.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-secondary/40 text-muted-foreground text-xs">
        <History className="w-3.5 h-3.5" />
        {t('analyze.runs.live')}
      </div>
    );
  }

  const buttonLabel = activeRecord
    ? `${activeRecord.scenarioName} · v${activeRecord.scenarioVersion}${activeRecord.dirtyAtCapture ? ` · ${t('analyze.runs.dirtyTag')}` : ''}`
    : t('analyze.runs.live');
  const buttonSub = activeRecord ? formatRunTime(activeRecord.endedAt) : '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-accent transition-colors max-w-[280px]"
        title={t('analyze.runs.tooltip')}
      >
        <History className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{buttonLabel}</span>
        {buttonSub && (
          <span className="font-data tabular-nums text-muted-foreground/80 flex-shrink-0">
            {buttonSub}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[360px] max-h-[420px] overflow-y-auto bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
          <button
            type="button"
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-accent flex items-center justify-between ${
              activeRunId === null ? 'bg-accent/60' : ''
            }`}
          >
            <span className="font-medium">{t('analyze.runs.live')}</span>
            <span className="text-[10px] text-muted-foreground">{t('analyze.runs.live.hint')}</span>
          </button>
          {groups.map((g) => (
            <div key={g.key} className="border-t border-border/40 pt-1 mt-1 first:border-t-0 first:pt-0 first:mt-0">
              <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="truncate flex-1">{g.scenarioName}</span>
                <span className="font-data tabular-nums">v{g.version}</span>
                {g.dirty && (
                  <span className="px-1 py-0.5 rounded bg-[var(--status-warning)]/15 text-[var(--status-warning)] text-[9px] font-semibold">
                    {t('analyze.runs.dirtyTag')}
                  </span>
                )}
                <span className="font-data tabular-nums text-muted-foreground/60">#{g.contentHash.slice(0, 4)}</span>
              </div>
              {g.records.map((r) => {
                const isActive = r.id === activeRunId;
                return (
                  <div
                    key={r.id}
                    className={`group flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent ${
                      isActive ? 'bg-accent/60' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => { onSelect(r.id); setOpen(false); }}
                      className="flex-1 text-left flex items-center gap-2 min-w-0"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isActive ? 'bg-primary' : 'bg-muted-foreground/40'
                      }`} />
                      <span className="font-data tabular-nums text-muted-foreground flex-shrink-0">
                        {formatRunTime(r.endedAt)}
                      </span>
                      <span className="font-data tabular-nums text-foreground/80 flex-shrink-0">
                        {r.totalSpawned}→{r.totalExited}
                      </span>
                      <span className="font-data tabular-nums text-muted-foreground/80 flex-shrink-0">
                        {Math.round((r.latestSnapshot.flowEfficiency.completionRate ?? 0) * 100)}%
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(t('analyze.runs.removeConfirm'))) onRemove(r.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-opacity"
                      title={t('analyze.runs.remove')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
