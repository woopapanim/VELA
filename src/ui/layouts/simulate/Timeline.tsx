import { useMemo } from 'react';
import { useStore } from '@/stores';
import { ReplayScrubber } from '../../panels/canvas/ReplayScrubber';

// 하단 floating timeline. 시뮬 진행 중에는 progress + 마일스톤 마커. 끝나면 ReplayScrubber 로 전환.
// 캔버스 위 침범 최소화 — 중앙 480px.
export function Timeline() {
  const phase = useStore((s) => s.phase);
  const replayCount = useStore((s) => s.replayFrames.length);
  const elapsed = useStore((s) => s.timeState.elapsed);
  const duration = useStore((s) => s.scenario?.simulationConfig.duration ?? 0);
  const kpiHistory = useStore((s) => s.kpiHistory);
  const isReplayable = phase === 'completed' || phase === 'paused';

  // Bottleneck 마커 — kpiHistory walk
  const markers = useMemo(() => {
    if (!duration) return [];
    const seen = new Set<string>();
    const out: { t: number; kind: 'bottleneck' }[] = [];
    for (const snap of kpiHistory as any[]) {
      for (const bn of snap.bottlenecks ?? []) {
        const key = bn.zoneId as string;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ t: snap.simulationTimeMs, kind: 'bottleneck' });
        }
      }
    }
    return out;
  }, [kpiHistory, duration]);

  // 1차: replay 가능하면 ReplayScrubber. 아니면 progress + 마커만.
  if (isReplayable && replayCount > 0) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[480px] max-w-[60vw]">
        <div className="rounded-2xl bg-[var(--surface)]/90 backdrop-blur-md border border-border shadow-xl p-2">
          <ReplayScrubber />
        </div>
      </div>
    );
  }

  if (phase === 'idle' || !duration) return null;
  const pct = Math.min(1, elapsed / duration) * 100;
  const mm = Math.floor(elapsed / 60000);
  const ss = Math.floor((elapsed % 60000) / 1000);
  const tm = Math.floor(duration / 60000);
  const ts = Math.floor((duration % 60000) / 1000);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[480px] max-w-[60vw]">
      <div className="rounded-2xl bg-[var(--surface)]/90 backdrop-blur-md border border-border shadow-xl px-3 py-2.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-data mb-1.5">
          <span>{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>
          <span className="text-muted-foreground/60">/</span>
          <span>{String(tm).padStart(2, '0')}:{String(ts).padStart(2, '0')}</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-secondary/60 overflow-hidden">
          <div className="absolute top-0 left-0 h-full bg-primary" style={{ width: `${pct}%` }} />
          {markers.map((m, i) => {
            const x = Math.min(100, (m.t / duration) * 100);
            return (
              <div
                key={i}
                className="absolute top-0 w-0.5 h-full bg-[var(--status-warning)]"
                style={{ left: `${x}%` }}
                title={`병목 발생 — ${Math.floor(m.t / 60000)}:${String(Math.floor((m.t % 60000) / 1000)).padStart(2, '0')}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
