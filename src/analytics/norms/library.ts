import type { Norm } from './types';

// VELA Norm 라이브러리. 각 metric 의 임계값 + 출처.
// 임계 변경 시 각 norm 옆 ℹ️ 툴팁의 근거도 같이 업데이트할 것.

export const NORM_PEAK_RATIO: Norm = {
  key: 'peak_ratio',
  direction: 'lower_is_better',
  goodAt: 0.7,
  warnAt: 0.9,
  unit: '%',
  source: {
    kind: 'self',
    cite: 'VELA 권장',
    rationale: 'capacity 70% 이상은 체감 정체, 90% 이상은 거의 만석 — 분석 합의 (2026-04-30)',
  },
};

export const NORM_AVG_DENSITY: Norm = {
  key: 'avg_density',
  direction: 'higher_is_better',
  goodAt: 1.5,    // m²/person
  warnAt: 1.0,
  unit: 'm²/person',
  source: {
    kind: 'industry',
    cite: 'NFPA 101 / WELL Building Standard',
    rationale: '실내 공중 이용시설 인파 안전 기준 — 1.5m² 이상 권장, 1.0m² 미만은 위험 수준',
  },
};

export const NORM_SKIP_RATE: Norm = {
  key: 'skip_rate',
  direction: 'lower_is_better',
  goodAt: 0.3,
  warnAt: 0.5,
  unit: '%',
  source: {
    kind: 'self',
    cite: 'VELA 권장',
    rationale: '관람 의도 무산 30% 이상이면 동선/배치 검토, 50% 이상은 구조적 문제',
  },
};

export const NORM_COMPLETION_RATE: Norm = {
  key: 'completion_rate',
  direction: 'higher_is_better',
  goodAt: 0.6,
  warnAt: 0.4,
  unit: '%',
  source: {
    kind: 'self',
    cite: 'VELA 권장',
    rationale: '완주율(전체 zone 도달 기준) 60% 이상이면 동선 의도 전달 양호, 40% 미만은 진입 단계 이탈 의심',
  },
};

export const NORM_BOTTLENECK_SCORE: Norm = {
  key: 'bottleneck_score',
  direction: 'lower_is_better',
  goodAt: 0.6,
  warnAt: 0.8,
  unit: 'score',
  source: {
    kind: 'derived',
    cite: 'bottleneckIndex',
    rationale: 'flow in/out 비율 + 큐 시간 + 그룹 기여로 0–1 산출 — 0.6 이상은 가시적 정체, 0.8 이상은 흐름 단절',
  },
};

export const NORM_FATIGUE: Norm = {
  key: 'fatigue_mean',
  direction: 'lower_is_better',
  goodAt: 0.5,
  warnAt: 0.7,
  unit: '%',
  source: {
    kind: 'self',
    cite: 'VELA 권장',
    rationale: '평균 피로도 50% 이하 양호, 70% 이상은 후반부 관람 품질 저하',
  },
};

export const NORM_SATISFACTION: Norm = {
  key: 'satisfaction',
  direction: 'higher_is_better',
  goodAt: 70,
  warnAt: 50,
  unit: 'score',
  source: {
    kind: 'mode_default',
    cite: 'ExperienceMode default',
    rationale: '모드별 만족도 가중치(체류·완주·정체 페널티)로 0–100 산출 — 70 이상 양호',
  },
};

// Zone 면적 효율 — peak occupancy / capacity 가 너무 낮으면 dead zone (저활용).
export const NORM_ZONE_UTILIZATION: Norm = {
  key: 'zone_utilization',
  direction: 'higher_is_better',
  goodAt: 0.3,
  warnAt: 0.1,
  unit: '%',
  source: {
    kind: 'self',
    cite: 'VELA 권장',
    rationale: 'peak 점유율 30% 이상이면 활용, 10% 미만은 dead zone (관람 동기 부족 의심)',
  },
};

// 입장 거절·이탈 — 외부 큐에서 인내심 한계로 abandon 한 비율.
export const NORM_ENTRY_REJECTION: Norm = {
  key: 'entry_rejection_rate',
  direction: 'lower_is_better',
  goodAt: 0.05,
  warnAt: 0.15,
  unit: '%',
  source: {
    kind: 'self',
    cite: 'VELA 권장',
    rationale: '외부 큐에서 인내심 한계로 이탈한 비율 — 5% 이상은 진입 정책/스폰 패턴 검토, 15% 이상은 구조적 진입 실패',
  },
};

// 입장 대기 — 최근 admit N 명의 외부 대기 평균 (ms 단위로 비교).
export const NORM_ENTRY_WAIT: Norm = {
  key: 'entry_avg_wait_ms',
  direction: 'lower_is_better',
  goodAt: 60_000,
  warnAt: 180_000,
  unit: 'ms',
  source: {
    kind: 'self',
    cite: 'VELA 권장',
    rationale: '실외/체크인 대기 1분 이내 양호, 3분 이상은 운영 부담 — 박물관·전시 운영 가이드 합의값 (2026-04-30)',
  },
};

// 정체 시간 비율 — 시뮬레이션 전체 시간 중 zone 이 "가시적 정체" 였던 비율.
// 임계 = bottleneck_score.goodAt (0.6) 이상이었던 누적 시간 / simulationTimeMs.
export const NORM_CONGESTION_TIME_RATIO: Norm = {
  key: 'congestion_time_ratio',
  direction: 'lower_is_better',
  goodAt: 0.10,
  warnAt: 0.25,
  unit: '%',
  source: {
    kind: 'self',
    cite: 'VELA 권장',
    rationale: '한 zone 의 정체(score≥0.6) 시간이 전체의 10% 이내 양호, 25% 이상은 구조적 정체 — 운영 개선 신호 (2026-04-30)',
  },
};

// 피크 시점 인당 면적 — 가장 붐비는 zone 의 m²/person. 안전 기준.
export const NORM_AREA_PER_PERSON_PEAK: Norm = {
  key: 'area_per_person_peak',
  direction: 'higher_is_better',
  goodAt: 1.5,
  warnAt: 1.0,
  unit: 'm²/person',
  source: {
    kind: 'industry',
    cite: 'NFPA 101 / WELL Building Standard',
    rationale: '피크 시점 인당 점유 면적 — 1.5m² 이상 권장, 1.0m² 미만은 인파 안전 위험',
  },
};

export const NORMS = {
  peak_ratio: NORM_PEAK_RATIO,
  avg_density: NORM_AVG_DENSITY,
  skip_rate: NORM_SKIP_RATE,
  completion_rate: NORM_COMPLETION_RATE,
  bottleneck_score: NORM_BOTTLENECK_SCORE,
  fatigue_mean: NORM_FATIGUE,
  satisfaction: NORM_SATISFACTION,
  zone_utilization: NORM_ZONE_UTILIZATION,
  entry_rejection_rate: NORM_ENTRY_REJECTION,
  entry_avg_wait_ms: NORM_ENTRY_WAIT,
  area_per_person_peak: NORM_AREA_PER_PERSON_PEAK,
  congestion_time_ratio: NORM_CONGESTION_TIME_RATIO,
} as const;

export type NormKey = keyof typeof NORMS;
