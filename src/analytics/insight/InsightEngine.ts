import type { KpiSnapshot, ZoneConfig, MediaPlacement, Visitor, VisitorGroup, InsightEntry } from '@/domain';
import { INTERNATIONAL_DENSITY_STANDARD, MEDIA_PRESETS } from '@/domain';

interface MediaStatsEntry {
  watchCount: number;
  skipCount: number;
  waitCount: number;
  totalWatchMs: number;
  totalWaitMs: number;
  peakViewers: number;
}

type TParams = Record<string, string | number>;
type TFn = (key: string, params?: TParams, fallback?: string) => string;

const identityT: TFn = (key, _params, fallback) => fallback ?? key;

export function generateInsights(
  snapshot: KpiSnapshot,
  zones: readonly ZoneConfig[],
  media?: readonly MediaPlacement[],
  mediaStats?: ReadonlyMap<string, MediaStatsEntry>,
  visitors?: readonly Visitor[],
  groups?: readonly VisitorGroup[],
  t: TFn = identityT,
): InsightEntry[] {
  const insights: InsightEntry[] = [];
  const zoneMap = new Map(zones.map((z) => [z.id as string, z]));

  // ══════════════════════════════════
  // 1. Congestion Analysis
  // ══════════════════════════════════
  for (const util of snapshot.zoneUtilizations) {
    const zone = zoneMap.get(util.zoneId as string);
    if (!zone) continue;

    if (util.ratio > 0.9) {
      insights.push({
        severity: 'critical',
        category: 'congestion',
        problem: t('insight.congestion.critical.problem', { zone: zone.name }),
        cause: t('insight.congestion.critical.cause', {
          occupancy: util.currentOccupancy,
          capacity: util.capacity,
          pct: Math.round(util.ratio * 100),
        }),
        recommendation: t('insight.congestion.critical.rec'),
        affectedZoneIds: [util.zoneId],
        affectedMediaIds: [],
        dataEvidence: { metric: 'utilization_ratio', value: util.ratio, threshold: 0.9 },
      });
    } else if (util.ratio > 0.7) {
      insights.push({
        severity: 'warning',
        category: 'congestion',
        problem: t('insight.congestion.warning.problem', { zone: zone.name }),
        cause: t('insight.congestion.warning.cause', { pct: Math.round(util.ratio * 100) }),
        recommendation: t('insight.congestion.warning.rec'),
        affectedZoneIds: [util.zoneId],
        affectedMediaIds: [],
        dataEvidence: { metric: 'utilization_ratio', value: util.ratio, threshold: 0.7 },
      });
    }
  }

  // ══════════════════════════════════
  // 2. Bottleneck Detection
  // ══════════════════════════════════
  for (const bn of snapshot.bottlenecks) {
    const zone = zoneMap.get(bn.zoneId as string);
    if (!zone) continue;

    if (bn.score > 0.7) {
      const isCritical = bn.score > 0.85;
      insights.push({
        severity: isCritical ? 'critical' : 'warning',
        category: 'congestion',
        problem: bn.isGroupInduced
          ? t('insight.bottleneck.group.problem', { zone: zone.name })
          : isCritical
            ? t('insight.bottleneck.critical.problem', { zone: zone.name })
            : t('insight.bottleneck.warning.problem', { zone: zone.name }),
        cause: t('insight.bottleneck.cause', {
          flowIn: bn.flowInRate,
          flowOut: bn.flowOutRate,
          score: Math.round(bn.score * 100),
        }),
        recommendation: bn.isGroupInduced
          ? t('insight.bottleneck.group.rec')
          : t('insight.bottleneck.nonGroup.rec'),
        affectedZoneIds: [bn.zoneId],
        affectedMediaIds: [],
        dataEvidence: { metric: 'bottleneck_score', value: bn.score, threshold: 0.7 },
      });
    }
  }

  // ══════════════════════════════════
  // 3. Density Standard Check
  // ══════════════════════════════════
  for (const util of snapshot.zoneUtilizations) {
    const zone = zoneMap.get(util.zoneId as string);
    if (!zone || util.currentOccupancy === 0) continue;

    const areaPerPerson = zone.area / util.currentOccupancy;
    if (areaPerPerson < INTERNATIONAL_DENSITY_STANDARD) {
      const safeCap = Math.floor(zone.area / INTERNATIONAL_DENSITY_STANDARD);
      insights.push({
        severity: 'warning',
        category: 'capacity',
        problem: t('insight.density.problem', { zone: zone.name }),
        cause: t('insight.density.cause', {
          areaPerPerson: areaPerPerson.toFixed(1),
          standard: INTERNATIONAL_DENSITY_STANDARD,
          occupancy: util.currentOccupancy,
          area: zone.area,
        }),
        recommendation: t('insight.density.rec', {
          safeCap,
          expandM2: Math.ceil(util.currentOccupancy * INTERNATIONAL_DENSITY_STANDARD - zone.area),
        }),
        affectedZoneIds: [util.zoneId],
        affectedMediaIds: [],
        dataEvidence: { metric: 'area_per_person', value: areaPerPerson, threshold: INTERNATIONAL_DENSITY_STANDARD },
      });
    }
  }

  // ══════════════════════════════════
  // 4. Skip Rate Warning
  // ══════════════════════════════════
  if (snapshot.skipRate.globalSkipRate > 0.3) {
    const highSkipMedia = snapshot.skipRate.perMedia.filter((m) => m.rate > 0.4);
    const mediaById = new Map((media ?? []).map((m) => [m.id as string, m]));
    const nameOf = (id: string): string => {
      const m = mediaById.get(id);
      if (!m) return id.slice(0, 6);
      const anyM = m as any;
      return (anyM.name && String(anyM.name).trim()) || String(m.type ?? id).replace(/_/g, ' ');
    };
    const topNames = highSkipMedia
      .slice(0, 3)
      .map((m) => nameOf(m.mediaId as string));
    const namesText = topNames.join(', ');
    insights.push({
      severity: 'warning',
      category: 'skip',
      problem: topNames.length > 0
        ? t('insight.skip.problem.withNames', { names: namesText })
        : t('insight.skip.problem'),
      cause: t('insight.skip.cause', { pct: Math.round(snapshot.skipRate.globalSkipRate * 100) }),
      recommendation: highSkipMedia.length > 0
        ? t('insight.skip.rec.withHighSkip', { count: highSkipMedia.length, names: namesText })
        : t('insight.skip.rec.default'),
      affectedZoneIds: [],
      affectedMediaIds: highSkipMedia.map((m) => m.mediaId),
      dataEvidence: { metric: 'global_skip_rate', value: snapshot.skipRate.globalSkipRate, threshold: 0.3 },
    });
  }

  // ══════════════════════════════════
  // 5. Fatigue Warning
  // ══════════════════════════════════
  if (snapshot.fatigueDistribution.p90 > 0.7) {
    insights.push({
      severity: 'warning',
      category: 'fatigue',
      problem: t('insight.fatigue.problem'),
      cause: t('insight.fatigue.cause', { pct: Math.round(snapshot.fatigueDistribution.p90 * 100) }),
      recommendation: t('insight.fatigue.rec'),
      affectedZoneIds: [],
      affectedMediaIds: [],
      dataEvidence: { metric: 'fatigue_p90', value: snapshot.fatigueDistribution.p90, threshold: 0.7 },
    });
  }

  // ══════════════════════════════════
  // 6. Flow Efficiency
  // ══════════════════════════════════
  if (snapshot.flowEfficiency.completionRate < 0.5 && snapshot.flowEfficiency.totalVisitorsProcessed > 10) {
    // Top-engagement media by watch/(watch+skip), filtered by minimum sample size.
    const topEngagement: { id: string; name: string }[] = [];
    if (media && mediaStats) {
      const scored = media.map((m) => {
        const stats = mediaStats.get(m.id as string);
        const w = stats?.watchCount ?? 0;
        const s = stats?.skipCount ?? 0;
        const approaches = w + s;
        const rate = approaches >= 3 ? w / approaches : -1;
        const anyM = m as any;
        const name = (anyM.name && String(anyM.name).trim())
          || String(m.type ?? m.id).replace(/_/g, ' ');
        return { id: m.id as string, name, rate };
      }).filter((e) => e.rate >= 0.6);
      scored.sort((a, b) => b.rate - a.rate);
      for (const e of scored.slice(0, 3)) topEngagement.push({ id: e.id, name: e.name });
    }
    const namesText = topEngagement.map((e) => e.name).join(', ');
    insights.push({
      severity: 'info',
      category: 'flow',
      problem: topEngagement.length > 0
        ? t('insight.flow.problem.withNames', { names: namesText })
        : t('insight.flow.problem'),
      cause: t('insight.flow.cause', { pct: Math.round(snapshot.flowEfficiency.completionRate * 100) }),
      recommendation: topEngagement.length > 0
        ? t('insight.flow.rec.withNames', { names: namesText })
        : t('insight.flow.rec'),
      affectedZoneIds: [],
      affectedMediaIds: topEngagement.map((e) => e.id as any),
      dataEvidence: { metric: 'completion_rate', value: snapshot.flowEfficiency.completionRate, threshold: 0.5 },
    });
  }

  // ══════════════════════════════════════════════════════════
  // 7~11: Extended insights (media, visitors, groups required)
  // ══════════════════════════════════════════════════════════
  if (media && mediaStats && media.length > 0) {
    generateSpaceRoiInsights(insights, media, mediaStats, t);
    generateContentMixInsights(insights, media, mediaStats, t);
    generateContentFatigueInsights(insights, media, mediaStats, t);
  }
  if (visitors && visitors.length > 0) {
    generateGroupImpactInsights(insights, visitors, groups ?? [], snapshot, t);
  }

  return insights;
}

