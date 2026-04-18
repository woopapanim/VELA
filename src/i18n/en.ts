import type { Dict } from './types';

export const en: Dict = {
  // Language toggle
  'language.toggle': 'Language',
  'language.en': 'English',
  'language.ko': 'Korean',

  // Analytics — action buttons on insight cards
  'analytics.action.editZone': 'Edit zone',
  'analytics.action.editCapacity': 'Edit capacity',
  'analytics.action.editMedia': 'Edit media',
  'analytics.action.viewHeatmap': 'View heatmap',
  'analytics.action.viewFlow': 'View flow',
  'analytics.action.checkZone': 'Check zone',
  'analytics.action.viewDensity': 'View density',

  // Analytics — static pre-sim insight (congestion warning)
  'analytics.staticInsight.title': '{zone}: Pre-expand area recommended',
  'analytics.staticInsight.cause':
    'Est. density {density}m²/person < threshold 2.5m²/person — bottleneck risk {risk}',
  'analytics.staticInsight.rec':
    '→ Raise capacity cap or expand area in advance',

  // Zone Media Performance
  'zoneMedia.itemsSuffix': 'items',

  // Flow vs Experience
  'flowVsExperience.rushThrough':
    'rush-through: watch depth under 25% vs installed media',

  // Completion Report
  'report.perPerson': 'per person',
};
