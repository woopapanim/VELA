import type {
  Visitor,
  ZoneConfig,
  MediaPlacement,
  MediaId,
  ZoneId,
} from '@/domain';
import { ENGAGEMENT_LEVEL } from '@/domain';
import type { SeededRandom } from '../utils/random';

// ---- Decide next target zone based on engagement profile ----
export function selectNextZone(
  visitor: Visitor,
  _currentZone: ZoneConfig | null,
  allZones: readonly ZoneConfig[],
  rng: SeededRandom,
): ZoneId | null {
  const visited = new Set(visitor.visitedZoneIds.map((z) => z as string));

  // Exhibition/Rest/Stage zones only (never Entrance; Exit only after all exh visited)
  const exhibitionZones = allZones.filter((z) => z.type !== 'entrance' && z.type !== 'exit');
  const allExhibitionsVisited = exhibitionZones.length === 0 ||
    exhibitionZones.every((z) => visited.has(z.id as string));

  // Candidates: unvisited non-entrance zones; exclude Exit until all exhibitions done
  let candidates = allZones.filter(
    (z) => !visited.has(z.id as string) &&
           z.type !== 'entrance' &&
           (z.type !== 'exit' || allExhibitionsVisited),
  );

  if (candidates.length === 0) {
    // All exhibition zones visited → head to Exit
    const exitZone = allZones.find((z) => z.type === 'exit');
    return exitZone?.id ?? null;
  }

  // Weight by attractiveness and interest map
  const weights = candidates.map((z) => {
    const interest = (visitor.profile.interestMap as Record<string, number>)[z.id as string] ?? 0.5;
    return {
      zoneId: z.id,
      weight: z.attractiveness * interest * (1 - visitor.fatigue * 0.5),
    };
  });

  // Weighted random selection
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  if (totalWeight <= 0) return candidates[0]?.id ?? null;

  let r = rng.next() * totalWeight;
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w.zoneId;
  }
  return weights[weights.length - 1].zoneId;
}

// ---- Decide next target media within a zone ----
export function selectNextMedia(
  visitor: Visitor,
  zoneMedia: readonly MediaPlacement[],
  rng: SeededRandom,
): MediaId | null {
  const visitedMedia = new Set(visitor.visitedMediaIds.map((m) => m as string));
  const candidates = zoneMedia.filter((m) => !visitedMedia.has(m.id as string));

  if (candidates.length === 0) return null;

  // Engagement level affects preference
  const { engagementLevel } = visitor.profile;
  const weights = candidates.map((m) => {
    let weight = m.attractiveness;

    if (engagementLevel === ENGAGEMENT_LEVEL.QUICK) {
      weight *= m.avgEngagementTimeMs < 30_000 ? 1.5 : 0.5;
    } else if (engagementLevel === ENGAGEMENT_LEVEL.IMMERSIVE) {
      weight *= m.avgEngagementTimeMs > 60_000 ? 1.5 : 0.8;
    }

    return { mediaId: m.id, weight };
  });

  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  if (totalWeight <= 0) return candidates[0]?.id ?? null;

  let r = rng.next() * totalWeight;
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w.mediaId;
  }
  return weights[weights.length - 1].mediaId;
}

// ---- Skip Logic: should visitor skip current target? ----
// Formula: waitTime > (patience * attractiveness * skipMultiplier)
export function shouldSkip(
  waitTimeMs: number,
  patience: number,
  attractiveness: number,
  skipMultiplier: number,
  maxWaitTimeMs: number,
): boolean {
  if (waitTimeMs >= maxWaitTimeMs) return true;
  const threshold = patience * attractiveness * skipMultiplier * maxWaitTimeMs;
  return waitTimeMs > threshold;
}

// ---- Compute engagement duration (how long visitor stays at a media) ----
export function computeEngagementDuration(
  baseTimeMs: number,
  engagementLevel: string,
  fatigue: number,
  rng: SeededRandom,
): number {
  let multiplier = 1.0;

  if (engagementLevel === ENGAGEMENT_LEVEL.QUICK) {
    multiplier = 0.4 + rng.next() * 0.3; // 40-70% of base
  } else if (engagementLevel === ENGAGEMENT_LEVEL.EXPLORER) {
    multiplier = 0.7 + rng.next() * 0.5; // 70-120%
  } else if (engagementLevel === ENGAGEMENT_LEVEL.IMMERSIVE) {
    multiplier = 1.0 + rng.next() * 0.8; // 100-180%
  }

  // Fatigue reduces engagement time
  const fatigueReduction = 1 - fatigue * 0.4;

  return baseTimeMs * multiplier * fatigueReduction;
}
