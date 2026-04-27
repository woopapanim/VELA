import { useState } from 'react';
import { ThemeProvider } from '@/ui/components/ThemeProvider';
import { ToastProvider } from '@/ui/components/Toast';
import { CompletionModal } from '@/ui/components/CompletionModal';
import { GlobalReportModal } from '@/ui/components/GlobalReportModal';
import { MainLayout } from '@/ui/layouts/MainLayout';
import { WelcomeScreen } from '@/ui/layouts/WelcomeScreen';
import { ModeSelectionScreen } from '@/ui/layouts/ModeSelectionScreen';
import { useStore } from '@/stores';

type Step = 'welcome' | 'mode' | 'ready';

function App() {
  const [step, setStep] = useState<Step>('welcome');

  // Open/Recent 흐름에서 legacy 시나리오(experienceMode 미설정)는 모드 선택 강제.
  // Phase 1 UX 정착 (2026-04-28 IA 재구성) — 모드가 IA 의 spine 이므로
  // 빈 시나리오는 즉시 분석 화면 진입 금지.
  const handleLoaded = () => {
    const scenario = useStore.getState().scenario;
    if (scenario && !scenario.experienceMode) setStep('mode');
    else setStep('ready');
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        {step === 'ready' && (
          <>
            <MainLayout />
            <CompletionModal />
            <GlobalReportModal />
          </>
        )}
        {step === 'mode' && (
          <ModeSelectionScreen
            onPicked={() => setStep('ready')}
            onBack={() => setStep('welcome')}
          />
        )}
        {step === 'welcome' && (
          <WelcomeScreen
            onNewProjectCreated={() => setStep('mode')}
            onLoaded={handleLoaded}
          />
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
