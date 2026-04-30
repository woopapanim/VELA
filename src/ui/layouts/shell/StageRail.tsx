import type { ReactNode } from 'react';
import { Wrench, Play, BarChart3 } from 'lucide-react';
import type { Stage } from './UnifiedHeader';

interface StageNav {
  build?: () => void;
  simulate?: () => void;
  analyze?: () => void;
}

interface Props {
  current: Stage;
  nav: StageNav;
  /** 하단에 붙는 stage-internal 도구. Build 의 task icons 등. */
  bottom?: ReactNode;
}

const STAGES: { id: Stage; icon: typeof Wrench; label: string }[] = [
  { id: 'build', icon: Wrench, label: '1 Build' },
  { id: 'simulate', icon: Play, label: '2 Simulate' },
  { id: 'analyze', icon: BarChart3, label: '3 Analyze' },
];

// 모든 phase 좌측 56px 영구 rail. 상단: 1·2·3 stage 점프. 하단: stage 별 도구.
// "Build 만 rail 있고 Simulate/Analyze 는 없음" 비대칭 폐기.
export function StageRail({ current, nav, bottom }: Props) {
  return (
    <aside className="w-14 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0">
      <div className="flex flex-col items-center gap-1 py-2">
        {STAGES.map(({ id, icon: Icon, label }) => {
          const isCurrent = id === current;
          const handler = nav[id];
          const clickable = !isCurrent && !!handler;
          const isPast =
            STAGES.findIndex((s) => s.id === current) >
            STAGES.findIndex((s) => s.id === id);
          return (
            <button
              key={id}
              type="button"
              onClick={handler}
              disabled={!clickable}
              title={label}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                ${
                  isCurrent
                    ? 'bg-primary/15 text-primary'
                    : clickable
                    ? 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    : 'text-muted-foreground/30 cursor-not-allowed'
                }`}
            >
              <Icon className="w-4 h-4" />
              {isPast && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--status-success)]" />
              )}
            </button>
          );
        })}
      </div>
      {bottom && (
        <>
          <div className="mx-2 border-t border-border" />
          <div className="flex-1 flex flex-col items-center gap-1 py-2 overflow-y-auto">
            {bottom}
          </div>
        </>
      )}
    </aside>
  );
}
