/**
 * WaypointNavigator — Graph-Point 기반 동선 엔진
 *
 * 노드(ENTRY/EXIT/ZONE/ATTRACTOR/REST) + 에지(directed/bidirectional)로 구성된
 * 그래프 위에서 Score 기반 의사결정으로 다음 목표 노드를 선택한다.
 *
 * Score(Node) = (attraction × w1) + (1/distance × w2) + (interestMatch × w3)
 *             - (crowdDensity × w4) - (visitedPenalty × w5)
 */

import type { WaypointNode, WaypointEdge, WaypointGraph, WaypointId, PathLogEntry, ShaftId } from '@/domain';
import type { Visitor } from '@/domain';
import type { SeededRandom } from '../utils/random';

// Score weights (tunable)
const W_ATTRACTION = 1.0;
const W_DISTANCE = 0.3;
const W_INTEREST = 0.5;
const W_CROWD = 0.4; // node crowd (원래값 유지)
const W_VISITED = 9999;
const W_ZONE_OVERCAP = 2.5; // 목적지 zone overcapacity penalty
const ZONE_SOFT_FULL_RATIO = 1.0; // 100% 이상부터 감점 시작

// EXIT 노드 진입 조건 — 피로 3시간 스케일 + 60~90분 평균 관람 기준으로 맞춤
const EXIT_VISIT_RATIO = 0.65;   // 필수 노드 65% 방문 후 EXIT 허용 (이전 0.9 — 3시간 피로 모델과 맞지 않음)
const EXIT_FATIGUE_THRESHOLD = 0.45; // 피로 45% 이상 (약 60~90분 관람 시 도달)

// Stuck 감지 — 이 시간을 초과하면 강제로 canExit 활성
const STUCK_AT_NODE_MS = 60_000;             // 동일 노드에 60초 이상 체류 = 실제 끼임
const MAX_TOTAL_DWELL_MS = 3 * 60 * 60_000;  // 전체 체류 3시간 초과 (피로 스케일과 맞춤,
                                             // 이전 15분은 관람 타임아웃이 아닌 진짜 stuck escape용)

export class WaypointNavigator {
  private adjacency = new Map<string, { node: WaypointNode; edge: WaypointEdge }[]>();
  private nodeMap = new Map<string, WaypointNode>();
  private entryNodes: WaypointNode[] = [];
  private exitNodes: WaypointNode[] = [];
  private essentialCount = 0; // ZONE + ATTRACTOR 노드 수 + shaft 수 (shaft 1개 = 필수 1개)
  private essentialShaftIds: Set<string> = new Set();
  // entryId → 기하학적으로 짝지어진 preferred exitId. "들어온 길로 나간다" 휴리스틱.
  // 같은 floor 의 exit 중 Euclidean 최단거리 exit. 스폰 시점 visitor.spawnEntryNodeId
  // 와 함께 작동해서 Entry 1 ↔ Exit 1 자연스러운 대칭 동선 유도.
  private entryToPreferredExit = new Map<string, string>();

