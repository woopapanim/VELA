import { useMemo } from 'react';
import { useStore } from '@/stores';
import type { ZoneId, MediaId } from '@/domain';

// Live insight — derived signal that the simulator surfaces during a run.
// Severity: ok < info < warn < critical. UI 는 critical 부터 위로 정렬.
export interface LiveInsight {
  readonly id: string;
  readonly severity: 'ok' | 'info' | 'warn' | 'critical';
  readonly title: string;        // 굵은 한 줄
  readonly detail?: string;      // 부제 (수치, 부연)
  readonly category: 'bottleneck' | 'capacity' | 'skip' | 'early-exit' | 'balance';
}

const SEVERITY_RANK: Record<LiveInsight['severity'], number> = {
  critical: 3,
  warn: 2,
  info: 1,
  ok: 0,
};

// 한 번의 sim 진행 중 실시간으로 필요한 5종 derived signal.
// 빈 배열이면 "정상 운행" 메시지를 UI 에서 채움.
export function useLiveInsights(): LiveInsight[] {
  const phase = useStore((s) => s.phase);
  const latest = useStore((s) => s.latestSnapshot);
  const zones = useStore((s) => s.zones);
  const media = useStore((s) => s.media);
  const visitors = useStore((s) => s.visitors);
  const spawnByNode = useStore((s) => s.spawnByNode);
  const exitByNode = useStore((s) => s.exitByNode);

  return useMemo(() => {
    if (phase === 'idle' || !latest) return [];
    const out: LiveInsight[] = [];

    // 1) Bottleneck — score > 0.6 인 zone 들. 상위 2개.
    const bn = [...latest.bottlenecks].sort((a, b) => b.score - a.score).slice(0, 2);
    for (const b of bn) {
      if (b.score < 0.6) break;
      const zone = zones.find((z) => z.id === b.zoneId);
      const sev: LiveInsight['severity'] = b.score > 0.85 ? 'critical' : 'warn';
      out.push({
        id: `bn_${b.zoneId as string}`,
        severity: sev,
        title: `${zone?.name ?? '?'} bottleneck`,
        detail: `score ${Math.round(b.score * 100)}${b.isGroupInduced ? ' · group-induced' : ''}`,
        category: 'bottleneck',
      });
    }

    // 2) Capacity 임박 — 점유율 > 80%. 가장 높은 한 개.
    const utilTop = [...latest.zoneUtilizations]
      .filter((u) => u.capacity > 0 && u.ratio > 0.8)
      .sort((a, b) => b.ratio - a.ratio)[0];
    if (utilTop) {
      const zone = zones.find((z) => z.id === utilTop.zoneId);
      out.push({
        id: `cap_${utilTop.zoneId as string}`,
        severity: utilTop.ratio > 0.95 ? 'critical' : 'warn',
        title: `${zone?.name ?? '?'} occupancy ${Math.round(utilTop.ratio * 100)}%`,
        detail: `${utilTop.currentOccupancy}/${utilTop.capacity}`,
        category: 'capacity',
      });
    }

    // 3) Skip rate spike — media 단위 skipRate > 0.5. 가장 높은 한 개.
    const skipTop = [...latest.skipRate.perMedia]
      .filter((m) => m.totalApproaches >= 5 && m.rate > 0.5)
      .sort((a, b) => b.rate - a.rate)[0];
    if (skipTop) {
      const m = media.find((mm) => mm.id === skipTop.mediaId as MediaId);
      out.push({
        id: `skip_${skipTop.mediaId as string}`,
        severity: skipTop.rate > 0.7 ? 'warn' : 'info',
        title: `${m?.name ?? '?'} skip ${Math.round(skipTop.rate * 100)}%`,
        detail: `${skipTop.skipCount}/${skipTop.totalApproaches} approaches`,
        category: 'skip',
      });
    }

    // 4) 조기이탈 — exit 한 visitors 중 visitedZoneIds.length < 2. ratio 계산.
    const exited = visitors.filter((v) => !v.isActive);
    if (exited.length >= 10) {
      const earlyExitCount = exited.filter((v) => v.visitedZoneIds.length < 2).length;
      const ratio = earlyExitCount / exited.length;
      if (ratio > 0.3) {
        out.push({
          id: 'early_exit',
          severity: ratio > 0.5 ? 'critical' : 'warn',
          title: `Early exit ${Math.round(ratio * 100)}%`,
          detail: `${earlyExitCount}/${exited.length} left after seeing only 1 zone`,
          category: 'early-exit',
        });
      }
    }

    // 5) Entry/Exit 불균형 — 가장 많이 쓰는 entry vs exit 비율.
    const totalSpawn = Array.from(spawnByNode.values()).reduce((a, b) => a + b, 0);
    const totalExit = Array.from(exitByNode.values()).reduce((a, b) => a + b, 0);
    if (totalSpawn >= 30 && totalExit >= 30) {
      // 단일 entry/exit 노드의 점유율
      const maxSpawn = Math.max(...Array.from(spawnByNode.values()));
      const maxExit = Math.max(...Array.from(exitByNode.values()));
      const spawnConcentration = maxSpawn / totalSpawn;
      const exitConcentration = maxExit / totalExit;
      if (spawnConcentration > 0.7 || exitConcentration > 0.7) {
        out.push({
          id: 'gate_imbalance',
          severity: 'info',
          title: 'Entry/Exit imbalance',
          detail: `Entry ${Math.round(spawnConcentration * 100)}% / Exit ${Math.round(exitConcentration * 100)}% concentrated on single node`,
          category: 'balance',
        });
      }
    }

    return out.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  }, [phase, latest, zones, media, visitors, spawnByNode, exitByNode]);
}

// Per-zone 카드용 summary. canvas zone 색깔/이름과 매칭.
export interface ZoneSummary {
  readonly zoneId: ZoneId;
  readonly name: string;
  readonly color: string;
  readonly currentOccupancy: number;
  readonly capacity: number;
  readonly ratio: number;             // 0-1
  readonly meanDwellMs: number;       // 평균 dwell
  readonly bottleneckScore: number;   // 0-1, 0이면 정상
  readonly watchingCount: number;
}

export function useZoneSummaries(): ZoneSummary[] {
  const zones = useStore((s) => s.zones);
  const latest = useStore((s) => s.latestSnapshot);

  return useMemo(() => {
    return zones.map((z) => {
      const u = latest?.zoneUtilizations.find((x) => x.zoneId === z.id);
      const b = latest?.bottlenecks.find((x) => x.zoneId === z.id);
      const d = latest?.visitDurations.find((x) => x.zoneId === z.id);
      return {
        zoneId: z.id,
        name: z.name,
        color: z.color,
        currentOccupancy: u?.currentOccupancy ?? 0,
        capacity: u?.capacity ?? z.capacity ?? 0,
        ratio: u?.ratio ?? 0,
        meanDwellMs: d?.meanDurationMs ?? 0,
        bottleneckScore: b?.score ?? 0,
        watchingCount: u?.watchingCount ?? 0,
      };
    });
  }, [zones, latest]);
}
