import type { UnixMs } from './common';
import type { KpiSnapshot, KpiTimeSeriesEntry } from './kpi';
import type { VisitorProfileType } from './visitor';

// profile 별 engagement 통계 — exited 방문자 sample 기반.
export interface ProfileEngagement {
  readonly sampleCount: number;     // exited 방문자 수
  readonly avgDwellSec: number;
  readonly avgZones: number;
  readonly avgMedia: number;
  readonly fullCompletion: number;  // 0-1
  readonly fatigueMean: number;     // 0-1
}

// 시뮬레이션 1회 실행 결과 — 비교에 필요한 핵심 필드만 보관 (raw visitor[] 등은 제외).
// groupKey = `${scenarioId}|v${scenarioVersion}|${contentHash}` 로 묶어서 같은 시나리오 변형끼리만 비교 가능하게 한다.
// dirtyAtCapture=true 인 run 은 "수정됨" 묶음으로 분리되어 저장된 baseline 과 섞이지 않는다.
export interface RunRecord {
  readonly id: string;
  readonly startedAt: UnixMs;
  readonly endedAt: UnixMs;

  // ── 시나리오 식별 ──
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly scenarioVersion: number;
  readonly contentHash: string;
  readonly dirtyAtCapture: boolean;

  // ── 페르소나 / 시드 (비교 컨텍스트) ──
  readonly persona: {
    readonly profileWeights: Readonly<Record<VisitorProfileType, number>>;
    readonly totalCount: number;
  };
  readonly seed: number;

  // ── KPI ──
  readonly latestSnapshot: KpiSnapshot;
  readonly kpiHistory: readonly KpiTimeSeriesEntry[];

  // ── 누적 카운터 ──
  readonly totalSpawned: number;
  readonly totalExited: number;
  readonly spawnByNode: Readonly<Record<string, number>>;
  readonly exitByNode: Readonly<Record<string, number>>;

  // ── 사후 집계 (visitor[] 통째로 보관 안 하고 사전 계산) ──
  readonly engagement: {
    readonly avgZones: number;
    readonly avgMedia: number;
    readonly fullCompletion: number; // 0-1
    readonly avgDwellSec: number;
    readonly fatigueMean: number;    // 0-1
  };

  // ── persona 분해 (Step 2, 2026-04-30) ──
  // profile 별 engagement 집계 — 공집합인 profile 은 sampleCount=0 으로 표시.
  readonly engagementByProfile: Readonly<Partial<Record<VisitorProfileType, ProfileEngagement>>>;

  // ── 외부 입장 큐 집계 (Step 2, 2026-04-30) ──
  // EntryController 가 활성이 아닌 시나리오는 모두 0 — rejectionRate 도 0 으로 의미 없음.
  readonly entryStats: {
    readonly totalArrived: number;
    readonly totalAdmitted: number;
    readonly totalAbandoned: number;
    readonly avgAdmitWaitMs: number;
    readonly rejectionRate: number; // abandoned / arrived
  };
}