  buildFromGraph(graph: WaypointGraph): void {
    this.adjacency.clear();
    this.nodeMap.clear();
    this.entryNodes = [];
    this.exitNodes = [];
    this.essentialCount = 0;
    this.essentialShaftIds = new Set();
    this.entryToPreferredExit.clear();

    for (const node of graph.nodes) {
      this.nodeMap.set(node.id as string, node);
      this.adjacency.set(node.id as string, []);
      if (node.type === 'entry') this.entryNodes.push(node);
      if (node.type === 'exit') this.exitNodes.push(node);
      if (node.type === 'zone' || node.type === 'attractor') this.essentialCount++;
      if (node.type === 'portal' && node.shaftId) {
        this.essentialShaftIds.add(node.shaftId as string);
      }
    }
    this.essentialCount += this.essentialShaftIds.size;

    for (const edge of graph.edges) {
      const fromNode = this.nodeMap.get(edge.fromId as string);
      const toNode = this.nodeMap.get(edge.toId as string);
      if (!fromNode || !toNode) continue;

      // from → to
      this.adjacency.get(edge.fromId as string)!.push({ node: toNode, edge });

      // bidirectional: to → from
      if (edge.direction === 'bidirectional') {
        this.adjacency.get(edge.toId as string)!.push({ node: fromNode, edge });
      }
    }

    // 각 entry 에 대해 preferred exit 선택 — 같은 floor 우선, Euclidean 거리 최단.
    // exit 가 하나면 pairing 무의미 (모두 그 exit), 아예 건너뜀.
    if (this.exitNodes.length > 1) {
      for (const entry of this.entryNodes) {
        let best: WaypointNode | null = null;
        let bestScore = Infinity;
        for (const exit of this.exitNodes) {
          const dx = exit.position.x - entry.position.x;
          const dy = exit.position.y - entry.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // same-floor 이면 원거리, different-floor 이면 큰 페널티를 더해 동층 exit 선호.
          const sameFloor = (exit.floorId as string) === (entry.floorId as string);
          const score = dist + (sameFloor ? 0 : 100_000);
          if (score < bestScore) { bestScore = score; best = exit; }
        }
        if (best) this.entryToPreferredExit.set(entry.id as string, best.id as string);
      }
    }
  }

  /** entry 에 지정된 preferred exit 조회. 매핑 없거나 exit 1개뿐이면 null. */
  getPreferredExitFor(entryId: WaypointId | null | undefined): WaypointNode | null {
    if (!entryId) return null;
    const eid = this.entryToPreferredExit.get(entryId as string);
    return eid ? (this.nodeMap.get(eid) ?? null) : null;
  }

  getNode(id: WaypointId): WaypointNode | undefined {
    return this.nodeMap.get(id as string);
  }

  getEntryNodes(): readonly WaypointNode[] {
    return this.entryNodes;
  }

  getExitNodes(): readonly WaypointNode[] {
    return this.exitNodes;
  }

  getNeighbors(nodeId: WaypointId): { node: WaypointNode; edge: WaypointEdge }[] {
    return this.adjacency.get(nodeId as string) ?? [];
  }

  /**
   * 특정 shaft에 속한 모든 elevator 노드 반환 (층 간 텔레포트 대상 탐색용)
   */
  getNodesByShaft(shaftId: ShaftId): WaypointNode[] {
    const out: WaypointNode[] = [];
    const target = shaftId as string;
    for (const node of this.nodeMap.values()) {
      if (node.type === 'portal' && (node.shaftId as string | null | undefined) === target) {
        out.push(node);
      }
    }
    return out;
  }

