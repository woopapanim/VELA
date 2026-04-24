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
    // Corridor sits tight below the galleries (y=5.5 not y=5) so edges touch
    // but no pair overlaps — the "clean" fixture is actually clean.
    { key: 'corridor', name: 'Corridor', type: 'corridor', shape: 'rect', rect: { x: 0.5, y: 5.5, w: 19, h: 1.5 } },
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

/**
 * Captured real AI output — Art Museum floor plan run, 2026-04-24.
 * Baseline for measuring prompt improvements. The AI pulled correct dimension
 * strings ("15,000 × 3" = 45m) as evidence but emitted 67.5×60m as the final
 * scale — an arithmetic hallucination. Also returned a few overlapping zones.
 * These are the exact failure modes the prompt revision should address.
 */
export const SAMPLE_DRAFT_CAPTURED_ART_MUSEUM: DraftScenario = {
  name: 'Art Museum (baseline capture)',
  notes: 'Captured 2026-04-24 — scale math is wrong (evidence=45m, emitted=67.5m). Baseline for prompt-quality regression.',
  scale: {
    label: '67.5m × 60m (from 15,000 × 3 dimension strings — miscalculated)',
    widthMeters: 67.5,
    heightMeters: 60,
    confidence: 'measured',
    evidence: 'Top dimension strings read "15,000" × 3 (=45 m building width); right-side strings sum to ~44.1 m — but AI emitted 67.5×60.',
  },
  zones: [
    { key: 'permanent_exhibit_1', name: '상설전시실 1', type: 'exhibition', shape: 'rect', rect: { x: 29, y: 17, w: 18, h: 10 } },
    { key: 'permanent_exhibit_2', name: '상설전시실 2', type: 'exhibition', shape: 'rect', rect: { x: 48.5, y: 17, w: 13.5, h: 10 } },
    { key: 'visible_storage', name: '보이는 수장고', type: 'exhibition', shape: 'rect', rect: { x: 24.5, y: 17, w: 4.5, h: 10 } },
    { key: 'conservation_lab', name: '학예 및 다목적실', type: 'exhibition', shape: 'rect', rect: { x: 10, y: 22.5, w: 12.5, h: 8 } },
    { key: 'archive_room', name: '잔실', type: 'exhibition', shape: 'rect', rect: { x: 22.5, y: 22.5, w: 7, h: 8 } },
    { key: 'special_exhibit', name: '기획전시실', type: 'exhibition', shape: 'rect', rect: { x: 13, y: 30.5, w: 16.5, h: 13 } },
    { key: 'light_courtyard', name: '빛의 중정', type: 'lobby', shape: 'rect', rect: { x: 29.5, y: 27, w: 16.5, h: 17 } },
    { key: 'education_room', name: '교육/체험관', type: 'exhibition', shape: 'rect', rect: { x: 50, y: 27.5, w: 4.5, h: 6 } },
    { key: 'library', name: '도서공간', type: 'rest', shape: 'rect', rect: { x: 54.5, y: 27.5, w: 4, h: 6 } },
    { key: 'av_room', name: '시청각실', type: 'exhibition', shape: 'rect', rect: { x: 58.5, y: 27.5, w: 4.5, h: 6 } },
    { key: 'seminar_room', name: '세미나실', type: 'exhibition', shape: 'rect', rect: { x: 50, y: 35.5, w: 8, h: 7.5 } },
    { key: 'lobby_shop', name: '로비/아트샵', type: 'lobby', shape: 'rect', rect: { x: 29, y: 44.5, w: 16.5, h: 8 } },
    { key: 'creation_studio', name: '창작스튜디오', type: 'exhibition', shape: 'rect', rect: { x: 50.5, y: 44.5, w: 10, h: 7 } },
    { key: 'rehearsal_room', name: '학예실', type: 'exhibition', shape: 'rect', rect: { x: 14, y: 44.5, w: 6, h: 4.5 } },
    { key: 'office', name: '사무실', type: 'exhibition', shape: 'rect', rect: { x: 14, y: 49, w: 6, h: 4.5 } },
    { key: 'outdoor_stage', name: '야외공연장', type: 'stage', shape: 'rect', rect: { x: 27, y: 54.5, w: 16, h: 5 } },
  ],
};

/**
 * Second Art Museum run — after prompt revision (explicit arithmetic, footprint
 * containment, self-check). Same source image as V1. Improvements over V1:
 * - widthMeters 67.5 → 58 (V1 over-scaled by ~16%)
 * - Evidence now shows explicit arithmetic ("45m / 0.78 ≈ 58")
 * - Zones fit inside building footprint; most previous overlaps resolved
 *   (only Vestibule still overlaps 2 neighbours)
 */
