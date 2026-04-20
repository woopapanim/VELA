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
- For L-shaped or non-rectangular rooms, also provide a polygon (absolute meters, clockwise or counter-clockwise, closed loop optional).
- Infer scale from dimension labels on the plan (e.g. "40'-1\\" × 70'-0\\"", "12m × 21m"). Convert feet to meters (1 ft = 0.3048 m).
- If no dimensions are visible, assume the shorter image axis spans 15 meters.

ZONE TYPING (map common room labels):
- reception, waiting, lounge → "lobby"
- entrance, vestibule, foyer → "entrance"
- treatment, exhibition hall, gallery, display, showroom → "exhibition"
- hallway, corridor, passage → "corridor"
- staff lounge, break room, rest area, kid's area → "rest"
- stage, theater, auditorium → "stage"
- exit, back-of-house egress → "exit"
- Skip pure utility rooms (restroom, storage, mechanical, closet, IT). They are NOT zones.

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
        required: ['label', 'widthMeters', 'heightMeters'],
        properties: {
          label: { type: 'string', description: 'Raw dimension text you saw on the plan.' },
          widthMeters: { type: 'number', description: 'Full image width in meters.' },
          heightMeters: { type: 'number', description: 'Full image height in meters.' },
        },
      },
      zones: {
        type: 'array',
        items: {
          type: 'object',
          required: ['key', 'name', 'type', 'rect'],
          properties: {
            key: { type: 'string', description: 'Unique snake_case slug.' },
            name: { type: 'string', description: 'Human-readable label from the plan.' },
            type: {
              type: 'string',
              enum: ['lobby', 'entrance', 'exhibition', 'corridor', 'rest', 'stage', 'exit', 'gateway'],
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
              description: 'Optional polygon for L/O/non-rect rooms. Absolute meter coords.',
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
