import { describe, it, expect } from 'vitest';
import { splitMultiSlotMedia } from './splitMultiSlotMedia';
import type { MediaId, ZoneId, MediaPlacement, MediaType, MediaCategory } from '@/domain';

const baseMedia = (overrides: Partial<MediaPlacement>): MediaPlacement => ({
  id: 'm_test' as MediaId,
  name: 'test',
  type: 'touch_table' as MediaType,
  category: 'interactive' as MediaCategory,
  zoneId: 'z_test' as ZoneId,
  position: { x: 100, y: 200 },
  size: { width: 1, height: 1 },
  orientation: 0,
  capacity: 1,
  avgEngagementTimeMs: 60_000,
  attractiveness: 0.5,
  attractionRadius: 50,
  interactionType: 'active',
  omnidirectional: false,
  queueBehavior: 'area',
  groupFriendly: false,
  ...overrides,
});

describe('splitMultiSlotMedia', () => {
  it('leaves cap=1 active media unchanged', () => {
    const input = [baseMedia({ interactionType: 'active', capacity: 1 })];
    const r = splitMultiSlotMedia(input);
    expect(r.migrated).toEqual(input);
    expect(r.splitSourceCount).toBe(0);
    expect(r.addedCount).toBe(0);
  });

  it('leaves analog cap=10 unchanged (area capacity preserved)', () => {
    const input = [baseMedia({ interactionType: 'analog', capacity: 10 })];
    const r = splitMultiSlotMedia(input);
    expect(r.migrated).toEqual(input);
    expect(r.splitSourceCount).toBe(0);
  });

  it('leaves passive cap=50 unchanged (area capacity preserved)', () => {
    const input = [baseMedia({ interactionType: 'passive', capacity: 50 })];
    const r = splitMultiSlotMedia(input);
    expect(r.migrated).toEqual(input);
    expect(r.splitSourceCount).toBe(0);
  });

  it('splits active cap=3 into 3 cap=1 media at horizontal offset', () => {
    const input = [
      baseMedia({
        id: 'm_kiosk' as MediaId,
        interactionType: 'active',
        capacity: 3,
        position: { x: 100, y: 200 },
        size: { width: 2, height: 1 },
      }),
    ];
    const r = splitMultiSlotMedia(input);
    expect(r.migrated).toHaveLength(3);
    expect(r.splitSourceCount).toBe(1);
    expect(r.addedCount).toBe(2);
    // All have cap=1
    expect(r.migrated.every((m) => m.capacity === 1)).toBe(true);
    // First keeps original id
    expect(r.migrated[0].id).toBe('m_kiosk');
    // Others get _splitN suffix
    expect(r.migrated[1].id).toBe('m_kiosk_split1');
    expect(r.migrated[2].id).toBe('m_kiosk_split2');
    // Positions offset along x (size.width 2 * 20 * 1.2 = 48)
    expect(r.migrated[0].position).toEqual({ x: 100, y: 200 });
    expect(r.migrated[1].position).toEqual({ x: 148, y: 200 });
    expect(r.migrated[2].position).toEqual({ x: 196, y: 200 });
  });

  it('splits staged cap=2 (simulator pair) correctly', () => {
    const input = [
      baseMedia({
        id: 'm_sim' as MediaId,
        interactionType: 'staged',
        capacity: 2,
        size: { width: 3, height: 3 },
      }),
    ];
    const r = splitMultiSlotMedia(input);
    expect(r.migrated).toHaveLength(2);
    expect(r.migrated.every((m) => m.interactionType === 'staged')).toBe(true);
    expect(r.migrated.every((m) => m.capacity === 1)).toBe(true);
  });

  it('uses minimum 20px offset for tiny media', () => {
    const input = [
      baseMedia({
        interactionType: 'active',
        capacity: 2,
        size: { width: 0.1, height: 0.1 }, // 0.1m × 20px × 1.2 = 2.4px → clamped to 20
      }),
    ];
    const r = splitMultiSlotMedia(input);
    expect(r.migrated[1].position.x - r.migrated[0].position.x).toBe(20);
  });

  it('handles mixed scenario (split + preserve)', () => {
    const input: MediaPlacement[] = [
      baseMedia({ id: 'a' as MediaId, interactionType: 'active', capacity: 3 }),
      baseMedia({ id: 'b' as MediaId, interactionType: 'analog', capacity: 8 }),
      baseMedia({ id: 'c' as MediaId, interactionType: 'staged', capacity: 2 }),
      baseMedia({ id: 'd' as MediaId, interactionType: 'passive', capacity: 50 }),
      baseMedia({ id: 'e' as MediaId, interactionType: 'active', capacity: 1 }),
    ];
    const r = splitMultiSlotMedia(input);
    // a (3) + b (1) + c (2) + d (1) + e (1) = 8
    expect(r.migrated).toHaveLength(8);
    expect(r.splitSourceCount).toBe(2); // a, c
    expect(r.addedCount).toBe(3); // (3-1) + (2-1) = 3
    // Order preserved: split copies stay adjacent to original
    expect(r.migrated.map((m) => m.id)).toEqual([
      'a', 'a_split1', 'a_split2',
      'b',
      'c', 'c_split1',
      'd',
      'e',
    ]);
  });

  it('does NOT split passive media even with cap > 1 (immersive_room cap=15 stays one media)', () => {
    // After interactionType correction (worldSlice.setScenario reclassifies
    // immersive+queue=area as 'passive'), the migration must NOT split it.
    const input = [
      baseMedia({
        id: 'm_imm_room' as MediaId,
        interactionType: 'passive', // post-correction
        capacity: 15,
        queueBehavior: 'area',
      }),
    ];
    const r = splitMultiSlotMedia(input);
    expect(r.migrated).toHaveLength(1);
    expect(r.migrated[0].capacity).toBe(15);
    expect(r.splitSourceCount).toBe(0);
  });

  it('preserves all non-capacity fields on splits', () => {
    const original = baseMedia({
      id: 'm_x' as MediaId,
      interactionType: 'active',
      capacity: 2,
      name: 'Workshop Kiosk',
      attractiveness: 0.8,
      avgEngagementTimeMs: 180_000,
      orientation: 90,
      omnidirectional: true,
    });
    const r = splitMultiSlotMedia([original]);
    expect(r.migrated[0]).toMatchObject({
      name: 'Workshop Kiosk',
      attractiveness: 0.8,
      avgEngagementTimeMs: 180_000,
      orientation: 90,
      omnidirectional: true,
    });
    expect(r.migrated[1]).toMatchObject({
      id: 'm_x_split1',
      name: 'Workshop Kiosk',
      attractiveness: 0.8,
      avgEngagementTimeMs: 180_000,
      orientation: 90,
      omnidirectional: true,
    });
  });
});
