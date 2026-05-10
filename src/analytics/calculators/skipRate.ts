import type { ZoneConfig, MediaPlacement, SkipRateAnalysis, MediaSkipEntry, ZoneSkipEntry } from '@/domain';

// Track skip events globally (accumulated over simulation)
const mediaSkipCounts = new Map<string, { skips: number; approaches: number }>();
const zoneSkipCounts = new Map<string, { skips: number }>();

export function resetSkipTracking() {
  mediaSkipCounts.clear();
  zoneSkipCounts.clear();
}

export function recordSkipEvent(mediaId: string | null, zoneId: string | null) {
  if (mediaId) {
    const entry = mediaSkipCounts.get(mediaId) ?? { skips: 0, approaches: 0 };
    entry.skips++;
    mediaSkipCounts.set(mediaId, entry);
  }
  if (zoneId) {
    const entry = zoneSkipCounts.get(zoneId) ?? { skips: 0 };
    entry.skips++;
    zoneSkipCounts.set(zoneId, entry);
  }
}

export function recordMediaApproach(mediaId: string) {
  const entry = mediaSkipCounts.get(mediaId) ?? { skips: 0, approaches: 0 };
  entry.approaches++;
  mediaSkipCounts.set(mediaId, entry);
}

export function calculateSkipRate(
  media: readonly MediaPlacement[],
  zones: readonly ZoneConfig[],
  totalVisitors: number,
): SkipRateAnalysis {
  let totalSkips = 0;
  let totalApproaches = 0;

  const perMedia: MediaSkipEntry[] = media.map((m) => {
    const entry = mediaSkipCounts.get(m.id as string) ?? { skips: 0, approaches: 0 };
    totalSkips += entry.skips;
    totalApproaches += entry.approaches;
    return {
      mediaId: m.id,
      skipCount: entry.skips,
      totalApproaches: entry.approaches,
      rate: entry.approaches > 0 ? entry.skips / entry.approaches : 0,
    };
  });

  const perZone: ZoneSkipEntry[] = zones.map((z) => {
    const entry = zoneSkipCounts.get(z.id as string) ?? { skips: 0 };
    return {
      zoneId: z.id,
      skipCount: entry.skips,
      rate: totalVisitors > 0 ? entry.skips / totalVisitors : 0,
    };
  });

  // Two distinct metrics, both retained for backward compat:
  //   globalSkipRate    = totalSkips / totalVisitors  (visitor당 평균 skip 횟수;
  //                       100%+ 가능, misleading naming)
  //   approachSkipRate  = totalSkips / totalApproaches (시도 중 실제 skip 비율;
  //                       0~1, 사용자가 "스킵률" 로 직관 기대하는 값)
  // UI 는 approachSkipRate 를 default 표시. globalSkipRate 는 별도 라벨
  // ("visitor 당 skip 횟수") 로만 노출하거나 deprecated 처리.
  const globalRate = totalVisitors > 0 ? totalSkips / totalVisitors : 0;
  const approachRate = totalApproaches > 0 ? totalSkips / totalApproaches : 0;

  return { globalSkipRate: globalRate, approachSkipRate: approachRate, perMedia, perZone };
}
