/**
 * LockedModeModal — 잠긴 sub-mode 클릭 시 짧은 안내 (v2 워싱, 2026-04-28)
 *
 * 이전 버전은 KPI 목록 (jargon) 을 노출했지만, 사용자에게 무의미.
 * 사용자 화면에 들어가는 것은 "아직 준비 중" 한 줄 + 어떤 분석인지 + 닫기.
 *
 * 진입 문서: docs/plans/ux-ia-restructure.md §3 IA 원칙
 */

import { Lock, X } from 'lucide-react';
import { useT } from '@/i18n';
import {
  EXPERIENCE_MODE_REGISTRY,
  type ExperienceMode,
} from '@/domain';

interface Props {
  mode: ExperienceMode | null;
  onClose: () => void;
}

export function LockedModeModal({ mode, onClose }: Props) {
  const t = useT();
  if (!mode) return null;

  const meta = EXPERIENCE_MODE_REGISTRY[mode];
  const phase = meta.enabledFromPhase ?? '';

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[400] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" aria-hidden />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
              {t('modeSelect.lockedModalTitle', { phase })}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('modeSelect.lockedModalClose')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5">
          <h3 className="text-base font-semibold tracking-tight mb-2">
            {t(`modeSelect.sub.${mode}`)}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-5">
            {t('modeSelect.lockedModalShortIntro')}
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="text-xs px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              {t('modeSelect.lockedModalClose')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
