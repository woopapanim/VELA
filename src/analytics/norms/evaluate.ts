import type { Confidence, Norm, NormSourceKind, NormStatus } from './types';

export function evaluateNorm(norm: Norm, value: number): NormStatus {
  if (!Number.isFinite(value)) return 'unknown';
  if (norm.direction === 'lower_is_better') {
    if (value <= norm.goodAt) return 'good';
    if (value <= norm.warnAt) return 'warn';
    return 'bad';
  } else {
    if (value >= norm.goodAt) return 'good';
    if (value >= norm.warnAt) return 'warn';
    return 'bad';
  }
}

// 신뢰도 등급. 단일 run + self 권장 → low. industry + replication → high.
export function deriveConfidence(opts: {
  sourceKind: NormSourceKind;
  hasReplication?: boolean;
  sampleCount?: number;
  status?: NormStatus;
}): Confidence {
  if (opts.status === 'unknown') return 'low';
  if (opts.hasReplication && (opts.sourceKind === 'industry' || opts.sourceKind === 'mode_default')) {
    return 'high';
  }
  if (opts.sourceKind === 'industry' || opts.sourceKind === 'mode_default') {
    return 'medium';
  }
  if (opts.sourceKind === 'derived') return 'medium';
  return 'low';
}

// 다관점 균형 — 4 카드의 status 집계로 verdict 산출.
export type VerdictLevel = 'ok' | 'review' | 'risk' | 'empty';

export function aggregateVerdict(statuses: readonly NormStatus[]): VerdictLevel {
  if (statuses.length === 0) return 'empty';
  const known = statuses.filter((s) => s !== 'unknown');
  if (known.length === 0) return 'empty';
  const bad = known.filter((s) => s === 'bad').length;
  const warn = known.filter((s) => s === 'warn').length;
  if (bad >= 1 || warn >= 2) return 'risk';
  if (warn >= 1) return 'review';
  return 'ok';
}
