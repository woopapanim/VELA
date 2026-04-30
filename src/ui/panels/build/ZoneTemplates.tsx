import { useCallback } from 'react';
import { LayoutGrid, Rows3, Circle, Maximize2 } from 'lucide-react';
import { useStore } from '@/stores';
import type {
  ZoneConfig, ZoneId, FloorId,
  WaypointGraph, WaypointNode, WaypointEdge, WaypointId, WaypointEdgeId,
} from '@/domain';
import { ZONE_COLORS } from '@/domain';
import { useT } from '@/i18n';

let _tplCounter = 200;
let _tplWpCounter = 200;
let _tplWeCounter = 200;

function ensureTplCounters() {
  const state = useStore.getState();
  let maxZ = _tplCounter - 1;
  let maxN = _tplWpCounter - 1;
  let maxE = _tplWeCounter - 1;
  for (const z of state.zones) {
    const zm = (z.id as string).match(/^z_tpl_(\d+)$/);
    if (zm) maxZ = Math.max(maxZ, parseInt(zm[1]));
  }
  if (state.waypointGraph) {
    for (const n of state.waypointGraph.nodes) {
      const nm = (n.id as string).match(/^wp_tpl_(\d+)$/);
      if (nm) maxN = Math.max(maxN, parseInt(nm[1]));
    }
    for (const ed of state.waypointGraph.edges) {
      const em = (ed.id as string).match(/^we_tpl_(\d+)$/);
      if (em) maxE = Math.max(maxE, parseInt(em[1]));
    }
  }
  _tplCounter = maxZ + 1;
  _tplWpCounter = maxN + 1;
  _tplWeCounter = maxE + 1;
}

interface TemplateOutput {
  zones: ZoneConfig[];
  graph: WaypointGraph;
}

interface ZoneTemplate {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  descKey: string;
  generate: (floorId: FloorId) => TemplateOutput;
}

function makeZone(
  name: string, type: string, x: number, y: number, w: number, h: number,
  cap: number, attract: number, floorId: FloorId,
): ZoneConfig {
  ensureTplCounters();
  const zoneId = `z_tpl_${_tplCounter++}` as ZoneId;
  return {
    id: zoneId,
    name,
    type: type as any,
    floorId,
    shape: 'rect',
    bounds: { x, y, w, h },
    polygon: null,
    area: Math.round(w * h * 0.000625), // rough px→m² at scale 0.025
    capacity: cap,
    flowType: 'free',
    gates: [],
    mediaIds: [],
    color: ZONE_COLORS[type] ?? '#3b82f6',
    attractiveness: attract,
    metadata: {},
  };
}

type NodeKind = 'entry' | 'exit' | 'zone' | 'rest';

function makeNode(
  kind: NodeKind, label: string, x: number, y: number, floorId: FloorId, zoneId: ZoneId | null,
): WaypointNode {
  ensureTplCounters();
  const id = `wp_tpl_${_tplWpCounter++}` as WaypointId;
  return {
    id,
    type: kind,
    position: { x, y },
    floorId,
    label,
    attraction: kind === 'zone' ? 0.7 : kind === 'rest' ? 0.3 : 0.5,
    dwellTimeMs: kind === 'zone' ? 15000 : kind === 'rest' ? 30000 : 0,
    capacity: 30,
    spawnWeight: kind === 'entry' ? 1.0 : 0,
    lookAt: 0,
    zoneId,
    mediaId: null,
  };
}

function makeEdge(
  from: WaypointNode, to: WaypointNode,
  direction: 'directed' | 'bidirectional' = 'directed',
): WaypointEdge {
  ensureTplCounters();
  const id = `we_tpl_${_tplWeCounter++}` as WaypointEdgeId;
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  const cost = Math.round(Math.hypot(dx, dy));
  return {
    id,
    fromId: from.id,
    toId: to.id,
    direction,
    passWeight: 0.5,
    cost,
  };
}

