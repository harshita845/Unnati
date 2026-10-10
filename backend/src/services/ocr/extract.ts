import { getOcrProvider, OcrFile, OcrProviderError, OcrUsage } from "./providers";
import { EXTRACTION_SYSTEM_PROMPT, extractionUserPrompt, repairPrompt } from "./prompt";
import { DocType, EXTRACTION_JSON_SCHEMA, Extraction, ExtractionParseError, parseExtraction } from "./schema";
import { normalizeExtraction, ScanWarning, validateExtraction } from "./validate";

export interface ExtractionOutcome {
  extraction: Extraction;
  warnings: ScanWarning[];
  provider: string;
  model: string;
  aiCalls: number;
  repaired: boolean;
  usage: OcrUsage & { ms: number };
}

export const ocrTimeoutMs = () => Math.min(120000, Math.max(5000, Number(process.env.OCR_TIMEOUT_MS) || 45000));

/**
 * files → provider → strict JSON. If the answer isn't valid JSON for the schema, one repair
 * retry (text only, so it's cheap and quick); a second failure is reported to the person, who can
 * re-scan or type the bill in.
 */
export async function runExtraction(
  files: OcrFile[],
  opts: { docTypeHint?: DocType | null; deadline?: number; /** Called just before each AI request (for the monthly limit) */ onAiCall?: () => void } = {}
): Promise<ExtractionOutcome> {
  const provider = getOcrProvider();
  const started = Date.now();
  const deadline = opts.deadline ?? started + ocrTimeoutMs();
  const remaining = () => Math.max(3000, deadline - Date.now());
  const usage: OcrUsage = { inputTokens: 0, outputTokens: 0 };
  const addUsage = (u: OcrUsage) => {
    usage.inputTokens = (usage.inputTokens || 0) + (u.inputTokens || 0);
    usage.outputTokens = (usage.outputTokens || 0) + (u.outputTokens || 0);
  };

  opts.onAiCall?.();
  const first = await provider.extract({
    files,
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: extractionUserPrompt({ pages: files.length, docTypeHint: opts.docTypeHint }),
    schema: EXTRACTION_JSON_SCHEMA,
    timeoutMs: remaining(),
  });
  addUsage(first.usage);

  let extraction: Extraction;
  let repaired = false;
  let aiCalls = 1;
  let model = first.model;
  try {
    extraction = parseExtraction(first.text);
  } catch (error) {
    if (!(error instanceof ExtractionParseError)) throw error;
    if (deadline - Date.now() < 4000) throw new OcrProviderError("The AI answer was unreadable and there's no time left to retry. Re-scan.", "upstream");
    opts.onAiCall?.();
    const second = await provider.repair({
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: repairPrompt(first.text, error.message),
      schema: EXTRACTION_JSON_SCHEMA,
      timeoutMs: remaining(),
    });
    addUsage(second.usage);
    aiCalls = 2;
    repaired = true;
    model = second.model || model;
    try {
      extraction = parseExtraction(second.text);
    } catch (again) {
      throw new OcrProviderError("The AI couldn't return a clean result for this bill. Re-scan with a clearer photo or enter it manually.", "upstream");
    }
  }

  if (opts.docTypeHint && opts.docTypeHint !== "unknown") extraction.docType = opts.docTypeHint;
  extraction = normalizeExtraction(extraction);
  return {
    extraction,
    warnings: validateExtraction(extraction),
    provider: provider.name,
    model,
    aiCalls,
    repaired,
    usage: { ...usage, ms: Date.now() - started },
  };
}
