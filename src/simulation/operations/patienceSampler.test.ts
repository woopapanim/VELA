/**
 * patienceSampler unit tests — Phase 1+ (2026-04-26)
 */

import { describe, it, expect } from 'vitest';
import { samplePatienceMs } from './patienceSampler';
import type { EntryPolicy } from '@/domain';
import type { VisitorProfile } from '@/domain/types/visitor';

// patienceSampler 는 profile.type / profile.engagementLevel 만 사용하지만
// VisitorProfile interface 충족 위해 나머지 필드도 명시 (mock).
const profGeneral: VisitorProfile = {
  type: 'general',
  engagementLevel: 'explorer',
  maxSpeed: 1.0,
  mass: 1,
  maxForce: 1,
  fatigueRate: 0.001,
  patience: 0.5,
  interestMap: {},
};

const profVip: VisitorProfile = { ...profGeneral, type: 'vip' };
const profChild: VisitorProfile = { ...profGeneral, type: 'child' };
const profQuick: VisitorProfile = { ...profGeneral, engagementLevel: 'quick' };
const profImmersive: VisitorProfile = { ...profGeneral, engagementLevel: 'immersive' };

const constRng = (v: number) => () => v;

describe('samplePatienceMs — fixed model with modifiers opt-in', () => {
  const policy: EntryPolicy = {
    mode: 'concurrent-cap',
    maxWaitBeforeAbandonMs: 1_000_000, // base 1000s
    patienceModel: 'fixed',
    patienceUseModifiers: true,
  };

  it('general explorer — base × 1.0 × 1.0 = base', () => {
    expect(samplePatienceMs(profGeneral, policy, constRng(0.5))).toBe(1_000_000);
  });

  it('vip — × 1.3', () => {
    expect(samplePatienceMs(profVip, policy, constRng(0.5))).toBe(1_300_000);
  });

  it('child — × 0.6', () => {
    expect(samplePatienceMs(profChild, policy, constRng(0.5))).toBe(600_000);
  });

  it('quick engagement — × 0.7', () => {
    expect(samplePatienceMs(profQuick, policy, constRng(0.5))).toBe(700_000);
  });

  it('immersive engagement — × 1.4', () => {
    expect(samplePatienceMs(profImmersive, policy, constRng(0.5))).toBe(1_400_000);
  });

  it('combined (vip × immersive) — × 1.3 × 1.4 = 1.82', () => {
    const vipImm: VisitorProfile = { ...profGeneral, type: 'vip', engagementLevel: 'immersive' };
    expect(samplePatienceMs(vipImm, policy, constRng(0.5))).toBe(1_820_000);
  });
});

describe('samplePatienceMs — normal model', () => {
  const policy: EntryPolicy = {
    mode: 'concurrent-cap',
    maxWaitBeforeAbandonMs: 1_000_000,
    patienceModel: 'normal',
    patienceStdMs: 200_000,
  };

  it('clamps to [0.3*mean, 3*mean] for extreme rng inputs', () => {
    // Box-Muller with rng=epsilon → very large negative z → would push below floor
    const lo = samplePatienceMs(profGeneral, policy, constRng(1e-10));
    expect(lo).toBeGreaterThanOrEqual(Math.round(1_000_000 * 0.3));
    expect(lo).toBeLessThanOrEqual(Math.round(1_000_000 * 3.0));
  });

  it('produces variation across rng samples (not constant)', () => {
    // mulberry32 — 짧은 주기 LCG 회피
    let s = 0x12345678 >>> 0;
    const rng = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const samples = new Set<number>();
    for (let i = 0; i < 50; i++) samples.add(samplePatienceMs(profGeneral, policy, rng));
    // 정규분포 + clamp 적용 → 50회 샘플 중 다양성 충분
    expect(samples.size).toBeGreaterThan(30);
  });
});

describe('samplePatienceMs — custom modifiers override defaults', () => {
  it('respects policy.patienceProfileModifiers when opt-in is true', () => {
    const policy: EntryPolicy = {
      mode: 'concurrent-cap',
      maxWaitBeforeAbandonMs: 1_000_000,
      patienceModel: 'fixed',
      patienceUseModifiers: true,
      patienceProfileModifiers: { vip: 2.0 }, // override 1.3
    };
    expect(samplePatienceMs(profVip, policy, constRng(0.5))).toBe(2_000_000);
  });
});

describe('samplePatienceMs — modifiers off by default (Phase 1+ 2026-04-26)', () => {
  it('without patienceUseModifiers, all profiles get same base patience', () => {
    const policy: EntryPolicy = {
      mode: 'concurrent-cap',
      maxWaitBeforeAbandonMs: 1_000_000,
      patienceModel: 'fixed',
    };
    expect(samplePatienceMs(profGeneral, policy, constRng(0.5))).toBe(1_000_000);
    expect(samplePatienceMs(profVip, policy, constRng(0.5))).toBe(1_000_000);
    expect(samplePatienceMs(profChild, policy, constRng(0.5))).toBe(1_000_000);
    expect(samplePatienceMs(profQuick, policy, constRng(0.5))).toBe(1_000_000);
    expect(samplePatienceMs(profImmersive, policy, constRng(0.5))).toBe(1_000_000);
  });

  it('patienceUseModifiers: false explicitly opts out', () => {
    const policy: EntryPolicy = {
      mode: 'concurrent-cap',
      maxWaitBeforeAbandonMs: 1_000_000,
      patienceModel: 'fixed',
      patienceUseModifiers: false,
      patienceProfileModifiers: { vip: 2.0 }, // ignored
    };
    expect(samplePatienceMs(profVip, policy, constRng(0.5))).toBe(1_000_000);
  });
});
