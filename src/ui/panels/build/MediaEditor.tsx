import { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '@/stores';
import { MEDIA_SCALE, MEDIA_SQMETER_PER_PERSON, EXHIBIT_KIND } from '@/domain';
import type {
  Vector2D,
  ArtworkProps,
  DigitalMediaProps,
  InteractiveProps,
  ArtworkSignificance,
  InteractivityLevel,
  InteractiveSessionMode,
} from '@/domain';
import { InfoTooltip } from '@/ui/components/InfoTooltip';
import { useT } from '@/i18n';

// Phase 0: 큐레이터 관점 라벨 (i18n exhibit.kind.* 키) 사용.
const CATEGORY_BADGE: Record<string, { labelKey: string; color: string }> = {
  analog: { labelKey: 'exhibit.kind.artwork', color: '#a78bfa' },
  passive_media: { labelKey: 'exhibit.kind.digital', color: '#3b82f6' },
  active: { labelKey: 'exhibit.kind.interactive', color: '#f59e0b' },
  immersive: { labelKey: 'exhibit.kind.immersive', color: '#ec4899' },
};

export function MediaEditor() {
  const selectedMediaId = useStore((s) => s.selectedMediaId);
  const media = useStore((s) => s.media);
  const updateMedia = useStore((s) => s.updateMedia);
  const removeMedia = useStore((s) => s.removeMedia);
  const phase = useStore((s) => s.phase);
  const mediaPolygonEditMode = useStore((s) => s.mediaPolygonEditMode);
  const setMediaPolygonEditMode = useStore((s) => s.setMediaPolygonEditMode);
  const t = useT();

  const m = media.find((m) => (m.id as string) === selectedMediaId);
  const isLocked = phase === 'running' || phase === 'paused';

  const handleUpdate = useCallback(
    (field: string, value: any) => {
      if (!selectedMediaId || isLocked) return;
      updateMedia(selectedMediaId, { [field]: value } as any);
    },
    [selectedMediaId, updateMedia, isLocked],
  );

  // Phase 0: nested 카테고리 속성 업데이트 (artwork/digital/interactive 의 sub-field).
  // 값이 빈 문자열/null/undefined 이면 해당 sub-field 를 제거 (default 동작 복원).
  const handleNestedUpdate = useCallback(
    (
      key: 'artwork' | 'digital' | 'interactive',
      field: string,
      value: unknown,
    ) => {
      if (!selectedMediaId || isLocked) return;
      const current = (m as any)?.[key] ?? {};
      const next = { ...current };
      if (value === undefined || value === null || value === '') {
        delete next[field];
      } else {
        next[field] = value;
      }
      // 객체가 비면 카테고리 props 자체를 undefined 로 (시나리오 파일 깨끗 유지)
      const isEmpty = Object.keys(next).length === 0;
      updateMedia(selectedMediaId, {
        [key]: isEmpty ? undefined : next,
      } as any);
    },
    [selectedMediaId, updateMedia, isLocked, m],
  );

  if (!m) return null;

  const interactionType = (m as any).interactionType || 'passive';
  const autoCapacity = Math.max(1, Math.floor(
    (m.size.width * m.size.height) / MEDIA_SQMETER_PER_PERSON
  ));

  return (
    <div data-editor="media" className="bento-box p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          {(() => {
            const cat = (m as any).category;
            const badge = CATEGORY_BADGE[cat];
            return badge ? (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-medium text-white" style={{ backgroundColor: badge.color }}>
                {t(badge.labelKey)}
              </span>
            ) : (
              <div className={`w-2 h-2 rounded-sm ${interactionType === 'active' ? 'bg-amber-400' : 'bg-blue-400'}`} />
            );
          })()}
          {t('exhibit.label')}
        </h3>
        {!isLocked && (
          <button onClick={() => removeMedia(selectedMediaId!)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="panel-label">Name</label>
        <input
          value={(m as any).name || m.type.replace(/_/g, ' ')}
          onChange={(e) => handleUpdate('name', e.target.value)}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        />
      </div>

      {/* Size (hidden for custom polygon — derived from vertices) */}
      {(m as any).shape !== 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="panel-label">Width (m)</label>
            <input type="number" step="0.5" min="0.5" max="20"
              value={m.size.width}
              onChange={(e) => handleUpdate('size', { ...m.size, width: parseFloat(e.target.value) || 1 })}
              disabled={isLocked}
              className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
            />
          </div>
          <div>
            <label className="panel-label">Height (m)</label>
            <input type="number" step="0.5" min="0.5" max="20"
              value={m.size.height}
              onChange={(e) => handleUpdate('size', { ...m.size, height: parseFloat(e.target.value) || 1 })}
              disabled={isLocked}
              className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
            />
          </div>
        </div>
      )}

      {/* Orientation */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <label className="panel-label">Orientation</label>
            <InfoTooltip text={t('tooltip.media.orientation')} />
          </div>
          <span className="text-[9px] font-data">{m.orientation}°</span>
        </div>
        <input type="range" min="0" max="315" step="45"
          value={m.orientation}
          onChange={(e) => handleUpdate('orientation', parseInt(e.target.value))}
          disabled={isLocked}
          className="w-full h-1"
        />
      </div>

      {/* Shape */}
      <div>
        <label className="panel-label">Shape</label>
        <select
          value={(m as any).shape || 'rect'}
          onChange={(e) => {
            const newShape = e.target.value;
            if (newShape === 'custom' && (m as any).shape !== 'custom') {
              // Convert rect/circle to polygon: generate 4 corners from current size
              const pw = m.size.width * MEDIA_SCALE;
              const ph = m.size.height * MEDIA_SCALE;
              const poly: Vector2D[] = [
                { x: -pw / 2, y: -ph / 2 },
                { x:  pw / 2, y: -ph / 2 },
                { x:  pw / 2, y:  ph / 2 },
                { x: -pw / 2, y:  ph / 2 },
              ];
              updateMedia(selectedMediaId!, { shape: 'custom', polygon: poly } as any);
              setMediaPolygonEditMode(true);
            } else if (newShape !== 'custom' && (m as any).shape === 'custom') {
              // Convert polygon back to rect/circle: derive size from polygon AABB
              const poly = m.polygon;
              if (poly && poly.length > 2) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const p of poly) {
                  if (p.x < minX) minX = p.x;
                  if (p.y < minY) minY = p.y;
                  if (p.x > maxX) maxX = p.x;
                  if (p.y > maxY) maxY = p.y;
                }
                const w = Math.max(0.5, (maxX - minX) / MEDIA_SCALE);
                const h = Math.max(0.5, (maxY - minY) / MEDIA_SCALE);
                updateMedia(selectedMediaId!, { shape: newShape, polygon: undefined, size: { width: w, height: h } } as any);
              } else {
                updateMedia(selectedMediaId!, { shape: newShape, polygon: undefined } as any);
              }
              setMediaPolygonEditMode(false);
            } else {
              handleUpdate('shape', newShape);
            }
          }}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        >
          <option value="rect">Rectangle</option>
          <option value="circle">Circle</option>
          <option value="ellipse">Ellipse</option>
          <option value="custom">Polygon</option>
        </select>
      </div>

      {/* Polygon edit mode toggle */}
      {(m as any).shape === 'custom' && !isLocked && (
        <button
          onClick={() => setMediaPolygonEditMode(!mediaPolygonEditMode)}
          className={`w-full px-2 py-1 text-[10px] rounded-lg border transition-colors ${
            mediaPolygonEditMode
              ? 'bg-green-500/20 border-green-500/40 text-green-400'
              : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {mediaPolygonEditMode ? t('editor.shape.done') : t('editor.shape.edit')}
        </button>
      )}

      {/* Interaction Type */}
      <div>
        <div className="flex items-center gap-1">
          <label className="panel-label">Interaction</label>
          <InfoTooltip text={t('tooltip.media.interaction')} />
        </div>
        <select
          value={interactionType}
          onChange={(e) => handleUpdate('interactionType', e.target.value)}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        >
          <option value="passive">Passive</option>
          <option value="active">Active</option>
          <option value="staged">Staged</option>
          <option value="analog">Analog</option>
        </select>
      </div>

      {/* Omnidirectional */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <label className="panel-label">Omnidirectional</label>
          <InfoTooltip text={t('tooltip.media.omnidirectional')} />
        </div>
        <button
          onClick={() => handleUpdate('omnidirectional', !(m as any).omnidirectional)}
          disabled={isLocked}
          className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${
            (m as any).omnidirectional ? 'bg-violet-500/20 text-violet-400' : 'bg-secondary text-muted-foreground'
          }`}
        >
          {(m as any).omnidirectional ? '360°' : 'Front'}
        </button>
      </div>

      {/* Stage Interval (staged only) */}
      {interactionType === 'staged' && (
        <div>
          <div className="flex items-center gap-1">
            <label className="panel-label">Session Interval (s)</label>
            <InfoTooltip text={t('tooltip.media.stageInterval')} />
          </div>
          <input type="number" step="10" min="10"
            value={Math.round(((m as any).stageIntervalMs ?? 60000) / 1000)}
            onChange={(e) => handleUpdate('stageIntervalMs', (parseInt(e.target.value) || 60) * 1000)}
            disabled={isLocked}
            className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
          />
        </div>
      )}

      {/* Capacity (not for analog) */}
      {interactionType !== 'analog' && (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="flex items-center gap-1">
            <label className="panel-label">Capacity</label>
            <InfoTooltip text={t('tooltip.media.capacity')} />
          </div>
          <input type="number" min="1" max="200"
            value={m.capacity}
            onChange={(e) => handleUpdate('capacity', parseInt(e.target.value) || 1)}
            disabled={isLocked}
            className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
          />
        </div>
        <div>
          <label className="panel-label">Auto Cap</label>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] font-data text-muted-foreground">{autoCapacity}</span>
            {!isLocked && (
              <button onClick={() => handleUpdate('capacity', autoCapacity)}
                className="text-[8px] text-primary hover:underline">Apply</button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Engagement Time */}
      <div>
        <div className="flex items-center gap-1">
          <label className="panel-label">Engagement (s)</label>
          <InfoTooltip text={t('tooltip.media.engagement')} />
        </div>
        <input type="number" step="5" min="1"
          value={Math.round(m.avgEngagementTimeMs / 1000)}
          onChange={(e) => handleUpdate('avgEngagementTimeMs', (parseInt(e.target.value) || 10) * 1000)}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        />
      </div>

      {/* View Distance (passive only) */}
      {interactionType === 'passive' && (
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <label className="panel-label">View Distance (m)</label>
            <InfoTooltip text={t('tooltip.media.viewDistance')} />
          </div>
          <span className="text-[9px] font-data">{((m as any).viewDistance ?? 2.0).toFixed(1)}m</span>
        </div>
        <input type="range" min="0.5" max="10" step="0.5"
          value={(m as any).viewDistance ?? 2.0}
          onChange={(e) => handleUpdate('viewDistance', parseFloat(e.target.value))}
          disabled={isLocked}
          className="w-full h-1"
        />
      </div>
      )}

      {/* Attractiveness */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <label className="panel-label">Attractiveness</label>
            <InfoTooltip text={t('tooltip.media.attractiveness')} />
          </div>
          <span className="text-[9px] font-data">{m.attractiveness.toFixed(1)}</span>
        </div>
        <input type="range" min="0" max="1" step="0.1"
          value={m.attractiveness}
          onChange={(e) => handleUpdate('attractiveness', parseFloat(e.target.value))}
          disabled={isLocked}
          className="w-full h-1"
        />
      </div>

      {/* Must-visit (hero exhibit) — forces visit regardless of fatigue */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <label className="panel-label">Must Visit</label>
          <InfoTooltip text="히어로 전시 — 모든 관람객이 반드시 관람. skip·대기 포기 로직 무시. 체류는 프로필×피로에 따라 단축." />
        </div>
        <button
          onClick={() => handleUpdate('mustVisit', !(m as any).mustVisit)}
          disabled={isLocked}
          className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${
            (m as any).mustVisit
              ? 'bg-amber-500/20 text-amber-400 font-semibold'
              : 'bg-secondary text-muted-foreground'
          } disabled:opacity-50`}
        >
          {(m as any).mustVisit ? '★ Hero' : 'Off'}
        </button>
      </div>

      {/* Queue Behavior (not for analog) */}
      {interactionType !== 'analog' && (
      <div>
        <div className="flex items-center gap-1">
          <label className="panel-label">Queue Behavior</label>
          <InfoTooltip text={t('tooltip.media.queueBehavior')} />
        </div>
        <select
          value={(m as any).queueBehavior || 'none'}
          onChange={(e) => handleUpdate('queueBehavior', e.target.value)}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        >
          <option value="none">None</option>
          <option value="linear">Linear</option>
          <option value="area">Area</option>
        </select>
      </div>
      )}

      {/* Group Friendly */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <label className="panel-label">Group Friendly</label>
          <InfoTooltip text={t('tooltip.media.groupFriendly')} />
        </div>
        <button
          onClick={() => handleUpdate('groupFriendly', !(m as any).groupFriendly)}
          disabled={isLocked}
          className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${
            (m as any).groupFriendly ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'
          }`}
        >
          {(m as any).groupFriendly ? 'Yes' : 'No'}
        </button>
      </div>

      {/* ── Phase 0: 카테고리별 큐레이션 속성 ───────────── */}
      <CategoryProps
        category={(m as any).category}
        artwork={(m as any).artwork as ArtworkProps | undefined}
        digital={(m as any).digital as DigitalMediaProps | undefined}
        interactive={(m as any).interactive as InteractiveProps | undefined}
        onArtworkChange={(field, value) => handleNestedUpdate('artwork', field, value)}
        onDigitalChange={(field, value) => handleNestedUpdate('digital', field, value)}
        onInteractiveChange={(field, value) => handleNestedUpdate('interactive', field, value)}
        isLocked={isLocked}
        t={t}
      />
    </div>
  );
}

// ── Phase 0: 카테고리별 입력 섹션 ──────────────────────────
// EXHIBIT_KIND 분기로 작품/디지털/인터랙티브/이머시브 각각의 큐레이션 속성을 입력.
// Immersive 는 본 Phase 에서 별도 UI 없이 Digital props 활용 (spec Phase 3B 결정).

interface CategoryPropsProps {
  category: string;
  artwork?: ArtworkProps;
  digital?: DigitalMediaProps;
  interactive?: InteractiveProps;
  onArtworkChange: (field: string, value: unknown) => void;
  onDigitalChange: (field: string, value: unknown) => void;
  onInteractiveChange: (field: string, value: unknown) => void;
  isLocked: boolean;
  t: (key: string) => string;
}

function CategoryProps({
  category,
  artwork,
  digital,
  interactive,
  onArtworkChange,
  onDigitalChange,
  onInteractiveChange,
  isLocked,
  t,
}: CategoryPropsProps) {
  if (category === EXHIBIT_KIND.ARTWORK) {
    return (
      <ArtworkSection
        props={artwork}
        onChange={onArtworkChange}
        isLocked={isLocked}
        t={t}
      />
    );
  }
  if (category === EXHIBIT_KIND.DIGITAL || category === EXHIBIT_KIND.IMMERSIVE) {
    return (
      <DigitalMediaSection
        props={digital}
        onChange={onDigitalChange}
        isLocked={isLocked}
        t={t}
      />
    );
  }
  if (category === EXHIBIT_KIND.INTERACTIVE) {
    return (
      <InteractiveSection
        props={interactive}
        onChange={onInteractiveChange}
        isLocked={isLocked}
        t={t}
      />
    );
  }
  return null;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="pt-2 mt-2 border-t border-border/40">
      <h4 className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </h4>
    </div>
  );
}

function ArtworkSection({
  props,
  onChange,
  isLocked,
  t,
}: {
  props?: ArtworkProps;
  onChange: (field: string, value: unknown) => void;
  isLocked: boolean;
  t: (key: string) => string;
}) {
  const sig = props?.significance;
  const SIG_OPTIONS: Array<{ value: ArtworkSignificance; labelKey: string; color: string }> = [
    { value: 'context', labelKey: 'exhibit.artwork.significance.context', color: 'bg-secondary text-muted-foreground' },
    { value: 'support', labelKey: 'exhibit.artwork.significance.support', color: 'bg-blue-500/20 text-blue-400' },
    { value: 'hero',    labelKey: 'exhibit.artwork.significance.hero',    color: 'bg-amber-500/30 text-amber-300 font-semibold' },
  ];

  return (
    <>
      <SectionHeader label={t('exhibit.artwork.section')} />

      {/* Series */}
      <div>
        <label className="panel-label">{t('exhibit.artwork.series')}</label>
        <input
          value={props?.series ?? ''}
          onChange={(e) => onChange('series', e.target.value)}
          disabled={isLocked}
          placeholder={t('exhibit.artwork.series.placeholder')}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        />
      </div>

      {/* Curatorial Order */}
      <div>
        <div className="flex items-center gap-1">
          <label className="panel-label">{t('exhibit.artwork.curatorialOrder')}</label>
          <InfoTooltip text={t('exhibit.artwork.curatorialOrder.hint')} />
        </div>
        <input
          type="number"
          min={1}
          step={1}
          value={props?.curatorialOrder ?? ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onChange('curatorialOrder', Number.isFinite(v) && v > 0 ? v : undefined);
          }}
          disabled={isLocked || !props?.series}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        />
        {!props?.series && (
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {t('exhibit.artwork.series')} →
          </p>
        )}
      </div>

      {/* Significance */}
      <div>
        <div className="flex items-center gap-1">
          <label className="panel-label">{t('exhibit.artwork.significance')}</label>
          <InfoTooltip text={t('exhibit.artwork.significance.hint')} />
        </div>
        <div className="flex gap-1 mt-0.5">
          {SIG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange('significance', sig === opt.value ? undefined : opt.value)}
              disabled={isLocked}
              className={`flex-1 px-1 py-1 text-[9px] rounded-lg transition-colors ${
                sig === opt.value ? opt.color : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              } disabled:opacity-50`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function DigitalMediaSection({
  props,
  onChange,
  isLocked,
  t,
}: {
  props?: DigitalMediaProps;
  onChange: (field: string, value: unknown) => void;
  isLocked: boolean;
  t: (key: string) => string;
}) {
  const contentSec = props?.contentDurationMs ? Math.round(props.contentDurationMs / 1000) : '';
  const minWatchSec = props?.minWatchMs ? Math.round(props.minWatchMs / 1000) : '';

  // 의미있는 체험이 컨텐츠 길이의 20% 이하면 경고
  const showShortMinWatchWarning =
    typeof contentSec === 'number' &&
    typeof minWatchSec === 'number' &&
    contentSec > 0 &&
    minWatchSec / contentSec < 0.2;

  const INTERACTIVITY_OPTIONS: Array<{ value: InteractivityLevel; labelKey: string }> = [
    { value: 'view-only', labelKey: 'exhibit.digital.interactivityLevel.viewOnly' },
    { value: 'chapter-select', labelKey: 'exhibit.digital.interactivityLevel.chapterSelect' },
    { value: 'full-interactive', labelKey: 'exhibit.digital.interactivityLevel.fullInteractive' },
  ];

  return (
    <>
      <SectionHeader label={t('exhibit.digital.section')} />

      {/* Content Duration */}
      <div>
        <div className="flex items-center gap-1">
          <label className="panel-label">{t('exhibit.digital.contentDuration')} (s)</label>
          <InfoTooltip text={t('exhibit.digital.contentDuration.hint')} />
        </div>
        <input
          type="number"
          min={0}
          step={5}
          value={contentSec}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onChange('contentDurationMs', Number.isFinite(v) && v > 0 ? v * 1000 : undefined);
          }}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        />
      </div>

      {/* Minimum Meaningful Watch */}
      <div>
        <div className="flex items-center gap-1">
          <label className="panel-label">{t('exhibit.digital.minWatch')} (s)</label>
          <InfoTooltip text={t('exhibit.digital.minWatch.hint')} />
        </div>
        <input
          type="number"
          min={0}
          step={5}
          value={minWatchSec}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onChange('minWatchMs', Number.isFinite(v) && v > 0 ? v * 1000 : undefined);
          }}
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        />
        {showShortMinWatchWarning && (
          <p className="text-[9px] text-amber-400 mt-0.5">
            ⚠ {t('exhibit.digital.warning.shortMinWatch')}
          </p>
        )}
      </div>

      {/* Loopable */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <label className="panel-label">{t('exhibit.digital.loopable')}</label>
          <InfoTooltip text={t('exhibit.digital.loopable.hint')} />
        </div>
        <button
          onClick={() => onChange('loopable', !props?.loopable)}
          disabled={isLocked}
          className={`px-2 py-0.5 text-[9px] rounded-full transition-colors ${
            props?.loopable ? 'bg-blue-500/20 text-blue-400' : 'bg-secondary text-muted-foreground'
          } disabled:opacity-50`}
        >
          {props?.loopable ? 'On' : 'Off'}
        </button>
      </div>

      {/* Interactivity Level */}
      <div>
        <label className="panel-label">{t('exhibit.digital.interactivityLevel')}</label>
        <select
          value={props?.interactivityLevel ?? 'view-only'}
          onChange={(e) =>
            onChange(
              'interactivityLevel',
              e.target.value === 'view-only' ? undefined : e.target.value,
            )
          }
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        >
          {INTERACTIVITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function InteractiveSection({
  props,
  onChange,
  isLocked,
  t,
}: {
  props?: InteractiveProps;
  onChange: (field: string, value: unknown) => void;
  isLocked: boolean;
  t: (key: string) => string;
}) {
  const SESSION_OPTIONS: Array<{ value: InteractiveSessionMode; labelKey: string }> = [
    { value: 'free',  labelKey: 'exhibit.interactive.sessionMode.free' },
    { value: 'queue', labelKey: 'exhibit.interactive.sessionMode.queue' },
    { value: 'slot',  labelKey: 'exhibit.interactive.sessionMode.slot' },
  ];

  return (
    <>
      <SectionHeader label={t('exhibit.interactive.section')} />

      {/* Session Mode */}
      <div>
        <label className="panel-label">{t('exhibit.interactive.sessionMode')}</label>
        <select
          value={props?.sessionMode ?? 'free'}
          onChange={(e) =>
            onChange('sessionMode', e.target.value === 'free' ? undefined : e.target.value)
          }
          disabled={isLocked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg bg-secondary border border-border disabled:opacity-50"
        >
          {SESSION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