  /**
   * Score 기반 다음 노드 선택
   *
   * @param visitor      현재 에이전트
   * @param currentNodeId 현재 위치 노드
   * @param crowdMap     노드별 현재 인원
   * @param rng          시드 랜덤
   * @returns 다음 목표 노드 또는 null (막다른 길)
   */
  selectNextNode(
    visitor: Visitor,
    currentNodeId: WaypointId,
    crowdMap: ReadonlyMap<string, number>,
    rng: SeededRandom,
    now: number = 0,
    zoneOccupancy: ReadonlyMap<string, number> = new Map(),
    zoneCapacity: ReadonlyMap<string, number> = new Map(),
    mustVisit?: { unvisitedZoneIds: ReadonlySet<string>; unvisitedMediaIds: ReadonlySet<string> },
    /** 각 exit 노드로 현재 향하는 에이전트 수 — preferred exit 과밀 fallback 판단용 */
    exitTargetCounts?: ReadonlyMap<string, number>,
  ): WaypointNode | null {
    const neighbors = this.getNeighbors(currentNodeId);
    if (neighbors.length === 0) return null;

    const visitedNodeIds = new Set(visitor.pathLog.map(e => e.nodeId as string));
    const visitedShaftIds = new Set<string>();
    for (const entry of visitor.pathLog) {
      const n = this.nodeMap.get(entry.nodeId as string);
      if (n?.type === 'portal' && n.shaftId) visitedShaftIds.add(n.shaftId as string);
    }
    const visitedCount = this.countVisitedEssential(visitor.pathLog);

    // Stuck 감지: 같은 노드에 너무 오래 체류 또는 전체 체류 시간 초과
    let stuck = false;
    if (now > 0) {
      // 현재 노드(진입만 기록되고 종료 안 된 마지막 pathLog 엔트리) 체류 시간
      let timeAtNode = 0;
      for (let i = visitor.pathLog.length - 1; i >= 0; i--) {
        const e = visitor.pathLog[i];
        if ((e.nodeId as string) === (currentNodeId as string) && e.exitTime === 0) {
          timeAtNode = now - e.entryTime;
          break;
        }
      }
      const totalDwell = now - visitor.enteredAt;
      stuck = timeAtNode >= STUCK_AT_NODE_MS || totalDwell >= MAX_TOTAL_DWELL_MS;
    }

    // mustVisit (히어로) 미방문이 남아있으면 stuck 이외엔 exit 보류 (Tier 2).
    const mustOutstanding = !!mustVisit
      && (mustVisit.unvisitedZoneIds.size > 0 || mustVisit.unvisitedMediaIds.size > 0);

    // 개인 관람 예산 초과 — 시나리오 크기와 독립적으로 정시 퇴장 유도.
    // mustVisit 가 남았으면 여전히 보류 (히어로 우선 Tier 2 규칙과 동일).
    const budgetExceeded = !mustOutstanding
      && visitor.visitBudgetMs > 0
      && now > 0
      && (now - visitor.enteredAt) >= visitor.visitBudgetMs;

    // EXIT 진입 조건 체크
    const canExit = stuck
      || budgetExceeded
      || (!mustOutstanding && (
        visitedCount / Math.max(1, this.essentialCount) >= EXIT_VISIT_RATIO
        || visitor.fatigue >= EXIT_FATIGUE_THRESHOLD
      ));

    // Stuck/예산초과/모든 필수노드 방문완료 → EXIT 방향 강제 유도.
    // allEssentialDone 는 mustOutstanding(미방문 히어로 미디어)과 독립적으로 작동한다.
    // 존을 다 돌았는데 특정 미디어만 못 본 건 스킵 포함 정상 행동이고, 계속 떠돌면
    // hub/bend 왕복으로 예산만 낭비하므로 주 경험 완료 즉시 퇴장 유도.
    // preferred exit 결정 — visitor.spawnEntryNodeId 기반 pre-computed 매핑.
    // 과밀이면 nearest 로 fallback: paired exit 타겟 수가 전체 exit 평균의 1.5×
    // 초과 시 (절대값 >= 5). 1회만 결정해두고 이후 모든 BFS 호출에 재사용.
    const preferredExitId = this.pickPreferredExitId(
      visitor.spawnEntryNodeId as string | null | undefined,
      exitTargetCounts,
    );

    const allEssentialDone = visitedCount >= this.essentialCount;
    if (stuck || budgetExceeded || allEssentialDone) {
      const exitFirstHop = this.findFirstHopToExit(currentNodeId, preferredExitId);
      if (exitFirstHop) return exitFirstHop;
    }

    const scored: { node: WaypointNode; score: number }[] = [];

    // canExit 상태에서 EXIT 방향 이웃에 보너스 (BFS 기반)
    const exitHopId = canExit ? this.findFirstHopToExit(currentNodeId, preferredExitId)?.id : null;

    // mustVisit(히어로) 방향 이웃에 보너스 (BFS 기반 multi-hop 유도)
    const mustHopId = mustOutstanding && mustVisit
      ? this.findFirstHopToMustVisit(currentNodeId, mustVisit)?.id
      : null;

    // 직전 노드(방금 떠난 노드) 식별 — pathLog 의 마지막은 현재 노드(open, exitTime=0),
    // 그 직전이 방금 닫힌 previous. hub/bend/entry 는 visited 패널티 면제이므로
    // 즉시 U-턴으로 왕복 진동하기 쉬워 별도 소프트 패널티를 적용한다.
    // BFS 가 U-턴을 "정답"으로 지목한 경우(exitHop/mustHop)는 면제해서
    // 진짜 백트래킹이 필요한 상황은 방해하지 않는다.
    let prevNodeId: string | null = null;
    for (let i = visitor.pathLog.length - 2; i >= 0; i--) {
      const e = visitor.pathLog[i];
      if (e.exitTime > 0) { prevNodeId = e.nodeId as string; break; }
    }

    for (const { node: candidate, edge } of neighbors) {
      // EXIT 노드: 조건 미충족 시 후보에서 제외
      if (candidate.type === 'exit' && !canExit) continue;

      let score = this.scoreNode(visitor, candidate, edge, currentNodeId, visitedNodeIds, crowdMap);

      // Zone overcrowding penalty — 목적지 zone이 capacity 초과 근처면 강하게 감점
      if (candidate.zoneId) {
        const zid = candidate.zoneId as string;
        const zOcc = zoneOccupancy.get(zid) ?? 0;
        const zCap = zoneCapacity.get(zid) ?? 0;
        if (zCap > 0) {
          const ratio = zOcc / zCap;
          if (ratio >= ZONE_SOFT_FULL_RATIO) {
            // 0.9부터 시작해서 overcapacity까지 강한 감점 (ratio=1.0 → -0.5, ratio=2.0 → -5.5 등)
            score -= (ratio - ZONE_SOFT_FULL_RATIO) * W_ZONE_OVERCAP;
          }
        }
      }

      // EXIT 방향 보너스: canExit 상태에서 EXIT까지의 경로 첫 홉에 +3
      if (exitHopId && (candidate.id as string) === (exitHopId as string)) {
        score += 3.0;
      }

      // Portal 필수 유도: 미방문 shaft 포털에 강한 보너스 (zone 수준의 인력)
      if (candidate.type === 'portal' && candidate.shaftId
          && !visitedShaftIds.has(candidate.shaftId as string)) {
        score += 2.5;
      }

      // mustVisit (히어로) 보너스 — 직접 히어로이면 +5, 히어로 방향 첫 홉이면 +4 (multi-hop 유도).
      if (mustVisit) {
        if (candidate.zoneId && mustVisit.unvisitedZoneIds.has(candidate.zoneId as string)) {
          score += 5.0;
        } else if (candidate.mediaId && mustVisit.unvisitedMediaIds.has(candidate.mediaId as string)) {
          score += 5.0;
        } else if (mustHopId && (candidate.id as string) === (mustHopId as string)) {
          score += 4.0;
        }
      }

      // U-턴 소프트 패널티 — 방금 떠난 노드로 즉시 되돌아가는 후보에 -1.5.
      // exitHop/mustHop 이 그 방향을 지목하면 면제(실제 백트래킹이 정답인 경우).
      if (prevNodeId && (candidate.id as string) === prevNodeId) {
        const bfsEndorsed = (exitHopId && (candidate.id as string) === (exitHopId as string))
          || (mustHopId && (candidate.id as string) === (mustHopId as string));
        if (!bfsEndorsed) score -= 1.5;
      }

      scored.push({ node: candidate, score });
    }

    if (scored.length === 0) {
      // 모든 이웃이 방문됨 → EXIT 있으면 강제 진입
      if (canExit) {
        const exitNeighbor = neighbors.find(n => n.node.type === 'exit');
        if (exitNeighbor) return exitNeighbor.node;
      }
      // 방문된 이웃 중 랜덤 (역주행 허용 — 막다른 길 탈출)
      const pick = neighbors[Math.floor(rng.next() * neighbors.length)];
      return pick?.node ?? null;
    }

    // 가중 랜덤 선택: Score를 확률 가중치로 변환
    const positives = scored.filter(s => s.score > 0);
    if (positives.length === 0) {
      scored.sort((a, b) => b.score - a.score);
      return scored[0].node;
    }

    const totalScore = positives.reduce((s, e) => s + e.score, 0);
    let roll = rng.next() * totalScore;
    for (const entry of positives) {
      roll -= entry.score;
      if (roll <= 0) return entry.node;
    }
    return positives[positives.length - 1].node;
  }

