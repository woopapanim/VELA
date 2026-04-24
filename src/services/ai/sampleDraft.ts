import type { DraftScenario } from './types';

/**
 * Dev-only sample DraftScenarios — let the review UI (confidence badge,
 * evidence line, Recalibrate button, calibrator overlay, warning list) be
 * tested without spending API credits. Also serve as regression fixtures for
 * hydrate.test.ts.
 *
 * All samples reuse /public/sample_img.png as the background. The image itself
 * isn't meant to match the zone layout — these are UI/logic fixtures.
 */
export const SAMPLE_IMAGE_PATH = '/sample_img.png';
export const SAMPLE_IMAGE_NATURAL = { width: 2300, height: 1634 } as const;

/** Clean "measured" case — no warnings expected. */
export const SAMPLE_DRAFT: DraftScenario = {
  name: 'Sample Floor Plan',
  scale: {
    label: '20m × 14.2m (from title block)',
    widthMeters: 20,
    heightMeters: 14.2,
    confidence: 'measured',
    evidence: 'Overall dimension label along bottom wall reads "20.0 m"; height derived from aspect ratio.',
  },
  notes: 'Fixture for local UI testing — not produced by the AI.',
  zones: [
    { key: 'lobby', name: 'Lobby', type: 'lobby', shape: 'rect', rect: { x: 0.5, y: 0.5, w: 6, h: 4 } },
    { key: 'gallery_a', name: 'Gallery A', type: 'exhibition', shape: 'rect', rect: { x: 7, y: 0.5, w: 6, h: 5 } },
    { key: 'gallery_b', name: 'Gallery B', type: 'exhibition', shape: 'rect', rect: { x: 13.5, y: 0.5, w: 6, h: 5 } },
    { key: 'corridor', name: 'Corridor', type: 'corridor', shape: 'rect', rect: { x: 0.5, y: 5, w: 19, h: 1.5 } },
    { key: 'rest_area', name: 'Rest Area', type: 'rest', shape: 'rect', rect: { x: 0.5, y: 7, w: 5, h: 3.5 } },
    {
      key: 'theater',
      name: 'Theater',
      type: 'stage',
      shape: 'rect',
      rect: { x: 6, y: 7, w: 7, h: 6.5 },
      polygon: [
        { x: 6, y: 7 },
        { x: 13, y: 7 },
        { x: 13, y: 13.5 },
        { x: 9.5, y: 13.5 },
        { x: 9.5, y: 11 },
        { x: 6, y: 11 },
      ],
    },
    { key: 'workshop', name: 'Workshop', type: 'exhibition', shape: 'rect', rect: { x: 13.5, y: 7, w: 6, h: 6.5 } },
  ],
};

/**
 * "Inferred" case — scale derived from a visual proxy (door width).
 * Exercises: info-level scale warning with evidence text, polygon custom zone.
 */
export const SAMPLE_DRAFT_INFERRED: DraftScenario = {
  name: 'Inferred Scale Plan',
  scale: {
    label: '~15m × 11.5m (inferred)',
    widthMeters: 15,
    heightMeters: 11.5,
    confidence: 'inferred',
    evidence: 'Door swing diameter measured at ~2.4% of plan width → ~0.9m, back-solved to ~15m total.',
  },
  notes: 'Fixture: no dimension labels, scale backed out from door width proxy.',
  zones: [
    { key: 'entry', name: 'Entry', type: 'lobby', shape: 'rect', rect: { x: 0.5, y: 0.5, w: 4, h: 3 } },
    {
      key: 'main_hall',
      name: 'Main Hall',
      type: 'exhibition',
      shape: 'rect',
      rect: { x: 5, y: 0.5, w: 9, h: 6 },
      polygon: [
        { x: 5, y: 0.5 },
        { x: 14, y: 0.5 },
        { x: 14, y: 6.5 },
        { x: 10, y: 6.5 },
        { x: 10, y: 4 },
        { x: 5, y: 4 },
      ],
    },
    { key: 'cafe', name: 'Cafe', type: 'rest', shape: 'rect', rect: { x: 0.5, y: 4, w: 4, h: 3 } },
    { key: 'exit', name: 'Exit', type: 'lobby', shape: 'rect', rect: { x: 0.5, y: 7.5, w: 13.5, h: 3.5 } },
  ],
};

/**
 * "Messy" case — assumed scale + overlapping zones + dropped zone.
 * Exercises every warning path at once: warning-level scale, warning-level
 * overlap (both zone names), warning-level dropped zone.
 */
export const SAMPLE_DRAFT_MESSY: DraftScenario = {
  name: 'Messy Plan',
  scale: {
    label: '18m × 12m (assumed)',
    widthMeters: 18,
    heightMeters: 12,
    confidence: 'assumed',
  },
  notes: 'Fixture: no scale cues at all; AI defaulted to an assumed value.',
  zones: [
    { key: 'hall_a', name: 'Hall A', type: 'exhibition', shape: 'rect', rect: { x: 1, y: 1, w: 8, h: 5 } },
    // Overlaps Hall A by ~50% of its own area → triggers overlap warning.
    { key: 'hall_b', name: 'Hall B', type: 'exhibition', shape: 'rect', rect: { x: 5, y: 1, w: 8, h: 5 } },
    // Missing rect → should be dropped with a per-zone warning.
    { key: 'broken', name: 'Broken Zone', type: 'rest', shape: 'rect' } as unknown as DraftScenario['zones'][number],
    { key: 'back', name: 'Back Room', type: 'rest', shape: 'rect', rect: { x: 1, y: 7, w: 16, h: 4 } },
  ],
};

export interface SampleFixture {
  readonly id: string;
  readonly label: string;
  readonly draft: DraftScenario;
}

export const SAMPLE_FIXTURES: readonly SampleFixture[] = [
  { id: 'measured', label: 'Measured (clean)', draft: SAMPLE_DRAFT },
  { id: 'inferred', label: 'Inferred (door proxy)', draft: SAMPLE_DRAFT_INFERRED },
  { id: 'messy', label: 'Messy (assumed + overlap + dropped)', draft: SAMPLE_DRAFT_MESSY },
];
