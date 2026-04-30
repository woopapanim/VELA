import type { ReactNode } from 'react';
import { Wrench, Play, BarChart3 } from 'lucide-react';
import { useT } from '@/i18n';
import type { Stage } from './UnifiedHeader';

interface StageNav {
  build?: () => void;
  simulate?: () => void;
  analyze?: () => void;
}

interface Props {
  current: Stage;
  nav: StageNav;
  bottom?: ReactNode;
}

const STAGES: { id: Stage; icon: typeof Wrench; num: string; key: string }[] = [
  { id: 'build', icon: Wrench, num: '1', key: 'build.topBar.stage.build' },
  { id: 'simulate', icon: Play, num: '2', key: 'build.topBar.stage.simulate' },
  { id: 'analyze', icon: BarChart3, num: '3', key: 'build.topBar.stage.analyze' },
];

export function StageRail({ current, nav, bottom }: Props) {
  const t = useT();
  return (
    <aside className="w-14 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0">
      <div className="flex flex-col items-center gap-1 py-2">
        {STAGES.map(({ id, icon: Icon, num, key }) => {
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
              title={`${num} ${t(key)}`}
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
