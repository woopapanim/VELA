import type {
  KpiSnapshot,
  KpiTimeSeriesEntry,
  ZoneConfig,
  MediaPlacement,
  Visitor,
  VisitorProfileType,
} from '@/domain';

// 단일 media 의 "왜 이 작품이 안 보이나" breakdown.
// rail 의 스킵 핫스팟 → 이 결과로 답을 채운다.

export interface MediaBreakdownProfileRow {
  readonly profile: VisitorProfileType;
  readonly visited: number;
  readonly total: number;
  readonly visitRate: number;     // 0–1
}

export interface MediaBreakdown {
  readonly mediaId: string;
  readonly mediaName: string;
  readonly mediaType: string;            // interactionType (passive/active/staged/analog)
  readonly category: string;
  readonly zoneId: string;
  readonly zoneName: string;
  readonly attractiveness: number;       // 0–1, design 값

  // ── 정량 지표 (latest snapshot) ──
  readonly skipRate: number;             // 0–1
  readonly skipCount: number;
  readonly totalApproaches: number;
  readonly visitFraction: number;        // 0–1, exited 중 visitedMediaIds 포함 비율

  // ── persona 분해 ──
  // exited 방문자 기준, profile 별 "이 미디어 본 사람 / 그 그룹 전체" 비율.
  // rough: skip vs visit per profile 데이터가 엔진에 따로 저장 안 되므로 visit ratio 만.
  readonly perProfile: readonly MediaBreakdownProfileRow[];

  // ── 시간 — skip rate 추이 ──
  readonly skipRateOverTime: readonly { tMs: number; rate: number }[];

  // ── reading 1줄 ──
  readonly reading: string;
}

export function computeMediaBreakdown(args: {
  mediaId: string;
  media: MediaPlacement;
  zone: ZoneConfig | null;
  latestSnapshot: KpiSnapshot;
  kpiHistory: readonly KpiTimeSeriesEntry[];
  visitors: readonly Visitor[];
}): MediaBreakdown {
  const { mediaId, media, zone, latestSnapshot, kpiHistory, visitors } = args;

  const cur = latestSnapshot.skipRate.perMedia.find((m) => (m.mediaId as string) === mediaId);
  const skipRate = cur?.rate ?? 0;
  const skipCount = cur?.skipCount ?? 0;
  const totalApproaches = cur?.totalApproaches ?? 0;

  // exited 중 이 media 를 visit 한 비율 + profile 별 분해.
  const exited = visitors.filter((v) => !v.isActive);
  const visitedHere = exited.filter((v) =>
    (v.visitedMediaIds ?? []).some((mid) => (mid as string) === mediaId),
  );
  const visitFraction = exited.length > 0 ? visitedHere.length / exited.length : 0;

  const groups = new Map<VisitorProfileType, { total: number; visited: number }>();
  for (const v of exited) {
    const t = v.profile.type;
    const cur2 = groups.get(t) ?? { total: 0, visited: 0 };
    cur2.total += 1;
    if ((v.visitedMediaIds ?? []).some((mid) => (mid as string) === mediaId)) cur2.visited += 1;
    groups.set(t, cur2);
  }
  const perProfile: MediaBreakdownProfileRow[] = Array.from(groups.entries())
    .map(([profile, g]) => ({
      profile,
      visited: g.visited,
      total: g.total,
      visitRate: g.total > 0 ? g.visited / g.total : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // skipRate over time — kpiHistory 의 snapshot 마다 perMedia rate.
  const skipRateOverTime = kpiHistory
    .map((h) => {
      const e = h.snapshot.skipRate.perMedia.find((m) => (m.mediaId as string) === mediaId);
      const tMs = h.snapshot.simulationTimeMs;
      if (!e || tMs <= 0) return null;
      return { tMs, rate: Math.max(0, Math.min(1, e.rate)) };
    })
    .filter((x): x is { tMs: number; rate: number } => x !== null);

  const reading = buildMediaReading({
    skipRate,
    visitFraction,
    perProfile,
    totalApproaches,
    interactionType: media.interactionType,
  });

  return {
    mediaId,
    mediaName: media.name,
    mediaType: media.interactionType,
    category: media.category,
    zoneId: media.zoneId as string,
    zoneName: zone?.name ?? '—',
    attractiveness: media.attractiveness,
    skipRate,
    skipCount,
    totalApproaches,
    visitFraction,
    perProfile,
    skipRateOverTime,
    reading,
  };
}

function buildMediaReading(args: {
  skipRate: number;
  visitFraction: number;
  perProfile: readonly MediaBreakdownProfileRow[];
  totalApproaches: number;
  interactionType: string;
}): string {
  const { skipRate, visitFraction, perProfile, totalApproaches, interactionType } = args;
  const reasons: string[] = [];

  if (totalApproaches < 3) {
    reasons.push('접근 표본 부족 — 추세 신뢰도 낮음');
  }

  if (skipRate >= 0.5) reasons.push(`스킵률 ${Math.round(skipRate * 100)}% — 절반 이상 이탈`);
  else if (skipRate >= 0.3) reasons.push(`스킵률 ${Math.round(skipRate * 100)}%`);

  if (visitFraction < 0.2 && visitFraction > 0) {
    reasons.push(`방문 ${Math.round(visitFraction * 100)}% — 도달 자체가 낮음`);
  }

  // profile gap — 가장 잘 본 그룹 vs 가장 안 본 그룹 차이.
  if (perProfile.length >= 2) {
    const sorted = [...perProfile].filter((p) => p.total >= 3).sort((a, b) => b.visitRate - a.visitRate);
    if (sorted.length >= 2) {
      const top = sorted[0];
      const bot = sorted[sorted.length - 1];
      const gap = top.visitRate - bot.visitRate;
      if (gap >= 0.3) {
        reasons.push(`${profileLabel(top.profile)}↔${profileLabel(bot.profile)} 격차 ${Math.round(gap * 100)}%p`);
      }
    }
  }

  if (interactionType === 'active' && skipRate >= 0.4) {
    reasons.push('체험형 — 대기/슬롯 상한이 의심됨');
  }

  if (reasons.length === 0) return '주요 위험 신호 없음. 다른 미디어 비교 검토.';
  return reasons.join(' · ');
}

function profileLabel(t: VisitorProfileType): string {
  switch (t) {
    case 'general': return '일반';
    case 'vip': return 'VIP';
    case 'child': return '어린이';
    case 'elderly': return '어르신';
    case 'disabled': return '장애인';
  }
}
