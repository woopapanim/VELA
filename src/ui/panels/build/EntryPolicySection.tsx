import { useStore } from '@/stores';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { NumField } from '@/ui/components/ConfigFields';
import {
  DEFAULT_OPERATIONS_CONFIG, DEFAULT_POLICY_PARAMS,
  type EntryPolicy, type EntryPolicyMode,
} from '@/domain';
import { useT } from '@/i18n';

const MODE_CARDS: ReadonlyArray<{ mode: EntryPolicyMode; labelKey: string; descKey: string }> = [
  { mode: 'unlimited',      labelKey: 'entry.mode.unlimited', descKey: 'entry.mode.unlimited.desc' },
  { mode: 'concurrent-cap', labelKey: 'entry.mode.capacity',  descKey: 'entry.mode.capacity.desc' },
  { mode: 'time-slot',      labelKey: 'entry.mode.slot',      descKey: 'entry.mode.slot.desc' },
  { mode: 'hybrid',         labelKey: 'entry.mode.group',     descKey: 'entry.mode.group.desc' },
];

export function EntryPolicySection() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);
  const t = useT();

  const isLocked = phase !== 'idle';
  const ops = scenario?.simulationConfig.operations ?? DEFAULT_OPERATIONS_CONFIG;
  const policy = ops.entryPolicy;

  const setMode = (mode: EntryPolicyMode) => {
    if (!scenario || isLocked || mode === policy.mode) return;
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        operations: { ...ops, entryPolicy: { ...DEFAULT_POLICY_PARAMS[mode] } },
      },
    });
  };

  const updatePolicy = (patch: Partial<EntryPolicy>) => {
    if (!scenario || isLocked) return;
    setScenario({
      ...scenario,
      simulationConfig: {
        ...scenario.simulationConfig,
        operations: { ...ops, entryPolicy: { ...policy, ...patch } as EntryPolicy },
      },
    });
  };

  if (!scenario) return null;

  return (
    <CollapsibleSection id="entry-policy" title={t('entry.title')} defaultOpen>
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {MODE_CARDS.map(({ mode, labelKey, descKey }) => {
          const active = policy.mode === mode;
          return (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              disabled={isLocked}
              className={`p-1.5 rounded-lg text-left border transition-colors disabled:opacity-50 ${
                active
                  ? 'bg-primary/15 border-primary/60 text-foreground'
                  : 'bg-secondary/60 border-transparent hover:bg-accent hover:border-border'
              }`}
            >
              <p className="text-[10px] font-medium">{t(labelKey)}</p>
              <p className={`text-[8px] leading-tight ${active ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                {t(descKey)}
              </p>
            </button>
          );
        })}
      </div>

      {policy.mode === 'unlimited' && (
        <p className="text-[9px] text-muted-foreground italic">{t('entry.unlimited.note')}</p>
      )}

      {policy.mode === 'concurrent-cap' && (
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label={t('entry.field.maxConcurrent')}
            value={policy.maxConcurrent ?? 200}
            onChange={(v) => updatePolicy({ maxConcurrent: Math.max(1, v) })}
            disabled={isLocked}
          />
          <NumField
            label={t('entry.field.maxWaitMin')}
            value={Math.round((policy.maxWaitBeforeAbandonMs ?? 1_800_000) / 60_000)}
            onChange={(v) => updatePolicy({ maxWaitBeforeAbandonMs: Math.max(1, v) * 60_000 })}
            disabled={isLocked}
          />
        </div>
      )}

      {policy.mode === 'time-slot' && (
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label={t('entry.field.slotMin')}
            value={Math.round((policy.slotDurationMs ?? 1_800_000) / 60_000)}
            onChange={(v) => updatePolicy({ slotDurationMs: Math.max(5, v) * 60_000 })}
            disabled={isLocked}
          />
          <NumField
            label={t('entry.field.perSlot')}
            value={policy.perSlotCap ?? 80}
            onChange={(v) => updatePolicy({ perSlotCap: Math.max(1, v) })}
            disabled={isLocked}
          />
          <NumField
            label={t('entry.field.maxWaitMin')}
            value={Math.round((policy.maxWaitBeforeAbandonMs ?? 1_800_000) / 60_000)}
            onChange={(v) => updatePolicy({ maxWaitBeforeAbandonMs: Math.max(1, v) * 60_000 })}
            disabled={isLocked}
          />
        </div>
      )}

      {policy.mode === 'hybrid' && (
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label={t('entry.field.maxConcurrent')}
            value={policy.maxConcurrent ?? 200}
            onChange={(v) => updatePolicy({ maxConcurrent: Math.max(1, v) })}
            disabled={isLocked}
          />
          <NumField
            label={t('entry.field.perSlot')}
            value={policy.perSlotCap ?? 80}
            onChange={(v) => updatePolicy({ perSlotCap: Math.max(1, v) })}
            disabled={isLocked}
          />
          <NumField
            label={t('entry.field.slotMin')}
            value={Math.round((policy.slotDurationMs ?? 1_800_000) / 60_000)}
            onChange={(v) => updatePolicy({ slotDurationMs: Math.max(5, v) * 60_000 })}
            disabled={isLocked}
          />
          <NumField
            label={t('entry.field.maxWaitMin')}
            value={Math.round((policy.maxWaitBeforeAbandonMs ?? 1_800_000) / 60_000)}
            onChange={(v) => updatePolicy({ maxWaitBeforeAbandonMs: Math.max(1, v) * 60_000 })}
            disabled={isLocked}
          />
        </div>
      )}
    </CollapsibleSection>
  );
}
