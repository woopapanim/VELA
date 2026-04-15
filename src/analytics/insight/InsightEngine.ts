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

export function generateInsights(
  snapshot: KpiSnapshot,
  zones: readonly ZoneConfig[],
  media?: readonly MediaPlacement[],
  mediaStats?: Map<string, MediaStatsEntry>,
  visitors?: readonly Visitor[],
  groups?: readonly VisitorGroup[],
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
        problem: `${zone.name} 과밀 상태 (수용률 ${Math.round(util.ratio * 100)}%)`,
        cause: `현재 ${util.currentOccupancy}명이 수용 인원 ${util.capacity}명을 초과 접근`,
        recommendation: '입장 제한 또는 존 면적 확장, 출구 게이트 추가 검토',
        affectedZoneIds: [util.zoneId],
        affectedMediaIds: [],
        dataEvidence: { metric: 'utilization_ratio', value: util.ratio, threshold: 0.9 },
      });
    } else if (util.ratio > 0.7) {
      insights.push({
        severity: 'warning',
        category: 'congestion',
        problem: `${zone.name} 혼잡도 상승 (수용률 ${Math.round(util.ratio * 100)}%)`,
        cause: '유입량 대비 공간 여유 부족',
        recommendation: '동선 분산 또는 인접 존으로 관심 요소 분배 고려',
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
      const groupNote = bn.isGroupInduced
        ? ' (단체 방문객에 의한 일시적 정체 가능성)'
        : '';
      insights.push({
        severity: bn.score > 0.85 ? 'critical' : 'warning',
        category: 'congestion',
        problem: `${zone.name} 병목 감지 (지수 ${Math.round(bn.score * 100)})${groupNote}`,
        cause: `유입률(${bn.flowInRate}/s) > 유출률(${bn.flowOutRate}/s), 대기 발생`,
        recommendation: bn.isGroupInduced
          ? '단체 통과 시간 고려한 게이트 폭 확장 또는 별도 동선 제공'
          : '출구 게이트 추가 또는 미디어 배치 분산으로 체류 시간 단축',
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
      insights.push({
        severity: 'warning',
        category: 'capacity',
        problem: `${zone.name} 국제 밀도 기준 미달 (${areaPerPerson.toFixed(1)}m²/인 < ${INTERNATIONAL_DENSITY_STANDARD}m²/인)`,
        cause: `현재 점유 ${util.currentOccupancy}명 대비 면적 ${zone.area}m² 부족`,
        recommendation: '존 면적 확대 또는 수용 인원 상한 설정 필요',
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
    insights.push({
      severity: 'warning',
      category: 'skip',
      problem: `전체 스킵률 ${Math.round(snapshot.skipRate.globalSkipRate * 100)}% — 관람 포기 다수 발생`,
      cause: '대기 시간 초과 또는 미디어 수용량 부족',
      recommendation: '인기 미디어의 복제 배치 또는 대기열 관리 시스템 도입',
      affectedZoneIds: [],
      affectedMediaIds: snapshot.skipRate.perMedia
        .filter((m) => m.rate > 0.4)
        .map((m) => m.mediaId),
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
      problem: `관람객 90%가 피로도 ${Math.round(snapshot.fatigueDistribution.p90 * 100)}% 이상`,
      cause: '휴식 공간 부족 또는 동선 과다',
      recommendation: '중간 지점에 휴식 존 추가 또는 동선 단축 검토',
      affectedZoneIds: [],
      affectedMediaIds: [],
      dataEvidence: { metric: 'fatigue_p90', value: snapshot.fatigueDistribution.p90, threshold: 0.7 },
    });
  }

  // ══════════════════════════════════
  // 6. Flow Efficiency
  // ══════════════════════════════════
  if (snapshot.flowEfficiency.completionRate < 0.5 && snapshot.flowEfficiency.totalVisitorsProcessed > 10) {
    insights.push({
      severity: 'info',
      category: 'flow',
      problem: `관람 완주율 ${Math.round(snapshot.flowEfficiency.completionRate * 100)}% — 절반 이상 조기 이탈`,
      cause: '피로 축적, 동선 혼잡, 또는 관심도 낮은 존 배치',
      recommendation: '핵심 전시물을 초반 동선에 배치하여 관람 동기 유지',
      affectedZoneIds: [],
      affectedMediaIds: [],
      dataEvidence: { metric: 'completion_rate', value: snapshot.flowEfficiency.completionRate, threshold: 0.5 },
    });
  }

  // ══════════════════════════════════════════════════════════
  // 7~11: 확장 인사이트 (media, visitors, groups 필요)
  // ══════════════════════════════════════════════════════════
  if (media && mediaStats && media.length > 0) {
    generateSpaceRoiInsights(insights, media, mediaStats);
    generateContentMixInsights(insights, media, mediaStats);
    generateContentFatigueInsights(insights, media, mediaStats);
  }
  if (visitors && visitors.length > 0) {
    generateGroupImpactInsights(insights, visitors, groups ?? [], snapshot);
  }

  return insights;
}

// ══════════════════════════════════
// 7. 공간 효율 (Space ROI)
// ══════════════════════════════════
function generateSpaceRoiInsights(
  insights: InsightEntry[],
  media: readonly MediaPlacement[],
  mediaStats: Map<string, MediaStatsEntry>,
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
      problem: `${names.join(', ')} — 공간 대비 관람 효율 저조 (평균의 ${worstPct}%)`,
      cause: `넓은 면적을 차지하지만 관람 시간이 짧거나 방문자가 적음`,
      recommendation: '크기 축소, 위치 변경, 또는 매력도 높은 콘텐츠로 교체 검토',
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
      problem: `${name} — 최고 공간 효율 (평균의 ${Math.round((best.density / avgDensity) * 100)}%)`,
      cause: `${best.watchCount}명이 관람, 단위 면적당 관람 시간이 가장 높음`,
      recommendation: '유사 콘텐츠 확대 배치 또는 동선 최적화로 접근성 강화',
      affectedZoneIds: [],
      affectedMediaIds: [best.m.id],
      dataEvidence: { metric: 'engagement_density', value: best.density, threshold: avgDensity * 2 },
    });
  }
}

// ══════════════════════════════════
// 8. 카테고리별 체류시간/스킵 분석
// ══════════════════════════════════
function generateContentMixInsights(
  insights: InsightEntry[],
  media: readonly MediaPlacement[],
  mediaStats: Map<string, MediaStatsEntry>,
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

  const catLabels: Record<string, string> = {
    analog: '아날로그', passive_media: '패시브 미디어', active: '액티브', immersive: '이머시브'
  };

  for (const [cat, stats] of catStats) {
    const total = stats.totalWatch + stats.totalSkip;
    if (total < 5) continue;
    const skipRate = stats.totalSkip / total;
    const avgWatchSec = stats.totalWatch > 0
      ? Math.round(stats.totalWatchMs / stats.totalWatch / 1000)
      : 0;

    if (skipRate > 0.4) {
      insights.push({
        severity: 'warning',
        category: 'content_mix',
        problem: `${catLabels[cat] ?? cat} 카테고리 스킵률 ${Math.round(skipRate * 100)}% — 콘텐츠 접근 불균형`,
        cause: `${stats.count}개 ${catLabels[cat] ?? cat} 콘텐츠에서 총 ${stats.totalSkip}회 스킵 발생 (평균 관람 ${avgWatchSec}초)`,
        recommendation: cat === 'active' || cat === 'immersive'
          ? '수용량 증설 또는 동일 유형 추가 배치로 대기시간 단축'
          : '배치 간격 조정 또는 다른 카테고리 콘텐츠와 교차 배치',
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
// 9. 도슨트 그룹 영향도
// ══════════════════════════════════
function generateGroupImpactInsights(
  insights: InsightEntry[],
  visitors: readonly Visitor[],
  groups: readonly VisitorGroup[],
  snapshot: KpiSnapshot,
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
          problem: `도슨트 그룹이 전체의 ${tourPct}%이지만 병목의 ${impactPct}%를 유발`,
          cause: `${groups.filter(g => g.type === 'guided').length}개 도슨트 그룹(${tourCount}명)이 이동 시 통로 점유`,
          recommendation: '도슨트 전용 동선 설계 또는 투어 시간대 분산 운영 검토',
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
        problem: `그룹 관람객 평균 피로도(${Math.round(groupAvgFatigue * 100)}%)가 솔로(${Math.round(soloAvgFatigue * 100)}%)보다 높음`,
        cause: `그룹 관람(${groupCount}명)은 체류시간 배율이 높아 피로 누적이 빠름`,
        recommendation: '그룹 동선 중간에 휴식 존 배치 또는 관람 콘텐츠 수 조절',
        affectedZoneIds: [],
        affectedMediaIds: [],
        dataEvidence: { metric: 'group_fatigue_ratio', value: groupAvgFatigue, threshold: soloAvgFatigue * 1.3 },
      });
    }
  }
}

// ══════════════════════════════════
// 10. 콘텐츠 피로도 패턴
// ══════════════════════════════════
function generateContentFatigueInsights(
  insights: InsightEntry[],
  media: readonly MediaPlacement[],
  mediaStats: Map<string, MediaStatsEntry>,
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

  const fatLabels: Record<string, string> = {
    analog: '아날로그 전시물', screen: '스크린 미디어', interactive: '인터랙션 체험', immersive: '이머시브 체험'
  };

  for (const [fatCat, stats] of fatigueCatStats) {
    if (stats.mediaCount < 3) continue; // 3개 이상일 때만 피로도 의미
    const total = stats.totalWatch + stats.totalSkip;
    if (total < 10) continue;
    const skipRate = stats.totalSkip / total;

    if (skipRate > 0.35 && stats.mediaCount >= 3) {
      insights.push({
        severity: 'info',
        category: 'content_fatigue',
        problem: `${fatLabels[fatCat] ?? fatCat} 유형 ${stats.mediaCount}개 연속 배치 — 스킵률 ${Math.round(skipRate * 100)}%`,
        cause: `같은 유형(${fatLabels[fatCat] ?? fatCat}) 콘텐츠 반복으로 관람 피로도 누적`,
        recommendation: '다른 카테고리 콘텐츠를 사이에 교차 배치하여 관람 리듬 변화 유도',
        affectedZoneIds: [],
        affectedMediaIds: media
          .filter(m => presets[m.type as string]?.fatigueCategory === fatCat)
          .map(m => m.id),
        dataEvidence: { metric: `${fatCat}_fatigue_skip`, value: skipRate, threshold: 0.35 },
      });
    }
  }
}
