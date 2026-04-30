import type { ReactNode } from 'react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { ThemeToggle } from '../../components/ThemeToggle';
import { LanguageToggle } from '../../components/LanguageToggle';
import { HelpButton } from '../../components/HelpOverlay';

export type Stage = 'build' | 'simulate' | 'analyze';

interface StageNav {
  build?: () => void;
  simulate?: () => void;
  analyze?: () => void;
}

interface Props {
  current: Stage;
  /** 각 stage 로 점프 가능한 콜백. undefined 면 disabled (아직 도달 불가). */
  nav: StageNav;
  /** 우측 stage 별 액션 (Run / 진행 ring 등). */
  rightSlot?: ReactNode;
  /** 좌측 식별자 영역의 추가 노드 (back 버튼 등은 더 이상 권장 안 함 — breadcrumb 으로 통합). */
  leftSlot?: ReactNode;
}

const STAGE_KEY: Record<Stage, string> = {
  build: 'build.topBar.stage.build',
  simulate: 'build.topBar.stage.simulate',
  analyze: 'build.topBar.stage.analyze',
};

const STAGE_NUM: Record<Stage, string> = {
  build: '1',
  simulate: '2',
  analyze: '3',
};

const STAGE_ORDER: Stage[] = ['build', 'simulate', 'analyze'];

export function UnifiedHeader({ current, nav, rightSlot, leftSlot }: Props) {
  const scenario = useStore((s) => s.scenario);
  const t = useT();

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-[var(--surface)] flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <h1 className="text-sm font-semibold tracking-tight">VELA</h1>
        {scenario && (
          <span className="text-xs text-muted-foreground italic truncate max-w-64">
            {scenario.meta.name}
          </span>
        )}
        {leftSlot}
      </div>

      <nav className="flex items-center gap-1 text-[11px]" aria-label="Stage navigation">
        {STAGE_ORDER.map((stage, idx) => {
          const isCurrent = stage === current;
          const isPast = STAGE_ORDER.indexOf(current) > idx;
          const handler = nav[stage];
          const clickable = !isCurrent && !!handler;

          return (
            <div key={stage} className="flex items-center gap-1">
              {idx > 0 && <span className="text-muted-foreground/40 px-0.5">→</span>}
              {clickable ? (
                <button
                  type="button"
                  onClick={handler}
                  className={`px-2 py-0.5 rounded-full font-medium transition-colors ${
                    isPast
                      ? 'bg-[var(--status-success)]/10 text-[var(--status-success)] hover:bg-[var(--status-success)]/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {STAGE_NUM[stage]} {t(STAGE_KEY[stage])}{isPast && ' ✓'}
                </button>
              ) : (
                <span
                  className={`px-2 py-0.5 rounded-full ${
                    isCurrent
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground/50'
                  }`}
                >
                  {STAGE_NUM[stage]} {t(STAGE_KEY[stage])}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 flex-1 justify-end">
        {rightSlot}
        {rightSlot && <div className="w-px h-5 bg-border mx-1" />}
        <HelpButton />
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
