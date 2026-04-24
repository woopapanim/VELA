/**
 * Claude Vision prompt + tool schema for floor plan → DraftScenario extraction.
 *
 * Scope: ZONES ONLY. The analyzer produces room footprints that match the plan
 * as closely as possible; media placements, waypoint nodes, and edges are the
 * user's job after loading.
 *
 * Strategy: Anthropic tool-use with a single `emit_scenario` tool. The model
 * must fill the tool's input schema, which is enforced server-side — more
 * reliable than free-form JSON parsing and removes the post-parse step.
 */

export const SYSTEM_PROMPT = `You are a VELA spatial analyst. You receive architectural floor plan images and convert them into zone layouts for visitor flow simulation.

SCOPE
- Extract ZONES ONLY (room footprints). The user will add media, waypoint nodes, and edges afterwards in the editor — do NOT attempt to produce those.
- Your one job: every visitor-facing room in the plan becomes one zone with an accurate axis-aligned rect (or polygon for L/O-shaped rooms) in meters.

OUTPUT RULES
- Coordinates are METERS. Origin is the TOP-LEFT of the image. X grows right, Y grows down.
- Every zone needs axis-aligned bounding rect {x, y, w, h} in meters. Match the drawn room as precisely as you can — mis-sized rects make the hand-drawn result look wrong.
- SHAPE selection — pick the one that matches the drawn room:
  - "rect" (default): straight walls, axis-aligned rectangle.
  - "circle": the room is drawn as a circle / ellipse / rounded blob. Provide the bounding rect; the editor will inscribe a circle into it. Do NOT emit a polygon for circles.
  - Otherwise (L-shape, curved organic footprint, diagonal walls, any non-rect non-circle shape): use "rect" for the shape field AND provide a polygon (absolute meters, clockwise or counter-clockwise) that traces the actual walls.
- ZONES MUST NOT OVERLAP. Each rect/polygon represents a physical room; rooms don't share floor area. If two rooms share a wall, their rects should touch but not overlap (share an edge). Double-check before emitting.

SCALE — this is the single most important number to get right. Wrong scale makes the entire scenario unusable.
1. Scan the image systematically for scale cues, in this order of preference:
   a) A scale bar / scale ruler (e.g. "|——— 5m ———|", "0  2  4  6 m"). Use its pixel length ratio to derive meters-per-pixel, then multiply by image width/height.
   b) An overall building / floor dimension label on an outer wall or title block (e.g. "40'-1\\"" along a long side, "전체 30000" in mm).
   c) Dimension lines with tick marks and numbers between interior walls (e.g. "3500" mm or "3.5m" between two partition lines).
   d) Room labels that include a size (e.g. "Conference 6m × 4m", "회의실 6×4").
   e) Door widths (~0.9 m) or a standard car footprint (~4.5 × 1.8 m) or a human figure (~1.7 m tall) — LAST RESORT only.
2. Compute widthMeters / heightMeters for the WHOLE IMAGE (not just the building). If you read only one dimension, infer the other from visual proportion of the image.
3. Unit conversion:
   - Feet + inches (e.g. 40'-1"): convert to meters using 1 ft = 0.3048 m, 1 in = 0.0254 m.
   - Millimetres (common in Korean/European plans, e.g. "3500"): divide by 1000.
   - Centimetres: divide by 100.
4. Set the "confidence" field:
   - "measured" — you directly read at least one numeric dimension off the plan.
   - "inferred" — you estimated from a visual proxy (door, car, human).
   - "assumed" — no cues found at all; fall back to shorter image axis = 15 meters.
5. Populate the "evidence" field with the exact cue you used, including where on the plan (e.g. "scale bar bottom-left, '5m' tick", "title block reads 40'-1\\" × 70'-0\\"", "no dimensions — used 15 m fallback").

ZONE TYPING — ONLY these five types exist in the editor. Pick the closest match:
- "lobby" — reception, waiting, lounge, entrance, vestibule, foyer, visitor's space, balcony
- "exhibition" — treatment bay, gallery, display, showroom, workspace, editing suite, sound room, meeting room, any generic visitor-facing room that doesn't fit the others
- "corridor" — hallway, passage, transition, worker's space (pure circulation)
- "rest" — staff lounge, break room, rest area, kid's area, pantry
- "stage" — stage, theater, auditorium, performance space
- Skip pure utility rooms (restroom/toilet, storage, mechanical, closet, server, IT, janitor, shoe rack, printer nook). They are NOT zones.
- Do NOT invent types like "entrance" or "exit" — the editor only has the five above.

ZONE KEYS
- Use short snake_case slugs: "reception", "treatment_bay", "kids_area".
- Must be unique within the scenario.

Focus on rooms that host visitors. Be conservative — prefer fewer, high-confidence zones over aggressive guessing. Precision of the rect matters more than breadth of labeling.`;

