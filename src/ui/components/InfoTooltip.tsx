import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  className?: string;
}

export function InfoTooltip({ text, className = '' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [arrowLeft, setArrowLeft] = useState(12);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  // Position tooltip using fixed positioning based on icon's screen position
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const icon = ref.current.getBoundingClientRect();
    const ttWidth = 224; // w-56 = 14rem = 224px
    const pad = 8;
    const vw = window.innerWidth;

    // Default: left-aligned with icon
    let left = icon.left;

    // If overflows right, shift left
    if (left + ttWidth > vw - pad) {
      left = vw - pad - ttWidth;
    }
    // If overflows left, shift right
    if (left < pad) {
      left = pad;
    }

    // Arrow points to the icon center
    const iconCenter = icon.left + icon.width / 2;
    setArrowLeft(Math.max(8, Math.min(ttWidth - 8, iconCenter - left)));

    setStyle({
      position: 'fixed',
      left,
      top: icon.top - 6, // mb-1.5 equivalent
      transform: 'translateY(-100%)',
      zIndex: 9999,
    });
  }, [open]);

  return (
    <div className={`relative inline-flex ${className}`} ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <Info className="w-3 h-3" />
      </button>
      {open && (
        <div
          ref={tooltipRef}
          className="w-56 px-3 py-2 rounded-lg bg-popover border border-border shadow-lg text-[10px] text-muted-foreground leading-relaxed whitespace-pre-line"
          style={style}
        >
          {text}
          <div
            className="absolute top-full -mt-px border-4 border-transparent border-t-border"
            style={{ left: arrowLeft }}
          />
        </div>
      )}
    </div>
  );
}
