import type { Dict } from './types';

export const ko: Dict = {
  // Language toggle
  'language.toggle': '언어',
  'language.en': 'English',
  'language.ko': '한국어',

  // Analytics — action buttons on insight cards
  'analytics.action.editZone': '존 편집',
  'analytics.action.editCapacity': '용량 편집',
  'analytics.action.editMedia': '미디어 편집',
  'analytics.action.viewHeatmap': '히트맵 보기',
  'analytics.action.viewFlow': '동선 보기',
  'analytics.action.checkZone': '존 확인',
  'analytics.action.viewDensity': '밀도 보기',

  // Analytics — static pre-sim insight (congestion warning)
  'analytics.staticInsight.title': '{zone}: 사전 면적 확장 권장',
  'analytics.staticInsight.cause':
    '예상 밀도 {density}m²/인 < 기준 2.5m²/인 — 병목 위험 {risk}',
  'analytics.staticInsight.rec': '→ 존 용량 상한 또는 면적 확장으로 사전 대응',

  // Zone Media Performance
  'zoneMedia.itemsSuffix': '개',

  // Flow vs Experience
  'flowVsExperience.rushThrough':
    'rush-through: 설치 미디어 대비 관람 깊이 25% 미만',

  // Completion Report
  'report.perPerson': '인',
};