  /**
   * 가중 랜덤으로 ENTRY 노드 선택
   */
  selectEntryNode(rng: SeededRandom): WaypointNode | null {
    if (this.entryNodes.length === 0) return null;
    const totalWeight = this.entryNodes.reduce((s, n) => s + n.spawnWeight, 0);
    if (totalWeight <= 0) return this.entryNodes[Math.floor(rng.next() * this.entryNodes.length)];

    let roll = rng.next() * totalWeight;
    for (const node of this.entryNodes) {
      roll -= node.spawnWeight;
      if (roll <= 0) return node;
    }
    return this.entryNodes[this.entryNodes.length - 1];
  }

  /**
   * Public: 현재 노드에서 EXIT 방향 첫 홉 반환.
   * Follower 가 리더를 잃었을 때처럼 "즉시 퇴장" 라우팅이 필요할 때 사용.
   *
   * @param spawnEntryId "들어온 길로 나간다" 휴리스틱용 — 해당 entry 에 짝지어진
   *   preferred exit 이 있으면 그 방향으로 BFS. 없으면 기존 "가장 가까운 exit".
   * @param exitTargetCounts preferred exit 이 과밀이면 fallback to nearest.
   */
  routeToExit(
    fromId: WaypointId,
    spawnEntryId?: WaypointId | null,
    exitTargetCounts?: ReadonlyMap<string, number>,
  ): WaypointNode | null {
    const preferredExitId = this.pickPreferredExitId(
      spawnEntryId as string | null | undefined,
      exitTargetCounts,
    );
    return this.findFirstHopToExit(fromId, preferredExitId);
  }

