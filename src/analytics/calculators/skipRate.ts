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

  const perMedia: MediaSkipEntry[] = media.map((m) => {
    const entry = mediaSkipCounts.get(m.id as string) ?? { skips: 0, approaches: 0 };
    totalSkips += entry.skips;
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

  const globalRate = totalVisitors > 0 ? totalSkips / totalVisitors : 0;

  return { globalSkipRate: globalRate, perMedia, perZone };
}
