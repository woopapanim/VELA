import { useState } from 'react';
import { ThemeProvider } from '@/ui/components/ThemeProvider';
import { ToastProvider } from '@/ui/components/Toast';
import { CompletionModal } from '@/ui/components/CompletionModal';
import { MainLayout } from '@/ui/layouts/MainLayout';
import { WelcomeScreen } from '@/ui/layouts/WelcomeScreen';

function App() {
  const [projectReady, setProjectReady] = useState(false);

  return (
    <ThemeProvider>
      <ToastProvider>
        {projectReady ? (
          <>
            <MainLayout />
            <CompletionModal />
          </>
        ) : (
          <WelcomeScreen onEnter={() => setProjectReady(true)} />
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