  // ── private ──

  /**
   * spawn entry 에 짝지어진 preferred exit id 를 선택한다.
   * 과밀이면 null 반환 — 호출측은 "가장 가까운 exit" fallback 으로 동작.
   *
   * 과밀 기준: preferred exit 타겟 수가 (전체 exit 평균 × 1.5) 초과 이고,
   * 절대값이 5 이상 (작은 시나리오에서 1→2 같은 과잉 반응 방지).
   */
  private pickPreferredExitId(
    spawnEntryId: string | null | undefined,
    exitTargetCounts?: ReadonlyMap<string, number>,
  ): string | undefined {
    if (!spawnEntryId) return undefined;
    const paired = this.entryToPreferredExit.get(spawnEntryId);
    if (!paired) return undefined;
    if (!exitTargetCounts || this.exitNodes.length <= 1) return paired;

    const pairedCount = exitTargetCounts.get(paired) ?? 0;
    if (pairedCount < 5) return paired; // 절대값 작으면 무조건 pairing 우선
    let total = 0;
    for (const exit of this.exitNodes) total += exitTargetCounts.get(exit.id as string) ?? 0;
    const avg = total / this.exitNodes.length;
    if (pairedCount > avg * 1.5) return undefined; // 과밀 — nearest fallback
    return paired;
  }

