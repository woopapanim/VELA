/**
 * ExperienceMode unit tests — Phase 1 UX (2026-04-26)
 */

import { describe, it, expect } from 'vitest';
import {
  EXPERIENCE_MODE_REGISTRY,
  EXPERIENCE_MODE_POLICY_DEFAULTS,
  SATISFACTION_WEIGHTS_BY_MODE,
  EXPERIENCE_MODES_BY_TIER,
  ENABLED_EXPERIENCE_MODES,
  inferExperienceMode,
  isExperienceModeEnabled,
  experienceModeTier,
  DEFAULT_EXPERIENCE_MODE,
  type ExperienceMode,
} from './experienceMode';
import { isSatisfactionWeightsValid } from './operations';

const ALL_MODES: ExperienceMode[] = [
  'layout_validation',
  'curation_validation',
  'media_experience',
  'free_admission',
  'free_with_throttle',
  'timed_reservation',
  'controlled_admission',
  'group_visit',
];

describe('EXPERIENCE_MODE_REGISTRY', () => {
  it('contains all 8 modes', () => {
    expect(Object.keys(EXPERIENCE_MODE_REGISTRY).sort()).toEqual([...ALL_MODES].sort());
  });

  it('marks Phase 1 active modes (5) as enabled', () => {
    expect(EXPERIENCE_MODE_REGISTRY.layout_validation.enabled).toBe(true);
    expect(EXPERIENCE_MODE_REGISTRY.free_admission.enabled).toBe(true);
    expect(EXPERIENCE_MODE_REGISTRY.free_with_throttle.enabled).toBe(true);
    expect(EXPERIENCE_MODE_REGISTRY.timed_reservation.enabled).toBe(true);
    expect(EXPERIENCE_MODE_REGISTRY.controlled_admission.enabled).toBe(true);
  });

  it('marks Phase 2/3A/3B modes (3) as disabled with phase hint', () => {
    expect(EXPERIENCE_MODE_REGISTRY.curation_validation.enabled).toBe(false);
    expect(EXPERIENCE_MODE_REGISTRY.curation_validation.enabledFromPhase).toBe('Phase 3A');

    expect(EXPERIENCE_MODE_REGISTRY.media_experience.enabled).toBe(false);
    expect(EXPERIENCE_MODE_REGISTRY.media_experience.enabledFromPhase).toBe('Phase 3B');

    expect(EXPERIENCE_MODE_REGISTRY.group_visit.enabled).toBe(false);
    expect(EXPERIENCE_MODE_REGISTRY.group_visit.enabledFromPhase).toBe('Phase 2');
  });

  it('assigns correct tier to each mode', () => {
    expect(experienceModeTier('layout_validation')).toBe('validation');
    expect(experienceModeTier('curation_validation')).toBe('validation');
    expect(experienceModeTier('media_experience')).toBe('validation');
    expect(experienceModeTier('free_admission')).toBe('operations');
    expect(experienceModeTier('free_with_throttle')).toBe('operations');
    expect(experienceModeTier('timed_reservation')).toBe('operations');
    expect(experienceModeTier('controlled_admission')).toBe('operations');
    expect(experienceModeTier('group_visit')).toBe('operations');
  });
});

describe('ENABLED_EXPERIENCE_MODES', () => {
  it('contains exactly 5 modes (Phase 1 active)', () => {
    expect(ENABLED_EXPERIENCE_MODES).toHaveLength(5);
    expect([...ENABLED_EXPERIENCE_MODES].sort()).toEqual(
      ['controlled_admission', 'free_admission', 'free_with_throttle', 'layout_validation', 'timed_reservation'],
    );
  });

  it('matches isExperienceModeEnabled for every mode', () => {
    for (const m of ALL_MODES) {
      expect(ENABLED_EXPERIENCE_MODES.includes(m)).toBe(isExperienceModeEnabled(m));
    }
  });
});

describe('EXPERIENCE_MODES_BY_TIER', () => {
  it('groups validation and operations correctly', () => {
    expect(EXPERIENCE_MODES_BY_TIER.validation).toHaveLength(3);
    expect(EXPERIENCE_MODES_BY_TIER.operations).toHaveLength(5);
  });

  it('union covers all 8 modes', () => {
    const union = [...EXPERIENCE_MODES_BY_TIER.validation, ...EXPERIENCE_MODES_BY_TIER.operations];
    expect(union.sort()).toEqual([...ALL_MODES].sort());
  });
});

