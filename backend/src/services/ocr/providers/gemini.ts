import { OcrProvider, OcrProviderError, OcrRepairRequest, OcrRequest, OcrResult } from "./types";

/**
 * Gemini adapter (REST models.generateContent with JSON output).
 * Model code checked against ai.google.dev/gemini-api/docs/models (Oct 2026): gemini-3.8-flash
 * is the current stable Flash model. Override with OCR_MODEL.
 */
export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiOcrProvider implements OcrProvider {
  readonly name = "gemini";

  constructor(private apiKey: string, readonly model: string = GEMINI_DEFAULT_MODEL) {}

  private async call(parts: unknown[], system: string, schema: Record<string, unknown>, timeoutMs: number): Promise<OcrResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`, {
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
      model: body?.modelVersion || this.model,
      usage: { inputTokens: body?.usageMetadata?.promptTokenCount, outputTokens: body?.usageMetadata?.candidatesTokenCount },
    };
  }

  extract(req: OcrRequest): Promise<OcrResult> {
    const parts: unknown[] = req.files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data.toString("base64") } }));
    parts.push({ text: req.prompt });
    return this.call(parts, req.system, req.schema, req.timeoutMs);
  }

  repair(req: OcrRepairRequest): Promise<OcrResult> {
    return this.call([{ text: req.prompt }], req.system, req.schema, req.timeoutMs);
  }
}
