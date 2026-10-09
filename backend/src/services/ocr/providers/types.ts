/**
 * One interface for every AI provider. Adapters receive the file bytes already in memory and
 * must never log them or the API key.
 */

export interface OcrFile {
  mimeType: string; // image/jpeg | image/png | image/webp | application/pdf
  data: Buffer;
}

export interface OcrRequest {
  files: OcrFile[];
  system: string;
  prompt: string;
  /** JSON Schema of the expected answer */
  schema: Record<string, unknown>;
  timeoutMs: number;
}

export interface OcrRepairRequest {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  timeoutMs: number;
}

export interface OcrUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface OcrResult {
  text: string;
  usage: OcrUsage;
  /** The model that actually answered (may differ from the configured one after a fallback) */
  model: string;
}

export interface OcrProvider {
  readonly name: string;
  readonly model: string;
  extract(req: OcrRequest): Promise<OcrResult>;
  /** Text-only follow-up used for the single JSON repair retry */
  repair(req: OcrRepairRequest): Promise<OcrResult>;
}

/** Errors the controller turns into a clean message (never containing the key or the image). */
export class OcrProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "timeout" | "rate_limit" | "refused" | "bad_request" | "upstream",
    readonly status?: number
  ) {
    super(message);
    this.name = "OcrProviderError";
  }
}
