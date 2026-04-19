import { useCallback } from 'react';
import { Zap, Clock, Crown, Users, MapPin } from 'lucide-react';
import { useStore } from '@/stores';
import type { VisitorCategory } from '@/domain';

interface PresetConfig {
  spawnRatePerSecond: number;
  profileWeights: Record<string, number>;
  engagementWeights: Record<string, number>;
  groupRatio: number;
  categoryWeights: Record<VisitorCategory, number>;
}

const PRESETS: readonly { id: string; label: string; icon: typeof Zap; desc: string; config: PresetConfig }[] = [
  {
    id: 'rush_hour',
    label: 'Rush Hour',
    icon: Zap,
    desc: 'High inflow, solo-dominant',
    config: {
      spawnRatePerSecond: 4,
      profileWeights: { general: 70, vip: 5, child: 15, elderly: 5, disabled: 5 },
      engagementWeights: { quick: 50, explorer: 30, immersive: 20 },
      groupRatio: 0.25,
      categoryWeights: { solo: 70, small_group: 20, guided_tour: 5, vip_expert: 5 },
    },
  },
  {
    id: 'steady_flow',
    label: 'Steady Flow',
    icon: Clock,
    desc: 'Steady inflow, balanced mix',
    config: {
      spawnRatePerSecond: 2,
      profileWeights: { general: 60, vip: 15, child: 10, elderly: 10, disabled: 5 },
      engagementWeights: { quick: 30, explorer: 40, immersive: 30 },
      groupRatio: 0.35,
      categoryWeights: { solo: 55, small_group: 30, guided_tour: 5, vip_expert: 10 },
    },
  },
  {
    id: 'vip_event',
    label: 'VIP Event',
    icon: Crown,
    desc: 'VIP-focused, immersive',
    config: {
      spawnRatePerSecond: 1.5,
      profileWeights: { general: 30, vip: 40, child: 5, elderly: 15, disabled: 10 },
      engagementWeights: { quick: 10, explorer: 40, immersive: 50 },
      groupRatio: 0.2,
      categoryWeights: { solo: 20, small_group: 15, guided_tour: 5, vip_expert: 60 },
    },
  },
  {
    id: 'family_day',
    label: 'Family Day',
    icon: Users,
    desc: 'Family groups, high group ratio',
    config: {
      spawnRatePerSecond: 3,
      profileWeights: { general: 40, vip: 5, child: 30, elderly: 15, disabled: 10 },
      engagementWeights: { quick: 20, explorer: 50, immersive: 30 },
      groupRatio: 0.6,
      categoryWeights: { solo: 30, small_group: 50, guided_tour: 10, vip_expert: 10 },
    },
  },
  {
    id: 'guided_tour_day',
    label: 'Guided Tour',
    icon: MapPin,
    desc: 'Docent tours, large groups',
    config: {
      spawnRatePerSecond: 2.5,
      profileWeights: { general: 50, vip: 10, child: 20, elderly: 15, disabled: 5 },
      engagementWeights: { quick: 15, explorer: 45, immersive: 40 },
      groupRatio: 0.6,
      categoryWeights: { solo: 25, small_group: 20, guided_tour: 40, vip_expert: 15 },
    },
  },
];

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
        categoryWeights: preset.config.categoryWeights,
      },
      simulationConfig: {
        ...scenario.simulationConfig,
        timeSlots: scenario.simulationConfig.timeSlots.map((slot) => ({
          ...slot,
          spawnRatePerSecond: preset.config.spawnRatePerSecond,
          profileDistribution: preset.config.profileWeights,
          engagementDistribution: preset.config.engagementWeights,
          groupRatio: preset.config.groupRatio,
          categoryDistribution: preset.config.categoryWeights,
        })),
      },
    });
  }, [scenario, setScenario, isLocked]);

  if (!scenario) return null;

  return (
    <div>
      <p className="panel-label mb-1.5">Quick Presets</p>
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
