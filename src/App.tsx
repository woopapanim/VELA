import { useState } from 'react';
import { ThemeProvider } from '@/ui/components/ThemeProvider';
import { ToastProvider } from '@/ui/components/Toast';
import { CompletionModal } from '@/ui/components/CompletionModal';
import { BuildLayout } from '@/ui/layouts/BuildLayout';
import { SimulateLayout } from '@/ui/layouts/SimulateLayout';
import { AnalyzeLayout } from '@/ui/layouts/AnalyzeLayout';
import { WelcomeScreen } from '@/ui/layouts/WelcomeScreen';

type AppPhase = 'welcome' | 'build' | 'simulate' | 'analyze';

function App() {
  const [phase, setPhase] = useState<AppPhase>('welcome');

  return (
    <ThemeProvider>
      <ToastProvider>
        {phase === 'welcome' && <WelcomeScreen onEnter={() => setPhase('build')} />}
        {phase === 'build' && <BuildLayout onRun={() => setPhase('simulate')} />}
        {phase === 'simulate' && (
          <>
            <SimulateLayout
              onBackToBuild={() => setPhase('build')}
              onAnalyze={() => setPhase('analyze')}
            />
            <CompletionModal onAnalyze={() => setPhase('analyze')} />
          </>
        )}
        {phase === 'analyze' && (
          <AnalyzeLayout
            onBackToSimulate={() => setPhase('simulate')}
            onBackToBuild={() => setPhase('build')}
          />
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
