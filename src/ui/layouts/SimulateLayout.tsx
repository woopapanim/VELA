import { useState } from 'react';
import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { StatsFooter } from '../components/StatsFooter';
import { CockpitTopBar } from './simulate/CockpitTopBar';
import { KpiStrip } from './simulate/KpiStrip';
import { CockpitDock } from './simulate/CockpitDock';
import { InsightsDrawer } from './simulate/InsightsDrawer';
import { ScrubberBar } from './simulate/ScrubberBar';

interface Props {
  /** Simulate 단계에서 Build 로 돌아갈 때 호출. 시뮬 실행/일시정지 중에도 사용 가능 — 단순 라우팅만. */
  onBackToBuild: () => void;
}

// Simulate 단계 — heads-up cockpit. 좌/우 영구 column 폐기. 캔버스 full-bleed.
// KPI strip (top-center) + control dock (bottom-left) + Insights drawer (right, toggle)
// + replay scrubber (bottom-center, completed 후) 모두 floating overlay.
// 사용자 피드백 (2026-04-29): "좌/우 패널 정해놓고 그것밖에 못쓰는거야? 시멘틱 개념 알아?"
//   → Build 와 구조적으로 다른 IA. Simulate 는 모니터링 cockpit 패턴.
export function SimulateLayout({ onBackToBuild }: Props) {
  const [insightsOpen, setInsightsOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <CockpitTopBar
        onBackToBuild={onBackToBuild}
        insightsOpen={insightsOpen}
        onToggleInsights={() => setInsightsOpen((o) => !o)}
      />
      <div className="flex-1 relative bg-background overflow-hidden">
        <CanvasPanel />
        <KpiStrip />
        <CockpitDock />
        <ScrubberBar />
        <InsightsDrawer open={insightsOpen} onClose={() => setInsightsOpen(false)} />
      </div>
      <StatsFooter />
    </div>
  );
}
