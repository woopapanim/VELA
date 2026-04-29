import { useEffect, useState } from 'react';
import { Trophy, X, BarChart3 } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';

interface Props {
  onAnalyze?: () => void;
}

export function CompletionModal({ onAnalyze }: Props) {
  const t = useT();
  const phase = useStore((s) => s.phase);
  const timeState = useStore((s) => s.timeState);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (phase === 'completed' && !dismissed) {
      setShow(true);
    }
    if (phase === 'idle') {
      setDismissed(false);
      setShow(false);
    }
  }, [phase, dismissed]);

  if (!show) return null;

  const mins = Math.floor(timeState.elapsed / 60000);

  const dismiss = () => { setShow(false); setDismissed(true); };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass rounded-2xl border border-border shadow-2xl w-96 overflow-hidden">
        <div className="bg-primary/10 p-6 text-center relative">
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 p-1 rounded hover:bg-secondary"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{t('completionModal.title')}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t('completionModal.duration', { mins })}</p>
        </div>
        {onAnalyze && (
          <div className="p-4">
            <button
              onClick={() => { dismiss(); onAnalyze(); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <BarChart3 className="w-4 h-4" />
              {t('analyze.viewFromCompletion')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