const TEMPLATES: ZoneTemplate[] = [
  {
    id: 'linear',
    labelKey: 'zoneTemplate.linear.label',
    icon: Rows3,
    descKey: 'zoneTemplate.linear.desc',
    generate: (floorId) => {
      const zEntry = makeZone('Entrance', 'entrance', 50, 300, 120, 180, 30, 0.3, floorId);
      const zG1 = makeZone('Gallery 1', 'exhibition', 220, 280, 220, 220, 60, 0.8, floorId);
      const zG2 = makeZone('Gallery 2', 'exhibition', 490, 280, 220, 220, 60, 0.9, floorId);
      const zExit = makeZone('Exit', 'exit', 760, 300, 120, 180, 40, 0.1, floorId);
      const nEntry = makeNode('entry', 'Entry', 110, 390, floorId, zEntry.id);
      const nG1 = makeNode('zone', 'Gallery 1', 330, 390, floorId, zG1.id);
      const nG2 = makeNode('zone', 'Gallery 2', 600, 390, floorId, zG2.id);
      const nExit = makeNode('exit', 'Exit', 820, 390, floorId, zExit.id);
      return {
        zones: [zEntry, zG1, zG2, zExit],
        graph: {
          nodes: [nEntry, nG1, nG2, nExit],
          edges: [
            makeEdge(nEntry, nG1),
            makeEdge(nG1, nG2),
            makeEdge(nG2, nExit),
          ],
        },
      };
    },
  },
  {
    id: 'hub_spoke',
    labelKey: 'zoneTemplate.hub.label',
    icon: Circle,
    descKey: 'zoneTemplate.hub.desc',
    generate: (floorId) => {
      const zEntry = makeZone('Entrance', 'entrance', 50, 320, 100, 160, 30, 0.3, floorId);
      const zHub = makeZone('Central Hub', 'exhibition', 250, 250, 250, 250, 80, 0.6, floorId);
      const zA = makeZone('Wing A', 'exhibition', 550, 200, 180, 160, 50, 0.85, floorId);
      const zB = makeZone('Wing B', 'exhibition', 550, 420, 180, 160, 50, 0.85, floorId);
      const zL = makeZone('Lounge', 'rest', 250, 550, 150, 100, 20, 0.4, floorId);
      const zExit = makeZone('Exit', 'exit', 800, 320, 100, 160, 40, 0.1, floorId);
      const nEntry = makeNode('entry', 'Entry', 100, 400, floorId, zEntry.id);
      const nHub = makeNode('zone', 'Central Hub', 375, 375, floorId, zHub.id);
      const nA = makeNode('zone', 'Wing A', 640, 280, floorId, zA.id);
      const nB = makeNode('zone', 'Wing B', 640, 500, floorId, zB.id);
      const nL = makeNode('rest', 'Lounge', 325, 600, floorId, zL.id);
      const nExit = makeNode('exit', 'Exit', 850, 400, floorId, zExit.id);
      return {
        zones: [zEntry, zHub, zA, zB, zL, zExit],
        graph: {
          nodes: [nEntry, nHub, nA, nB, nL, nExit],
          edges: [
            makeEdge(nEntry, nHub),
            makeEdge(nHub, nA, 'bidirectional'),
            makeEdge(nHub, nB, 'bidirectional'),
            makeEdge(nHub, nL, 'bidirectional'),
            makeEdge(nHub, nExit),
          ],
        },
      };
    },
  },
  {
    id: 'grid',
    labelKey: 'zoneTemplate.grid.label',
    icon: LayoutGrid,
    descKey: 'zoneTemplate.grid.desc',
    generate: (floorId) => {
      const zones: ZoneConfig[] = [];
      const nodes: WaypointNode[] = [];
      const edges: WaypointEdge[] = [];
      const zEntry = makeZone('Entrance', 'entrance', 50, 300, 100, 160, 30, 0.3, floorId);
      zones.push(zEntry);
      const nEntry = makeNode('entry', 'Entry', 100, 380, floorId, zEntry.id);
      nodes.push(nEntry);

      // 2 rows × 3 cols grid of booths.
      const booths: WaypointNode[][] = [];
      for (let row = 0; row < 2; row++) {
        const rowNodes: WaypointNode[] = [];
        for (let col = 0; col < 3; col++) {
          const x = 200 + col * 200;
          const y = 180 + row * 240;
          const z = makeZone(
            `Booth ${row * 3 + col + 1}`,
            'exhibition', x, y, 160, 180, 40, 0.7 + Math.random() * 0.2, floorId,
          );
          zones.push(z);
          const n = makeNode('zone', z.name, x + 80, y + 90, floorId, z.id);
          nodes.push(n);
          rowNodes.push(n);
        }
        booths.push(rowNodes);
      }
      const zExit = makeZone('Exit', 'exit', 810, 300, 100, 160, 40, 0.1, floorId);
      zones.push(zExit);
      const nExit = makeNode('exit', 'Exit', 860, 380, floorId, zExit.id);
      nodes.push(nExit);

      // ENTRY → first booth (top-left).
      edges.push(makeEdge(nEntry, booths[0][0]));
      // Horizontal bidir within each row.
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          edges.push(makeEdge(booths[row][col], booths[row][col + 1], 'bidirectional'));
        }
      }
      // Vertical bidir between rows.
      for (let col = 0; col < 3; col++) {
        edges.push(makeEdge(booths[0][col], booths[1][col], 'bidirectional'));
      }
      // Last booth → EXIT.
      edges.push(makeEdge(booths[1][2], nExit));

      return { zones, graph: { nodes, edges } };
    },
  },
  {
    id: 'large_hall',
    labelKey: 'zoneTemplate.hall.label',
    icon: Maximize2,
    descKey: 'zoneTemplate.hall.desc',
    generate: (floorId) => {
      const zEntry = makeZone('Entrance', 'entrance', 50, 300, 100, 200, 40, 0.3, floorId);
      const zHall = makeZone('Main Hall', 'exhibition', 200, 100, 600, 500, 200, 0.9, floorId);
      const zStage = makeZone('Stage', 'stage', 850, 150, 200, 300, 80, 0.7, floorId);
      const zRest = makeZone('Rest', 'rest', 200, 650, 250, 120, 30, 0.4, floorId);
      const zExit = makeZone('Exit', 'exit', 850, 500, 200, 200, 50, 0.1, floorId);
      const nEntry = makeNode('entry', 'Entry', 100, 400, floorId, zEntry.id);
      const nHall = makeNode('zone', 'Main Hall', 500, 350, floorId, zHall.id);
      const nStage = makeNode('zone', 'Stage', 950, 300, floorId, zStage.id);
      const nRest = makeNode('rest', 'Rest', 325, 710, floorId, zRest.id);
      const nExit = makeNode('exit', 'Exit', 950, 600, floorId, zExit.id);
      return {
        zones: [zEntry, zHall, zStage, zRest, zExit],
        graph: {
          nodes: [nEntry, nHall, nStage, nRest, nExit],
          edges: [
            makeEdge(nEntry, nHall),
            makeEdge(nHall, nStage, 'bidirectional'),
            makeEdge(nHall, nRest, 'bidirectional'),
            makeEdge(nHall, nExit),
          ],
        },
      };
    },
  },
];