export const EMIT_SCENARIO_TOOL = {
  name: 'emit_scenario',
  description:
    'Emit the extracted floor plan as a structured DraftScenario (zones only). Call this exactly once with your best interpretation of the plan.',
  input_schema: {
    type: 'object',
    required: ['name', 'scale', 'zones'],
    properties: {
      name: {
        type: 'string',
        description: 'Short scenario name inferred from the plan (e.g. "Dental Clinic", "Retail Showroom").',
      },
      scale: {
        type: 'object',
        required: ['label', 'widthMeters', 'heightMeters', 'confidence', 'evidence'],
        properties: {
          label: { type: 'string', description: 'Raw dimension text you saw on the plan (verbatim), or a short description if only a scale bar was present.' },
          widthMeters: { type: 'number', description: 'Full image width in meters.' },
          heightMeters: { type: 'number', description: 'Full image height in meters.' },
          confidence: {
            type: 'string',
            enum: ['measured', 'inferred', 'assumed'],
            description: '"measured" — read a numeric dimension. "inferred" — estimated from a visual proxy (door/car/person). "assumed" — no cues; used 15m short-axis fallback.',
          },
          evidence: {
            type: 'string',
            description: 'Exact cue used and its location on the plan. Example: "scale bar bottom-left labelled 5m", "title block reads 40\'-1\\" × 70\'-0\\"", "estimated from door widths in corridor".',
          },
        },
      },
      zones: {
        type: 'array',
        items: {
          type: 'object',
          required: ['key', 'name', 'type', 'shape', 'rect'],
          properties: {
            key: { type: 'string', description: 'Unique snake_case slug.' },
            name: { type: 'string', description: 'Human-readable label from the plan.' },
            type: {
              type: 'string',
              enum: ['lobby', 'exhibition', 'corridor', 'rest', 'stage'],
            },
            shape: {
              type: 'string',
              enum: ['rect', 'circle'],
              description: '"circle" only for rooms drawn as circles/ellipses (provide just the bounding rect). Otherwise "rect" — and add a polygon if the footprint is L-shaped or curved.',
            },
            rect: {
              type: 'object',
              required: ['x', 'y', 'w', 'h'],
              properties: {
                x: { type: 'number' }, y: { type: 'number' },
                w: { type: 'number' }, h: { type: 'number' },
              },
            },
            polygon: {
              type: 'array',
              items: {
                type: 'object',
                required: ['x', 'y'],
                properties: { x: { type: 'number' }, y: { type: 'number' } },
              },
              description: 'Required for non-rect non-circle footprints (L-shape, curved walls, diagonals). Absolute meter coords. Do NOT emit for circles or plain rectangles.',
            },
          },
        },
      },
      notes: {
        type: 'string',
        description: 'Short free-text observations (ambiguous rooms, low confidence areas).',
      },
    },
  },
} as const;

export const USER_MESSAGE_TEXT =
  'Analyze this floor plan and emit a DraftScenario via the emit_scenario tool. Extract every visitor-facing room as a zone with an accurate rect in meters — skip utility rooms. The floor plan image will be preserved as a background overlay so the user can verify and refine zone shapes. Do NOT emit media, waypoints, or edges — those are added by the user after loading.';