  private scoreNode(
    visitor: Visitor,
    candidate: WaypointNode,
    edge: WaypointEdge,
    currentNodeId: WaypointId,
    visitedNodeIds: Set<string>,
    crowdMap: ReadonlyMap<string, number>,
  ): number {
    // 방문 패널티 — 이미 방문한 노드는 점수 대폭 감소
    // HUB/ENTRY는 교차로이므로 면제
    // ZONE/ATTRACTOR/REST는 감점하되 차단(-9999)은 아님 → 퇴장 경로로 재방문 가능
    if (visitedNodeIds.has(candidate.id as string)) {
      if (candidate.type === 'hub' || candidate.type === 'entry' || candidate.type === 'bend') {
        // 면제: 패널티 없이 정상 Score 계산
      } else {
        return -2.0; // 강한 감점이지만 다른 경로가 없으면 선택 가능
      }
    }

    const currentNode = this.nodeMap.get(currentNodeId as string);
    if (!currentNode) return 0;

    // 1. Proximity (edge cost 기반)
    const dist = Math.max(1, edge.cost);
    const proximity = (1 / dist) * 300 * W_DISTANCE; // 300 = normalizer for px distances

    // 2. Interest match (visitor의 interestMap에 해당 zone이 있으면)
    const zoneInterest = candidate.zoneId
      ? (visitor.profile.interestMap[candidate.zoneId as string] ?? 0.5)
      : 0.5;
    const interest = zoneInterest * W_INTEREST;

    // 3. Attraction gate — 매력도를 곱셈 게이트로 적용.
    // 매력도 0 → 0.1 floor (완전 차단 방지), 1.0 → 1.0 (영향 없음).
    // 이게 없으면 proximity(≈4.5 for short edges)가 attraction(≤1.0)을 압도해
    // 사용자가 매력도를 0.01로 낮춰도 가장 가까운 존이 무조건 뽑힘.
    const attrMul = 0.1 + candidate.attraction * W_ATTRACTION * 0.9;

    // 4. Crowd density (노드 현재 인원 / capacity)
    const crowd = crowdMap.get(candidate.id as string) ?? 0;
    const density = candidate.capacity > 0
      ? (crowd / candidate.capacity) * W_CROWD
      : 0;

    // 5. Edge passWeight 보정
    const edgeBonus = edge.passWeight;

    return (proximity + interest) * attrMul - density + edgeBonus;
  }

  /**
   * BFS: 현재 노드에서 EXIT까지의 첫 홉 반환.
   * Portal shaft 노드들은 가상 엣지로 상호 연결되어 BFS가 층 경계를 넘어갈 수 있게 한다.
   *
   * @param preferredExitId 지정되면 해당 exit 만 목적지로 BFS. 매칭 exit 도달 실패 시
   *   "가장 가까운 exit" 으로 자동 fallback. 지정 안 되면 기존 동작 (아무 exit).
   */
  private findFirstHopToExit(
    fromId: WaypointId,
    preferredExitId?: string,
  ): WaypointNode | null {
    if (this.exitNodes.length === 0) return null;
    // preferred exit 매칭 우선 시도; 실패하면 전체 exit 집합으로 재시도.
    if (preferredExitId && this.nodeMap.has(preferredExitId)) {
      const hop = this.bfsFirstHopToExitSet(fromId, new Set([preferredExitId]));
      if (hop) return hop;
    }
    const exitIds = new Set(this.exitNodes.map(n => n.id as string));
    return this.bfsFirstHopToExitSet(fromId, exitIds);
  }

  private bfsFirstHopToExitSet(
    fromId: WaypointId,
    exitIds: ReadonlySet<string>,
  ): WaypointNode | null {
    if (exitIds.size === 0) return null;

    // Build shaft membership lookup (shaftId → member nodes) once per BFS call
    const shaftMembers = new Map<string, WaypointNode[]>();
    for (const node of this.nodeMap.values()) {
      if (node.type !== 'portal' || !node.shaftId) continue;
      const key = node.shaftId as string;
      const list = shaftMembers.get(key) ?? [];
      list.push(node);
      shaftMembers.set(key, list);
    }

    // "Virtual neighbors": 실제 edge + 같은 shaft의 다른 엘리베이터 노드들
    const virtualNeighbors = (id: WaypointId): WaypointNode[] => {
      const out: WaypointNode[] = this.getNeighbors(id).map(n => n.node);
      const node = this.nodeMap.get(id as string);
      if (node?.type === 'portal' && node.shaftId) {
        const members = shaftMembers.get(node.shaftId as string) ?? [];
        for (const m of members) {
          if ((m.id as string) !== (node.id as string)) out.push(m);
        }
      }
      return out;
    };

    const visited = new Set<string>();
    const queue: { nodeId: string; firstHop: WaypointNode }[] = [];

    // 시작: 실제 인접 노드만 firstHop 후보 (같은 shaft 가상 이웃은 물리적으로
    // 걸어갈 수 없는 다른 층이므로 firstHop 이 될 수 없음 — 샤프트 이동은
    // 에이전트가 포털 노드에 도착했을 때 assignNextTargetGraph 에서 별도 처리).
    for (const { node } of this.getNeighbors(fromId)) {
      if (exitIds.has(node.id as string)) return node; // 직접 연결된 EXIT
      queue.push({ nodeId: node.id as string, firstHop: node });
      visited.add(node.id as string);
    }
    visited.add(fromId as string);

    while (queue.length > 0) {
      const { nodeId, firstHop } = queue.shift()!;
      // 다음 층은 shaft 가상 엣지를 통해 탐색 가능 — 단 firstHop 은 고정.
      for (const neighbor of virtualNeighbors(nodeId as WaypointId)) {
        const nid = neighbor.id as string;
        if (visited.has(nid)) continue;
        if (exitIds.has(nid)) return firstHop; // EXIT 도달 — 첫 홉 반환
        visited.add(nid);
        queue.push({ nodeId: nid, firstHop });
      }
    }
    return null; // EXIT에 도달 불가
  }

