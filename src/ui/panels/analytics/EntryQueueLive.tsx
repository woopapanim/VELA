/**
 * EntryQueueLive — 외부 입장 큐 라이브 KPI (Phase 1+, 2026-04-26)
 *
 * 위치: 우측 분석 패널의 Experience 탭. 좌측 OperationsPanel (셋팅) 과 분리.
 * - "셋팅" = 정책 입력 (모드/cap/인내심)
 * - "분석" (이 컴포넌트) = 그 정책의 결과 — 대기열, 대기시간, 포기, throughput
 *
 * 정책이 'unlimited' 이면 큐 자체가 비어 있어 placeholder 안내 표시.
 *
 * KPI:
 * - 대기 인원 / 누적 도착 / 누적 입장 / 누적 포기
 * - **평균 대기 (현재 큐)** — 지금 줄 서 있는 사람들의 대기 시간 평균
 * - **최근 입장 평균 대기** — 최근 입장한 100명이 외부에서 기다린 평균 (운영 결정용)
 * - 최장 대기 (현재 큐의 가장 오래된 사람)
 * - 포기율 = abandoned / arrived
 * - throughput/h 추정 = totalAdmitted / elapsed_h
 */

import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { EXPERIENCE_MODE_REGISTRY, inferExperienceMode } from '@/domain';

function fmtSec(ms: number): string {
  if (ms < 1000) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

export function EntryQueueLive() {
  const t = useT();
  const entryQueue = useStore((s) => s.entryQueue);
  const phase = useStore((s) => s.phase);
  const elapsed = useStore((s) => s.timeState.elapsed);
  const scenario = useStore((s) => s.scenario);
  const policy = scenario?.simulationConfig.operations?.entryPolicy;

  // Phase 1 UX (2026-04-26): 검증 tier 는 큐 자체가 의미 없는 모드 (모두 unlimited).
  // 패널을 통째로 숨겨 검증 워크플로우의 노이즈 제거.
  if (scenario) {
    const expMode = scenario.experienceMode
      ?? inferExperienceMode(scenario.simulationConfig.operations?.entryPolicy?.mode);
    if (EXPERIENCE_MODE_REGISTRY[expMode].tier === 'validation') return null;
  }

  const isUnlimited = !policy || policy.mode === 'unlimited';
  const isIdle = phase === 'idle';

  // 정책 미설정 / unlimited 상태 — 패널 자체는 노출하되 안내 표시.
  if (isUnlimited) {
    return (
      <div className="bento-box p-3">
        <h2 className="panel-section mb-2 flex items-center gap-1.5">
          {t('experience.queue.title')}
          <InfoTooltip text={t('experience.queue.titleHint')} />
        </h2>
        <p className="text-[10px] text-muted-foreground italic">
          {t('experience.queue.unlimited')}
        </p>
      </div>
    );
  }

  const arrived = entryQueue.totalArrived;
  const admitted = entryQueue.totalAdmitted;
  const abandoned = entryQueue.totalAbandoned;
  const queueLen = entryQueue.totalQueueLength;
  const avgQueueWait = entryQueue.avgQueueWaitMs;
  const recentAdmitWait = entryQueue.recentAdmitAvgWaitMs;
  const oldest = entryQueue.oldestWaitMs;

  const abandonRate = arrived > 0 ? (abandoned / arrived) * 100 : 0;
  const throughputPerHour = elapsed > 0 ? Math.round((admitted / elapsed) * 3_600_000) : 0;

  return (
    <div className="bento-box p-3">
      <h2 className="panel-section mb-2 flex items-center gap-1.5">
        {t('experience.queue.title')}
        <InfoTooltip text={t('experience.queue.titleHint')} />
      </h2>

      {isIdle && arrived === 0 && (
        <p className="text-[10px] text-muted-foreground italic mb-2">
          {t('experience.queue.idleHint')}
        </p>
      )}

      {/* ── 1행: 카운트 — 도착/입장/포기/대기 중 ── */}
      <div className="grid grid-cols-4 gap-1 mb-2 text-[10px]">
        <div className="flex flex-col px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-[8px] text-muted-foreground">{t('experience.queue.arrived')}</span>
          <span className="font-data font-medium">{arrived}</span>
        </div>
        <div className="flex flex-col px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-[8px] text-muted-foreground">{t('experience.queue.admitted')}</span>
          <span className="font-data font-medium text-[var(--status-success)]">{admitted}</span>
        </div>
        <div className="flex flex-col px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-[8px] text-muted-foreground">{t('experience.queue.abandoned')}</span>
          <span className={`font-data font-medium ${abandoned > 0 ? 'text-[var(--status-danger)]' : ''}`}>
            {abandoned}
          </span>
        </div>
        <div className="flex flex-col px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-[8px] text-muted-foreground">{t('experience.queue.queued')}</span>
          <span className="font-data font-medium text-primary">{queueLen}</span>
        </div>
      </div>

      {/* ── 2행: 대기 시간 KPIs (현재 큐 평균 / 최근 입장 평균 / 최장 대기) ── */}
      <div className="grid grid-cols-3 gap-1 mb-2 text-[10px]">
        <div className="flex flex-col px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-[8px] text-muted-foreground flex items-center gap-1">
            {t('experience.queue.avgQueueWait')}
            <InfoTooltip text={t('experience.queue.avgQueueWaitHint')} />
          </span>
          <span className="font-data font-medium">{fmtSec(avgQueueWait)}</span>
        </div>
        <div className="flex flex-col px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-[8px] text-muted-foreground flex items-center gap-1">
            {t('experience.queue.recentAdmitWait')}
            <InfoTooltip text={t('experience.queue.recentAdmitWaitHint')} />
          </span>
          <span className="font-data font-medium text-primary">{fmtSec(recentAdmitWait)}</span>
        </div>
        <div className="flex flex-col px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-[8px] text-muted-foreground">{t('experience.queue.oldestWait')}</span>
          <span className="font-data font-medium">{fmtSec(oldest)}</span>
        </div>
      </div>

      {/* ── 3행: 효율 KPIs (포기율 / throughput/h) ── */}
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <div className="flex flex-col px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-[8px] text-muted-foreground flex items-center gap-1">
            {t('experience.queue.abandonRate')}
            <InfoTooltip text={t('experience.queue.abandonRateHint')} />
          </span>
          <span className={`font-data font-medium ${abandonRate > 20 ? 'text-[var(--status-danger)]' : abandonRate > 10 ? 'text-[var(--status-warning)]' : 'text-[var(--status-success)]'}`}>
            {abandonRate.toFixed(1)}%
          </span>
        </div>
        <div className="flex flex-col px-2 py-1 rounded-lg bg-secondary/50">
          <span className="text-[8px] text-muted-foreground flex items-center gap-1">
            {t('experience.queue.throughputPerHour')}
            <InfoTooltip text={t('experience.queue.throughputPerHourHint')} />
          </span>
          <span className="font-data font-medium">{throughputPerHour}</span>
        </div>
      </div>
    </div>
  );
}
