import type {
  ZoneConfig,
  MediaPlacement,
  ProfileEngagement,
  Visitor,
  VisitorProfileType,
} from '@/domain';

// 단일 페르소나 (general/vip/child/elderly/disabled) 의 "왜 이 그룹인가" breakdown.
// PersonaSection 컬럼 클릭 → 이 결과로 답을 채운다.
//
// raw visitor[] 가 필요한 zone/media 비율은 현재 store 의 liveVisitors 만으로 산출.
// active record 가 선택된 경우엔 raw visitor 가 없으므로 perZone/perMedia 가 빈 배열일 수 있음.

export interface PersonaBreakdownZoneRow {
  readonly zoneId: string;
  readonly zoneName: string;
  readonly visitRate: number;       // 0–1 — 이 페르소나의 그 zone 방문 비율
  readonly avgRate: number;         // 0–1 — 다른 페르소나 평균 방문 비율
}

export interface PersonaBreakdownMediaRow {
  readonly mediaId: string;
  readonly name: string;
  readonly visitRate: number;       // 0–1
  readonly avgRate: number;         // 0–1
}

export interface PersonaBreakdown {
  readonly profile: VisitorProfileType;
  readonly profileLabel: string;
  readonly sampleCount: number;

  // ── 정량 (engagement) ──
  readonly avgDwellSec: number;
  readonly avgZones: number;
  readonly avgMedia: number;
  readonly fullCompletion: number;     // 0–1
  readonly fatigueMean: number;        // 0–1

  // ── vs 다른 페르소나 평균 (delta) ──
  readonly dwellVsAvg: number | null;          // sec
  readonly zonesVsAvg: number | null;          // count
  readonly mediaVsAvg: number | null;          // count
  readonly completionVsAvg: number | null;     // 0–1
  readonly fatigueVsAvg: number | null;        // 0–1

  // ── 분해 ──
  readonly underVisitedZones: readonly PersonaBreakdownZoneRow[];   // 다른 그룹 대비 덜 가는 zone
  readonly underVisitedMedia: readonly PersonaBreakdownMediaRow[];  // 다른 그룹 대비 덜 보는 media

  readonly hasRawVisitors: boolean;

  // ── reading 1줄 ──
  readonly reading: string;
}

const PROFILE_LABEL: Record<VisitorProfileType, string> = {
  general: '일반',
  vip: 'VIP',
  child: '어린이',
  elderly: '어르신',
  disabled: '장애인',
};

export function computePersonaBreakdown(args: {
  profile: VisitorProfileType;
  engagementByProfile: Readonly<Partial<Record<VisitorProfileType, ProfileEngagement>>>;
  visitors: readonly Visitor[];
  zones: readonly ZoneConfig[];
  media: readonly MediaPlacement[];
}): PersonaBreakdown | null {
  const { profile, engagementByProfile, visitors, zones, media } = args;
  const target = engagementByProfile[profile];
  if (!target || target.sampleCount === 0) return null;

  const others = (Object.entries(engagementByProfile) as [VisitorProfileType, ProfileEngagement][])
    .filter(([t, e]) => t !== profile && e && e.sampleCount > 0)
    .map(([, e]) => e);

  const dwellVsAvg = deltaVsOthers(target.avgDwellSec, others.map((e) => e.avgDwellSec));
  const zonesVsAvg = deltaVsOthers(target.avgZones, others.map((e) => e.avgZones));
  const mediaVsAvg = deltaVsOthers(target.avgMedia, others.map((e) => e.avgMedia));
  const completionVsAvg = deltaVsOthers(target.fullCompletion, others.map((e) => e.fullCompletion));
  const fatigueVsAvg = deltaVsOthers(target.fatigueMean, others.map((e) => e.fatigueMean));

  // raw visitors — exited 만, profile 별로 분리.
  const exited = visitors.filter((v) => !v.isActive);
  const targetVisitors = exited.filter((v) => v.profile.type === profile);
  const otherVisitors = exited.filter((v) => v.profile.type !== profile);
  const hasRawVisitors = targetVisitors.length > 0 && otherVisitors.length > 0;

  const underVisitedZones: PersonaBreakdownZoneRow[] = hasRawVisitors
    ? computeZoneVisitRates(zones, targetVisitors, otherVisitors)
    : [];

  const underVisitedMedia: PersonaBreakdownMediaRow[] = hasRawVisitors
    ? computeMediaVisitRates(media, targetVisitors, otherVisitors)
    : [];

  const reading = buildPersonaReading({
    profileLabel: PROFILE_LABEL[profile],
    sampleCount: target.sampleCount,
    completion: target.fullCompletion,
    completionVsAvg,
    dwellVsAvg,
    fatigueMean: target.fatigueMean,
    fatigueVsAvg,
    topUnderZone: underVisitedZones[0],
    topUnderMedia: underVisitedMedia[0],
  });

  return {
    profile,
    profileLabel: PROFILE_LABEL[profile],
    sampleCount: target.sampleCount,
    avgDwellSec: target.avgDwellSec,
    avgZones: target.avgZones,
    avgMedia: target.avgMedia,
    fullCompletion: target.fullCompletion,
    fatigueMean: target.fatigueMean,
    dwellVsAvg,
    zonesVsAvg,
    mediaVsAvg,
    completionVsAvg,
    fatigueVsAvg,
    underVisitedZones,
    underVisitedMedia,
    hasRawVisitors,
    reading,
  };
}