// ══════════════════════════════════
// 7. Space ROI
// ══════════════════════════════════
function generateSpaceRoiInsights(
  insights: InsightEntry[],
  media: readonly MediaPlacement[],
  mediaStats: ReadonlyMap<string, MediaStatsEntry>,
  t: TFn,
) {
  // engagement density = totalWatchMs / area(m²)
  const roiEntries: { m: MediaPlacement; density: number; watchCount: number }[] = [];
  let totalArea = 0;
  let totalEngagement = 0;

  for (const m of media) {
    const stats = mediaStats.get(m.id as string);
    if (!stats || stats.watchCount === 0) continue;
    const area = m.size.width * m.size.height;
    const engagementMs = stats.totalWatchMs;
    const density = engagementMs / area; // ms per m²
    totalArea += area;
    totalEngagement += engagementMs;
    roiEntries.push({ m, density, watchCount: stats.watchCount });
  }

  if (roiEntries.length < 2) return;

  roiEntries.sort((a, b) => b.density - a.density);
  const avgDensity = totalEngagement / totalArea;

  // Flag media with very low ROI (< 20% of average)
  const lowRoi = roiEntries.filter(e => e.density < avgDensity * 0.2);
  if (lowRoi.length > 0) {
    const names = lowRoi.slice(0, 3).map(e => (e.m as any).name || e.m.type.replace(/_/g, ' '));
    const worstPct = Math.round((lowRoi[0].density / avgDensity) * 100);
    insights.push({
      severity: 'info',
      category: 'space_roi',
      problem: t('insight.spaceRoi.low.problem', { names: names.join(', ') }),
      cause: t('insight.spaceRoi.low.cause', { pct: worstPct }),
      recommendation: t('insight.spaceRoi.low.rec'),
      affectedZoneIds: [],
      affectedMediaIds: lowRoi.map(e => e.m.id),
      dataEvidence: { metric: 'engagement_density', value: lowRoi[0].density, threshold: avgDensity * 0.2 },
    });
  }

  // Flag top performer
  const best = roiEntries[0];
  if (best.density > avgDensity * 2) {
    const name = (best.m as any).name || best.m.type.replace(/_/g, ' ');
    insights.push({
      severity: 'info',
      category: 'space_roi',
      problem: t('insight.spaceRoi.high.problem', { name }),
      cause: t('insight.spaceRoi.high.cause', {
        pct: Math.round((best.density / avgDensity) * 100),
        count: best.watchCount,
      }),
      recommendation: t('insight.spaceRoi.high.rec'),
      affectedZoneIds: [],
      affectedMediaIds: [best.m.id],
      dataEvidence: { metric: 'engagement_density', value: best.density, threshold: avgDensity * 2 },
    });
  }
}

