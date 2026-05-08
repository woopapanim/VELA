import { lazy, Suspense, useState } from 'react';
import { ThemeProvider } from '@/ui/components/ThemeProvider';
import { ToastProvider } from '@/ui/components/Toast';
import { CompletionModal } from '@/ui/components/CompletionModal';
import { WelcomeScreen } from '@/ui/layouts/WelcomeScreen';
import { useStore } from '@/stores';

// Layout-level code splitting: each major mode (Build / Simulate / Analyze)
// loads as its own chunk on first navigation, so the initial bundle only
// carries the welcome screen + shell + store. Chart.js + jsPDF + analytics
// breakdown code stay out of the initial download path.
//
// `import().then(m => ({ default: m.X }))` adapts named exports to the
// default-export contract React.lazy expects without forcing every consumer
// to switch to default exports.
const BuildLayout = lazy(() =>
  import('@/ui/layouts/BuildLayout').then((m) => ({ default: m.BuildLayout })),
);
const SimulateLayout = lazy(() =>
  import('@/ui/layouts/SimulateLayout').then((m) => ({ default: m.SimulateLayout })),
);
const AnalyzeLayout = lazy(() =>
  import('@/ui/layouts/AnalyzeLayout').then((m) => ({ default: m.AnalyzeLayout })),
);

// Minimal fallback while the next layout chunk fetches. Chunks are usually
// well under 100ms on local dev / fast networks; the placeholder is just to
// avoid a flash of nothing on first navigation.
function LayoutFallback() {
  return (
    <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

type AppPhase = 'welcome' | 'build' | 'simulate' | 'analyze';

function App() {
  const [phase, setPhase] = useState<AppPhase>('welcome');
  const hasRunResult = useStore((s) => s.kpiHistory.length > 0);

  return (
    <ThemeProvider>
      <ToastProvider>
        {phase === 'welcome' && <WelcomeScreen onEnter={() => setPhase('build')} />}
        {phase === 'build' && (
          <Suspense fallback={<LayoutFallback />}>
            <BuildLayout
              onRun={() => setPhase('simulate')}
              onAnalyze={hasRunResult ? () => setPhase('analyze') : undefined}
            />
          </Suspense>
        )}
        {phase === 'simulate' && (
          <Suspense fallback={<LayoutFallback />}>
            <SimulateLayout
              onBackToBuild={() => setPhase('build')}
              onAnalyze={() => setPhase('analyze')}
            />
            <CompletionModal onAnalyze={() => setPhase('analyze')} />
          </Suspense>
        )}
        {phase === 'analyze' && (
          <Suspense fallback={<LayoutFallback />}>
            <AnalyzeLayout
              onBackToSimulate={() => setPhase('simulate')}
              onBackToBuild={() => setPhase('build')}
            />
          </Suspense>
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
