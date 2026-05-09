import { createContext, useContext } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastContextValue {
  toast: (type: ToastType, message: string, duration?: number) => void;
}

// Lives outside Toast.tsx so React Fast Refresh can hot-reload the
// ToastProvider/ToastItem components without invalidating the context.
export const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
