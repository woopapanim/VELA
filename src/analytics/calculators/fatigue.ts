import type { Visitor, FatigueDistribution, FatigueBucket } from '@/domain';

export function calculateFatigueDistribution(
  visitors: readonly Visitor[],
): FatigueDistribution {
  const active = visitors.filter((v) => v.isActive);
  if (active.length === 0) {
    return {
      mean: 0, median: 0, p90: 0, p99: 0,
      histogram: createEmptyHistogram(),
    };
  }

  const fatigues = active.map((v) => v.fatigue).sort((a, b) => a - b);
  const n = fatigues.length;

  const mean = fatigues.reduce((s, f) => s + f, 0) / n;
  const median = fatigues[Math.floor(n / 2)];
  const p90 = fatigues[Math.floor(n * 0.9)];
  const p99 = fatigues[Math.min(n - 1, Math.floor(n * 0.99))];

  // Build histogram with 10 buckets
  const bucketCount = 10;
  const buckets: FatigueBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const rangeMin = i / bucketCount;
    const rangeMax = (i + 1) / bucketCount;
    const count = fatigues.filter((f) => f >= rangeMin && f < rangeMax).length;
    buckets.push({ rangeMin, rangeMax, count });
  }

  return { mean, median, p90, p99, histogram: buckets };
}

function createEmptyHistogram(): FatigueBucket[] {
  return Array.from({ length: 10 }, (_, i) => ({
    rangeMin: i / 10,
    rangeMax: (i + 1) / 10,
    count: 0,
  }));
}
