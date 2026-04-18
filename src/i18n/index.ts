import { useStore } from '@/stores';
import { en } from './en';
import { ko } from './ko';
import type { Dict, Language } from './types';

export const dictionaries: Record<Language, Dict> = { en, ko };

export type { Language } from './types';

export type TParams = Record<string, string | number>;

function interpolate(text: string, params?: TParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, key) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}

export function translate(
  lang: Language,
  key: string,
  params?: TParams,
  fallback?: string,
): string {
  const raw =
    dictionaries[lang][key] ?? dictionaries.en[key] ?? fallback ?? key;
  return interpolate(raw, params);
}

export function useT() {
  const language = useStore((s) => s.language);
  return (key: string, params?: TParams, fallback?: string) =>
    translate(language, key, params, fallback);
}
