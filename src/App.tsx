import { useState } from 'react';
import { ThemeProvider } from '@/ui/components/ThemeProvider';
import { ToastProvider } from '@/ui/components/Toast';
import { CompletionModal } from '@/ui/components/CompletionModal';
import { GlobalReportModal } from '@/ui/components/GlobalReportModal';
import { GlobalHeader } from '@/ui/layouts/GlobalHeader';
import { MainLayout } from '@/ui/layouts/MainLayout';
import { WelcomeScreen } from '@/ui/layouts/WelcomeScreen';
import { ModeSelectionScreen } from '@/ui/layouts/ModeSelectionScreen';
import { useStore } from '@/stores';

type Step = 'welcome' | 'mode' | 'ready';

function App() {
  const [step, setStep] = useState<Step>('welcome');

  // Open/Recent 흐름에서 legacy 시나리오(experienceMode 미설정)는 모드 선택 강제.
  const handleLoaded = () => {
    const scenario = useStore.getState().scenario;
    if (scenario && !scenario.experienceMode) setStep('mode');
    else setStep('ready');
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <GlobalHeader />
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
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
