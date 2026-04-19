import { useCallback, useRef, useState } from 'react';
import { X, Sparkles, Upload, AlertCircle, Key, Loader2 } from 'lucide-react';
import { useStore } from '@/stores';
import {
  analyzeFloorPlan, fileToBase64, getStoredApiKey, setStoredApiKey, isProxyMode,
  AIClientError,
} from '@/services/ai/anthropicClient';
import { hydrateDraft } from '@/services/ai/hydrate';
import type { DraftScenario, HydrationWarning } from '@/services/ai/types';
import type { Scenario } from '@/domain';

type Stage = 'idle' | 'analyzing' | 'review';

interface ReviewData {
  readonly scenario: Scenario;
  readonly draft: DraftScenario;
  readonly warnings: readonly HydrationWarning[];
  readonly previewUrl: string;
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
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const { scenario, warnings } = hydrateDraft(draft, previewUrl);
      setReview({ scenario, draft, warnings, previewUrl });
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

              {!isProxyMode() && (
                <button
                  onClick={() => { setApiKey(getStoredApiKey() ?? ''); setShowKeyInput(true); }}
                  className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <Key className="w-3 h-3" />
                  {getStoredApiKey() ? 'Change API key' : 'Set Anthropic API key'}
                </button>
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
                <p className="panel-label mb-2">Detected ({review.scenario.zones.length} zones · {review.scenario.media.length} media)</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {review.scenario.zones.map((z) => {
                    const mediaCount = review.scenario.media.filter((m) => m.zoneId === z.id).length;
                    return (
                      <div key={z.id as string} className="flex items-center gap-2 text-[11px]">
                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: z.color }} />
                        <span className="flex-1 truncate">{z.name}</span>
                        <span className="text-muted-foreground font-data">
                          {z.type} · {z.gates.length}g · {mediaCount}m
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {review.draft.scale?.label && (
                <div className="text-[10px] text-muted-foreground">
                  Scale: {review.draft.scale.label} → {Math.round(review.draft.scale.widthMeters)}×{Math.round(review.draft.scale.heightMeters)} m
                </div>
              )}

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
