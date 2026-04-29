import { useEffect } from 'react';
import { useStore } from '@/stores';
import { CanvasPanel } from '../panels/canvas/CanvasPanel';
import { StatsFooter } from '../components/StatsFooter';
import { CockpitTopBar } from './simulate/CockpitTopBar';
import { RunConfigColumn } from './simulate/RunConfigColumn';
import { MonitoringPanel } from './simulate/MonitoringPanel';
import { ControlBar } from './simulate/ControlBar';

interface Props {
  onBackToBuild: () => void;
  onAnalyze?: () => void;
}

// Simulate phase — 3-column + bottom-bar (2026-04-29 재구조화).
// Floating overlay 폐기 — Build 와 동일한 paneled IA 로 통일.
//
// 좌측 (RunConfigColumn):
//   - idle: SpawnConfig + SkipThreshold 편집 가능
//   - running/paused/completed: readonly summary ("어떤 설정으로 돌고 있나")
//
// 중앙 (CanvasPanel):
//   - 시나리오 미리보기 (idle) → 라이브 시뮬 (running)
//
// 우측 (MonitoringPanel):
//   - Overview (active / progress / spawn / exit / throughput)
//   - Live Insights (bottleneck / capacity / skip / 조기이탈 / 입출구 편중)
//   - Per-zone cards (color-coded, capacity fill, dwell)
//
// 하단 (ControlBar):
//   - Start/Pause/Stop · Timeline progress + 마커 · Speed · Heatmap/Pin
//   - 완료 후에는 ReplayScrubber 로 자동 전환
export function SimulateLayout({ onBackToBuild, onAnalyze }: Props) {
  // Unmount 시 sim run 정리. ControlBar 의 cleanup 이 먼저 실행되어 loop 가
  // destroy 된 뒤 우리가 phase 를 idle 로 set — race 없이 안전하게 종료.
  // 단, phase === 'completed' (이미 loop 종료) 이면 결과 데이터를 보존해야
  // Analyze 화면에서 활용 가능 — 이 경우 reset 생략.
  useEffect(() => {
    return () => {
      const s = useStore.getState();
      if (s.phase === 'running' || s.phase === 'paused') {
        s.resetSim();
        s.clearHistory?.();
        s.clearReplay?.();
        s.clearPins?.();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <CockpitTopBar onBackToBuild={onBackToBuild} onAnalyze={onAnalyze} />
      <div className="flex-1 flex overflow-hidden">
        <RunConfigColumn />
        <div className="flex-1 relative bg-background overflow-hidden">
          <CanvasPanel />
        </div>
        <MonitoringPanel />
      </div>
      <ControlBar />
      <StatsFooter />
    </div>
  );
}
