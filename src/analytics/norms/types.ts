// Norm 라이브러리 — 사용자 합격선 입력 X. 시스템이 norm 으로 자동 판정.
// 출처/근거를 항상 동반 (분석 솔루션의 정직성).

export type NormStatus = 'good' | 'warn' | 'bad' | 'unknown';

export type NormSourceKind =
  | 'industry'      // 산업 표준 (NFPA 101 등)
  | 'mode_default'  // 운영 모드 default (코드 정의)
  | 'self'          // 자체 권장 (근거 정리 필요)
  | 'derived';      // 산식에서 derive

export interface NormSource {
  readonly kind: NormSourceKind;
  readonly cite: string;        // 짧은 인용 ("NFPA 101", "운영 default", "VELA 권장")
  readonly rationale: string;   // 근거 한 줄
}

export interface Norm {
  readonly key: string;
  readonly direction: 'lower_is_better' | 'higher_is_better';
  readonly goodAt: number;      // 이 값에 도달하면 good
  readonly warnAt: number;      // 이 값에 도달하면 warn (good 미달 시)
  readonly unit: string;        // "%", "m²/person", "score"
  readonly source: NormSource;
}

// 신뢰도 — Reading 옆에 high/medium/low 표시.
// norm 출처가 industry 면 신뢰 ↑, self 면 ↓, 단일 run 이면 ↓.
export type Confidence = 'high' | 'medium' | 'low';
