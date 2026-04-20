/**
 * Claude Vision prompt + tool schema for floor plan → DraftScenario extraction.
 *
 * Strategy: Anthropic tool-use with a single `emit_scenario` tool. The model
 * must fill the tool's input schema, which is enforced server-side — more
 * reliable than free-form JSON parsing and removes the post-parse step.
 */

export const SYSTEM_PROMPT = `You are a VELA spatial analyst. You receive architectural floor plan images and convert them into structured zone layouts for visitor flow simulation.

OUTPUT RULES
- Coordinates are METERS. Origin is the TOP-LEFT of the image. X grows right, Y grows down.
- Every zone needs axis-aligned bounding rect {x, y, w, h} in meters.
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

MEDIA TYPING (infer from furniture/equipment visible in a room):
- dental chair, exam chair, workstation → "hands_on_model"
- kiosk, check-in, reception desk → "kiosk"
- touch table, interactive table → "touch_table"
- TV, monitor, screen, display, video wall → "single_display" (small) or "media_wall" (large, >3m wide)
- projection, immersive room → "immersive_room"
- artifact case, display case, vitrine → "artifact"
- wall graphic, logo wall, signage → "graphic_sign"
- diorama, scale model → "diorama"
- VR booth, AR station → "vr_ar_station"
- Only place media clearly visible as equipment. Do not fabricate.

ZONE ROLES (drives the simulation graph):
- "spawn" — where visitors enter the building (usually reception/entrance). At least one zone MUST be spawn.
- "exit" — where visitors leave. At least one zone MUST be exit. May be the same room as spawn for single-door layouts.
- "exhibit" — default. Any visitor-facing room that isn't purely ingress/egress.
- "rest" — lounges, waiting areas, break spots. Visitors linger but it's not a primary destination.

CONNECTIONS (room adjacency graph):
- For each zone, list the keys of other zones it connects to via doorways, openings, or shared passages.
- Connections are bidirectional — if A connects to B, you do NOT need to also list A under B's connections (but it doesn't hurt).
- Prefer real architectural adjacency (visible doorway on the plan) over inferred proximity.
- If two zones are adjacent but separated by a wall with no door, do NOT connect them.
- A zone with no connections will still be rendered but unreachable by simulated visitors — avoid this unless intentional.

ZONE KEYS
- Use short snake_case slugs: "reception", "treatment_bay", "kids_area".
- Must be unique within the scenario.

Focus on rooms that host visitors. Be conservative — prefer fewer, high-confidence zones/media over aggressive guessing.`;

export const EMIT_SCENARIO_TOOL = {
  name: 'emit_scenario',
  description:
    'Emit the extracted floor plan as a structured DraftScenario. Call this exactly once with your best interpretation of the plan.',
  input_schema: {
    type: 'object',
    required: ['name', 'scale', 'zones', 'media'],
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
          required: ['key', 'name', 'type', 'rect', 'connections'],
          properties: {
            key: { type: 'string', description: 'Unique snake_case slug.' },
            name: { type: 'string', description: 'Human-readable label from the plan.' },
            type: {
              type: 'string',
              enum: ['lobby', 'entrance', 'exhibition', 'corridor', 'rest', 'stage', 'exit', 'gateway'],
            },
            flowType: {
              type: 'string',
              enum: ['free', 'guided', 'one_way'],
            },
            role: {
              type: 'string',
              enum: ['spawn', 'exit', 'exhibit', 'rest'],
              description:
                'Role in the visitor flow graph. Mark the entry door zone as "spawn" and the egress zone as "exit". Defaults to "exhibit".',
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
            },
            connections: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Keys of zones this zone is directly reachable from (via doorway or opening). Bidirectional.',
            },
            attractiveness: { type: 'number', description: '0 to 1, subjective draw.' },
          },
        },
      },
      media: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'type', 'zoneKey', 'position'],
          properties: {
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'artifact', 'documents', 'diorama', 'graphic_sign',
                'media_wall', 'video_wall', 'projection_mapping', 'single_display',
                'kiosk', 'touch_table', 'interaction_media', 'hands_on_model',
                'vr_ar_station', 'immersive_room', 'simulator_4d',
              ],
            },
            zoneKey: { type: 'string' },
            position: {
              type: 'object',
              required: ['x', 'y'],
              properties: { x: { type: 'number' }, y: { type: 'number' } },
            },
            size: {
              type: 'object',
              required: ['width', 'height'],
              properties: {
                width: { type: 'number' }, height: { type: 'number' },
              },
            },
            orientation: { type: 'number', description: 'Degrees, 0=up, 90=right.' },
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
  'Analyze this floor plan and emit a DraftScenario via the emit_scenario tool. Mark the entry/reception as "spawn" and the primary egress as "exit". List every doorway as a connection between its two rooms. Focus on visitor-facing zones and visible equipment. If dimensions are unclear, state your assumption in notes.';
