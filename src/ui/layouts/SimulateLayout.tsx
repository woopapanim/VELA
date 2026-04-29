import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { StatsFooter } from '../components/StatsFooter';
import { CockpitTopBar } from './simulate/CockpitTopBar';
import { StatusCard } from './simulate/StatusCard';
import { ThroughputGauge } from './simulate/ThroughputGauge';
import { CockpitDock } from './simulate/CockpitDock';
import { LiveEventFeed } from './simulate/LiveEventFeed';
import { Timeline } from './simulate/Timeline';

interface Props {
  onBackToBuild: () => void;
}

// Simulate 단계 — monitoring cockpit. 영구 column 폐기. 캔버스 full-bleed.
// 정보 분류 (2026-04-29 피드백 반영):
//   1) 라이브 신호 (병목 발생/해소, 마일스톤) → 우측 narrow LiveEventFeed 220px
//   2) 단일 verdict ("정상 / 1 bottleneck") → 좌상단 StatusCard
//   3) 단일 핵심 지표 (throughput) → 우상단 ThroughputGauge
//   4) 분석/탐색 데이터 (trend/distribution/sensitivity/report) → Analyze phase 로 이전
// Drawer 통째로 dump 패턴 폐기 — "정해진 chrome 에 다 때려넣지 말 것".
export function SimulateLayout({ onBackToBuild }: Props) {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <CockpitTopBar onBackToBuild={onBackToBuild} />
      <div className="flex-1 relative bg-background overflow-hidden">
        <CanvasPanel />
        <StatusCard />
        <ThroughputGauge />
        <LiveEventFeed />
        <CockpitDock />
        <Timeline />
      </div>
      <StatsFooter />
    </div>
  );
}
