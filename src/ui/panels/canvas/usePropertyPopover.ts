import { useState } from 'react';

export interface PopoverState {
  visible: boolean;
  x: number;
  y: number;
  targetType: 'node' | 'edge' | 'media' | 'zone' | null;
  targetId: string | null;
}

// Lives outside PropertyPopover.tsx so React Fast Refresh can hot-reload the
// PropertyPopover / MediaPickerInline components without invalidating the hook.
export function usePropertyPopover() {
  const [state, setState] = useState<PopoverState>({ visible: false, x: 0, y: 0, targetType: null, targetId: null });

  const show = (x: number, y: number, targetType: PopoverState['targetType'], targetId: string) => {
    setState({ visible: true, x, y, targetType, targetId });
  };

  const hide = () => setState(s => ({ ...s, visible: false }));

  return { popover: state, showPopover: show, hidePopover: hide };
}