export function ZoneTemplates() {
  const setScenario = useStore((s) => s.setScenario);
  const scenario = useStore((s) => s.scenario);
  const phase = useStore((s) => s.phase);
  const resetSim = useStore((s) => s.resetSim);
  const t = useT();

  const isLocked = phase !== 'idle';

  const applyTemplate = useCallback((templateId: string) => {
    if (!scenario || isLocked) return;
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const floorId = (scenario.floors[0]?.id ?? 'floor_1f') as FloorId;
    const { zones: newZones, graph } = template.generate(floorId);

    resetSim();
    setScenario({
      ...scenario,
      zones: newZones,
      media: [],
      waypointGraph: graph,
      floors: scenario.floors.map((f) => ({
        ...f,
        zoneIds: newZones.map((z) => z.id),
      })),
    });
  }, [scenario, setScenario, resetSim, isLocked]);

  if (!scenario) return null;

  return (
    <div>
      <p className="panel-label mb-1.5">{t('zoneTemplate.section.title')}</p>
      <div className="grid grid-cols-2 gap-1">
        {TEMPLATES.map(({ id, labelKey, icon: Icon, descKey }) => (
          <button
            key={id}
            onClick={() => applyTemplate(id)}
            disabled={isLocked}
            className="flex items-start gap-1.5 p-2 text-left rounded-xl bg-secondary hover:bg-accent disabled:opacity-40 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-medium">{t(labelKey)}</p>
              <p className="text-[8px] text-muted-foreground leading-tight">{t(descKey)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
