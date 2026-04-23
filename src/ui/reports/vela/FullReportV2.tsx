import { useCallback, useMemo, useRef, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import { toReportData } from '@/analytics/reporting';
import { exportElementToPdf } from '../pdfExport';
import { HeroSection } from './sections/HeroSection';
import { TldrSection } from './sections/TldrSection';
import { ExecutiveSection } from './sections/ExecutiveSection';
import { DensitySection } from './sections/DensitySection';
import { TimelineSection } from './sections/TimelineSection';
import { SystemOverviewSection } from './sections/SystemOverviewSection';
import { FlowSection } from './sections/FlowSection';
import { BehaviorSection } from './sections/BehaviorSection';
import { MediaSection } from './sections/MediaSection';
import { RecosSection } from './sections/RecosSection';
import { AppendixSection } from './sections/AppendixSection';
import './vela-report.css';

export function FullReportV2({ onClose }: { onClose: () => void }) {
  const t = useT();
  const language = useStore((s) => s.language);
  const scenario = useStore((s) => s.scenario);
  const visitors = useStore((s) => s.visitors);
  const zones = useStore((s) => s.zones);
  const floors = useStore((s) => s.floors);
  const media = useStore((s) => s.media);
  const timeState = useStore((s) => s.timeState);
  const latestSnapshot = useStore((s) => s.latestSnapshot);
  const kpiHistory = useStore((s) => s.kpiHistory);
  const mediaStats = useStore((s) => s.mediaStats);
  const groups = useStore((s) => s.groups);
  const totalSpawned = useStore((s) => s.totalSpawned);
  const totalExited = useStore((s) => s.totalExited);
  const densityGrids = useStore((s) => s.densityGrids);
  const spawnByNode = useStore((s) => s.spawnByNode);
  const exitByNode = useStore((s) => s.exitByNode);
  const waypointGraph = useStore((s) => s.waypointGraph);
  const runId = useStore((s) => s.runId);

  const reportRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const data = useMemo(() => {
    if (!scenario || !latestSnapshot) return null;
    return toReportData({
      scenario, zones, media, floors, visitors, groups,
      timeState, latestSnapshot, kpiHistory, mediaStats,
      spawnByNode, exitByNode, waypointGraph,
      totalExited, runId, t,
    });
  }, [scenario, zones, media, floors, visitors, groups, timeState, latestSnapshot, kpiHistory, mediaStats, spawnByNode, exitByNode, waypointGraph, totalExited, runId, t]);

  const handleExport = useCallback(async () => {
    if (!pageRef.current || !scenario) return;
    setExporting(true);
    try {
      const safe = scenario.meta.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
      const date = new Date().toISOString().slice(0, 10);
      await exportElementToPdf(pageRef.current, `vela-report-${safe}-${date}.pdf`, {
        title: `${scenario.meta.name} — VELA Report`,
        subject: 'Spatial simulation & visitor flow analysis',
      });
    } catch (err) {
      console.error('PDF export failed', err);
      alert('PDF export failed. See console for details.');
    } finally {
      setExporting(false);
    }
  }, [scenario]);

  const hasSim = totalSpawned > 0 || visitors.length > 0;

  if (!scenario) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ padding: '80px 48px', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          {t('vela.loadScenario')}
        </div>
      </Overlay>
    );
  }

  if (!data || !hasSim) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ padding: '80px 48px', textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#0f172a' }}>{t('vela.noSimTitle')}</p>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {t('vela.noSimBody')}
          </p>
        </div>
      </Overlay>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[400] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Floating toolbar */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e4e4e7', padding: '12px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 12, color: '#71717a' }}>
          <span style={{ fontWeight: 600, color: '#18181b' }}>{scenario.meta.name}</span>
          <span style={{ margin: '0 8px' }}>·</span>
          <span>{data.meta.generated.slice(0, 10)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', fontSize: 12, fontWeight: 500,
              borderRadius: 8, background: '#2F5BFF', color: '#fff',
              border: 'none', cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.5 : 1,
            }}
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? t('vela.toolbar.exporting') : t('vela.toolbar.export')}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: 6, borderRadius: 8, background: '#f4f4f5',
              border: 'none', cursor: 'pointer', color: '#52525b',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="vela-report" ref={reportRef} data-lang={language}>
        <main className="page" ref={pageRef}>
          <div className="pdf-group">
            <HeroSection meta={data.meta} />
            <TldrSection evidence={data.evidence} headline={data.headline} />
          </div>
          <ExecutiveSection
            visitors={data.meta.visitors}
            kpis={data.kpis}
            findings={data.findings}
          />
          <DensitySection
            floors={data.floors}
            peakMoment={data.meta.peakMoment}
            fatigueP90Pct={Math.round(data.fatigueStats.p90 * 100)}
            densityGrids={densityGrids}
          />
          <TimelineSection
            timeline={data.timeline}
            peakMoment={data.meta.peakMoment}
            peakMomentMs={data.peakMomentMs}
            peakZoneLabel={data.zones.reduce((best, z) => z.utilPct > (best?.utilPct ?? -1) ? z : best, data.zones[0])?.name ?? '—'}
            peakUtilPct={Math.max(0, ...data.zones.map((z) => z.utilPct))}
            peakRanking={data.peakRanking}
          />
          <SystemOverviewSection
            system={data.system}
            zones={data.zones}
            zoneVisitLegend={data.zoneVisitLegend}
          />
          <FlowSection flow={data.flow} />
          <BehaviorSection
            behavior={data.behavior}
            fatigueHist={data.fatigueHist}
            fatigueStats={data.fatigueStats}
          />
          <MediaSection
            media={data.media}
            topMedia={data.topMedia}
            bottomMedia={data.bottomMedia}
            totals={data.mediaTotals}
          />
          <RecosSection findings={data.findings} />
          <AppendixSection glossary={data.glossary} />
        </main>
        <div className="foot">
          <span>{t('vela.foot.product')}</span>
          <span>{t('vela.foot.generated', { date: data.meta.generated })}</span>
        </div>
      </div>
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[400] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        maxWidth: 960, margin: '32px auto', background: '#fff',
        borderRadius: 16, overflow: 'hidden', border: '1px solid #e4e4e7',
      }}>
        {children}
      </div>
    </div>
  );
}
