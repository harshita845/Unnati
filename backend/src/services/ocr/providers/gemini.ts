import { OcrProvider, OcrProviderError, OcrRepairRequest, OcrRequest, OcrResult } from "./types";

/**
 * Gemini adapter (REST models.generateContent with JSON output).
 * Model code checked against ai.google.dev/gemini-api/docs/models (Oct 2026): gemini-3.8-flash
 * is the current stable Flash model. Override with OCR_MODEL.
 */
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Tried once when the main model stays busy (Google 503 "high demand"). OCR_FALLBACK_MODEL overrides. */
export const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash";
/** Waits before retrying a busy / rate-limited answer */
const RETRY_DELAYS_MS = [2000, 5000];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isBusy = (error: unknown) =>
  error instanceof OcrProviderError &&
  (error.kind === "rate_limit" || (error.kind === "upstream" && [500, 502, 503, 504].includes(Number(error.status))));

export class GeminiOcrProvider implements OcrProvider {
  readonly name = "gemini";

  constructor(
    private apiKey: string,
    readonly model: string = GEMINI_DEFAULT_MODEL,
    /** Model tried when the main one stays busy; null turns it off */
    private fallbackModel: string | null = GEMINI_FALLBACK_MODEL
  ) {}

  /**
   * Google often answers "high demand" (503) or rate limits for a few seconds: retry the main model
   * a couple of times, then try the fallback model once, all within the time the scan allows.
   */
  private async callWithRetry(parts: unknown[], system: string, schema: Record<string, unknown>, timeoutMs: number): Promise<OcrResult> {
    const deadline = Date.now() + timeoutMs;
    const left = () => deadline - Date.now();
    const attempts: string[] = [this.model, this.model, this.model];
    if (this.fallbackModel && this.fallbackModel !== this.model) attempts.push(this.fallbackModel);
    let lastError: unknown;
    for (let i = 0; i < attempts.length; i++) {
      if (i > 0) {
        const wait = RETRY_DELAYS_MS[Math.min(i - 1, RETRY_DELAYS_MS.length - 1)];
        if (left() < wait + 10000) break;
        await sleep(wait);
      }
      try {
        return await this.call(attempts[i], parts, system, schema, Math.max(3000, left()));
      } catch (error) {
        lastError = error;
        if (!isBusy(error)) throw error;
      }
    }
    throw lastError instanceof OcrProviderError && lastError.kind === "upstream"
      ? new OcrProviderError("The AI service is busy right now. Wait a minute and try again.", "upstream", lastError.status)
      : lastError;
  }

  private async call(model: string, parts: unknown[], system: string, schema: Record<string, unknown>, timeoutMs: number): Promise<OcrResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        // Key in a header, never in the URL (URLs end up in logs)
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0 },
        }),
        signal: controller.signal,
      });
    } catch (error: any) {
      if (error?.name === "AbortError") throw new OcrProviderError("The AI took too long to answer. Try again.", "timeout");
      throw new OcrProviderError("Couldn't reach the AI service. Try again.", "upstream");
    } finally {
      clearTimeout(timer);
    }

    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = String(body?.error?.message || "").slice(0, 200);
      if (res.status === 401 || res.status === 403) throw new OcrProviderError("AI key is invalid or not allowed. Check GEMINI_API_KEY on the server.", "config", res.status);
      if (res.status === 429) throw new OcrProviderError("AI is busy (rate limit). Wait a minute and retry.", "rate_limit", 429);
      if (res.status === 400) throw new OcrProviderError(`AI rejected the request: ${msg}`, "bad_request", 400);
      throw new OcrProviderError(`AI service error (${res.status}). Try again.`, "upstream", res.status);
    }

    const candidate = body?.candidates?.[0];
    if (!candidate || candidate.finishReason === "SAFETY" || body?.promptFeedback?.blockReason) {
      throw new OcrProviderError("The AI declined to read this document. Enter it manually.", "refused");
    }
    if (candidate.finishReason === "MAX_TOKENS") {
      throw new OcrProviderError("The bill is too long to read in one go. Split it into fewer pages.", "bad_request");
    }
    const text = (candidate.content?.parts || []).map((p: any) => p?.text || "").join("");
    return {
      text,
      model: body?.modelVersion || model,
      usage: { inputTokens: body?.usageMetadata?.promptTokenCount, outputTokens: body?.usageMetadata?.candidatesTokenCount },
    };
  }

  extract(req: OcrRequest): Promise<OcrResult> {
    const parts: unknown[] = req.files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data.toString("base64") } }));
    parts.push({ text: req.prompt });
    return this.callWithRetry(parts, req.system, req.schema, req.timeoutMs);
  }

  repair(req: OcrRepairRequest): Promise<OcrResult> {
    return this.callWithRetry([{ text: req.prompt }], req.system, req.schema, req.timeoutMs);
  }
}