  /**
   * BFS로 미방문 히어로(zone/media) 노드까지의 최단 경로 첫 홉을 찾는다.
   * 직접 neighbor가 hero가 아닌 다층 경로에서도 multi-hop 유도가 동작하도록 한다.
   */
  private findFirstHopToMustVisit(
    fromId: WaypointId,
    mustVisit: { unvisitedZoneIds: ReadonlySet<string>; unvisitedMediaIds: ReadonlySet<string> },
  ): WaypointNode | null {
    const isMust = (n: WaypointNode): boolean =>
      (!!n.zoneId && mustVisit.unvisitedZoneIds.has(n.zoneId as string))
      || (!!n.mediaId && mustVisit.unvisitedMediaIds.has(n.mediaId as string));

    const shaftMembers = new Map<string, WaypointNode[]>();
    for (const node of this.nodeMap.values()) {
      if (node.type !== 'portal' || !node.shaftId) continue;
      const key = node.shaftId as string;
      const list = shaftMembers.get(key) ?? [];
      list.push(node);
      shaftMembers.set(key, list);
    }
    const virtualNeighbors = (id: WaypointId): WaypointNode[] => {
      const out: WaypointNode[] = this.getNeighbors(id).map(n => n.node);
      const node = this.nodeMap.get(id as string);
      if (node?.type === 'portal' && node.shaftId) {
        const members = shaftMembers.get(node.shaftId as string) ?? [];
        for (const m of members) {
          if ((m.id as string) !== (node.id as string)) out.push(m);
        }
      }
      return out;
    };

    const visited = new Set<string>();
    const queue: { nodeId: string; firstHop: WaypointNode }[] = [];
    // 시작: 실제 인접 노드만 firstHop 후보 (샤프트 가상 이웃은 물리적
    // 걸음이 아니라 샤프트 탑승이므로 firstHop 이 될 수 없음).
    for (const { node } of this.getNeighbors(fromId)) {
      if (isMust(node)) return node;
      queue.push({ nodeId: node.id as string, firstHop: node });
      visited.add(node.id as string);
    }
    visited.add(fromId as string);

    while (queue.length > 0) {
      const { nodeId, firstHop } = queue.shift()!;
      for (const neighbor of virtualNeighbors(nodeId as WaypointId)) {
        const nid = neighbor.id as string;
        if (visited.has(nid)) continue;
        if (isMust(neighbor)) return firstHop;
        visited.add(nid);
        queue.push({ nodeId: nid, firstHop });
      }
    }
    return null;
  }

  private countVisitedEssential(pathLog: readonly PathLogEntry[]): number {
    const visited = new Set<string>();
    const visitedShafts = new Set<string>();
    for (const entry of pathLog) {
      const node = this.nodeMap.get(entry.nodeId as string);
      if (!node) continue;
      if (node.type === 'zone' || node.type === 'attractor') {
        visited.add(entry.nodeId as string);
      } else if (node.type === 'portal' && node.shaftId) {
        visitedShafts.add(node.shaftId as string);
      }
    }
    return visited.size + visitedShafts.size;
  }
}
