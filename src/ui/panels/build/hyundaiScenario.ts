import type { Scenario, FloorConfig, ZoneConfig, MediaPlacement } from '@/domain';
import { DEFAULT_PHYSICS, DEFAULT_SKIP_THRESHOLD } from '@/domain';
import type { FloorId, ZoneId, GateId, MediaId } from '@/domain';

export function createHyundaiScenario(): Scenario {
  const f1 = 'hyundai_1f' as FloorId;

  const floor1: FloorConfig = {
    id: f1, name: '1F Main', level: 0,
    canvas: { width: 1400, height: 900, gridSize: 40, backgroundImage: null, scale: 0.02 },
    zoneIds: ['h_entrance', 'h_welcome', 'h_ioniq', 'h_nx', 'h_heritage', 'h_ev_experience', 'h_kids', 'h_cafe', 'h_shop', 'h_exit'].map(id => id as ZoneId),
    metadata: { client: 'Hyundai Motor' },
  };

  const zones: ZoneConfig[] = [
    { id: 'h_entrance' as ZoneId, name: 'Grand Entrance', type: 'entrance', shape: 'rect', bounds: { x: 50, y: 350, w: 140, h: 200 }, polygon: null, area: 56, capacity: 50, flowType: 'free',
      gates: [
        { id: 'g_h_ent_in' as GateId, zoneId: 'h_entrance' as ZoneId, floorId: f1, type: 'entrance', position: { x: 50, y: 450 }, width: 60, connectedGateId: null },
        { id: 'g_h_ent_out' as GateId, zoneId: 'h_entrance' as ZoneId, floorId: f1, type: 'exit', position: { x: 190, y: 450 }, width: 50, connectedGateId: 'g_h_welcome_in' as GateId },
      ],
      mediaIds: [], color: '#22c55e', attractiveness: 0.3, metadata: {} },

    { id: 'h_welcome' as ZoneId, name: 'Welcome Plaza', type: 'exhibition', shape: 'rect', bounds: { x: 220, y: 250, w: 200, h: 300 }, polygon: null, area: 120, capacity: 60, flowType: 'free',
      gates: [
        { id: 'g_h_welcome_in' as GateId, zoneId: 'h_welcome' as ZoneId, floorId: f1, type: 'entrance', position: { x: 220, y: 400 }, width: 50, connectedGateId: 'g_h_ent_out' as GateId },
        { id: 'g_h_welcome_to_ioniq' as GateId, zoneId: 'h_welcome' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 420, y: 320 }, width: 50, connectedGateId: 'g_h_ioniq_in' as GateId },
        { id: 'g_h_welcome_to_heritage' as GateId, zoneId: 'h_welcome' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 420, y: 480 }, width: 50, connectedGateId: 'g_h_heritage_in' as GateId },
      ],
      mediaIds: ['m_h_led_main' as MediaId, 'm_h_welcome_sign' as MediaId], color: '#3b82f6', attractiveness: 0.7, metadata: {} },

    { id: 'h_ioniq' as ZoneId, name: 'IONIQ Experience', type: 'exhibition', shape: 'rect', bounds: { x: 460, y: 150, w: 300, h: 220 }, polygon: null, area: 165, capacity: 80, flowType: 'guided',
      gates: [
        { id: 'g_h_ioniq_in' as GateId, zoneId: 'h_ioniq' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 460, y: 260 }, width: 50, connectedGateId: 'g_h_welcome_to_ioniq' as GateId },
        { id: 'g_h_ioniq_to_nx' as GateId, zoneId: 'h_ioniq' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 760, y: 260 }, width: 50, connectedGateId: 'g_h_nx_in' as GateId },
      ],
      mediaIds: ['m_h_ioniq5' as MediaId, 'm_h_ioniq6' as MediaId, 'm_h_ev_kiosk' as MediaId], color: '#06b6d4', attractiveness: 0.95, metadata: {} },

    { id: 'h_nx' as ZoneId, name: 'N / N Line Zone', type: 'exhibition', shape: 'rect', bounds: { x: 800, y: 150, w: 280, h: 220 }, polygon: null, area: 154, capacity: 70, flowType: 'free',
      gates: [
        { id: 'g_h_nx_in' as GateId, zoneId: 'h_nx' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 800, y: 260 }, width: 50, connectedGateId: 'g_h_ioniq_to_nx' as GateId },
        { id: 'g_h_nx_to_ev' as GateId, zoneId: 'h_nx' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 940, y: 370 }, width: 50, connectedGateId: 'g_h_ev_in' as GateId },
      ],
      mediaIds: ['m_h_n_sim' as MediaId, 'm_h_n_display' as MediaId], color: '#ef4444', attractiveness: 0.9, metadata: {} },

    { id: 'h_heritage' as ZoneId, name: 'Heritage Gallery', type: 'exhibition', shape: 'rect', bounds: { x: 460, y: 420, w: 300, h: 200 }, polygon: null, area: 150, capacity: 60, flowType: 'one_way',
      gates: [
        { id: 'g_h_heritage_in' as GateId, zoneId: 'h_heritage' as ZoneId, floorId: f1, type: 'entrance', position: { x: 460, y: 520 }, width: 50, connectedGateId: 'g_h_welcome_to_heritage' as GateId },
        { id: 'g_h_heritage_to_kids' as GateId, zoneId: 'h_heritage' as ZoneId, floorId: f1, type: 'exit', position: { x: 760, y: 520 }, width: 50, connectedGateId: 'g_h_kids_in' as GateId },
      ],
      mediaIds: ['m_h_heritage_wall' as MediaId, 'm_h_pony' as MediaId], color: '#8b5cf6', attractiveness: 0.75, metadata: {} },

    { id: 'h_ev_experience' as ZoneId, name: 'EV Test Drive', type: 'exhibition', shape: 'rect', bounds: { x: 800, y: 400, w: 300, h: 200 }, polygon: null, area: 150, capacity: 30, flowType: 'guided',
      gates: [
        { id: 'g_h_ev_in' as GateId, zoneId: 'h_ev_experience' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 940, y: 400 }, width: 40, connectedGateId: 'g_h_nx_to_ev' as GateId },
        { id: 'g_h_ev_to_shop' as GateId, zoneId: 'h_ev_experience' as ZoneId, floorId: f1, type: 'exit', position: { x: 1100, y: 500 }, width: 40, connectedGateId: 'g_h_shop_in' as GateId },
      ],
      mediaIds: ['m_h_sim_drive' as MediaId, 'm_h_vr_drive' as MediaId], color: '#10b981', attractiveness: 0.98, metadata: {} },

    { id: 'h_kids' as ZoneId, name: 'Kids Zone', type: 'rest', shape: 'rect', bounds: { x: 460, y: 660, w: 200, h: 160 }, polygon: null, area: 80, capacity: 25, flowType: 'free',
      gates: [
        { id: 'g_h_kids_in' as GateId, zoneId: 'h_kids' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 560, y: 660 }, width: 40, connectedGateId: 'g_h_heritage_to_kids' as GateId },
        { id: 'g_h_kids_to_cafe' as GateId, zoneId: 'h_kids' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 660, y: 740 }, width: 40, connectedGateId: 'g_h_cafe_in' as GateId },
      ],
      mediaIds: ['m_h_kids_play' as MediaId], color: '#fbbf24', attractiveness: 0.6, metadata: {} },

    { id: 'h_cafe' as ZoneId, name: 'Hyundai Cafe', type: 'rest', shape: 'rect', bounds: { x: 700, y: 660, w: 200, h: 160 }, polygon: null, area: 80, capacity: 35, flowType: 'free',
      gates: [
        { id: 'g_h_cafe_in' as GateId, zoneId: 'h_cafe' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 700, y: 740 }, width: 40, connectedGateId: 'g_h_kids_to_cafe' as GateId },
        { id: 'g_h_cafe_to_shop' as GateId, zoneId: 'h_cafe' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 900, y: 740 }, width: 40, connectedGateId: 'g_h_shop_from_cafe' as GateId },
      ],
      mediaIds: ['m_h_cafe_menu' as MediaId], color: '#f59e0b', attractiveness: 0.5, metadata: {} },

    { id: 'h_shop' as ZoneId, name: 'Merchandise Shop', type: 'exhibition', shape: 'rect', bounds: { x: 1130, y: 400, w: 180, h: 250 }, polygon: null, area: 112, capacity: 40, flowType: 'free',
      gates: [
        { id: 'g_h_shop_in' as GateId, zoneId: 'h_shop' as ZoneId, floorId: f1, type: 'entrance', position: { x: 1130, y: 500 }, width: 40, connectedGateId: 'g_h_ev_to_shop' as GateId },
        { id: 'g_h_shop_from_cafe' as GateId, zoneId: 'h_shop' as ZoneId, floorId: f1, type: 'entrance', position: { x: 1130, y: 600 }, width: 40, connectedGateId: 'g_h_cafe_to_shop' as GateId },
        { id: 'g_h_shop_to_exit' as GateId, zoneId: 'h_shop' as ZoneId, floorId: f1, type: 'exit', position: { x: 1310, y: 525 }, width: 50, connectedGateId: 'g_h_exit_in' as GateId },
      ],
      mediaIds: ['m_h_merch_display' as MediaId], color: '#ec4899', attractiveness: 0.4, metadata: {} },

    { id: 'h_exit' as ZoneId, name: 'Exit Gate', type: 'exit', shape: 'rect', bounds: { x: 1250, y: 350, w: 120, h: 200 }, polygon: null, area: 60, capacity: 50, flowType: 'free',
      gates: [
        { id: 'g_h_exit_in' as GateId, zoneId: 'h_exit' as ZoneId, floorId: f1, type: 'entrance', position: { x: 1250, y: 450 }, width: 50, connectedGateId: 'g_h_shop_to_exit' as GateId },
      ],
      mediaIds: [], color: '#ef4444', attractiveness: 0.1, metadata: {} },
  ];

  const media: MediaPlacement[] = [
    { id: 'm_h_led_main' as MediaId, type: 'led_wall', zoneId: 'h_welcome' as ZoneId, position: { x: 320, y: 300 }, size: { width: 10, height: 4 }, orientation: 0, capacity: 40, avgEngagementTimeMs: 30000, attractiveness: 0.8 },
    { id: 'm_h_welcome_sign' as MediaId, type: 'digital_signage', zoneId: 'h_welcome' as ZoneId, position: { x: 280, y: 450 }, size: { width: 2, height: 1.5 }, orientation: 90, capacity: 10, avgEngagementTimeMs: 10000, attractiveness: 0.4 },
    { id: 'm_h_ioniq5' as MediaId, type: 'product_display', zoneId: 'h_ioniq' as ZoneId, position: { x: 540, y: 220 }, size: { width: 5, height: 3 }, orientation: 0, capacity: 15, avgEngagementTimeMs: 45000, attractiveness: 0.95 },
    { id: 'm_h_ioniq6' as MediaId, type: 'rotating_platform', zoneId: 'h_ioniq' as ZoneId, position: { x: 680, y: 250 }, size: { width: 4, height: 4 }, orientation: 0, capacity: 20, avgEngagementTimeMs: 30000, attractiveness: 0.9 },
    { id: 'm_h_ev_kiosk' as MediaId, type: 'touchscreen_kiosk', zoneId: 'h_ioniq' as ZoneId, position: { x: 520, y: 310 }, size: { width: 0.8, height: 0.5 }, orientation: 180, capacity: 2, avgEngagementTimeMs: 60000, attractiveness: 0.7 },
    { id: 'm_h_n_sim' as MediaId, type: 'simulator', zoneId: 'h_nx' as ZoneId, position: { x: 900, y: 220 }, size: { width: 4, height: 3 }, orientation: 0, capacity: 2, avgEngagementTimeMs: 300000, attractiveness: 0.95 },
    { id: 'm_h_n_display' as MediaId, type: 'product_display', zoneId: 'h_nx' as ZoneId, position: { x: 850, y: 300 }, size: { width: 5, height: 3 }, orientation: 0, capacity: 12, avgEngagementTimeMs: 35000, attractiveness: 0.85 },
    { id: 'm_h_heritage_wall' as MediaId, type: 'led_wall', zoneId: 'h_heritage' as ZoneId, position: { x: 600, y: 460 }, size: { width: 8, height: 3 }, orientation: 0, capacity: 30, avgEngagementTimeMs: 40000, attractiveness: 0.8 },
    { id: 'm_h_pony' as MediaId, type: 'showcase_case', zoneId: 'h_heritage' as ZoneId, position: { x: 520, y: 550 }, size: { width: 3, height: 2 }, orientation: 0, capacity: 10, avgEngagementTimeMs: 25000, attractiveness: 0.7 },
    { id: 'm_h_sim_drive' as MediaId, type: 'simulator', zoneId: 'h_ev_experience' as ZoneId, position: { x: 900, y: 470 }, size: { width: 4, height: 3 }, orientation: 0, capacity: 1, avgEngagementTimeMs: 300000, attractiveness: 0.98 },
    { id: 'm_h_vr_drive' as MediaId, type: 'vr_booth', zoneId: 'h_ev_experience' as ZoneId, position: { x: 1020, y: 470 }, size: { width: 3, height: 3 }, orientation: 0, capacity: 1, avgEngagementTimeMs: 180000, attractiveness: 0.95 },
    { id: 'm_h_kids_play' as MediaId, type: 'interactive_table', zoneId: 'h_kids' as ZoneId, position: { x: 560, y: 730 }, size: { width: 2, height: 1.2 }, orientation: 0, capacity: 6, avgEngagementTimeMs: 120000, attractiveness: 0.7 },
    { id: 'm_h_cafe_menu' as MediaId, type: 'digital_signage', zoneId: 'h_cafe' as ZoneId, position: { x: 800, y: 700 }, size: { width: 2, height: 1 }, orientation: 0, capacity: 5, avgEngagementTimeMs: 5000, attractiveness: 0.3 },
    { id: 'm_h_merch_display' as MediaId, type: 'product_display', zoneId: 'h_shop' as ZoneId, position: { x: 1220, y: 500 }, size: { width: 3, height: 2 }, orientation: 0, capacity: 10, avgEngagementTimeMs: 20000, attractiveness: 0.5 },
  ];

  return {
    meta: {
      id: 'hyundai_exhibition' as any,
      name: 'Hyundai Motor Exhibition',
      description: 'IONIQ + N Line + Heritage + EV Experience + Kids + Cafe',
      version: 1, parentId: null, tags: ['hyundai', 'automotive', 'exhibition'],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    floors: [floor1],
    zones,
    media,
    visitorDistribution: {
      totalCount: 300,
      profileWeights: { general: 55, vip: 20, child: 12, elderly: 8, disabled: 5 },
      engagementWeights: { quick: 25, explorer: 40, immersive: 35 },
      groupRatio: 0.35, spawnRatePerSecond: 3,
    },
    simulationConfig: {
      fixedDeltaTime: 1000 / 60, duration: 3_600_000, timeScale: 3, maxVisitors: 500, seed: 2024,
      physics: { ...DEFAULT_PHYSICS, maxSpeed: 100, arrivalRadius: 35 },
      skipThreshold: { ...DEFAULT_SKIP_THRESHOLD, maxWaitTimeMs: 90000 },
      timeSlots: [
        { startTimeMs: 0, endTimeMs: 1_200_000, spawnRatePerSecond: 3, profileDistribution: { general: 55, vip: 20, child: 12, elderly: 8, disabled: 5 }, engagementDistribution: { quick: 25, explorer: 40, immersive: 35 }, groupRatio: 0.35 },
        { startTimeMs: 1_200_000, endTimeMs: 2_400_000, spawnRatePerSecond: 4, profileDistribution: { general: 50, vip: 15, child: 20, elderly: 10, disabled: 5 }, engagementDistribution: { quick: 30, explorer: 35, immersive: 35 }, groupRatio: 0.45 },
        { startTimeMs: 2_400_000, endTimeMs: 3_600_000, spawnRatePerSecond: 2, profileDistribution: { general: 60, vip: 25, child: 5, elderly: 5, disabled: 5 }, engagementDistribution: { quick: 20, explorer: 45, immersive: 35 }, groupRatio: 0.2 },
      ],
    },
  };
}
