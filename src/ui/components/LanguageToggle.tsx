import { useStore } from '@/stores';
import { useT } from '@/i18n';

export function LanguageToggle() {
  const language = useStore((s) => s.language);
  const setLanguage = useStore((s) => s.setLanguage);
  const t = useT();

  const next = language === 'en' ? 'ko' : 'en';
  const label = language === 'en' ? 'EN' : '한';

  return (
    <button
      onClick={() => setLanguage(next)}
      className="flex items-center justify-center w-8 h-8 rounded-lg
                 bg-secondary text-secondary-foreground
                 hover:bg-accent hover:micro-glow
                 transition-all duration-200
                 text-[11px] font-semibold font-data"
      aria-label={t('language.toggle')}
      title={t('language.toggle')}
    >
      {label}
    </button>
  );
}
