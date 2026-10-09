import Anthropic from "@anthropic-ai/sdk";
import { OcrProvider, OcrProviderError, OcrRepairRequest, OcrRequest, OcrResult } from "./types";

/**
 * Claude adapter (Messages API, structured JSON output).
 * Model IDs checked against platform.claude.com/docs/en/about-claude/models/overview (Oct 2026):
 * claude-opus-5-5 (default), claude-sonnet-5-5, claude-haiku-5-5. Override with OCR_MODEL.
 */
export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export class AnthropicOcrProvider implements OcrProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string = ANTHROPIC_DEFAULT_MODEL,
    private effort: Effort = "low",
    /** Server-side refusal fallback (opt-in beta); OCR_FALLBACKS=off disables it */
    private fallbacks = true
  ) {
    // maxRetries 1: a scan has a ~45s budget, so one quick retry on 429/5xx at most
    this.client = new Anthropic({ apiKey, maxRetries: 1 });
  }

  private async call(content: Anthropic.Beta.BetaContentBlockParam[], system: string, schema: Record<string, unknown>, timeoutMs: number): Promise<OcrResult> {
    try {
      const response = await this.client.beta.messages.create(
        {
          model: this.model,
          max_tokens: 16000,
          system,
          messages: [{ role: "user", content }],
          output_config: { effort: this.effort, format: { type: "json_schema", schema } },
          ...(this.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        },
        { timeout: timeoutMs }
      );
      if (response.stop_reason === "refusal") {
        throw new OcrProviderError("The AI declined to read this document. Enter it manually.", "refused");
      }
      if (response.stop_reason === "max_tokens") {
        throw new OcrProviderError("The bill is too long to read in one go. Split it into fewer pages.", "bad_request");
      }
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return {
        text,
        model: response.model,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  extract(req: OcrRequest): Promise<OcrResult> {
    const blocks: Anthropic.Beta.BetaContentBlockParam[] = req.files.map((f) =>
      f.mimeType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data.toString("base64") } }
        : {
            type: "image",
            source: { type: "base64", media_type: f.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: f.data.toString("base64") },
          }
    );
    blocks.push({ type: "text", text: req.prompt });
    return this.call(blocks, req.system, req.schema, req.timeoutMs);
  }

  repair(req: OcrRepairRequest): Promise<OcrResult> {
    return this.call([{ type: "text", text: req.prompt }], req.system, req.schema, req.timeoutMs);
  }
}

function toProviderError(error: unknown): Error {
  if (error instanceof OcrProviderError) return error;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new OcrProviderError("The AI took too long to answer. Try again.", "timeout");
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new OcrProviderError("AI key is invalid or not allowed. Check ANTHROPIC_API_KEY on the server.", "config", error.status);
  }
  if (error instanceof Anthropic.RateLimitError) return new OcrProviderError("AI is busy (rate limit). Wait a minute and retry.", "rate_limit", 429);
  if (error instanceof Anthropic.BadRequestError) {
    // The message describes the request (never the image bytes), safe to surface for debugging
    return new OcrProviderError(`AI rejected the request: ${error.message}`.slice(0, 300), "bad_request", 400);
  }
  if (error instanceof Anthropic.APIError) return new OcrProviderError(`AI service error (${error.status ?? "network"}). Try again.`, "upstream", error.status);
  return new OcrProviderError("Couldn't reach the AI service. Try again.", "upstream");
}