export const SAMPLE_DRAFT_CAPTURED_ART_MUSEUM_V2: DraftScenario = {
  name: 'Art Museum (미술관) — prompt v2',
  notes: 'Captured 2026-04-24 after prompt revision. Compare against V1 for prompt-quality regression.',
  scale: {
    label: 'Top edge: 15,000 + 15,000 + 15,000 mm; Right edge: 5,100 + 12,000 + 15,000 + 12,000 mm',
    widthMeters: 58,
    heightMeters: 55,
    confidence: 'measured',
    evidence: 'Top dimension string reads 15,000 + 15,000 + 15,000 mm = 45 m across three bays covering the building width. Right-side string reads 5,100 + 12,000 + 15,000 + 12,000 = 44.1 m building height. Building occupies ~78% of image width and ~80% of image height → widthMeters ≈ 45/0.78 ≈ 58; heightMeters ≈ 44.1/0.80 ≈ 55.',
  },
  zones: [
    { key: 'storage_viewable', name: '보이는 수장고 (Viewable Storage)', type: 'exhibition', shape: 'rect', rect: { x: 18.5, y: 17.5, w: 4, h: 6.5 } },
    { key: 'permanent_exhibit_1', name: '상설전시실 1', type: 'exhibition', shape: 'rect', rect: { x: 22.5, y: 12.5, w: 13.5, h: 11 } },
    { key: 'permanent_exhibit_2', name: '상설전시실 2', type: 'exhibition', shape: 'rect', rect: { x: 36.5, y: 12.5, w: 11, h: 11 } },
    { key: 'conservation_room', name: '하역 및 다목적실 (Conservation/Multipurpose)', type: 'exhibition', shape: 'rect', rect: { x: 9, y: 18.5, w: 9.5, h: 6 } },
    { key: 'office_room', name: '전실 (Vestibule)', type: 'lobby', shape: 'rect', rect: { x: 19, y: 18.5, w: 7, h: 6 } },
    { key: 'special_exhibit', name: '기획전시실 (Special Exhibition)', type: 'exhibition', shape: 'rect', rect: { x: 9, y: 26, w: 17, h: 12 } },
    { key: 'light_courtyard', name: '빛의 중정 (Light Courtyard)', type: 'lobby', shape: 'rect', rect: { x: 26, y: 26, w: 13.5, h: 12.5 } },
    { key: 'education_room', name: '교육/체험관', type: 'exhibition', shape: 'rect', rect: { x: 39.5, y: 25, w: 3.5, h: 5.5 } },
    { key: 'library_space', name: '도서공간 (Library)', type: 'rest', shape: 'rect', rect: { x: 43, y: 25, w: 3.5, h: 5.5 } },
    { key: 'av_room', name: '시청각실 (AV Room)', type: 'exhibition', shape: 'rect', rect: { x: 46.5, y: 25, w: 3.5, h: 5.5 } },
    { key: 'seminar_room', name: '세미나실 (Seminar)', type: 'exhibition', shape: 'rect', rect: { x: 39.5, y: 32, w: 6.5, h: 6.5 } },
    { key: 'office', name: '사무실 (Office)', type: 'exhibition', shape: 'rect', rect: { x: 16.5, y: 39, w: 5.5, h: 5.5 } },
    { key: 'staff_lounge', name: '휴게실 (Staff Lounge)', type: 'rest', shape: 'rect', rect: { x: 12, y: 38.5, w: 4.5, h: 4.5 } },
    { key: 'lobby_shop', name: '로비/아트샵 (Lobby/Art Shop)', type: 'lobby', shape: 'rect', rect: { x: 26, y: 38.5, w: 11.5, h: 7 } },
    { key: 'creative_studio', name: '창작스튜디오 (Creative Studio)', type: 'exhibition', shape: 'rect', rect: { x: 39.5, y: 38.5, w: 8.5, h: 6.5 } },
    { key: 'outdoor_performance', name: '야외공연장 (Outdoor Stage)', type: 'stage', shape: 'rect', rect: { x: 25, y: 46.5, w: 13, h: 7 } },
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
  { id: 'art_museum', label: 'Art Museum (real AI capture, 2026-04-24)', draft: SAMPLE_DRAFT_CAPTURED_ART_MUSEUM },
  { id: 'art_museum_v2', label: 'Art Museum V2 (after prompt revision)', draft: SAMPLE_DRAFT_CAPTURED_ART_MUSEUM_V2 },
];