describe('EXPERIENCE_MODE_POLICY_DEFAULTS', () => {
  it('has entry for every mode', () => {
    for (const m of ALL_MODES) {
      expect(EXPERIENCE_MODE_POLICY_DEFAULTS[m]).toBeDefined();
    }
  });

  it('all validation modes default to unlimited (no queue)', () => {
    expect(EXPERIENCE_MODE_POLICY_DEFAULTS.layout_validation.mode).toBe('unlimited');
    expect(EXPERIENCE_MODE_POLICY_DEFAULTS.curation_validation.mode).toBe('unlimited');
    expect(EXPERIENCE_MODE_POLICY_DEFAULTS.media_experience.mode).toBe('unlimited');
  });

  it('free_admission defaults to unlimited', () => {
    expect(EXPERIENCE_MODE_POLICY_DEFAULTS.free_admission.mode).toBe('unlimited');
  });

  it('free_with_throttle uses concurrent-cap with high cap (≥ controlled_admission)', () => {
    const fwt = EXPERIENCE_MODE_POLICY_DEFAULTS.free_with_throttle;
    const ca = EXPERIENCE_MODE_POLICY_DEFAULTS.controlled_admission;
    expect(fwt.mode).toBe('concurrent-cap');
    expect(ca.mode).toBe('concurrent-cap');
    // 핵심 design 원칙: free_with_throttle 의 cap 은 controlled 보다 커야 (폭주만 발동)
    expect(fwt.maxConcurrent ?? 0).toBeGreaterThan(ca.maxConcurrent ?? 0);
  });

  it('timed_reservation uses time-slot with 30min slot + 80 perSlotCap', () => {
    const tr = EXPERIENCE_MODE_POLICY_DEFAULTS.timed_reservation;
    expect(tr.mode).toBe('time-slot');
    expect(tr.slotDurationMs).toBe(1_800_000);
    expect(tr.perSlotCap).toBe(80);
  });

  it('non-unlimited modes have patience defaults (30min mean, normal, σ 9min)', () => {
    const operationsModes: ExperienceMode[] = ['free_with_throttle', 'timed_reservation', 'controlled_admission'];
    for (const m of operationsModes) {
      const p = EXPERIENCE_MODE_POLICY_DEFAULTS[m];
      expect(p.maxWaitBeforeAbandonMs).toBe(1_800_000);
      expect(p.patienceModel).toBe('normal');
      expect(p.patienceStdMs).toBe(540_000);
    }
  });
});

describe('SATISFACTION_WEIGHTS_BY_MODE', () => {
  it('has entry for every mode', () => {
    for (const m of ALL_MODES) {
      expect(SATISFACTION_WEIGHTS_BY_MODE[m]).toBeDefined();
    }
  });

  it('all weights sum to 1.0 ± 0.01 (validity invariant)', () => {
    for (const m of ALL_MODES) {
      const w = SATISFACTION_WEIGHTS_BY_MODE[m];
      expect(isSatisfactionWeightsValid(w)).toBe(true);
    }
  });

  it('validation tier modes have wait weight = 0 (no queue)', () => {
    expect(SATISFACTION_WEIGHTS_BY_MODE.layout_validation.wait).toBe(0);
    expect(SATISFACTION_WEIGHTS_BY_MODE.curation_validation.wait).toBe(0);
    expect(SATISFACTION_WEIGHTS_BY_MODE.media_experience.wait).toBe(0);
  });

  it('controlled_admission emphasizes wait (highest wait weight in operations)', () => {
    const ca = SATISFACTION_WEIGHTS_BY_MODE.controlled_admission.wait;
    expect(ca).toBeGreaterThanOrEqual(SATISFACTION_WEIGHTS_BY_MODE.free_admission.wait);
    expect(ca).toBeGreaterThanOrEqual(SATISFACTION_WEIGHTS_BY_MODE.free_with_throttle.wait);
    expect(ca).toBeGreaterThanOrEqual(SATISFACTION_WEIGHTS_BY_MODE.timed_reservation.wait);
  });

  it('media_experience emphasizes engagement (highest engagement weight)', () => {
    const me = SATISFACTION_WEIGHTS_BY_MODE.media_experience.engagement;
    for (const m of ALL_MODES) {
      if (m === 'media_experience') continue;
      expect(me).toBeGreaterThanOrEqual(SATISFACTION_WEIGHTS_BY_MODE[m].engagement);
    }
  });

  it('free_admission emphasizes crowd (highest crowd weight)', () => {
    const fa = SATISFACTION_WEIGHTS_BY_MODE.free_admission.crowd;
    for (const m of ALL_MODES) {
      if (m === 'free_admission') continue;
      expect(fa).toBeGreaterThanOrEqual(SATISFACTION_WEIGHTS_BY_MODE[m].crowd);
    }
  });
});

describe('inferExperienceMode (migration from existing scenarios)', () => {
  it('unlimited → free_admission', () => {
    expect(inferExperienceMode('unlimited')).toBe('free_admission');
  });

  it('concurrent-cap → controlled_admission (conservative)', () => {
    expect(inferExperienceMode('concurrent-cap')).toBe('controlled_admission');
  });

  it('rate-limit → controlled_admission', () => {
    expect(inferExperienceMode('rate-limit')).toBe('controlled_admission');
  });

  it('time-slot → timed_reservation', () => {
    expect(inferExperienceMode('time-slot')).toBe('timed_reservation');
  });

  it('hybrid → controlled_admission', () => {
    expect(inferExperienceMode('hybrid')).toBe('controlled_admission');
  });

  it('undefined (legacy scenarios w/o operations config) → free_admission', () => {
    expect(inferExperienceMode(undefined)).toBe('free_admission');
  });

  it('inferred mode is always enabled', () => {
    const inputs: Array<Parameters<typeof inferExperienceMode>[0]> = [
      'unlimited', 'concurrent-cap', 'rate-limit', 'time-slot', 'hybrid', undefined,
    ];
    for (const input of inputs) {
      expect(isExperienceModeEnabled(inferExperienceMode(input))).toBe(true);
    }
  });
});

describe('DEFAULT_EXPERIENCE_MODE', () => {
  it('is enabled (selectable on first scenario create)', () => {
    expect(isExperienceModeEnabled(DEFAULT_EXPERIENCE_MODE)).toBe(true);
  });
});
