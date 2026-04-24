import { useCallback, useRef, useState } from 'react';
import { X, Sparkles, Upload, AlertCircle, Key, Loader2, Ruler, FlaskConical, Scan } from 'lucide-react';
import { useStore } from '@/stores';
import {
  analyzeFloorPlan, fileToBase64, getStoredApiKey, setStoredApiKey, isProxyMode,
  AIClientError,
} from '@/services/ai/anthropicClient';
import { hydrateDraft, rescaleDraft } from '@/services/ai/hydrate';
import type { DraftScale, DraftScenario, HydrationWarning } from '@/services/ai/types';
import { SAMPLE_FIXTURES, SAMPLE_IMAGE_NATURAL, SAMPLE_IMAGE_PATH } from '@/services/ai/sampleDraft';
import { detectRooms, type DetectionResult } from '@/services/cv/roomDetector';
import type { Scenario } from '@/domain';
import { ScaleCalibrator } from './ScaleCalibrator';
import { CvRoomPreview } from './CvRoomPreview';

type Stage = 'idle' | 'analyzing' | 'review' | 'calibrating' | 'cv_review';

function measureImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to measure image.'));
    img.src = url;
  });
}

interface ReviewData {
  readonly scenario: Scenario;
  readonly draft: DraftScenario;
  readonly warnings: readonly HydrationWarning[];
  readonly previewUrl: string;
  readonly imageSize: { readonly width: number; readonly height: number };
}

