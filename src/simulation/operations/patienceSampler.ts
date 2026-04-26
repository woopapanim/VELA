/**
 * patienceSampler — 개별 visitor 의 인내심 ms 산출 (Phase 1+, 2026-04-26)
 *
 * 두 단계 (서로 독립):
 *   A) 평균 결정:
 *      - patienceUseModifiers === true → base × profile × engagement
 *      - 그 외 (default) → base 그대로 (모두 동일)
 *   B) 분포 적용:
 *      - patienceModel === 'normal' → N(adjustedMean, std), [0.3*mean, 3*mean] 클램프
 *      - 'fixed' (또는 미지정) → adjustedMean 그대로 (노이즈 없음)
 *
 * 결정성: rng 인자로 받음 → 같은 seed 면 같은 결과 (회귀 테스트 가능).
 */

import {
  DEFAULT_PATIENCE_PROFILE_MODIFIERS,
  DEFAULT_PATIENCE_ENGAGEMENT_MODIFIERS,
  type EntryPolicy,
} from '@/domain';
import type { VisitorProfile } from '@/domain/types/visitor';

/** Box-Muller — uniform [0,1) 두 개를 표준정규 z 하나로 변환. */
function boxMullerStandardNormal(rng: () => number): number {
  // u1 == 0 이면 log(0) 발산 → epsilon 가드
  let u1 = rng();
  if (u1 < 1e-9) u1 = 1e-9;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * 개별 인내심 (ms) 산출.
 *
 * @param profile  visitor.profile
 * @param policy   현재 EntryPolicy (maxWaitBeforeAbandonMs / patienceModel / 배수)
 * @param rng      uniform [0,1) 함수 (SimEngine 의 seedable rng)
 * @returns 개별 인내심 ms — abandon 임계값
 */
export function samplePatienceMs(
  profile: VisitorProfile,
  policy: EntryPolicy,
  rng: () => number,
): number {
  const baseMean = policy.maxWaitBeforeAbandonMs ?? 1_800_000;

  let adjustedMean = baseMean;
  if (policy.patienceUseModifiers === true) {
    const profMod = (policy.patienceProfileModifiers ?? DEFAULT_PATIENCE_PROFILE_MODIFIERS)[profile.type]
      ?? DEFAULT_PATIENCE_PROFILE_MODIFIERS[profile.type];
    const engMod = (policy.patienceEngagementModifiers ?? DEFAULT_PATIENCE_ENGAGEMENT_MODIFIERS)[profile.engagementLevel]
      ?? DEFAULT_PATIENCE_ENGAGEMENT_MODIFIERS[profile.engagementLevel];
    adjustedMean = baseMean * profMod * engMod;
  }

  if ((policy.patienceModel ?? 'fixed') === 'fixed') {
    return Math.max(1, Math.round(adjustedMean));
  }

  // normal mode — sample N(adjustedMean, std), clamp to [0.3*mean, 3*mean]
  const std = policy.patienceStdMs ?? 540_000;
  const z = boxMullerStandardNormal(rng);
  const sampled = adjustedMean + z * std;
  const lo = adjustedMean * 0.3;
  const hi = adjustedMean * 3.0;
  return Math.max(1, Math.round(Math.min(hi, Math.max(lo, sampled))));
}
