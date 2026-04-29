/**
 * TaskContextPanel — Build 단계 우측 패널 (300px).
 *
 * 두 모드:
 *   1) 캔버스에서 객체 선택됨 → 해당 인스펙터 (ZoneEditor / MediaEditor / WaypointInspector).
 *   2) 선택 없음 → 활성 task 별 목록 / 안내.
 *
 * BuildLayout 의 하단 inspector 자리를 대체 — 폼이 잘리지 않게 세로 스크롤.
 */

import { Square, Sparkles, GitBranch, ArrowRight, ArrowLeftRight } from 'lucide-react';
import { useStore } from '@/stores';
import { useT } from '@/i18n';
import type { WaypointType } from '@/domain';
import { ZoneEditor } from '../ZoneEditor';
import { MediaEditor } from '../MediaEditor';
import { WaypointInspector } from '../WaypointInspector';
import { RegionPanelRight } from './RegionPanelRight';

const NODE_COLORS: Record<WaypointType, string> = {
  entry: '#22c55e',
  exit: '#ef4444',
  zone: '#3b82f6',
  attractor: '#f59e0b',
  hub: '#8b5cf6',
  rest: '#f59e0b',
  bend: '#94a3b8',
  portal: '#06b6d4',
};

export type BuildTaskId = 'region' | 'zones' | 'exhibits' | 'flow';

interface Props {
  activeTask: BuildTaskId;
}

export function TaskContextPanel({ activeTask }: Props) {
  const t = useT();
  const selectedZoneId = useStore((s) => s.selectedZoneId);
  const selectedMediaId = useStore((s) => s.selectedMediaId);
  const selectedWaypointId = useStore((s) => s.selectedWaypointId);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);

  const hasSelection = !!(
    selectedZoneId || selectedMediaId || selectedWaypointId || selectedEdgeId
  );

  if (hasSelection) {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        {selectedZoneId && <ZoneEditor />}
        {selectedMediaId && <MediaEditor />}
        {(selectedWaypointId || selectedEdgeId) && <WaypointInspector />}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3">
      {activeTask === 'zones' && <ZoneList />}
      {activeTask === 'exhibits' && <ExhibitList />}
      {activeTask === 'flow' && <FlowList />}
      {activeTask === 'region' && <RegionPanelRight />}
    </div>
  );
}

// ── Zone 목록 ────────────────────────────────────────────────────
function ZoneList() {
  const t = useT();
  const zones = useStore((s) => s.zones);
  const selectZone = useStore((s) => s.selectZone);

  if (zones.length === 0) {
    return <EmptyHint text={t('build.list.zonesEmpty')} />;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-1">
        {t('build.list.zonesTitle', { n: zones.length })}
      </h3>
      <ul className="space-y-1">
        {zones.map((zone) => (
          <li key={zone.id as string}>
            <button
              type="button"
              onClick={() => selectZone(zone.id as string)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/80 transition-colors text-left"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: zone.color }}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium truncate">
                  {zone.name}
                </span>
                <span className="block text-[10px] text-muted-foreground/70 truncate">
                  {zone.type}
                </span>
              </span>
              <Square className="w-3 h-3 text-muted-foreground/40 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Exhibit 목록 (선택 zone 으로 필터, 없으면 전체) ─────────────────
function ExhibitList() {
  const t = useT();
  const media = useStore((s) => s.media);
  const zones = useStore((s) => s.zones);
  const selectMedia = useStore((s) => s.selectMedia);

  if (media.length === 0) {
    return <EmptyHint text={t('build.list.exhibitsEmpty')} />;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-1">
        {t('build.list.exhibitsTitle', { n: media.length })}
      </h3>
      <ul className="space-y-1">
        {media.map((m) => {
          const zone = zones.find((z) => (z.id as string) === (m.zoneId as string));
          return (
            <li key={m.id as string}>
              <button
                type="button"
                onClick={() => selectMedia(m.id as string)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/80 transition-colors text-left"
              >
                <Sparkles className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium truncate">
                    {m.name}
                  </span>
                  <span className="block text-[10px] text-muted-foreground/70 truncate">
                    {zone ? zone.name : '—'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Flow 목록 (노드 + 엣지) ───────────────────────────────────────
function FlowList() {
  const t = useT();
  const graph = useStore((s) => s.waypointGraph);
  const selectWaypoint = useStore((s) => s.selectWaypoint);
  const selectEdge = useStore((s) => s.selectEdge);

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];

  if (nodes.length === 0) {
    return <EmptyHint text={t('build.list.flowEmpty')} />;
  }

  const nodeById = new Map(nodes.map((n) => [n.id as string, n]));

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-1">
          {t('build.list.nodesTitle', { n: nodes.length })}
        </h3>
        <ul className="space-y-1">
          {nodes.map((n) => (
            <li key={n.id as string}>
              <button
                type="button"
                onClick={() => selectWaypoint(n.id as string)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/80 transition-colors text-left"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: NODE_COLORS[n.type] }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium truncate">
                    {n.label || n.type}
                  </span>
                  <span className="block text-[10px] text-muted-foreground/70 truncate">
                    {n.type}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-1">
          {t('build.list.edgesTitle', { n: edges.length })}
        </h3>
        {edges.length === 0 ? (
          <EmptyHint text={t('build.list.edgesEmpty')} />
        ) : (
          <ul className="space-y-1">
            {edges.map((e) => {
              const from = nodeById.get(e.fromId as string);
              const to = nodeById.get(e.toId as string);
              const Arrow = e.direction === 'bidirectional' ? ArrowLeftRight : ArrowRight;
              return (
                <li key={e.id as string}>
                  <button
                    type="button"
                    onClick={() => selectEdge(e.id as string)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/80 transition-colors text-left"
                  >
                    <GitBranch className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                    <span className="flex-1 min-w-0 flex items-center gap-1.5 text-xs">
                      <span className="truncate">{from?.label || from?.type || '?'}</span>
                      <Arrow className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                      <span className="truncate">{to?.label || to?.type || '?'}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-muted-foreground/70 leading-relaxed px-1 py-2">
      {text}
    </p>
  );
}
