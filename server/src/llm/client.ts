import type { LlmConfigRow } from "../db";

/** GitHub Models: OpenAI-kompatibler Endpunkt, Auth über GitHub-PAT. */
const GITHUB_MODELS_BASE = "https://models.github.ai/inference";

export class LlmError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/** Effektive Basis-URL: für GitHub Models fest, sonst die konfigurierte. */
export function resolveBaseUrl(config: LlmConfigRow): string {
  if (config.provider === "github_models") return GITHUB_MODELS_BASE;
  return config.baseUrl.replace(/\/+$/, "");
}

export function isConfigured(config: LlmConfigRow): boolean {
  return Boolean(config.apiKey && config.model && resolveBaseUrl(config));
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** OpenAI-kompatibles response_format, z.B. { type: "json_object" }. */
  responseFormat?: unknown;
}

async function errorFrom(res: Response): Promise<LlmError> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { error?: { message?: string } | string };
    const m = typeof body.error === "string" ? body.error : body.error?.message;
    if (m) message = m;
  } catch {
    // Antwort war kein JSON -- Statuszeile genügt.
  }
  if (res.status === 401) message = "API-Key ungültig oder ohne Zugriff";
  if (res.status === 403) message = `Zugriff verweigert: ${message}`;
  return new LlmError(res.status, message);
}

/** Ein Chat-Completions-Aufruf; liefert den Textinhalt der ersten Antwort. */
export async function chatCompletion(config: LlmConfigRow, opts: ChatOptions): Promise<string> {
  if (!isConfigured(config)) throw new LlmError(400, "Kein LLM konfiguriert");
  const base = resolveBaseUrl(config);
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 2048,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
    }),
  });
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new LlmError(502, "Unerwartete Antwort vom LLM");
  return content;
}

/** Minimaler Aufruf, um Key/Modell/Endpunkt zu prüfen. */
export async function testConnection(config: LlmConfigRow): Promise<{ model: string }> {
  await chatCompletion(config, { messages: [{ role: "user", content: "ping" }], maxTokens: 1 });
  return { model: config.model };
}