// ══════════════════════════════════
// 8. Content mix — dwell/skip analysis by category
// ══════════════════════════════════
function generateContentMixInsights(
  insights: InsightEntry[],
  media: readonly MediaPlacement[],
  mediaStats: ReadonlyMap<string, MediaStatsEntry>,
  t: TFn,
) {
  const catStats = new Map<string, { totalWatch: number; totalSkip: number; totalWatchMs: number; count: number }>();

  for (const m of media) {
    const cat = (m as any).category as string;
    if (!cat) continue;
    const stats = mediaStats.get(m.id as string);
    if (!stats) continue;
    const prev = catStats.get(cat) ?? { totalWatch: 0, totalSkip: 0, totalWatchMs: 0, count: 0 };
    prev.totalWatch += stats.watchCount;
    prev.totalSkip += stats.skipCount;
    prev.totalWatchMs += stats.totalWatchMs;
    prev.count++;
    catStats.set(cat, prev);
  }

  for (const [cat, stats] of catStats) {
    const total = stats.totalWatch + stats.totalSkip;
    if (total < 5) continue;
    const skipRate = stats.totalSkip / total;
    const avgWatchSec = stats.totalWatch > 0
      ? Math.round(stats.totalWatchMs / stats.totalWatch / 1000)
      : 0;

    if (skipRate > 0.4) {
      const catLabel = t(`insight.category.${cat}`, undefined, cat);
      const isHighCapacityCat = cat === 'active' || cat === 'immersive';
      insights.push({
        severity: 'warning',
        category: 'content_mix',
        problem: isHighCapacityCat
          ? t('insight.contentMix.capacity.problem', { category: catLabel })
          : t('insight.contentMix.layout.problem', { category: catLabel }),
        cause: t('insight.contentMix.cause', {
          pct: Math.round(skipRate * 100),
          count: stats.count,
          skipCount: stats.totalSkip,
          avgSec: avgWatchSec,
        }),
        recommendation: isHighCapacityCat
          ? t('insight.contentMix.capacity.rec')
          : t('insight.contentMix.layout.rec'),
        affectedZoneIds: [],
        affectedMediaIds: media
          .filter(m => (m as any).category === cat)
          .map(m => m.id),
        dataEvidence: { metric: `${cat}_skip_rate`, value: skipRate, threshold: 0.4 },
      });
    }
  }
}

