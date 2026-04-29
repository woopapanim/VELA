import { useStore } from '@/stores';
import type { VisitorProfileType, VisitorCategory } from '@/domain';

// Simulate 좌측 column 의 readonly 모드 — phase != idle 일 때.
// "지금 무슨 설정으로 돌고 있는가" 한눈에. 편집은 idle 로 돌아가야 함.
export function RunSummary() {
  const scenario = useStore((s) => s.scenario);
  if (!scenario) return null;

  const dist = scenario.visitorDistribution;
  const config = scenario.simulationConfig;
  const mode = config.simulationMode ?? 'time';
  const slots = config.timeSlots ?? [];
  const isMultiSlot = slots.length > 1;
  const rateRps = isMultiSlot
    ? slots.reduce((a, s) => a + s.spawnRatePerSecond, 0) / slots.length
    : (slots[0]?.spawnRatePerSecond ?? dist.spawnRatePerSecond ?? 0);

  const profile: Partial<Record<VisitorProfileType, number>> = dist.profileWeights ?? {};
  const cat: Partial<Record<VisitorCategory, number>> = dist.categoryWeights ?? {};
  const skip = config.skipThreshold;

  return (
    <div className="space-y-3">
      <Section title="Mode">
        <Row label="Type" value={mode === 'person' ? '사람 기준' : '시간 기준'} />
        <Row label="Total" value={`${dist.totalCount}명`} />
        <Row label="Duration" value={`${Math.round(config.duration / 60000)} min`} />
        <Row label="Spawn" value={`${(rateRps * 60).toFixed(1)}/min${isMultiSlot ? ` · ${slots.length} slots` : ''}`} />
        <Row label="Seed" value={String(config.seed ?? 0)} />
      </Section>

      <Section title="Visitor Intent">
        <Row label="General" value={`${profile.general ?? 0}%`} />
        <Row label="VIP" value={`${profile.vip ?? 0}%`} />
        <Row label="Child" value={`${profile.child ?? 0}%`} />
        <Row label="Elderly" value={`${profile.elderly ?? 0}%`} />
        <Row label="Disabled" value={`${profile.disabled ?? 0}%`} />
        <div className="h-px bg-border/60 my-1" />
        <Row label="Solo" value={`${cat.solo ?? 0}%`} />
        <Row label="Small group" value={`${cat.small_group ?? 0}%`} />
        <Row label="Guided tour" value={`${cat.guided_tour ?? 0}%`} />
        <Row label="VIP / Expert" value={`${cat.vip_expert ?? 0}%`} />
      </Section>

      {skip && (
        <Section title="Skip Threshold">
          <Row label="Max wait" value={`${Math.round((skip.maxWaitTimeMs ?? 30000) / 1000)}s`} />
          <Row label="Multiplier" value={(skip.skipMultiplier ?? 1).toFixed(1)} />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/30 border border-border/60 p-2.5">
      <h4 className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
        {title}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-data tabular-nums">{value}</span>
    </div>
  );
}
