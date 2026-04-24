import type { DraftScenario } from './types';
import { SYSTEM_PROMPT, EMIT_SCENARIO_TOOL, USER_MESSAGE_TEXT } from './prompt';

const API_KEY_STORAGE = 'vela-anthropic-key';
const API_MODEL = 'claude-opus-4-7';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/** Injected at build time. When set, client calls the SaaS proxy instead of Anthropic directly. */
const PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL as string | undefined) || null;

export class AIClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AIClientError';
  }
}

export function getStoredApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setStoredApiKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key);
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    // localStorage unavailable (private mode) — caller handles
  }
}

export function isProxyMode(): boolean {
  return !!PROXY_URL;
}

/**
 * Analyze a floor plan image and return a DraftScenario.
 *
 * MVP: browser → Anthropic directly, using user-supplied API key.
 * SaaS: set VITE_AI_PROXY_URL at build time — the request then hits your
 * backend which holds the service API key and enforces auth/rate-limits.
 */
export async function analyzeFloorPlan(imageBase64: string, mediaType: string): Promise<DraftScenario> {
  const body = {
    model: API_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EMIT_SCENARIO_TOOL],
    tool_choice: { type: 'tool', name: EMIT_SCENARIO_TOOL.name },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        { type: 'text', text: USER_MESSAGE_TEXT },
      ],
    }],
  };

  const headers: Record<string, string> = { 'content-type': 'application/json' };

  let url: string;
  if (PROXY_URL) {
    url = PROXY_URL;
  } else {
    const apiKey = getStoredApiKey();
    if (!apiKey) throw new AIClientError('API key not set. Open settings and paste your Anthropic API key.');
    url = API_URL;
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = API_VERSION;
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (err) {
    throw new AIClientError('Network error reaching the AI endpoint.', err);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new AIClientError(`AI endpoint returned ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = await response.json() as { content?: Array<{ type: string; name?: string; input?: unknown }> };
  const toolUse = data.content?.find((b) => b.type === 'tool_use' && b.name === EMIT_SCENARIO_TOOL.name);
  if (!toolUse || !toolUse.input) {
    throw new AIClientError('Model did not emit a scenario. Try a clearer image or a different plan.');
  }
  const draft = toolUse.input as DraftScenario;
  if (import.meta.env.DEV) {
    (window as unknown as { __lastDraft: DraftScenario }).__lastDraft = draft;
    console.log('[AI] raw DraftScenario:', draft);
  }
  return draft;
}

/** Read a File (from input/drag-drop) into a base64 string (no data: prefix). */
export function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new AIClientError('Failed to read file.'));
    reader.onload = () => {
      const result = reader.result as string;
      const match = /^data:([^;]+);base64,(.+)$/.exec(result);
      if (!match) return reject(new AIClientError('Unexpected file encoding.'));
      resolve({ mediaType: match[1], base64: match[2] });
    };
    reader.readAsDataURL(file);
  });
}
