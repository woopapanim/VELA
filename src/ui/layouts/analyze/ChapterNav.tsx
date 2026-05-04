import { useEffect, useState, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, BarChart3, Sparkles, Zap } from 'lucide-react';

export interface Chapter {
  id: string;
  label: string;
  Icon: LucideIcon;
  available: boolean;
}

interface Props {
  scrollRoot: HTMLElement | null;
  chapters?: Chapter[];
}

const DEFAULT_CHAPTERS: Chapter[] = [
  { id: 'verdict',        label: '위험 신호',     Icon: Activity,    available: true },
  { id: 'pattern',        label: '시간·공간 패턴', Icon: BarChart3,   available: true },
  { id: 'recommendation', label: '운영 권장',     Icon: Sparkles,    available: true },
  { id: 'actions',        label: '액션',          Icon: Zap,         available: true },
];

// 분석 챕터 좌측 nav. anchor 클릭 → smooth scroll. IntersectionObserver 로
// 현재 보이는 섹션 highlight (scroll spy).
export function ChapterNav({ scrollRoot, chapters = DEFAULT_CHAPTERS }: Props) {
  const [activeId, setActiveId] = useState<string>(chapters[0]?.id ?? '');
  const visibleRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!scrollRoot) return;
    visibleRef.current.clear();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id;
          if (e.isIntersecting) visibleRef.current.set(id, e.intersectionRatio);
          else visibleRef.current.delete(id);
        }
        // 현재 보이는 섹션 중 챕터 순서상 가장 먼저인 것
        const visibleIds = new Set(visibleRef.current.keys());
        const firstVisible = chapters.find((c) => visibleIds.has(c.id));
        if (firstVisible) setActiveId(firstVisible.id);
      },
      {
        root: scrollRoot,
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 1],
      },
    );
    for (const c of chapters) {
      const el = scrollRoot.querySelector(`#${c.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [scrollRoot, chapters]);

  const handleJump = (id: string) => {
    if (!scrollRoot) return;
    const el = scrollRoot.querySelector(`#${id}`);
    if (!el) return;
    (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside
      className="w-52 border-r border-border bg-[var(--surface)] flex flex-col flex-shrink-0 overflow-hidden"
      aria-label="Analyze chapter navigation"
    >
      <div className="px-3 py-2.5 border-b border-border">
        <h2 className="text-xs font-semibold tracking-tight">분석 챕터</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
          섹션을 눌러 바로 이동
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5" aria-label="Chapter list">
        {chapters.map((c) => {
          const isActive = c.id === activeId;
          const Icon = c.Icon;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleJump(c.id)}
              disabled={!c.available}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] transition-colors ${
                isActive
                  ? 'bg-primary/15 text-primary font-medium'
                  : c.available
                  ? 'text-foreground/80 hover:bg-secondary/60 hover:text-foreground'
                  : 'text-muted-foreground/40 cursor-not-allowed'
              }`}
              aria-current={isActive ? 'true' : undefined}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 truncate">{c.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
