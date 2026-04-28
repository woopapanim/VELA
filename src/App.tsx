import { useState, useEffect, useRef, useMemo } from 'react';
import { ThemeProvider } from '@/ui/components/ThemeProvider';
import { ToastProvider, useToast } from '@/ui/components/Toast';
import { GlobalReportModal } from '@/ui/components/GlobalReportModal';
import { GlobalHeader } from '@/ui/layouts/GlobalHeader';
import { MainLayout } from '@/ui/layouts/MainLayout';
import { BuildLayout } from '@/ui/layouts/BuildLayout';
import { AnalyzeLayout } from '@/ui/layouts/AnalyzeLayout';
import { WelcomeScreen } from '@/ui/layouts/WelcomeScreen';
import { ModeSelectionScreen } from '@/ui/layouts/ModeSelectionScreen';
import type { WorkflowStepStatus } from '@/ui/layouts/WorkflowStepIndicator';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { scenarioManager } from '@/scenario';

type Step = 'welcome' | 'mode' | 'build' | 'ready' | 'analyze';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ThemeProvider>
  );
}

function AppShell() {
  const t = useT();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('welcome');
  const phase = useStore((s) => s.phase);
  // 아래 4개 — stepper reachability 계산용. 변경 시 stepper 가 리렌더되어야 잠금이 풀림.
  const scenario = useStore((s) => s.scenario);
  const zoneCount = useStore((s) => s.zones.length);
  const mediaCount = useStore((s) => s.media.length);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const lastAutoTransitRef = useRef<string | null>(null);

  // 시뮬 완료 시 자동으로 Analyze 단계로 이동 + 토스트.
  // runId 단위로 한 번만 트리거 — 사용자가 stepper 로 ready 로 돌아가도 재실행 X.
  useEffect(() => {
    if (step !== 'ready' || phase !== 'completed') return;
    const runId = useStore.getState().runId;
    if (!runId || lastAutoTransitRef.current === runId) return;
    lastAutoTransitRef.current = runId;
    toast('success', t('toast.simCompleted'));
    setStep('analyze');
  }, [step, phase, toast, t]);

  // Open/Recent 흐름에서 legacy 시나리오(experienceMode 미설정)는 모드 선택 강제.
  // experienceMode 있으면 zone 유무로 build / ready 결정.
  const handleLoaded = () => {
    const scenario = useStore.getState().scenario;
    if (scenario && !scenario.experienceMode) {
      setStep('mode');
    } else {
      setStep('build');
    }
  };

  // 검증 tier Action 탭 CTA: 현재 시나리오를 변형으로 fork → Build 단계 이동.
  const handleForkToBuild = () => {
    const cur = useStore.getState().scenario;
    if (!cur) return;
    scenarioManager.save(cur, useStore.getState().kpiHistory);
    const branched = scenarioManager.branch(cur.meta.id, `${cur.meta.name} (Variant)`);
    if (branched) {
      useStore.getState().setScenario(branched);
      setStep('build');
    }
  };

  const workflowStep =
    step === 'mode' ? 1 :
    step === 'build' ? 2 :
    step === 'ready' ? 3 :
    step === 'analyze' ? 4 : undefined;

  // 단일 navigation 규칙: stepper 칸 누르면 거기로 간다.
  // 잠긴 단계는 stepper 가 disabled + tooltip 으로 차단 → 여기는 가드 없이 단순 라우팅.
  const handleNavigateStep = (n: number) => {
    if (n === 1) setStep('mode');
    else if (n === 2) setStep('build');
    else if (n === 3) setStep('ready');
    else if (n === 4) setStep('analyze');
  };

  // 각 step 의 reachable + lockReason 계산.
  //   1 Setup    : 모드 잡히기 전까지만 도달 가능. 모드 잡힌 후엔 잠금 — 모드 변경은
  //                새 프로젝트 또는 변형 fork 로만. 이미 만든 빌드/시뮬 결과를 모드
  //                변경으로 침묵 무효화하는 사고 방지 (2026-04-28 사용자 결정).
  //   2 Build    : experienceMode 가 정해진 시나리오가 있어야 함.
  //   3 Simulate : zone ≥1 + media ≥1.
  //   4 Analyze  : 시뮬 완료 결과(latestSnapshot) 가 있어야 함.
  const stepStatus = useMemo<ReadonlyArray<WorkflowStepStatus>>(() => {
    const hasMode = !!scenario?.experienceMode;
    const hasBuild = zoneCount > 0 && mediaCount > 0;
    const hasResult = !!latestSnapshot;
    return [
      { reachable: !hasMode, lockReason: hasMode ? t('step.lock.setup') : undefined },
      { reachable: hasMode, lockReason: hasMode ? undefined : t('step.lock.build') },
      { reachable: hasBuild, lockReason: hasBuild ? undefined : t('step.lock.simulate') },
      { reachable: hasResult, lockReason: hasResult ? undefined : t('step.lock.analyze') },
    ];
  }, [scenario, zoneCount, mediaCount, latestSnapshot, t]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {step !== 'welcome' && (
        <GlobalHeader
          workflowStep={workflowStep}
          onNavigateStep={handleNavigateStep}
          stepStatus={stepStatus}
        />
      )}
      {step === 'analyze' && (
        <>
          <AnalyzeLayout onForkToBuild={handleForkToBuild} />
          <GlobalReportModal />
        </>
      )}
      {step === 'ready' && (
        <>
          <MainLayout />
          <GlobalReportModal />
        </>
      )}
      {step === 'build' && (
        <BuildLayout />
      )}
      {step === 'mode' && (
        <ModeSelectionScreen
          onPicked={() => setStep('build')}
          onBack={() => setStep('welcome')}
        />
      )}
      {step === 'welcome' && (
        <WelcomeScreen
          onNewProjectCreated={() => setStep('mode')}
          onLoaded={handleLoaded}
        />
      )}
    </div>
  );
}

export default App;
