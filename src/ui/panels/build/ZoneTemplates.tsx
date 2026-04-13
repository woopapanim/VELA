import { useCallback } from 'react';
import { LayoutGrid, Rows3, Circle, Maximize2 } from 'lucide-react';
import { useStore } from '@/stores';
import type { ZoneConfig, ZoneId, GateId, FloorId } from '@/domain';
import { ZONE_COLORS } from '@/domain';

let _tplCounter = 200;
let _tplGateCounter = 200;

interface ZoneTemplate {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  generate: (floorId: FloorId) => ZoneConfig[];
}

function makeZone(
  name: string, type: string, x: number, y: number, w: number, h: number,
  cap: number, attract: number, floorId: FloorId, gates: Array<{ type: string; x: number; y: number; connId?: string }>,
): ZoneConfig {
  const zoneId = `z_tpl_${_tplCounter++}` as ZoneId;
  return {
    id: zoneId,
    name,
    type: type as any,
    shape: 'rect',
    bounds: { x, y, w, h },
    polygon: null,
    area: Math.round(w * h * 0.000625), // rough px→m² at scale 0.025
    capacity: cap,
    flowType: 'free',
    gates: gates.map((g) => ({
      id: `g_tpl_${_tplGateCounter++}` as GateId,
      zoneId,
      floorId,
      type: g.type as any,
      position: { x: g.x, y: g.y },
      width: 40,
      connectedGateId: null,
      targetFloorId: null,
      targetGateId: null,
    })),
    mediaIds: [],
    color: ZONE_COLORS[type] ?? '#3b82f6',
    attractiveness: attract,
    metadata: {},
  };
}

const TEMPLATES: ZoneTemplate[] = [
  {
    id: 'linear',
    label: 'Linear',
    icon: Rows3,
    desc: '일렬 동선 (입구→전시→출구)',
    generate: (floorId) => [
      makeZone('Entrance', 'entrance', 50, 300, 120, 180, 30, 0.3, floorId, [{ type: 'entrance', x: 50, y: 390 }, { type: 'exit', x: 170, y: 390 }]),
      makeZone('Gallery 1', 'exhibition', 220, 280, 220, 220, 60, 0.8, floorId, [{ type: 'entrance', x: 220, y: 390 }, { type: 'exit', x: 440, y: 390 }]),
      makeZone('Gallery 2', 'exhibition', 490, 280, 220, 220, 60, 0.9, floorId, [{ type: 'entrance', x: 490, y: 390 }, { type: 'exit', x: 710, y: 390 }]),
      makeZone('Exit', 'exit', 760, 300, 120, 180, 40, 0.1, floorId, [{ type: 'entrance', x: 760, y: 390 }]),
    ],
  },
  {
    id: 'hub_spoke',
    label: 'Hub & Spoke',
    icon: Circle,
    desc: '중앙 홀 + 주변 전시실',
    generate: (floorId) => [
      makeZone('Entrance', 'entrance', 50, 320, 100, 160, 30, 0.3, floorId, [{ type: 'entrance', x: 50, y: 400 }, { type: 'exit', x: 150, y: 400 }]),
      makeZone('Central Hub', 'exhibition', 250, 250, 250, 250, 80, 0.6, floorId, [
        { type: 'bidirectional', x: 250, y: 375 }, { type: 'bidirectional', x: 500, y: 375 },
        { type: 'bidirectional', x: 375, y: 250 }, { type: 'bidirectional', x: 375, y: 500 },
      ]),
      makeZone('Wing A', 'exhibition', 550, 200, 180, 160, 50, 0.85, floorId, [{ type: 'bidirectional', x: 550, y: 280 }]),
      makeZone('Wing B', 'exhibition', 550, 420, 180, 160, 50, 0.85, floorId, [{ type: 'bidirectional', x: 550, y: 500 }]),
      makeZone('Lounge', 'rest', 250, 550, 150, 100, 20, 0.4, floorId, [{ type: 'bidirectional', x: 325, y: 550 }]),
      makeZone('Exit', 'exit', 800, 320, 100, 160, 40, 0.1, floorId, [{ type: 'entrance', x: 800, y: 400 }]),
    ],
  },
  {
    id: 'grid',
    label: 'Grid',
    icon: LayoutGrid,
    desc: '격자형 부스 배치',
    generate: (floorId) => {
      const zones: ZoneConfig[] = [];
      zones.push(makeZone('Entrance', 'entrance', 50, 300, 100, 160, 30, 0.3, floorId, [{ type: 'entrance', x: 50, y: 380 }, { type: 'exit', x: 150, y: 380 }]));
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const x = 200 + col * 200;
          const y = 180 + row * 240;
          zones.push(makeZone(`Booth ${row * 3 + col + 1}`, 'exhibition', x, y, 160, 180, 40, 0.7 + Math.random() * 0.2, floorId, [
            { type: 'bidirectional', x: x, y: y + 90 },
            { type: 'bidirectional', x: x + 160, y: y + 90 },
          ]));
        }
      }
      zones.push(makeZone('Exit', 'exit', 810, 300, 100, 160, 40, 0.1, floorId, [{ type: 'entrance', x: 810, y: 380 }]));
      return zones;
    },
  },
  {
    id: 'large_hall',
    label: 'Large Hall',
    icon: Maximize2,
    desc: '대형 단일 전시 홀',
    generate: (floorId) => [
      makeZone('Entrance', 'entrance', 50, 300, 100, 200, 40, 0.3, floorId, [{ type: 'entrance', x: 50, y: 400 }, { type: 'exit', x: 150, y: 400 }]),
      makeZone('Main Hall', 'exhibition', 200, 100, 600, 500, 200, 0.9, floorId, [
        { type: 'bidirectional', x: 200, y: 350 }, { type: 'bidirectional', x: 800, y: 350 },
      ]),
      makeZone('Stage', 'stage', 850, 150, 200, 300, 80, 0.7, floorId, [{ type: 'entrance', x: 850, y: 300 }]),
      makeZone('Rest', 'rest', 200, 650, 250, 120, 30, 0.4, floorId, [{ type: 'bidirectional', x: 325, y: 650 }]),
      makeZone('Exit', 'exit', 850, 500, 200, 200, 50, 0.1, floorId, [{ type: 'entrance', x: 850, y: 600 }]),
    ],
  },
];

export function ZoneTemplates() {
  const setScenario = useStore((s) => s.setScenario);
  const scenario = useStore((s) => s.scenario);
  const phase = useStore((s) => s.phase);
  const resetSim = useStore((s) => s.resetSim);

  const isLocked = phase !== 'idle';

  const applyTemplate = useCallback((templateId: string) => {
    if (!scenario || isLocked) return;
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const floorId = (scenario.floors[0]?.id ?? 'floor_1f') as FloorId;
    const newZones = template.generate(floorId);

    resetSim();
    setScenario({
      ...scenario,
      zones: newZones,
      media: [],
      floors: scenario.floors.map((f) => ({
        ...f,
        zoneIds: newZones.map((z) => z.id),
      })),
    });
  }, [scenario, setScenario, resetSim, isLocked]);

  if (!scenario) return null;

  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Zone Templates</p>
      <div className="grid grid-cols-2 gap-1">
        {TEMPLATES.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => applyTemplate(id)}
            disabled={isLocked}
            className="flex items-start gap-1.5 p-2 text-left rounded-xl bg-secondary hover:bg-accent disabled:opacity-40 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-medium">{label}</p>
              <p className="text-[8px] text-muted-foreground leading-tight">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
