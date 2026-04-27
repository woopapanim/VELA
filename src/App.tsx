import { useState } from 'react';
import { ThemeProvider } from '@/ui/components/ThemeProvider';
import { ToastProvider } from '@/ui/components/Toast';
import { CompletionModal } from '@/ui/components/CompletionModal';
import { GlobalReportModal } from '@/ui/components/GlobalReportModal';
import { MainLayout } from '@/ui/layouts/MainLayout';
import { WelcomeScreen } from '@/ui/layouts/WelcomeScreen';
import { ModeSelectionScreen } from '@/ui/layouts/ModeSelectionScreen';

type Step = 'welcome' | 'mode' | 'ready';

function App() {
  const [step, setStep] = useState<Step>('welcome');

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
            onLoaded={() => setStep('ready')}
          />
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
