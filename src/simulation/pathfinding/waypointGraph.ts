/**
 * WaypointNavigator — Graph-Point 기반 동선 엔진
 *
 * 노드(ENTRY/EXIT/ZONE/ATTRACTOR/REST) + 에지(directed/bidirectional)로 구성된
 * 그래프 위에서 Score 기반 의사결정으로 다음 목표 노드를 선택한다.
 *
 * Score(Node) = (attraction × w1) + (1/distance × w2) + (interestMatch × w3)
 *             - (crowdDensity × w4) - (visitedPenalty × w5)
 */

import type { WaypointNode, WaypointEdge, WaypointGraph, WaypointId, PathLogEntry } from '@/domain';
import type { Visitor } from '@/domain';
import type { SeededRandom } from '../utils/random';

// Score weights (tunable)
const W_ATTRACTION = 1.0;
const W_DISTANCE = 0.3;
const W_INTEREST = 0.5;
const W_CROWD = 0.4;
const W_VISITED = 9999;

// EXIT 노드 진입 조건
const EXIT_VISIT_RATIO = 0.8;    // 필수 노드의 80% 방문 시
const EXIT_FATIGUE_THRESHOLD = 0.9;

export class WaypointNavigator {
  private adjacency = new Map<string, { node: WaypointNode; edge: WaypointEdge }[]>();
  private nodeMap = new Map<string, WaypointNode>();
  private entryNodes: WaypointNode[] = [];
  private exitNodes: WaypointNode[] = [];
  private essentialCount = 0; // ZONE + ATTRACTOR 노드 수

  buildFromGraph(graph: WaypointGraph): void {
    this.adjacency.clear();
    this.nodeMap.clear();
    this.entryNodes = [];
    this.exitNodes = [];
    this.essentialCount = 0;

    for (const node of graph.nodes) {
      this.nodeMap.set(node.id as string, node);
      this.adjacency.set(node.id as string, []);
      if (node.type === 'entry') this.entryNodes.push(node);
      if (node.type === 'exit') this.exitNodes.push(node);
      if (node.type === 'zone' || node.type === 'attractor') this.essentialCount++;
    }

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
  ): WaypointNode | null {
    const neighbors = this.getNeighbors(currentNodeId);
    if (neighbors.length === 0) return null;

    const visitedNodeIds = new Set(visitor.pathLog.map(e => e.nodeId as string));
    const visitedCount = this.countVisitedEssential(visitor.pathLog);

    // EXIT 진입 조건 체크
    const canExit = visitedCount / Math.max(1, this.essentialCount) >= EXIT_VISIT_RATIO
      || visitor.fatigue >= EXIT_FATIGUE_THRESHOLD;

    // canExit + 모든 필수 노드 방문 완료 → EXIT 방향 강제 유도
    const allEssentialDone = visitedCount >= this.essentialCount;
    if (canExit && allEssentialDone) {
      const exitFirstHop = this.findFirstHopToExit(currentNodeId);
      if (exitFirstHop) return exitFirstHop;
    }

    const scored: { node: WaypointNode; score: number }[] = [];

    // canExit 상태에서 EXIT 방향 이웃에 보너스 (BFS 기반)
    const exitHopId = canExit ? this.findFirstHopToExit(currentNodeId)?.id : null;

    for (const { node: candidate, edge } of neighbors) {
      // EXIT 노드: 조건 미충족 시 후보에서 제외
      if (candidate.type === 'exit' && !canExit) continue;

      let score = this.scoreNode(visitor, candidate, edge, currentNodeId, visitedNodeIds, crowdMap);

      // EXIT 방향 보너스: canExit 상태에서 EXIT까지의 경로 첫 홉에 +3
      if (exitHopId && (candidate.id as string) === (exitHopId as string)) {
        score += 3.0;
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

  // ── private ──

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
      if (candidate.type === 'hub' || candidate.type === 'entry') {
        // 면제: 패널티 없이 정상 Score 계산
      } else {
        return -2.0; // 강한 감점이지만 다른 경로가 없으면 선택 가능
      }
    }

    const currentNode = this.nodeMap.get(currentNodeId as string);
    if (!currentNode) return 0;

    // 1. Attraction
    const attraction = candidate.attraction * W_ATTRACTION;

    // 2. Inverse distance (edge cost 사용)
    const dist = Math.max(1, edge.cost);
    const proximity = (1 / dist) * 300 * W_DISTANCE; // 300 = normalizer for px distances

    // 3. Interest match (visitor의 interestMap에 해당 zone이 있으면)
    const zoneInterest = candidate.zoneId
      ? (visitor.profile.interestMap[candidate.zoneId as string] ?? 0.5)
      : 0.5;
    const interest = zoneInterest * W_INTEREST;

    // 4. Crowd density (노드 현재 인원 / capacity)
    const crowd = crowdMap.get(candidate.id as string) ?? 0;
    const density = candidate.capacity > 0
      ? (crowd / candidate.capacity) * W_CROWD
      : 0;

    // 5. Edge passWeight 보정
    const edgeBonus = edge.passWeight;

    return attraction + proximity + interest - density + edgeBonus;
  }

  /**
   * BFS: 현재 노드에서 가장 가까운 EXIT까지의 첫 홉 반환
   */
  private findFirstHopToExit(fromId: WaypointId): WaypointNode | null {
    if (this.exitNodes.length === 0) return null;
    const exitIds = new Set(this.exitNodes.map(n => n.id as string));

    // BFS
    const visited = new Set<string>();
    const queue: { nodeId: string; firstHop: WaypointNode }[] = [];

    // 시작: 이웃 노드들을 firstHop으로 등록
    for (const { node } of this.getNeighbors(fromId)) {
      if (exitIds.has(node.id as string)) return node; // 직접 연결된 EXIT
      queue.push({ nodeId: node.id as string, firstHop: node });
      visited.add(node.id as string);
    }
    visited.add(fromId as string);

    while (queue.length > 0) {
      const { nodeId, firstHop } = queue.shift()!;
      for (const { node: neighbor } of this.getNeighbors(nodeId as WaypointId)) {
        const nid = neighbor.id as string;
        if (visited.has(nid)) continue;
        if (exitIds.has(nid)) return firstHop; // EXIT 도달 — 첫 홉 반환
        visited.add(nid);
        queue.push({ nodeId: nid, firstHop });
      }
    }
    return null; // EXIT에 도달 불가
  }

  private countVisitedEssential(pathLog: readonly PathLogEntry[]): number {
    const visited = new Set<string>();
    for (const entry of pathLog) {
      const node = this.nodeMap.get(entry.nodeId as string);
      if (node && (node.type === 'zone' || node.type === 'attractor')) {
        visited.add(entry.nodeId as string);
      }
    }
    return visited.size;
  }
}
