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
  type ChartOptions,
} from 'chart.js';
import { useStore } from '@/stores';
import { useTheme } from '@/ui/components/ThemeProvider';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

export function TrendChart() {
  const kpiHistory = useStore((s) => s.kpiHistory);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const data = useMemo(() => {
    // Sample every 5th entry to keep chart performant
    const sampled = kpiHistory.filter((_, i) => i % 5 === 0).slice(-60);

    const labels = sampled.map((e) => {
      const s = Math.floor(e.timestamp / 1000);
      const m = Math.floor(s / 60);
      return `${m}:${String(s % 60).padStart(2, '0')}`;
    });

    const utilization = sampled.map((e) => {
      const maxUtil = Math.max(...e.snapshot.zoneUtilizations.map((u) => u.ratio), 0);
      return Math.round(maxUtil * 100);
    });

    const fatigue = sampled.map((e) =>
      Math.round(e.snapshot.fatigueDistribution.mean * 100),
    );

    const visitors = sampled.map((e) =>
      e.snapshot.zoneUtilizations.reduce((sum, u) => sum + u.currentOccupancy, 0),
    );

    return {
      labels,
      datasets: [
        {
          label: 'Peak Utilization %',
          data: utilization,
          borderColor: isDark ? '#f87171' : '#ef4444',
          backgroundColor: isDark ? 'rgba(248,113,113,0.1)' : 'rgba(239,68,68,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: 'Avg Fatigue %',
          data: fatigue,
          borderColor: isDark ? '#fbbf24' : '#f59e0b',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: 'Active Visitors',
          data: visitors,
          borderColor: isDark ? '#60a5fa' : '#3b82f6',
          backgroundColor: isDark ? 'rgba(96,165,250,0.08)' : 'rgba(59,130,246,0.06)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
          yAxisID: 'y1',
        },
      ],
    };
  }, [kpiHistory, isDark]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        tooltip: {
          backgroundColor: isDark ? '#1f1f23' : '#ffffff',
          titleColor: isDark ? '#fafafa' : '#18181b',
          bodyColor: isDark ? '#a1a1aa' : '#71717a',
          borderColor: isDark ? '#27272a' : '#e4e4e7',
          borderWidth: 1,
          padding: 8,
          bodyFont: { family: "'JetBrains Mono', monospace", size: 10 },
          titleFont: { family: "'Inter', sans-serif", size: 11 },
        },
      },
      scales: {
        x: {
          display: true,
          ticks: {
            color: isDark ? '#52525b' : '#a1a1aa',
            font: { size: 9, family: "'JetBrains Mono', monospace" },
            maxTicksLimit: 8,
          },
          grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        },
        y: {
          display: true,
          position: 'left',
          beginAtZero: true,
          ticks: {
            color: isDark ? '#52525b' : '#a1a1aa',
            font: { size: 9, family: "'JetBrains Mono', monospace" },
          },
          grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        },
        y1: {
          display: true,
          position: 'right',
          min: 0,
          ticks: {
            color: isDark ? '#3b82f680' : '#3b82f680',
            font: { size: 9, family: "'JetBrains Mono', monospace" },
          },
          grid: { display: false },
        },
      },
    }),
    [isDark],
  );

  if (kpiHistory.length < 3) return null;

  return (
    <div className="bento-box p-4">
      <h2 className="panel-section mb-3">
        Trend
      </h2>
      <div className="h-36">
        <Line data={data} options={options} />
      </div>
      <div className="flex justify-center gap-4 mt-2">
        <LegendDot color={isDark ? '#f87171' : '#ef4444'} label="Peak Util %" />
        <LegendDot color={isDark ? '#fbbf24' : '#f59e0b'} label="Fatigue %" />
        <LegendDot color={isDark ? '#60a5fa' : '#3b82f6'} label="Visitors" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}
