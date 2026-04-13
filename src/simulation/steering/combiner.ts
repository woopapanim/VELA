import type { SteeringOutput } from '@/domain';
import { clampMagnitude, ZERO } from '../utils/math';

export interface WeightedSteering {
  readonly output: SteeringOutput;
  readonly weight: number;
}

// Weighted blend of multiple steering outputs
export function combineSteeringOutputs(
  outputs: readonly WeightedSteering[],
  maxForce: number,
): SteeringOutput {
  if (outputs.length === 0) return { linear: ZERO, angular: 0 };

  let fx = 0;
  let fy = 0;
  let angularSum = 0;

  for (const { output, weight } of outputs) {
    fx += output.linear.x * weight;
    fy += output.linear.y * weight;
    angularSum += output.angular * weight;
  }

  const linear = clampMagnitude({ x: fx, y: fy }, maxForce);
  return { linear, angular: angularSum };
}

// Priority-based combination: higher priority forces consume budget first
export function combineSteeringPriority(
  outputs: readonly WeightedSteering[],
  maxForce: number,
): SteeringOutput {
  let fx = 0;
  let fy = 0;
  let budgetRemaining = maxForce;

  // Outputs should be sorted by priority (highest first)
  for (const { output, weight } of outputs) {
    const wx = output.linear.x * weight;
    const wy = output.linear.y * weight;
    const mag = Math.sqrt(wx * wx + wy * wy);

    if (mag <= 0.001) continue;

    if (mag <= budgetRemaining) {
      fx += wx;
      fy += wy;
      budgetRemaining -= mag;
    } else {
      // Use remaining budget proportionally
      const ratio = budgetRemaining / mag;
      fx += wx * ratio;
      fy += wy * ratio;
      budgetRemaining = 0;
      break;
    }
  }

  return { linear: { x: fx, y: fy }, angular: 0 };
}
