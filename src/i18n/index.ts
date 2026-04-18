import { useStore } from '@/stores';
import { en } from './en';
import { ko } from './ko';
import type { Dict, Language } from './types';

export const dictionaries: Record<Language, Dict> = { en, ko };

export type { Language } from './types';

export function translate(lang: Language, key: string, fallback?: string): string {
  return dictionaries[lang][key] ?? dictionaries.en[key] ?? fallback ?? key;
}

export function useT() {
  const language = useStore((s) => s.language);
  return (key: string, fallback?: string) => translate(language, key, fallback);
}
