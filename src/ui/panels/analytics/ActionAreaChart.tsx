import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js';
import { useStore } from '@/stores';
import { useTheme } from '@/ui/components/ThemeProvider';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

export function ActionAreaChart() {
  const kpiHistory = useStore((s) => s.kpiHistory);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const data = useMemo(() => {
    const sampled = kpiHistory.filter((_, i) => i % 5 === 0).slice(-40);
    if (sampled.length < 3) return null;

    const labels = sampled.map((e) => {
      const s = Math.floor(e.timestamp / 1000);
      const m = Math.floor(s / 60);
      return `${m}:${String(s % 60).padStart(2, '0')}`;
    });

    // Count actions from zone utilizations (we don't have per-action history,
    // so we use visitor count proxy)
    const totalVisitors = sampled.map((e) =>
      e.snapshot.zoneUtilizations.reduce((s, u) => s + u.currentOccupancy, 0),
    );

    const fatigueP90 = sampled.map((e) =>
      Math.round(e.snapshot.fatigueDistribution.p90 * 100),
    );

    const bottleneckZones = sampled.map((e) =>
      e.snapshot.bottlenecks.filter((b) => b.score > 0.5).length,
    );

    return {
      labels,
      datasets: [
        {
          label: 'Active Visitors',
          data: totalVisitors,
          borderColor: isDark ? '#60a5fa' : '#3b82f6',
          backgroundColor: isDark ? 'rgba(96,165,250,0.15)' : 'rgba(59,130,246,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: 'Fatigue P90 %',
          data: fatigueP90,
          borderColor: isDark ? '#fbbf24' : '#f59e0b',
          backgroundColor: isDark ? 'rgba(251,191,36,0.1)' : 'rgba(245,158,11,0.06)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
          yAxisID: 'y1',
        },
        {
          label: 'Bottleneck Zones',
          data: bottleneckZones,
          borderColor: isDark ? '#f87171' : '#ef4444',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [4, 4],
          yAxisID: 'y1',
        },
      ],
    };
  }, [kpiHistory, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      tooltip: {
        backgroundColor: isDark ? '#1f1f23' : '#ffffff',
        titleColor: isDark ? '#fafafa' : '#18181b',
        bodyColor: isDark ? '#a1a1aa' : '#71717a',
        borderColor: isDark ? '#27272a' : '#e4e4e7',
        borderWidth: 1,
        padding: 8,
        bodyFont: { family: "'JetBrains Mono', monospace", size: 10 },
      },
    },
    scales: {
      x: {
        ticks: { color: isDark ? '#52525b' : '#a1a1aa', font: { size: 8 }, maxTicksLimit: 6 },
        grid: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' },
      },
      y: {
        position: 'left' as const,
        ticks: { color: isDark ? '#52525b' : '#a1a1aa', font: { size: 8 } },
        grid: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' },
      },
      y1: {
        position: 'right' as const,
        min: 0,
        max: 120,
        ticks: { color: isDark ? '#52525b40' : '#a1a1aa40', font: { size: 8 } },
        grid: { display: false },
      },
    },
  }), [isDark]);

  if (!data) return null;

  return (
    <div className="bento-box p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Simulation Timeline
      </h2>
      <div className="h-32">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
