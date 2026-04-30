import type { ReactNode } from 'react';

interface Props {
  header: ReactNode;
  rail: ReactNode;
  left?: ReactNode;
  main: ReactNode;
  right?: ReactNode;
  /** 메인 영역 하단에 붙는 phase 별 toolbar (Simulate timeline 등). */
  footer?: ReactNode;
  /** 항상 최하단에 붙는 공통 stats strip. */
  statsFooter?: ReactNode;
}

// 모든 stage 가 공유하는 skeleton. header/rail 은 항상 동일한 자리,
// left/right/footer 는 phase 별 slot. "stage 마다 div 새로 짜는" 패턴 폐기.
export function AppShell({ header, rail, left, main, right, footer, statsFooter }: Props) {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {header}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {rail}
        {left}
        <main className="flex-1 relative bg-background overflow-hidden min-w-0">
          {main}
        </main>
        {right}
      </div>
      {footer}
      {statsFooter}
    </div>
  );
}