// ══════════════════════════════════
// 9. Docent group impact
// ══════════════════════════════════
function generateGroupImpactInsights(
  insights: InsightEntry[],
  visitors: readonly Visitor[],
  groups: readonly VisitorGroup[],
  snapshot: KpiSnapshot,
  t: TFn,
) {
  const active = visitors.filter(v => v.isActive);
  if (active.length < 10) return;

  // Category distribution
  const catCounts: Record<string, number> = {};
  for (const v of active) {
    const cat = (v as any).category as string ?? 'solo';
    catCounts[cat] = (catCounts[cat] ?? 0) + 1;
  }

  const tourCount = catCounts['guided_tour'] ?? 0;
  const groupCount = (catCounts['small_group'] ?? 0) + tourCount;
  const soloCount = catCounts['solo'] ?? 0;
  const totalCount = active.length;

  // Tour impact: tour agents as % of total vs congestion contribution
  if (tourCount > 0 && snapshot.bottlenecks.length > 0) {
    const tourPct = Math.round((tourCount / totalCount) * 100);
    const groupInducedCount = snapshot.bottlenecks.filter(b => b.isGroupInduced).length;
    const totalBottlenecks = snapshot.bottlenecks.filter(b => b.score > 0.3).length;

    if (groupInducedCount > 0 && totalBottlenecks > 0) {
      const impactPct = Math.round((groupInducedCount / totalBottlenecks) * 100);
      if (impactPct > tourPct * 2) { // disproportionate impact
        insights.push({
          severity: 'warning',
          category: 'group_impact',
          problem: t('insight.groupImpact.tour.problem'),
          cause: t('insight.groupImpact.tour.cause', {
            tourPct,
            impactPct,
            groupCount: groups.filter(g => g.type === 'guided').length,
            tourCount,
          }),
          recommendation: t('insight.groupImpact.tour.rec'),
          affectedZoneIds: snapshot.bottlenecks
            .filter(b => b.isGroupInduced)
            .map(b => b.zoneId),
          affectedMediaIds: [],
          dataEvidence: { metric: 'tour_congestion_ratio', value: impactPct / 100, threshold: tourPct / 100 },
        });
      }
    }
  }

  // Group vs Solo dwell time comparison
  if (groupCount > 5 && soloCount > 5) {
    // Estimate from fatigue as proxy (groups have higher dwellTimeMultiplier)
    let soloFatigueSum = 0, soloN = 0;
    let groupFatigueSum = 0, groupN = 0;
    for (const v of active) {
      const cat = (v as any).category as string ?? 'solo';
      if (cat === 'solo') { soloFatigueSum += v.fatigue; soloN++; }
      else if (cat === 'small_group' || cat === 'guided_tour') { groupFatigueSum += v.fatigue; groupN++; }
    }
    const soloAvgFatigue = soloN > 0 ? soloFatigueSum / soloN : 0;
    const groupAvgFatigue = groupN > 0 ? groupFatigueSum / groupN : 0;

    if (groupAvgFatigue > soloAvgFatigue * 1.3 && groupAvgFatigue > 0.15) {
      insights.push({
        severity: 'info',
        category: 'group_impact',
        problem: t('insight.groupImpact.fatigue.problem'),
        cause: t('insight.groupImpact.fatigue.cause', {
          groupPct: Math.round(groupAvgFatigue * 100),
          soloPct: Math.round(soloAvgFatigue * 100),
          count: groupCount,
        }),
        recommendation: t('insight.groupImpact.fatigue.rec'),
        affectedZoneIds: [],
        affectedMediaIds: [],
        dataEvidence: { metric: 'group_fatigue_ratio', value: groupAvgFatigue, threshold: soloAvgFatigue * 1.3 },
      });
    }
  }
}

