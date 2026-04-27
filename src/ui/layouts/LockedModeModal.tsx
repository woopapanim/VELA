/**
 * LockedModeModal — 잠긴 체험 모드 카드 클릭 시 가치 미리보기 (2026-04-28)
 *
 * 잠긴 모드 (Phase 2/3A/3B) 도 카드는 노출하되, 적용 대신 이 모달을 띄워
 * "이 모드가 켜지면 어떤 KPI 를 보게 될지" 미리 보여준다.
 *
 * spec 약속이 코드 미구현인 동안에도, 사용자가 어떤 가치를 얻을지
 * IA 에 미리 노출하는 것이 본 IA 재구성의 핵심 원칙.
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
  const labelKey = `${meta.i18nKey}.label`;
  const descKey = `${meta.i18nKey}.desc`;

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[400] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
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

        <div className="px-5 pb-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
            {t(meta.personaKey)}
          </div>
          <h3 className="text-base font-semibold tracking-tight mb-1">
            {t(meta.questionKey)}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            {t(descKey)}
          </p>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2">
            {t('modeSelect.lockedModalIntro')}
          </div>
          <ul className="space-y-1.5 mb-5">
            {meta.previewKpiKeys.map((kpiKey) => (
              <li key={kpiKey} className="flex items-center gap-2 text-xs">
                <span className="w-1 h-1 rounded-full bg-primary/60" aria-hidden />
                <span>{t(kpiKey)}</span>
              </li>
            ))}
          </ul>
          <div className="text-[10px] text-muted-foreground/60 mb-4">
            {t(labelKey)}
          </div>
        </div>

        <div className="px-5 pb-5 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          >
            {t('modeSelect.lockedModalClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
