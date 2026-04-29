import { useStore } from '@/stores';
import { SpawnConfig } from '@/ui/panels/build/SpawnConfig';
import { SkipThresholdConfig } from './SkipThresholdConfig';

// Simulate / 좌측 column. "어떻게 돌릴까" — 실행 파라미터 전부.
// Spawn rate / Total / Duration / Time slots / Seed / Skip threshold.
// idle: 편집 가능. running/paused/completed: SpawnConfig 내부에서 isLocked 처리.
// 의도 (profile / engagement / category mix) 는 Build / Visitors 에서.
export function RunConfigPanel() {
  const scenario = useStore((s) => s.scenario);

  if (!scenario) {
    return (
      <div className="p-3 text-[10px] text-muted-foreground">
        시나리오를 먼저 선택하세요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SpawnConfig />
      <SkipThresholdConfig />
    </div>
  );
}
