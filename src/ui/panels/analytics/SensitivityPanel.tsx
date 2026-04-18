import { useMemo } from 'react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';

interface SensitivityFactor {
  name: string;
  parameter: string;
  currentValue: number;
  unit: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
}

export function SensitivityPanel() {
  const zones = useStore((s) => s.zones);
  const visitors = useStore((s) => s.visitors);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const scenario = useStore((s) => s.scenario);
  const t = useT();

  const analysis = useMemo<SensitivityFactor[]>(() => {
    if (!latestSnapshot || !scenario) return [];

    const factors: SensitivityFactor[] = [];
    const active = visitors.filter((v) => v.isActive);

    // 1. Entrance capacity sensitivity
    const entranceZone = zones.find((z) => z.type === 'entrance');
    if (entranceZone) {
      const entranceUtil = latestSnapshot.zoneUtilizations.find((u) => u.zoneId === entranceZone.id);
      const ratio = entranceUtil?.ratio ?? 0;
      if (ratio > 0.7) {
        factors.push({
          name: 'Entrance Capacity',
          parameter: 'capacity',
          currentValue: entranceZone.capacity,
          unit: 'visitors',
          impact: ratio > 0.9 ? 'high' : 'medium',
          recommendation: t('sensitivity.rec.expandEntrance', {
            capacity: Math.ceil(entranceZone.capacity * 1.5),
            percent: Math.round((1 - 0.7 / ratio) * 100),
          }),
        });
      }
    }

    // 2. Spawn rate sensitivity
    const spawnRate = scenario.simulationConfig.timeSlots[0]?.spawnRatePerSecond ?? 0;
    if (active.length > scenario.simulationConfig.maxVisitors * 0.7) {
      factors.push({
        name: 'Spawn Rate',
        parameter: 'spawnRatePerSecond',
        currentValue: spawnRate,
        unit: '/s',
        impact: 'medium',
        recommendation: t('sensitivity.rec.reduceInflow', { rate: (spawnRate * 0.7).toFixed(1) }),
      });
    }

    // 3. Zone count sensitivity
    const overloadedZones = latestSnapshot.zoneUtilizations.filter((u) => u.ratio > 0.8);
    if (overloadedZones.length >= 2) {
      factors.push({
        name: 'Exhibition Area',
        parameter: 'zone_count',
        currentValue: zones.filter((z) => z.type === 'exhibition').length,
        unit: 'zones',
        impact: 'high',
        recommendation: t('sensitivity.rec.addExhibitionZone', {
          before: overloadedZones.length,
          after: Math.max(0, overloadedZones.length - 2),
        }),
      });
    }

    // 4. Media capacity sensitivity
    const avgFatigue = latestSnapshot.fatigueDistribution.mean;
    if (avgFatigue > 0.6) {
      factors.push({
        name: 'Rest Area Capacity',
        parameter: 'rest_capacity',
        currentValue: zones.filter((z) => z.type === 'rest').reduce((s, z) => s + z.capacity, 0),
        unit: 'seats',
        impact: avgFatigue > 0.8 ? 'high' : 'medium',
        recommendation: t('sensitivity.rec.expandRest', {
          before: Math.round(avgFatigue * 100),
          after: Math.round(avgFatigue * 70),
        }),
      });
    }

    // 5. Gate width sensitivity
    const bottleneckedZones = latestSnapshot.bottlenecks.filter((b) => b.score > 0.6);
    if (bottleneckedZones.length > 0) {
      factors.push({
        name: 'Gate Width',
        parameter: 'gate_width',
        currentValue: 40,
        unit: 'px',
        impact: 'medium',
        recommendation: t('sensitivity.rec.widenGate'),
      });
    }

    return factors;
  }, [zones, visitors, latestSnapshot, scenario, t]);

  if (analysis.length === 0) return null;

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Sensitivity Analysis
      </h2>
      <div className="space-y-2">
        {analysis.map((factor, i) => (
          <div key={i} className="bento-box-elevated p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium">{factor.name}</span>
              <ImpactBadge impact={factor.impact} />
            </div>
            <div className="text-[9px] font-data text-muted-foreground mb-1">
              Current: {factor.currentValue} {factor.unit}
            </div>
            <p className="text-[9px] text-primary">{factor.recommendation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImpactBadge({ impact }: { impact: 'high' | 'medium' | 'low' }) {
  const config = {
    high: 'bg-[var(--status-danger)]/15 text-[var(--status-danger)]',
    medium: 'bg-[var(--status-warning)]/15 text-[var(--status-warning)]',
    low: 'bg-[var(--status-info)]/15 text-[var(--status-info)]',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[8px] font-data uppercase ${config[impact]}`}>
      {impact}
    </span>
  );
}