function deltaVsOthers(current: number, others: readonly number[]): number | null {
  if (others.length === 0) return null;
  const avg = others.reduce((s, v) => s + v, 0) / others.length;
  return current - avg;
}

function computeZoneVisitRates(
  zones: readonly ZoneConfig[],
  target: readonly Visitor[],
  others: readonly Visitor[],
): PersonaBreakdownZoneRow[] {
  return zones
    .map((z) => {
      const zid = z.id as string;
      const visitedTarget = target.filter((v) =>
        v.visitedZoneIds.some((zz) => (zz as string) === zid),
      ).length;
      const visitedOther = others.filter((v) =>
        v.visitedZoneIds.some((zz) => (zz as string) === zid),
      ).length;
      const visitRate = target.length > 0 ? visitedTarget / target.length : 0;
      const avgRate = others.length > 0 ? visitedOther / others.length : 0;
      return {
        zoneId: zid,
        zoneName: z.name ?? zid,
        visitRate,
        avgRate,
      };
    })
    // 다른 그룹 대비 덜 가는 zone — gap 큰 것부터.
    .filter((r) => r.avgRate - r.visitRate > 0.1)
    .sort((a, b) => (b.avgRate - b.visitRate) - (a.avgRate - a.visitRate))
    .slice(0, 5);
}

function computeMediaVisitRates(
  media: readonly MediaPlacement[],
  target: readonly Visitor[],
  others: readonly Visitor[],
): PersonaBreakdownMediaRow[] {
  return media
    .map((m) => {
      const mid = m.id as string;
      const visitedTarget = target.filter((v) =>
        (v.visitedMediaIds ?? []).some((mm) => (mm as string) === mid),
      ).length;
      const visitedOther = others.filter((v) =>
        (v.visitedMediaIds ?? []).some((mm) => (mm as string) === mid),
      ).length;
      const visitRate = target.length > 0 ? visitedTarget / target.length : 0;
      const avgRate = others.length > 0 ? visitedOther / others.length : 0;
      return {
        mediaId: mid,
        name: m.name,
        visitRate,
        avgRate,
      };
    })
    .filter((r) => r.avgRate - r.visitRate > 0.1)
    .sort((a, b) => (b.avgRate - b.visitRate) - (a.avgRate - a.visitRate))
    .slice(0, 5);
}

function buildPersonaReading(args: {
  profileLabel: string;
  sampleCount: number;
  completion: number;
  completionVsAvg: number | null;
  dwellVsAvg: number | null;
  fatigueMean: number;
  fatigueVsAvg: number | null;
  topUnderZone: PersonaBreakdownZoneRow | undefined;
  topUnderMedia: PersonaBreakdownMediaRow | undefined;
}): string {
  const {
    profileLabel, sampleCount, completion, completionVsAvg,
    dwellVsAvg, fatigueMean, fatigueVsAvg, topUnderZone, topUnderMedia,
  } = args;
  const reasons: string[] = [];

  if (sampleCount < 3) {
    reasons.push('표본 부족');
  }

  if (completionVsAvg !== null && completionVsAvg <= -0.15) {
    reasons.push(`완주율 ${Math.round(completion * 100)}% — 평균 대비 ${Math.round(completionVsAvg * 100)}%p`);
  } else if (completion <= 0.3) {
    reasons.push(`완주율 ${Math.round(completion * 100)}% — 절반 이상 미완주`);
  }

  if (dwellVsAvg !== null && Math.abs(dwellVsAvg) >= 60) {
    const sign = dwellVsAvg >= 0 ? '+' : '';
    reasons.push(`평균 체류 ${sign}${Math.round(dwellVsAvg)}s vs 다른 그룹`);
  }

  if (fatigueVsAvg !== null && fatigueVsAvg >= 0.10) {
    reasons.push(`피로도 ${Math.round(fatigueMean * 100)}% — 평균 대비 +${Math.round(fatigueVsAvg * 100)}%p`);
  }

  if (topUnderZone) {
    const gap = topUnderZone.avgRate - topUnderZone.visitRate;
    reasons.push(`${topUnderZone.zoneName} 도달 ${Math.round(topUnderZone.visitRate * 100)}% — 격차 ${Math.round(gap * 100)}%p`);
  }

  if (topUnderMedia) {
    const gap = topUnderMedia.avgRate - topUnderMedia.visitRate;
    reasons.push(`${topUnderMedia.name} ${Math.round(topUnderMedia.visitRate * 100)}% — 격차 ${Math.round(gap * 100)}%p`);
  }

  if (reasons.length === 0) return `${profileLabel} — 다른 그룹 대비 큰 차이 없음.`;
  return `${profileLabel} — ${reasons.join(' · ')}`;
}
