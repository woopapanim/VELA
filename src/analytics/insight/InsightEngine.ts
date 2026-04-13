import type { KpiSnapshot, ZoneConfig, InsightEntry } from '@/domain';
import { INTERNATIONAL_DENSITY_STANDARD } from '@/domain';

export function generateInsights(
  snapshot: KpiSnapshot,
  zones: readonly ZoneConfig[],
): InsightEntry[] {
  const insights: InsightEntry[] = [];
  const zoneMap = new Map(zones.map((z) => [z.id as string, z]));

  // 1. Congestion Analysis
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

  // 2. Bottleneck Detection
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

  // 3. Density Standard Check
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

  // 4. Skip Rate Warning
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

  // 5. Fatigue Warning
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

  // 6. Flow Efficiency
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

  return insights;
}
