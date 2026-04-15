import type { FloorId, ZoneId, MediaId, Vector2D, WaypointId, WaypointEdgeId } from './common';

export type { WaypointId, WaypointEdgeId };

// ---- Waypoint Node Type ----
export const WAYPOINT_TYPE = {
  ENTRY: 'entry',         // 스폰 지점
  EXIT: 'exit',           // 소멸 지점
  ZONE: 'zone',           // 전시 거점
  ATTRACTOR: 'attractor', // 고인력 타겟 (대형 LED, 신차 전시 등)
  HUB: 'hub',             // 의사결정점 (교차로/분기점, 체류 없음)
  REST: 'rest',           // 휴게/버퍼
} as const;

export type WaypointType = (typeof WAYPOINT_TYPE)[keyof typeof WAYPOINT_TYPE];

// ---- Waypoint Node ----
export interface WaypointNode {
  readonly id: WaypointId;
  readonly type: WaypointType;
  readonly position: Vector2D;
  readonly floorId: FloorId;
  readonly label: string;
  // 속성
  readonly attraction: number;       // 0-1, Score 공식 w1
  readonly dwellTimeMs: number;      // 평균 체류 시간 (ms)
  readonly capacity: number;         // 최대 동시 수용 인원
  readonly spawnWeight: number;      // ENTRY 전용: 스폰 확률 가중치
  readonly lookAt: number;           // degrees, 미디어 정면 방향
  // Zone 연결 (자동 계산: 노드가 zone polygon 안이면)
  readonly zoneId: ZoneId | null;
  // 미디어 직접 바인딩 (ATTRACTOR 전용)
  readonly mediaId: MediaId | null;
}

// ---- Edge Direction ----
export const EDGE_DIRECTION = {
  DIRECTED: 'directed',
  BIDIRECTIONAL: 'bidirectional',
} as const;

export type EdgeDirection = (typeof EDGE_DIRECTION)[keyof typeof EDGE_DIRECTION];

// ---- Waypoint Edge ----
export interface WaypointEdge {
  readonly id: WaypointEdgeId;
  readonly fromId: WaypointId;
  readonly toId: WaypointId;
  readonly direction: EdgeDirection;
  readonly passWeight: number;       // 0-1, 갈림길 선택 확률 보정
  readonly cost: number;             // 기본값 = 노드 간 거리(px)
}

// ---- Waypoint Graph (전체 그래프) ----
export interface WaypointGraph {
  readonly nodes: readonly WaypointNode[];
  readonly edges: readonly WaypointEdge[];
}

// ---- Path Log Entry (방문 기록) ----
export interface PathLogEntry {
  readonly nodeId: WaypointId;
  readonly entryTime: number;        // elapsed ms
  readonly exitTime: number;         // elapsed ms (0 = 아직 체류 중)
  readonly duration: number;         // ms
}
