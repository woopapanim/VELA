import type { Scenario, FloorConfig, ZoneConfig, MediaPlacement } from '@/domain';
import { DEFAULT_PHYSICS, DEFAULT_SKIP_THRESHOLD } from '@/domain';
import type { FloorId, ZoneId, GateId, MediaId } from '@/domain';

export function createDBGroupScenario(): Scenario {
  const f1 = 'db_1f' as FloorId;
  const f2 = 'db_2f' as FloorId;

  const floor1: FloorConfig = {
    id: f1, name: '1F', level: 0,
    canvas: { width: 1300, height: 850, gridSize: 40, backgroundImage: null, scale: 0.022 },
    zoneIds: ['db_entrance', 'db_main_hall', 'db_fintech', 'db_insurance', 'db_lounge', 'db_exit'].map(id => id as ZoneId),
    metadata: { client: 'DB Group' },
  };

  const floor2: FloorConfig = {
    id: f2, name: '2F', level: 1,
    canvas: { width: 1300, height: 850, gridSize: 40, backgroundImage: null, scale: 0.022 },
    zoneIds: ['db_2f_tech', 'db_2f_art', 'db_2f_vip', 'db_2f_exit'].map(id => id as ZoneId),
    metadata: {},
  };

  const zones: ZoneConfig[] = [
    // 1F
    { id: 'db_entrance' as ZoneId, name: 'DB Welcome', type: 'entrance', shape: 'rect',
      bounds: { x: 50, y: 320, w: 150, h: 200 }, polygon: null, area: 66, capacity: 40, flowType: 'free',
      gates: [
        { id: 'g_db_ent_in' as GateId, zoneId: 'db_entrance' as ZoneId, floorId: f1, type: 'entrance', position: { x: 50, y: 420 }, width: 60, connectedGateId: null },
        { id: 'g_db_ent_out' as GateId, zoneId: 'db_entrance' as ZoneId, floorId: f1, type: 'exit', position: { x: 200, y: 420 }, width: 50, connectedGateId: 'g_db_main_in' as GateId },
      ], mediaIds: ['m_db_welcome_led' as MediaId], color: '#22c55e', attractiveness: 0.3, metadata: {} },

    { id: 'db_main_hall' as ZoneId, name: 'DB Innovation Hall', type: 'exhibition', shape: 'rect',
      bounds: { x: 230, y: 200, w: 350, h: 350 }, polygon: null, area: 270, capacity: 100, flowType: 'free',
      gates: [
        { id: 'g_db_main_in' as GateId, zoneId: 'db_main_hall' as ZoneId, floorId: f1, type: 'entrance', position: { x: 230, y: 375 }, width: 50, connectedGateId: 'g_db_ent_out' as GateId },
        { id: 'g_db_main_to_fin' as GateId, zoneId: 'db_main_hall' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 580, y: 300 }, width: 50, connectedGateId: 'g_db_fin_in' as GateId },
        { id: 'g_db_main_to_ins' as GateId, zoneId: 'db_main_hall' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 580, y: 450 }, width: 50, connectedGateId: 'g_db_ins_in' as GateId },
      ], mediaIds: ['m_db_main_led' as MediaId, 'm_db_timeline' as MediaId, 'm_db_kiosk1' as MediaId], color: '#3b82f6', attractiveness: 0.8, metadata: {} },

    { id: 'db_fintech' as ZoneId, name: 'Fintech Zone', type: 'exhibition', shape: 'rect',
      bounds: { x: 620, y: 180, w: 280, h: 200 }, polygon: null, area: 135, capacity: 50, flowType: 'guided',
      gates: [
        { id: 'g_db_fin_in' as GateId, zoneId: 'db_fintech' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 620, y: 280 }, width: 50, connectedGateId: 'g_db_main_to_fin' as GateId },
        { id: 'g_db_fin_to_lounge' as GateId, zoneId: 'db_fintech' as ZoneId, floorId: f1, type: 'exit', position: { x: 900, y: 280 }, width: 40, connectedGateId: 'g_db_lounge_in1' as GateId },
      ], mediaIds: ['m_db_fintech_ar' as MediaId, 'm_db_fintech_table' as MediaId], color: '#06b6d4', attractiveness: 0.9, metadata: {} },

    { id: 'db_insurance' as ZoneId, name: 'Insurance Experience', type: 'exhibition', shape: 'rect',
      bounds: { x: 620, y: 420, w: 280, h: 200 }, polygon: null, area: 135, capacity: 50, flowType: 'free',
      gates: [
        { id: 'g_db_ins_in' as GateId, zoneId: 'db_insurance' as ZoneId, floorId: f1, type: 'bidirectional', position: { x: 620, y: 520 }, width: 50, connectedGateId: 'g_db_main_to_ins' as GateId },
        { id: 'g_db_ins_to_lounge' as GateId, zoneId: 'db_insurance' as ZoneId, floorId: f1, type: 'exit', position: { x: 900, y: 520 }, width: 40, connectedGateId: 'g_db_lounge_in2' as GateId },
      ], mediaIds: ['m_db_ins_sim' as MediaId, 'm_db_ins_vr' as MediaId], color: '#8b5cf6', attractiveness: 0.85, metadata: {} },

    { id: 'db_lounge' as ZoneId, name: 'DB Lounge', type: 'rest', shape: 'rect',
      bounds: { x: 940, y: 300, w: 200, h: 250 }, polygon: null, area: 110, capacity: 35, flowType: 'free',
      gates: [
        { id: 'g_db_lounge_in1' as GateId, zoneId: 'db_lounge' as ZoneId, floorId: f1, type: 'entrance', position: { x: 940, y: 370 }, width: 40, connectedGateId: 'g_db_fin_to_lounge' as GateId },
        { id: 'g_db_lounge_in2' as GateId, zoneId: 'db_lounge' as ZoneId, floorId: f1, type: 'entrance', position: { x: 940, y: 470 }, width: 40, connectedGateId: 'g_db_ins_to_lounge' as GateId },
        { id: 'g_db_lounge_exit' as GateId, zoneId: 'db_lounge' as ZoneId, floorId: f1, type: 'exit', position: { x: 1140, y: 425 }, width: 50, connectedGateId: 'g_db_exit_in' as GateId },
      ], mediaIds: ['m_db_lounge_seat' as MediaId], color: '#f59e0b', attractiveness: 0.4, metadata: {} },

    { id: 'db_exit' as ZoneId, name: 'Exit', type: 'exit', shape: 'rect',
      bounds: { x: 1150, y: 320, w: 120, h: 200 }, polygon: null, area: 60, capacity: 50, flowType: 'free',
      gates: [
        { id: 'g_db_exit_in' as GateId, zoneId: 'db_exit' as ZoneId, floorId: f1, type: 'entrance', position: { x: 1150, y: 420 }, width: 50, connectedGateId: 'g_db_lounge_exit' as GateId },
      ], mediaIds: [], color: '#ef4444', attractiveness: 0.1, metadata: {} },

    // 2F
    { id: 'db_2f_tech' as ZoneId, name: 'Tech Lab', type: 'exhibition', shape: 'rect',
      bounds: { x: 200, y: 250, w: 300, h: 250 }, polygon: null, area: 165, capacity: 40, flowType: 'guided',
      gates: [
        { id: 'g_db_2f_tech_to_art' as GateId, zoneId: 'db_2f_tech' as ZoneId, floorId: f2, type: 'exit', position: { x: 500, y: 375 }, width: 40, connectedGateId: 'g_db_2f_art_in' as GateId },
      ], mediaIds: ['m_db_2f_ai' as MediaId, 'm_db_2f_robot' as MediaId], color: '#10b981', attractiveness: 0.95, metadata: {} },

    { id: 'db_2f_art' as ZoneId, name: 'Digital Art Gallery', type: 'exhibition', shape: 'rect',
      bounds: { x: 550, y: 250, w: 250, h: 250 }, polygon: null, area: 137, capacity: 45, flowType: 'free',
      gates: [
        { id: 'g_db_2f_art_in' as GateId, zoneId: 'db_2f_art' as ZoneId, floorId: f2, type: 'entrance', position: { x: 550, y: 375 }, width: 40, connectedGateId: 'g_db_2f_tech_to_art' as GateId },
        { id: 'g_db_2f_art_to_vip' as GateId, zoneId: 'db_2f_art' as ZoneId, floorId: f2, type: 'exit', position: { x: 800, y: 375 }, width: 40, connectedGateId: 'g_db_2f_vip_in' as GateId },
      ], mediaIds: ['m_db_2f_immersive' as MediaId, 'm_db_2f_nft' as MediaId], color: '#ec4899', attractiveness: 0.9, metadata: {} },

    { id: 'db_2f_vip' as ZoneId, name: 'VIP Suite', type: 'rest', shape: 'rect',
      bounds: { x: 850, y: 280, w: 200, h: 200 }, polygon: null, area: 88, capacity: 15, flowType: 'free',
      gates: [
        { id: 'g_db_2f_vip_in' as GateId, zoneId: 'db_2f_vip' as ZoneId, floorId: f2, type: 'entrance', position: { x: 850, y: 380 }, width: 40, connectedGateId: 'g_db_2f_art_to_vip' as GateId },
        { id: 'g_db_2f_vip_exit' as GateId, zoneId: 'db_2f_vip' as ZoneId, floorId: f2, type: 'exit', position: { x: 950, y: 480 }, width: 40, connectedGateId: 'g_db_2f_exit_in' as GateId },
      ], mediaIds: ['m_db_2f_vip_seat' as MediaId], color: '#fbbf24', attractiveness: 0.5, metadata: {} },

    { id: 'db_2f_exit' as ZoneId, name: '2F Exit', type: 'exit', shape: 'rect',
      bounds: { x: 900, y: 500, w: 150, h: 150 }, polygon: null, area: 50, capacity: 30, flowType: 'free',
      gates: [
        { id: 'g_db_2f_exit_in' as GateId, zoneId: 'db_2f_exit' as ZoneId, floorId: f2, type: 'entrance', position: { x: 950, y: 500 }, width: 40, connectedGateId: 'g_db_2f_vip_exit' as GateId },
      ], mediaIds: [], color: '#ef4444', attractiveness: 0.1, metadata: {} },
  ];

  const media: MediaPlacement[] = [
    { id: 'm_db_welcome_led' as MediaId, type: 'led_wall', zoneId: 'db_entrance' as ZoneId, position: { x: 125, y: 380 }, size: { width: 6, height: 3 }, orientation: 0, capacity: 25, avgEngagementTimeMs: 15000, attractiveness: 0.6 },
    { id: 'm_db_main_led' as MediaId, type: 'led_wall', zoneId: 'db_main_hall' as ZoneId, position: { x: 350, y: 280 }, size: { width: 10, height: 4 }, orientation: 0, capacity: 40, avgEngagementTimeMs: 30000, attractiveness: 0.8 },
    { id: 'm_db_timeline' as MediaId, type: 'projection', zoneId: 'db_main_hall' as ZoneId, position: { x: 300, y: 420 }, size: { width: 8, height: 4 }, orientation: 0, capacity: 30, avgEngagementTimeMs: 45000, attractiveness: 0.75 },
    { id: 'm_db_kiosk1' as MediaId, type: 'touchscreen_kiosk', zoneId: 'db_main_hall' as ZoneId, position: { x: 480, y: 350 }, size: { width: 0.8, height: 0.5 }, orientation: 90, capacity: 2, avgEngagementTimeMs: 60000, attractiveness: 0.65 },
    { id: 'm_db_fintech_ar' as MediaId, type: 'ar_station', zoneId: 'db_fintech' as ZoneId, position: { x: 720, y: 250 }, size: { width: 2, height: 2 }, orientation: 0, capacity: 2, avgEngagementTimeMs: 120000, attractiveness: 0.95 },
    { id: 'm_db_fintech_table' as MediaId, type: 'interactive_table', zoneId: 'db_fintech' as ZoneId, position: { x: 800, y: 320 }, size: { width: 2, height: 1.2 }, orientation: 0, capacity: 6, avgEngagementTimeMs: 90000, attractiveness: 0.85 },
    { id: 'm_db_ins_sim' as MediaId, type: 'simulator', zoneId: 'db_insurance' as ZoneId, position: { x: 720, y: 490 }, size: { width: 4, height: 3 }, orientation: 0, capacity: 1, avgEngagementTimeMs: 240000, attractiveness: 0.9 },
    { id: 'm_db_ins_vr' as MediaId, type: 'vr_booth', zoneId: 'db_insurance' as ZoneId, position: { x: 830, y: 490 }, size: { width: 3, height: 3 }, orientation: 0, capacity: 1, avgEngagementTimeMs: 180000, attractiveness: 0.88 },
    { id: 'm_db_lounge_seat' as MediaId, type: 'seating_area', zoneId: 'db_lounge' as ZoneId, position: { x: 1040, y: 420 }, size: { width: 4, height: 3 }, orientation: 0, capacity: 15, avgEngagementTimeMs: 300000, attractiveness: 0.3 },
    { id: 'm_db_2f_ai' as MediaId, type: 'gesture_wall', zoneId: 'db_2f_tech' as ZoneId, position: { x: 300, y: 340 }, size: { width: 4, height: 2.5 }, orientation: 0, capacity: 4, avgEngagementTimeMs: 60000, attractiveness: 0.92 },
    { id: 'm_db_2f_robot' as MediaId, type: 'hands_on_demo', zoneId: 'db_2f_tech' as ZoneId, position: { x: 420, y: 400 }, size: { width: 3, height: 2 }, orientation: 0, capacity: 3, avgEngagementTimeMs: 120000, attractiveness: 0.88 },
    { id: 'm_db_2f_immersive' as MediaId, type: 'projection', zoneId: 'db_2f_art' as ZoneId, position: { x: 650, y: 330 }, size: { width: 8, height: 4 }, orientation: 0, capacity: 20, avgEngagementTimeMs: 60000, attractiveness: 0.93 },
    { id: 'm_db_2f_nft' as MediaId, type: 'digital_signage', zoneId: 'db_2f_art' as ZoneId, position: { x: 620, y: 430 }, size: { width: 3, height: 2 }, orientation: 0, capacity: 8, avgEngagementTimeMs: 30000, attractiveness: 0.7 },
    { id: 'm_db_2f_vip_seat' as MediaId, type: 'seating_area', zoneId: 'db_2f_vip' as ZoneId, position: { x: 950, y: 380 }, size: { width: 3, height: 2 }, orientation: 0, capacity: 8, avgEngagementTimeMs: 300000, attractiveness: 0.35 },
  ];

  return {
    meta: {
      id: 'db_group_exhibition' as any,
      name: 'DB Group Innovation Exhibition',
      description: 'Fintech + Insurance + Tech Lab + Digital Art + VIP (2-floor)',
      version: 1, parentId: null, tags: ['db-group', 'finance', 'innovation'],
      createdAt: Date.now(), updatedAt: Date.now(),
    },
    floors: [floor1, floor2],
    zones,
    media,
    visitorDistribution: {
      totalCount: 250,
      profileWeights: { general: 50, vip: 25, child: 5, elderly: 12, disabled: 8 },
      engagementWeights: { quick: 20, explorer: 45, immersive: 35 },
      groupRatio: 0.25, spawnRatePerSecond: 2.5,
    },
    simulationConfig: {
      fixedDeltaTime: 1000 / 60, duration: 3_600_000, timeScale: 3, maxVisitors: 400, seed: 2025,
      physics: { ...DEFAULT_PHYSICS, maxSpeed: 110 },
      skipThreshold: DEFAULT_SKIP_THRESHOLD,
      timeSlots: [
        { startTimeMs: 0, endTimeMs: 1_800_000, spawnRatePerSecond: 2.5, profileDistribution: { general: 50, vip: 25, child: 5, elderly: 12, disabled: 8 }, engagementDistribution: { quick: 20, explorer: 45, immersive: 35 }, groupRatio: 0.25 },
        { startTimeMs: 1_800_000, endTimeMs: 3_600_000, spawnRatePerSecond: 1.5, profileDistribution: { general: 40, vip: 35, child: 3, elderly: 15, disabled: 7 }, engagementDistribution: { quick: 15, explorer: 40, immersive: 45 }, groupRatio: 0.2 },
      ],
    },
  };
}
