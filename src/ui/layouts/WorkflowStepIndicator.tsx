/**
 * WorkflowStepIndicator — 4단계 워크플로우 (2026-04-28 IA 재구성, nav 통일 v2)
 *
 *   Setup → Build → Simulate → Analyze.
 *
 * 단일 navigation 규칙:
 *   "stepper 칸 누르면 거기로 간다."
 *   완료/현재/도달가능/잠김 4-state 로 시각화. 잠김 단계는 tooltip 으로 사유 제공.
 *   화면별 next 버튼은 모두 제거 — 진행은 stepper 만으로.
 *
 * states:
 *   - current : 현재 단계 (강조)
 *   - completed : 지나온 단계 (n < current) — 항상 클릭 가능
 *   - available : 미래 단계지만 진입 조건 충족 — 클릭 가능 + pulse
 *   - locked : 진입 조건 미충족 — disabled + tooltip(lockReason)
 */

import { Check, Lock } from 'lucide-react';
import { useT } from '@/i18n';

export type WorkflowStep = 1 | 2 | 3 | 4;

export interface WorkflowStepStatus {
  /** 클릭 가능 여부. current 는 무시(자기 자신 클릭). */
  reachable: boolean;
  /** locked(=!reachable) 일 때 tooltip 으로 노출할 사유 (i18n 적용된 문자열). */
  lockReason?: string;
}

interface Props {
  current: WorkflowStep;
  /** vertical: 좌측 사이드바형 / horizontal: 헤더형 */
  variant?: 'vertical' | 'horizontal';
  /** 칸 클릭 시 호출. 미지정 시 stepper 클릭 비활성. */
  onNavigate?: (step: WorkflowStep) => void;
  /** 4개 step 의 reachable + lockReason. index 0 == step 1. 미지정 시 done 만 클릭 가능 (legacy). */
  status?: ReadonlyArray<WorkflowStepStatus>;
}

const STEPS: ReadonlyArray<{ n: WorkflowStep; titleKey: string; subKey: string }> = [
  { n: 1, titleKey: 'workflow.step1', subKey: 'workflow.step1.sub' },
  { n: 2, titleKey: 'workflow.step2', subKey: 'workflow.step2.sub' },
  { n: 3, titleKey: 'workflow.step3', subKey: 'workflow.step3.sub' },
  { n: 4, titleKey: 'workflow.step4', subKey: 'workflow.step4.sub' },
];

type Visual = 'current' | 'completed' | 'available' | 'locked';

function computeVisual(n: WorkflowStep, current: WorkflowStep, status?: ReadonlyArray<WorkflowStepStatus>): Visual {
  if (n === current) return 'current';
  if (n < current) return 'completed';
  // future step
  if (status && status[n - 1]?.reachable) return 'available';
  return 'locked';
}

export function WorkflowStepIndicator({ current, variant = 'vertical', onNavigate, status }: Props) {
  const t = useT();

  if (variant === 'horizontal') {
    return (
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const visual = computeVisual(s.n, current, status);
          const isClickable = !!onNavigate && (visual === 'completed' || visual === 'available');
          const lockReason = visual === 'locked' ? status?.[s.n - 1]?.lockReason : undefined;
          const Wrapper: any = isClickable ? 'button' : 'div';

          // 색/테두리 매핑.
          const wrapperColor =
            visual === 'current' ? 'bg-primary/15 text-primary'
            : visual === 'completed' ? 'text-foreground'
            : visual === 'available' ? 'text-foreground'
            : 'text-muted-foreground/45';
          const dotColor =
            visual === 'current' ? 'bg-primary text-primary-foreground'
            : visual === 'completed' ? 'bg-primary/30 text-primary'
            : visual === 'available' ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
            : 'bg-muted-foreground/15 text-muted-foreground/55';

          return (
            <div key={s.n} className="flex items-center gap-2">
              <Wrapper
                onClick={isClickable ? () => onNavigate!(s.n) : undefined}
                disabled={Wrapper === 'button' && !isClickable ? true : undefined}
                title={lockReason}
                aria-label={lockReason ? `${t(s.titleKey)} — ${lockReason}` : t(s.titleKey)}
                aria-disabled={visual === 'locked' ? true : undefined}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg transition-colors
                  ${wrapperColor}
                  ${isClickable ? 'hover:bg-accent cursor-pointer' : ''}
                  ${visual === 'locked' ? 'cursor-not-allowed' : ''}`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${dotColor}`}
                >
                  {visual === 'completed' ? <Check className="w-3 h-3" />
                    : visual === 'locked' ? <Lock className="w-2.5 h-2.5" />
                    : s.n}
                </span>
                <span className="text-xs font-medium">{t(s.titleKey)}</span>
              </Wrapper>
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
        const visual = computeVisual(s.n, current, status);
        const isClickable = !!onNavigate && (visual === 'completed' || visual === 'available');
        const lockReason = visual === 'locked' ? status?.[s.n - 1]?.lockReason : undefined;
        const Wrapper: any = isClickable ? 'button' : 'div';

        const dotColor =
          visual === 'current' ? 'bg-primary text-primary-foreground'
          : visual === 'completed' ? 'bg-primary/25 text-primary'
          : visual === 'available' ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
          : 'bg-muted-foreground/15 text-muted-foreground/55';
        const titleColor =
          visual === 'current' ? 'text-primary'
          : visual === 'locked' ? 'text-muted-foreground/55'
          : '';

        return (
          <div key={s.n} className="relative">
            <Wrapper
              onClick={isClickable ? () => onNavigate!(s.n) : undefined}
              disabled={Wrapper === 'button' && !isClickable ? true : undefined}
              title={lockReason}
              aria-disabled={visual === 'locked' ? true : undefined}
              className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-colors
                ${visual === 'current' ? 'bg-primary/10 border border-primary/30' : ''}
                ${isClickable ? 'hover:bg-accent cursor-pointer' : ''}
                ${visual === 'locked' ? 'cursor-not-allowed' : ''}`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0 mt-0.5 ${dotColor}`}>
                {visual === 'completed' ? <Check className="w-3.5 h-3.5" />
                  : visual === 'locked' ? <Lock className="w-3 h-3" />
                  : s.n}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium leading-tight ${titleColor}`}>
                  {t(s.titleKey)}
                </div>
                <div className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2">
                  {visual === 'locked' && lockReason ? lockReason : t(s.subKey)}
                </div>
              </div>
              {visual === 'current' && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" aria-hidden />}
            </Wrapper>
            {i < STEPS.length - 1 && (
              <div className="absolute left-[1.625rem] top-[3.25rem] w-px h-3 bg-border/60 pointer-events-none" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
