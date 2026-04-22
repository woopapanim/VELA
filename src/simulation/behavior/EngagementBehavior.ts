import type {
  Visitor,
  VisitorProfileType,
  EngagementLevel,
  ZoneConfig,
  MediaPlacement,
  MediaId,
  ZoneId,
} from '@/domain';
import { ENGAGEMENT_LEVEL, MEDIA_PRESETS, VISITOR_PROFILE_TYPE } from '@/domain';
import type { SeededRandom } from '../utils/random';

// ---- mustVisit dwell modifier matrix ----
// 필수 관람 대상은 피로·대기 무시하고 전원 방문하지만, 체류 질은 프로필/피로에 따라 차등.
// 반환값: base avgEngagementTimeMs에 곱할 배수 (이미 computeEngagementDuration의 fatigue 감쇄를 대체).
// Fresh (fatigue≤0.3) → Normal (0.3<fatigue≤0.7) → Drained (fatigue>0.7) 3단계 보간.
export function mustVisitDwellMultiplier(
  profile: VisitorProfileType,
  engagement: EngagementLevel,
  fatigue: number,
): number {
  const freshEnd = 0.3;
  const drainEnd = 0.7;
  const t = fatigue <= freshEnd
    ? 0
    : fatigue >= drainEnd
      ? 1
      : (fatigue - freshEnd) / (drainEnd - freshEnd);

  // [fresh, drained] per axis; engagement takes precedence over profile when set.
  let fresh = 1.0, drained = 0.6; // general default
  if (engagement === ENGAGEMENT_LEVEL.IMMERSIVE) { fresh = 1.0; drained = 0.9; }
  else if (engagement === ENGAGEMENT_LEVEL.QUICK) { fresh = 0.8; drained = 0.4; }
  else if (engagement === ENGAGEMENT_LEVEL.EXPLORER) { fresh = 1.0; drained = 0.6; }

  // Profile override only for demographics that dominate engagement in reality.
  if (profile === VISITOR_PROFILE_TYPE.VIP) { fresh = 1.0; drained = 0.9; }
  else if (profile === VISITOR_PROFILE_TYPE.CHILD) { fresh = 0.7; drained = 0.3; }
  else if (profile === VISITOR_PROFILE_TYPE.ELDERLY || profile === VISITOR_PROFILE_TYPE.DISABLED) {
    fresh = 1.0; drained = 0.5;
  }

  return fresh * (1 - t) + drained * t;
}

// ---- mustVisit candidate filter ----
// 후보 중 mustVisit+미방문이 하나라도 있으면 그것들로만 좁힘. 없으면 원본 반환.
export function filterMustVisitCandidates<T extends { id: any; mustVisit?: boolean }>(
  candidates: readonly T[],
  visitedIds: ReadonlySet<string>,
): readonly T[] {
  const must = candidates.filter(c => c.mustVisit && !visitedIds.has(c.id as string));
  return must.length > 0 ? must : candidates;
}

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
  ) as ZoneConfig[];

  // mustVisit 우선 — 히어로 존이 남아있으면 그것만 후보로
  candidates = filterMustVisitCandidates(candidates, visited) as ZoneConfig[];

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
  let candidates = zoneMedia.filter((m) => !visitedMedia.has(m.id as string));

  // mustVisit 우선 — 히어로 미디어가 이 존에 남아있으면 그것만 후보로
  candidates = filterMustVisitCandidates(candidates, visitedMedia) as MediaPlacement[];

  if (candidates.length === 0) return null;

  // Engagement level affects preference + attractionPower + fatigueCategory
  const { engagementLevel } = visitor.profile;

  // Get the last visited media's fatigue category for fatigue penalty
  const lastVisitedMediaId = visitor.visitedMediaIds.length > 0
    ? visitor.visitedMediaIds[visitor.visitedMediaIds.length - 1]
    : null;
  const lastMediaType = lastVisitedMediaId
    ? zoneMedia.find(m => m.id === lastVisitedMediaId)?.type
      ?? (MEDIA_PRESETS as any)[lastVisitedMediaId]?.type
    : null;
  const lastFatigueCategory = lastMediaType
    ? (MEDIA_PRESETS as Record<string, any>)[lastMediaType as string]?.fatigueCategory
    : null;

  const weights = candidates.map((m) => {
    let weight = m.attractiveness;

    // Apply attraction power from preset
    const preset = (MEDIA_PRESETS as Record<string, any>)[m.type as string];
    if (preset?.attractionPower) {
      weight *= 0.5 + preset.attractionPower * 0.5; // scale 0.5-1.0
    }

    // Fatigue category penalty: same category in sequence → 50% weight
    if (lastFatigueCategory && preset?.fatigueCategory === lastFatigueCategory) {
      weight *= 0.5;
    }

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
  opts?: { mustVisit?: boolean; profile?: VisitorProfileType },
): number {
  // mustVisit 대상: 프로필×피로 dwell 매트릭스 사용 (Tier 2).
  // 일반 fatigue 감쇄 경로를 타지 않고 결정적 테이블로 체류 질을 표현.
  if (opts?.mustVisit) {
    const profile = opts.profile ?? VISITOR_PROFILE_TYPE.GENERAL;
    const mult = mustVisitDwellMultiplier(profile, engagementLevel as EngagementLevel, fatigue);
    // 약간의 랜덤 지터 (±10%)로 동시 종료 방지
    const jitter = 0.9 + rng.next() * 0.2;
    return baseTimeMs * mult * jitter;
  }

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