export function AnalyzeFloorPlan({
  onClose, onLoaded,
}: { onClose: () => void; onLoaded: () => void }) {
  const setScenario = useStore((s) => s.setScenario);
  const [stage, setStage] = useState<Stage>('idle');
  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey() ?? '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<string>('');
  const [review, setReview] = useState<ReviewData | null>(null);
  const [cvData, setCvData] = useState<{ file: File; previewUrl: string; result: DetectionResult } | null>(null);
  const [boostingWithAi, setBoostingWithAi] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cvFileRef = useRef<HTMLInputElement>(null);

  const needsKey = !isProxyMode() && !getStoredApiKey();

  const runAnalysis = useCallback(async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Upload a JPG or PNG floor plan image.');
      return;
    }
    if (needsKey) {
      setShowKeyInput(true);
      return;
    }
    setStage('analyzing');
    setProgress('Reading image...');
    const previewUrl = URL.createObjectURL(file);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      setProgress('Analyzing with Claude Vision — this takes 10-30 seconds...');
      const draft = await analyzeFloorPlan(base64, mediaType);
      setProgress('Building scenario...');
      const imageSize = await measureImage(previewUrl);
      const { scenario, warnings } = hydrateDraft(draft, previewUrl, imageSize);
      setReview({ scenario, draft, warnings, previewUrl, imageSize });
      setStage('review');
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      const msg = err instanceof AIClientError ? err.message : err instanceof Error ? err.message : String(err);
      setError(msg);
      setStage('idle');
    }
  }, [needsKey]);

  const onFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) runAnalysis(file);
  }, [runAnalysis]);

  const runCvOnly = useCallback(async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Upload a JPG or PNG floor plan image.');
      return;
    }
    setStage('analyzing');
    setProgress('Running CV room detection...');
    const previewUrl = URL.createObjectURL(file);
    try {
      const result = await detectRooms(previewUrl, { onProgress: setProgress });
      setCvData({ file, previewUrl, result });
      setStage('cv_review');
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      setError(err instanceof Error ? err.message : String(err));
      setStage('idle');
    }
  }, []);

  const onCvFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) runCvOnly(file);
  }, [runCvOnly]);

  /**
   * Escalation path from the CV preview: re-encode the stored file and run
   * the full Claude Vision flow. Re-uses everything from runAnalysis — same
   * prompt, same hydration, same review UI — so the user lands on the same
   * "Detected N zones" screen they would have gotten from the direct AI path.
   * On error we stay in cv_review so the CV rects are still visible.
   */
  const boostWithAi = useCallback(async () => {
    if (!cvData) return;
    setError('');
    if (needsKey) {
      setShowKeyInput(true);
      return;
    }
    setBoostingWithAi(true);
    setProgress('Analyzing with Claude Vision — this takes 10-30 seconds...');
    try {
      const { base64, mediaType } = await fileToBase64(cvData.file);
      const draft = await analyzeFloorPlan(base64, mediaType);
      setProgress('Building scenario...');
      const imageSize = await measureImage(cvData.previewUrl);
      const { scenario, warnings } = hydrateDraft(draft, cvData.previewUrl, imageSize);
      // Transfer previewUrl ownership from cvData → review. Don't revoke —
      // hydrated scenario uses it as the editor background.
      setReview({ scenario, draft, warnings, previewUrl: cvData.previewUrl, imageSize });
      setCvData(null);
      setStage('review');
    } catch (err) {
      const msg = err instanceof AIClientError ? err.message : err instanceof Error ? err.message : String(err);
      setError(msg);
      // Stay in cv_review so the user can retry or go back.
    } finally {
      setBoostingWithAi(false);
      setProgress('');
    }
  }, [cvData, needsKey]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runAnalysis(file);
  }, [runAnalysis]);

  const saveKey = useCallback(() => {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith('sk-')) {
      setError('API key should start with "sk-". Copy it from console.anthropic.com.');
      return;
    }
    setStoredApiKey(trimmed);
    setShowKeyInput(false);
    setError('');
  }, [apiKey]);

  const load = useCallback(() => {
    if (!review) return;
    setScenario(review.scenario);
    onLoaded();
  }, [review, setScenario, onLoaded]);

  const loadSample = useCallback((fixtureId?: string) => {
    setError('');
    const fx = SAMPLE_FIXTURES.find((f) => f.id === fixtureId) ?? SAMPLE_FIXTURES[0];
    const { scenario, warnings } = hydrateDraft(fx.draft, SAMPLE_IMAGE_PATH, {
      width: SAMPLE_IMAGE_NATURAL.width,
      height: SAMPLE_IMAGE_NATURAL.height,
    });
    setReview({
      scenario,
      draft: fx.draft,
      warnings,
      previewUrl: SAMPLE_IMAGE_PATH,
      imageSize: { width: SAMPLE_IMAGE_NATURAL.width, height: SAMPLE_IMAGE_NATURAL.height },
    });
    setStage('review');
  }, []);

  const applyCalibration = useCallback((scale: DraftScale) => {
    if (!review) return;
    const rescaled = rescaleDraft(review.draft, scale);
    const { scenario, warnings } = hydrateDraft(rescaled, review.previewUrl, review.imageSize);
    setReview({
      scenario,
      draft: rescaled,
      warnings,
      previewUrl: review.previewUrl,
      imageSize: review.imageSize,
    });
    setStage('review');
  }, [review]);

  return (
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="glass rounded-2xl border border-border shadow-2xl w-[560px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-primary/10 px-6 py-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Analyze Floor Plan</h2>
              <p className="text-[10px] text-muted-foreground">AI-powered layout generation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {stage === 'idle' && !showKeyInput && (
            <>
              <div
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => fileRef.current?.click()}
                style={{ cursor: 'pointer' }}
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Drop floor plan image here</p>
                <p className="text-[11px] text-muted-foreground">or click to upload (JPG, PNG)</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFilePick}
              />

              <div className="mt-5 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
                <p>• Plans with labeled rooms and dimensions work best.</p>
                <p>• Visible equipment (chairs, kiosks, screens) becomes media.</p>
                <p>• Output is editable — the AI produces a starting layout, you refine it.</p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                {!isProxyMode() && (
                  <button
                    onClick={() => { setApiKey(getStoredApiKey() ?? ''); setShowKeyInput(true); }}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <Key className="w-3 h-3" />
                    {getStoredApiKey() ? 'Change API key' : 'Set Anthropic API key'}
                  </button>
                )}
                {import.meta.env.DEV && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <FlaskConical className="w-3 h-3 text-primary/80" />
                    <span className="text-[10px] text-muted-foreground">Sample:</span>
                    {SAMPLE_FIXTURES.map((fx) => (
                      <button
                        key={fx.id}
                        onClick={() => loadSample(fx.id)}
                        className="text-[11px] text-primary/80 hover:text-primary underline-offset-2 hover:underline"
                        title={fx.label}
                      >
                        {fx.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {import.meta.env.DEV && (
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Scan className="w-3 h-3" />
                    <span>CV first (AI boost optional)</span>
                  </div>
                  <button
                    onClick={() => cvFileRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-secondary hover:bg-accent text-foreground"
                  >
                    Detect rooms
                  </button>
                  <input
                    ref={cvFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onCvFilePick}
                  />
                </div>
              )}
            </>
          )}

          {showKeyInput && (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">Anthropic API key</p>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Stored in your browser only. Get one at{' '}
                  <span className="font-data">console.anthropic.com</span>.
                </p>
              </div>
              <input
                autoFocus
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full px-3 py-2.5 text-sm font-data rounded-xl bg-secondary border border-border focus:border-primary focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveKey}
                  disabled={!apiKey.trim()}
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowKeyInput(false); setError(''); }}
                  className="px-4 py-2.5 text-sm rounded-xl bg-secondary hover:bg-accent"
                >
                  Cancel
                </button>
                {getStoredApiKey() && (
                  <button
                    onClick={() => { setStoredApiKey(null); setApiKey(''); }}
                    className="px-4 py-2.5 text-sm rounded-xl bg-secondary hover:bg-accent text-muted-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                ⚠ Your key is sent directly from the browser to Anthropic. For shared deployments use the SaaS proxy.
              </p>
            </div>
          )}

          {stage === 'analyzing' && (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium mb-1">{progress || 'Analyzing...'}</p>
              <p className="text-[11px] text-muted-foreground">Using Claude Opus 4.7 Vision</p>
            </div>
          )}

          {stage === 'review' && review && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-border bg-black/20">
                <img src={review.previewUrl} alt="Floor plan" className="w-full max-h-48 object-contain" />
              </div>

              <div>
                <p className="panel-label mb-2">
                  Detected ({review.scenario.zones.length} zones)
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {review.scenario.zones.map((z) => (
                    <div key={z.id as string} className="flex items-center gap-2 text-[11px]">
                      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: z.color }} />
                      <span className="flex-1 truncate">{z.name}</span>
                      <span className="text-muted-foreground font-data">{z.type}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                  Media, waypoint nodes, and edges are not generated — add them in the editor over the background image.
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] text-muted-foreground flex-1 min-w-0 space-y-0.5">
                  {review.draft.scale?.label ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>
                        Scale: {review.draft.scale.label} → {Math.round(review.draft.scale.widthMeters)}×{Math.round(review.draft.scale.heightMeters)} m
                      </span>
                      {review.draft.scale.confidence && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide font-data ${
                            review.draft.scale.confidence === 'measured' ? 'bg-emerald-500/20 text-emerald-400'
                            : review.draft.scale.confidence === 'inferred' ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {review.draft.scale.confidence}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div>Scale: not detected</div>
                  )}
                  {review.draft.scale?.evidence && (
                    <div className="text-[9px] italic leading-tight truncate">
                      Evidence: {review.draft.scale.evidence}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setStage('calibrating')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-secondary hover:bg-accent text-foreground shrink-0"
                >
                  <Ruler className="w-3 h-3" />
                  Recalibrate
                </button>
              </div>

              {review.warnings.length > 0 && (
                <div className="rounded-xl bg-secondary/50 p-3 space-y-1">
                  <p className="panel-label mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> Warnings
                  </p>
                  {review.warnings.map((w, i) => (
                    <p key={i} className={`text-[10px] leading-relaxed ${
                      w.severity === 'error' ? 'text-red-400'
                      : w.severity === 'warning' ? 'text-yellow-400'
                      : 'text-muted-foreground'
                    }`}>
                      • {w.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={load}
                  disabled={review.scenario.zones.length === 0}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  Load into editor
                </button>
                <button
                  onClick={() => { setReview(null); setStage('idle'); }}
                  className="px-4 py-2.5 text-sm rounded-xl bg-secondary hover:bg-accent"
                >
                  Try another
                </button>
              </div>
            </div>
          )}

          {stage === 'calibrating' && review && (
            <ScaleCalibrator
              imageUrl={review.previewUrl}
              imageSize={review.imageSize}
              current={review.draft.scale ?? { label: '', widthMeters: 20, heightMeters: 15 }}
              onApply={applyCalibration}
              onCancel={() => setStage('review')}
            />
          )}

          {stage === 'cv_review' && cvData && (
            <CvRoomPreview
              imageUrl={cvData.previewUrl}
              result={cvData.result}
              onBack={() => {
                URL.revokeObjectURL(cvData.previewUrl);
                setCvData(null);
                setStage('idle');
              }}
              onBoostWithAi={boostWithAi}
              isBoostingWithAi={boostingWithAi}
            />
          )}

          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-[11px] text-red-400 leading-relaxed">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
