import { useCallback } from 'react';
import { Zap, Clock, Crown, Users } from 'lucide-react';
import { useStore } from '@/stores';

const PRESETS = [
  {
    id: 'rush_hour',
    label: 'Rush Hour',
    icon: Zap,
    desc: '높은 유입률, 빠른 관람자 위주',
    config: {
      spawnRatePerSecond: 4,
      profileWeights: { general: 70, vip: 5, child: 15, elderly: 5, disabled: 5 },
      engagementWeights: { quick: 50, explorer: 30, immersive: 20 },
      groupRatio: 0.4,
    },
  },
  {
    id: 'steady_flow',
    label: 'Steady Flow',
    icon: Clock,
    desc: '균일한 유입, 균형 잡힌 프로필',
    config: {
      spawnRatePerSecond: 2,
      profileWeights: { general: 60, vip: 15, child: 10, elderly: 10, disabled: 5 },
      engagementWeights: { quick: 30, explorer: 40, immersive: 30 },
      groupRatio: 0.3,
    },
  },
  {
    id: 'vip_event',
    label: 'VIP Event',
    icon: Crown,
    desc: 'VIP 중심, 몰입형 관람자 다수',
    config: {
      spawnRatePerSecond: 1.5,
      profileWeights: { general: 30, vip: 40, child: 5, elderly: 15, disabled: 10 },
      engagementWeights: { quick: 10, explorer: 40, immersive: 50 },
      groupRatio: 0.2,
    },
  },
  {
    id: 'family_day',
    label: 'Family Day',
    icon: Users,
    desc: '가족 단위, 높은 그룹 비율',
    config: {
      spawnRatePerSecond: 3,
      profileWeights: { general: 40, vip: 5, child: 30, elderly: 15, disabled: 10 },
      engagementWeights: { quick: 20, explorer: 50, immersive: 30 },
      groupRatio: 0.6,
    },
  },
] as const;

export function VisitorPresets() {
  const scenario = useStore((s) => s.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const phase = useStore((s) => s.phase);

  const isLocked = phase !== 'idle';

  const applyPreset = useCallback((presetId: string) => {
    if (!scenario || isLocked) return;
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setScenario({
      ...scenario,
      visitorDistribution: {
        ...scenario.visitorDistribution,
        spawnRatePerSecond: preset.config.spawnRatePerSecond,
        profileWeights: preset.config.profileWeights,
        engagementWeights: preset.config.engagementWeights,
        groupRatio: preset.config.groupRatio,
      },
      simulationConfig: {
        ...scenario.simulationConfig,
        timeSlots: scenario.simulationConfig.timeSlots.map((slot) => ({
          ...slot,
          spawnRatePerSecond: preset.config.spawnRatePerSecond,
          profileDistribution: preset.config.profileWeights,
          engagementDistribution: preset.config.engagementWeights,
          groupRatio: preset.config.groupRatio,
        })),
      },
    });
  }, [scenario, setScenario, isLocked]);

  if (!scenario) return null;

  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Quick Presets</p>
      <div className="grid grid-cols-2 gap-1">
        {PRESETS.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => applyPreset(id)}
            disabled={isLocked}
            className="flex items-start gap-1.5 p-2 text-left rounded-xl bg-secondary hover:bg-accent disabled:opacity-40 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-medium">{label}</p>
              <p className="text-[8px] text-muted-foreground leading-tight">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
