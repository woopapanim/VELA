/**
 * WorkflowStepIndicator — 4단계 워크플로우 진행 표시 (2026-04-28 IA 재구성)
 *
 * Setup → Build → Simulate → Analyze.
 *
 * 사용자가 좌/우 패널 (12 섹션) 동시 노출 대신 한 단계씩 화면 전체를
 * 차지하도록 IA 를 재구성. 이 indicator 는 헤더 또는 사이드바에서
 * 사용자가 현재 어디에 있는지 + 다음 단계 prefetch 를 보여줌.
 *
 * MVP: 현재 단계만 강조, 나머지는 disabled (점프 없음).
 * 향후: 완료된 단계는 클릭으로 돌아갈 수 있게.
 */

import { Check } from 'lucide-react';
import { useT } from '@/i18n';

export type WorkflowStep = 1 | 2 | 3 | 4;

interface Props {
  current: WorkflowStep;
  /** vertical: 좌측 사이드바형 (예: Setup screen) / horizontal: 헤더형 */
  variant?: 'vertical' | 'horizontal';
}

const STEPS: ReadonlyArray<{ n: WorkflowStep; titleKey: string; subKey: string }> = [
  { n: 1, titleKey: 'workflow.step1', subKey: 'workflow.step1.sub' },
  { n: 2, titleKey: 'workflow.step2', subKey: 'workflow.step2.sub' },
  { n: 3, titleKey: 'workflow.step3', subKey: 'workflow.step3.sub' },
  { n: 4, titleKey: 'workflow.step4', subKey: 'workflow.step4.sub' },
];

export function WorkflowStepIndicator({ current, variant = 'vertical' }: Props) {
  const t = useT();

  if (variant === 'horizontal') {
    return (
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const active = s.n === current;
          const done = s.n < current;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg
                  ${active ? 'bg-primary/15 text-primary' : done ? 'text-foreground' : 'text-muted-foreground/60'}`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium
                    ${active ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/30 text-primary' : 'bg-muted-foreground/20'}`}
                >
                  {done ? <Check className="w-3 h-3" /> : s.n}
                </span>
                <span className="text-xs font-medium">{t(s.titleKey)}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-4 h-px bg-border" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {STEPS.map((s, i) => {
        const active = s.n === current;
        const done = s.n < current;
        return (
          <div key={s.n} className="relative">
            <div
              className={`flex items-start gap-3 px-3 py-3 rounded-xl transition-colors
                ${active ? 'bg-primary/10 border border-primary/30' : ''}`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0 mt-0.5
                  ${active
                    ? 'bg-primary text-primary-foreground'
                    : done
                      ? 'bg-primary/25 text-primary'
                      : 'bg-muted-foreground/15 text-muted-foreground/70'
                  }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : s.n}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium leading-tight ${active ? 'text-primary' : done ? '' : 'text-muted-foreground/70'}`}>
                  {t(s.titleKey)}
                </div>
                <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {t(s.subKey)}
                </div>
              </div>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" aria-hidden />}
            </div>
            {i < STEPS.length - 1 && (
              <div className="absolute left-[1.625rem] top-[3.25rem] w-px h-3 bg-border/60" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
