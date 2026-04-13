import type { ZoneConfig, MediaPlacement, StaticInsight } from '@/domain';
import { INTERNATIONAL_DENSITY_STANDARD } from '@/domain';

export function analyzeStaticDensity(
  zones: readonly ZoneConfig[],
  media: readonly MediaPlacement[],
  expectedPeakVisitors: number,
): StaticInsight[] {
  return zones.map((zone) => {
    // Calculate media capacity in this zone
    const zoneMedia = media.filter((m) => m.zoneId === zone.id);
    const mediaCapacityTotal = zoneMedia.reduce((sum, m) => sum + m.capacity, 0);

    // Estimate peak visitors proportional to zone attractiveness
    const totalAttractiveness = zones.reduce((s, z) => s + z.attractiveness, 0);
    const projectedPeak = totalAttractiveness > 0
      ? Math.ceil(expectedPeakVisitors * (zone.attractiveness / totalAttractiveness))
      : 0;

    // Area per person at projected peak
    const areaPerPerson = projectedPeak > 0 ? zone.area / projectedPeak : zone.area;
    const meetsStandard = areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD;

    // Risk assessment
    let risk: 'low' | 'medium' | 'high' | 'critical';
    if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 2) {
      risk = 'low';
    } else if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD) {
      risk = 'medium';
    } else if (areaPerPerson >= INTERNATIONAL_DENSITY_STANDARD * 0.5) {
      risk = 'high';
    } else {
      risk = 'critical';
    }

    // Also check if media capacity is sufficient
    if (projectedPeak > mediaCapacityTotal * 1.5 && mediaCapacityTotal > 0) {
      risk = risk === 'low' ? 'medium' : risk === 'medium' ? 'high' : risk;
    }

    return {
      zoneId: zone.id,
      areaPerPerson,
      meetsStandard,
      mediaCapacityTotal,
      projectedPeakVisitors: projectedPeak,
      bottleneckRisk: risk,
    };
  });
}
