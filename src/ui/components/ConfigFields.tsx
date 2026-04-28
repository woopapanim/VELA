import { useState, useRef } from 'react';
import { CATEGORY_CONFIGS } from '@/domain';
import { useT } from '@/i18n';

// ── Numeric input field ──
// min/max 가 주어지면 blur 시 clamp + 범위 밖일 때 빨간 테두리. 타이핑 중엔 자유.
// (예: max=2000 인데 "5000" 타이핑 → blur 시 2000 으로 스냅. 0/음수도 동일.)
export function NumField({ label, value, onChange, disabled, step = 1, min, max }: {
  label: string; value: number; onChange: (v: number) => void; disabled: boolean;
  step?: number; min?: number; max?: number;
}) {
  const [raw, setRaw] = useState(String(value));
  const prevValue = useRef(value);
  // Sync from parent when value changes externally
  if (value !== prevValue.current) {
    prevValue.current = value;
    if (parseFloat(raw) !== value) setRaw(String(value));
  }

  const hasBounds = min !== undefined || max !== undefined;
  const parsed = parseFloat(raw);
  const isInvalid = raw === '' || isNaN(parsed)
    || (min !== undefined && parsed < min)
    || (max !== undefined && parsed > max);
  const showError = hasBounds && !disabled && isInvalid;

  return (
    <div>
      <label className="panel-label whitespace-nowrap overflow-hidden text-ellipsis block" title={label}>{label}</label>
      <input
        type="number"
        value={raw}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          setRaw(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        onBlur={() => {
          const n = parseFloat(raw);
          if (isNaN(n) || raw === '') {
            setRaw(String(value));
            return;
          }
          let clamped = n;
          if (min !== undefined) clamped = Math.max(min, clamped);
          if (max !== undefined) clamped = Math.min(max, clamped);
          if (clamped !== n) {
            setRaw(String(clamped));
            onChange(clamped);
          }
        }}
        disabled={disabled}
        className={`w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border disabled:opacity-50 ${
          showError ? 'border-[var(--status-error)]' : 'border-border'
        }`}
      />
    </div>
  );
}

// ── Category labels ──
export const CATEGORY_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  solo: { label: 'Solo (1)', color: '#60a5fa', desc: `${CATEGORY_CONFIGS.solo.baseSpeed / 20}m/s` },
  small_group: { label: 'Small Group (2-4)', color: '#34d399', desc: `${CATEGORY_CONFIGS.small_group.baseSpeed / 20}m/s, ×${CATEGORY_CONFIGS.small_group.dwellTimeMultiplier}` },
  guided_tour: { label: 'Guided Tour (10-20)', color: '#f472b6', desc: `${CATEGORY_CONFIGS.guided_tour.baseSpeed / 20}m/s, ×${CATEGORY_CONFIGS.guided_tour.dwellTimeMultiplier}` },
  vip_expert: { label: 'VIP / Expert', color: '#fbbf24', desc: `${CATEGORY_CONFIGS.vip_expert.baseSpeed / 20}m/s, ×${CATEGORY_CONFIGS.vip_expert.dwellTimeMultiplier}` },
};

export function CategoryMix({ values, onChange, disabled }: {
  values: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
  disabled: boolean;
}) {
  const t = useT();
  const keys = ['solo', 'small_group', 'guided_tour', 'vip_expert'];
  const total = keys.reduce((s, k) => s + (values[k] ?? 0), 0);

  const handleChange = (changedKey: string, newVal: number) => {
    newVal = Math.max(0, Math.min(100, newVal));
    const otherKeys = keys.filter((k) => k !== changedKey);
    const otherTotal = otherKeys.reduce((s, k) => s + (values[k] ?? 0), 0);
    const result: Record<string, number> = { ...values, [changedKey]: newVal };

    if (otherTotal > 0) {
      const remaining = 100 - newVal;
      for (const k of otherKeys) {
        const ratio = (values[k] ?? 0) / otherTotal;
        result[k] = Math.max(0, Math.round(ratio * remaining));
      }
      const currentSum = keys.reduce((s, k) => s + (result[k] ?? 0), 0);
      if (currentSum !== 100) {
        const lastOther = otherKeys[otherKeys.length - 1];
        result[lastOther] = Math.max(0, (result[lastOther] ?? 0) + (100 - currentSum));
      }
    } else {
      const each = Math.floor((100 - newVal) / otherKeys.length);
      otherKeys.forEach((k, i) => {
        result[k] = i === otherKeys.length - 1 ? 100 - newVal - each * (otherKeys.length - 1) : each;
      });
    }
    onChange(result);
  };

  return (
    <div className="space-y-1.5">
      {keys.map((k) => {
        const val = values[k] ?? 0;
        const info = CATEGORY_LABELS[k];
        return (
          <div key={k}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: info?.color }} />
              <span className="flex-1 text-[9px] text-foreground">{info?.label ?? k}</span>
              <span className="text-[8px] text-muted-foreground">{info?.desc}</span>
              <span className="w-8 text-[9px] font-data text-right">{val}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={val}
              onChange={(e) => handleChange(k, parseInt(e.target.value))}
              disabled={disabled}
              className="w-full h-1"
            />
          </div>
        );
      })}
      {total !== 100 && (
        <p className="text-[8px] text-[var(--status-warning)]">{t('configFields.sumRequired', { total })}</p>
      )}
    </div>
  );
}

// ── Percentage Mix (sum always = 100%) ──
export function PercentMix({ keys, values, onChange, disabled }: {
  keys: string[];
  values: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
  disabled: boolean;
}) {
  const t = useT();
  const total = keys.reduce((s, k) => s + (values[k] ?? 0), 0);

  const handleChange = (changedKey: string, newVal: number) => {
    newVal = Math.max(0, Math.min(100, newVal));
    const otherKeys = keys.filter((k) => k !== changedKey);
    const otherTotal = otherKeys.reduce((s, k) => s + (values[k] ?? 0), 0);

    const result: Record<string, number> = { ...values, [changedKey]: newVal };

    if (otherTotal > 0) {
      const remaining = 100 - newVal;
      for (const k of otherKeys) {
        const ratio = (values[k] ?? 0) / otherTotal;
        result[k] = Math.max(0, Math.round(ratio * remaining));
      }
      const currentSum = keys.reduce((s, k) => s + (result[k] ?? 0), 0);
      if (currentSum !== 100) {
        const lastOther = otherKeys[otherKeys.length - 1];
        result[lastOther] = Math.max(0, (result[lastOther] ?? 0) + (100 - currentSum));
      }
    } else {
      const each = Math.floor((100 - newVal) / otherKeys.length);
      otherKeys.forEach((k, i) => {
        result[k] = i === otherKeys.length - 1 ? 100 - newVal - each * (otherKeys.length - 1) : each;
      });
    }

    onChange(result);
  };

  return (
    <div className="space-y-1">
      {keys.map((k) => {
        const val = values[k] ?? 0;
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="w-14 text-[9px] text-muted-foreground capitalize">{k}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={val}
              onChange={(e) => handleChange(k, parseInt(e.target.value))}
              disabled={disabled}
              className="flex-1 h-1"
            />
            <span className="w-8 text-[9px] font-data text-right">{val}%</span>
          </div>
        );
      })}
      {total !== 100 && (
        <p className="text-[8px] text-[var(--status-warning)]">{t('configFields.sumRequired', { total })}</p>
      )}
    </div>
  );
}