// ══════════════════════════════════
// 10. Content fatigue pattern
// ══════════════════════════════════
function generateContentFatigueInsights(
  insights: InsightEntry[],
  media: readonly MediaPlacement[],
  mediaStats: ReadonlyMap<string, MediaStatsEntry>,
  t: TFn,
) {
  // Check fatigue categories: if same fatigueCategory media have high skip rates
  const presets = MEDIA_PRESETS as Record<string, any>;
  const fatigueCatStats = new Map<string, { totalWatch: number; totalSkip: number; mediaCount: number }>();

  for (const m of media) {
    const preset = presets[m.type as string];
    const fatCat = preset?.fatigueCategory;
    if (!fatCat) continue;
    const stats = mediaStats.get(m.id as string);
    if (!stats) continue;
    const prev = fatigueCatStats.get(fatCat) ?? { totalWatch: 0, totalSkip: 0, mediaCount: 0 };
    prev.totalWatch += stats.watchCount;
    prev.totalSkip += stats.skipCount;
    prev.mediaCount++;
    fatigueCatStats.set(fatCat, prev);
  }

  for (const [fatCat, stats] of fatigueCatStats) {
    if (stats.mediaCount < 3) continue; // fatigue only meaningful with 3+
    const total = stats.totalWatch + stats.totalSkip;
    if (total < 10) continue;
    const skipRate = stats.totalSkip / total;

    if (skipRate > 0.35 && stats.mediaCount >= 3) {
      const fatLabel = t(`insight.fatigueCategory.${fatCat}`, undefined, fatCat);
      insights.push({
        severity: 'info',
        category: 'content_fatigue',
        problem: t('insight.contentFatigue.problem', { category: fatLabel }),
        cause: t('insight.contentFatigue.cause', {
          count: stats.mediaCount,
          pct: Math.round(skipRate * 100),
        }),
        recommendation: t('insight.contentFatigue.rec'),
        affectedZoneIds: [],
        affectedMediaIds: media
          .filter(m => presets[m.type as string]?.fatigueCategory === fatCat)
          .map(m => m.id),
        dataEvidence: { metric: `${fatCat}_fatigue_skip`, value: skipRate, threshold: 0.35 },
      });
    }
  }
}
