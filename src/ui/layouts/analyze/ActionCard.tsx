import { ChevronRight } from 'lucide-react';
import type { ZoneId, MediaId } from '@/domain';

export interface CockpitAction {
  id: string;
  level: 'critical' | 'warning';
  title: string;
  detail: string;
  zoneId?: ZoneId;
  mediaId?: MediaId;
}

interface Props {
  action: CockpitAction;
  ctaLabel: string;
  onClick: () => void;
}

// severity 는 좌측 dot 하나로만 표현. border/bg/CTA 색 다 빼서 카드 단조롭게 —
// 색 위계는 verdict strip 이 담당 (2026-04-30).
export function ActionCard({ action, ctaLabel, onClick }: Props) {
  const dot = action.level === 'critical'
    ? 'bg-[var(--status-danger)]'
    : 'bg-[var(--status-warning)]';
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative text-left rounded-xl border border-border/60 bg-[var(--surface)] p-3.5 transition-all hover:border-foreground/20 hover:shadow-md flex flex-col"
    >
      <div className="flex items-start gap-2 flex-1">
        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold tracking-tight text-foreground leading-snug">
            {action.title}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            {action.detail}
          </p>
        </div>
      </div>
      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground/80 transition-colors">
        <span>{ctaLabel}</span>
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}
