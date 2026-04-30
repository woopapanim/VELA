import type { Scenario } from '@/domain';

// djb2 → 8 hex. 시나리오의 비교 가능한 내용 (zones/media/visitorDistribution/simulationConfig/waypointGraph/floors/shafts/flow)
// 만 직렬화해서 해시. meta(name/timestamp/version) 와 pins 는 비교 무관하므로 제외.
//
// 같은 hash → 같은 baseline run 묶음. dirty 상태에서 돌리면 hash 가 달라져서
// 저장된 run 묶음과 섞이지 않는다 (사용자에게 "이 run 은 저장 전 변경분입니다" 라는 신호).
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function computeScenarioContentHash(scenario: Scenario): string {
  const payload = {
    floors: scenario.floors,
    zones: scenario.zones,
    media: scenario.media,
    distribution: scenario.visitorDistribution,
    config: scenario.simulationConfig,
    flow: scenario.globalFlowMode ?? 'free',
    guided: scenario.guidedUntilIndex ?? 0,
    graph: scenario.waypointGraph
      ? { nodes: scenario.waypointGraph.nodes, edges: scenario.waypointGraph.edges }
      : null,
    shafts: scenario.shafts ?? [],
  };
  return djb2(JSON.stringify(payload));
}
