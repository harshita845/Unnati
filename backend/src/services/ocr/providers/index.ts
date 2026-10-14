import { AnthropicOcrProvider } from "./anthropic";
import { GeminiOcrProvider } from "./gemini";
import { FakeOcrProvider } from "./fake";
import { OcrProvider, OcrProviderError } from "./types";

export * from "./types";

/**
 * Pick the provider from env. Keys live only in server env (Vercel project settings); they are
 * never sent to the browser or logged.
 *
 * OCR_PROVIDER = anthropic | gemini | fake   (unset → whichever key is present, else disabled)
 * OCR_MODEL    = override the provider's default model
 */
let override: OcrProvider | null = null;

/** Tests inject a provider here */
export function setOcrProviderForTests(p: OcrProvider | null) {
  override = p;
}

export function configuredProviderName(): string | null {
  const explicit = (process.env.OCR_PROVIDER || "").trim().toLowerCase();
  if (explicit) return explicit === "off" ? null : explicit;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

let cached: { key: string; provider: OcrProvider } | null = null;

export function getOcrProvider(): OcrProvider {
  if (override) return override;
  const name = configuredProviderName();
  const model = (process.env.OCR_MODEL || "").trim() || undefined;
  const cacheKey = `${name}|${model}|${process.env.NODE_ENV}`;
  if (cached?.key === cacheKey) return cached.provider;

  let provider: OcrProvider;
  switch (name) {
    case "anthropic": {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new OcrProviderError("AI scanning is set to Anthropic but ANTHROPIC_API_KEY is not set on the server.", "config");
      const effort = (process.env.OCR_EFFORT || "low") as "low" | "medium" | "high";
      provider = new AnthropicOcrProvider(key, model, effort, process.env.OCR_FALLBACKS !== "off");
      break;
    }
    case "gemini": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new OcrProviderError("AI scanning is set to Gemini but GEMINI_API_KEY is not set on the server.", "config");
      const fallback = process.env.OCR_FALLBACKS === "off" ? null : (process.env.OCR_FALLBACK_MODEL || "").trim() || undefined;
      provider = new GeminiOcrProvider(key, model, fallback);
      break;
    }
    case "fake":
      // The fake returns a made-up sample bill: confirming it in production would add fake stock
      // and supplier debt to real books. Refuse it there.
      if (process.env.NODE_ENV === "production") {
        throw new OcrProviderError("OCR_PROVIDER=fake is not allowed in production. Set anthropic or gemini.", "config");
      }
      provider = new FakeOcrProvider();
      break;
    case null:
      throw new OcrProviderError("AI scanning is not set up on the server. Enter the bill manually.", "config");
    default:
      throw new OcrProviderError(`Unknown OCR_PROVIDER "${name}". Use anthropic, gemini or fake.`, "config");
  }
  cached = { key: cacheKey, provider };
  return provider;
}
