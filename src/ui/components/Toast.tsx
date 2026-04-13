import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let _toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const config = {
    info: { icon: Info, bg: 'bg-[var(--status-info)]/10', border: 'border-[var(--status-info)]/30', text: 'text-[var(--status-info)]' },
    success: { icon: CheckCircle, bg: 'bg-[var(--status-success)]/10', border: 'border-[var(--status-success)]/30', text: 'text-[var(--status-success)]' },
    warning: { icon: AlertTriangle, bg: 'bg-[var(--status-warning)]/10', border: 'border-[var(--status-warning)]/30', text: 'text-[var(--status-warning)]' },
    error: { icon: AlertTriangle, bg: 'bg-[var(--status-danger)]/10', border: 'border-[var(--status-danger)]/30', text: 'text-[var(--status-danger)]' },
  }[toast.type];

  const Icon = config.icon;

  return (
    <div className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-xl ${config.bg} border ${config.border} shadow-lg backdrop-blur-md animate-in slide-in-from-right-5 min-w-64`}>
      <Icon className={`w-4 h-4 ${config.text} shrink-0`} />
      <span className="text-xs flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="p-0.5 rounded hover:bg-secondary/50 shrink-0">
        <X className="w-3 h-3 text-muted-foreground" />
      </button>
    </div>
  );
}
