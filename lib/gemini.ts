import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
  GenerateContentResult,
} from "@google/generative-ai";
import fs from "fs";
import path from "path";

const apiKey = process.env.GEMINI_API_KEY || "";
export const genAI = new GoogleGenerativeAI(apiKey);

export class AllModelsExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllModelsExhaustedError";
  }
}

export function base64ToGenerativePart(base64DataUrl: string) {
  const match = base64DataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) {
    return {
      inlineData: {
        data: base64DataUrl,
        mimeType: "image/jpeg",
      },
    };
  }
  return {
    inlineData: {
      data: match[2],
      mimeType: match[1],
    },
  };
}

// Global singleton definitions to ensure process-lifetime persistence in Next.js server context
declare global {
  // eslint-disable-next-line no-var
  var __gemini_discovery_promise__: Promise<string[]> | undefined;
  // eslint-disable-next-line no-var
  var __gemini_discovery_count__: number | undefined;
  // eslint-disable-next-line no-var
  var __gemini_hard_failed_models__: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __gemini_quota_cooldowns__: Map<string, number> | undefined;
}

if (!globalThis.__gemini_discovery_count__) {
  globalThis.__gemini_discovery_count__ = 0;
}
if (!globalThis.__gemini_hard_failed_models__) {
  globalThis.__gemini_hard_failed_models__ = new Set<string>();
}
if (!globalThis.__gemini_quota_cooldowns__) {
  globalThis.__gemini_quota_cooldowns__ = new Map<string, number>();
}

// Fixed candidate models array — strictly limited to these 3 models only
const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
];

const QUOTA_COOLDOWN_MS = 3 * 60 * 1000; // 3 minute cooldown for 429 quota errors

export function getCandidateModels(): string[] {
  const hardFailed = globalThis.__gemini_hard_failed_models__ || new Set();
  return CANDIDATE_MODELS.filter((m) => !hardFailed.has(m));
}

export function getAvailableModels(): Promise<string[]> {
  // Discovery fetch retained for logging/diagnostic purposes only
  if (!globalThis.__gemini_discovery_promise__) {
    globalThis.__gemini_discovery_promise__ = (async () => {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.models)) {
            const discovered = data.models
              .filter((m: { supportedGenerationMethods?: string[]; name?: string }) =>
                m.supportedGenerationMethods?.includes("generateContent")
              )
              .map((m: { name: string }) => m.name.replace(/^models\//, ""));

            if (discovered.length > 0) {
              console.log("[Gemini API] Dynamically discovered available models list from API.");
            }
          }
        }
      } catch (err) {
        console.warn("[Gemini API Warning] Live model discovery fetch failed.", err);
      }
      return CANDIDATE_MODELS;
    })();
  }

  return Promise.resolve(getCandidateModels());
}

export async function getGeminiModel(generationConfig?: GenerationConfig): Promise<GenerativeModel> {
  const models = getCandidateModels();
  const modelName = process.env.GEMINI_MODEL_NAME || models[0] || "gemini-3.5-flash";
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });
}

// Smart execution wrapper with differentiated error handling and MOCK_GEMINI support
export async function generateContentWithRetry(
  generationConfig: unknown,
  contents: Parameters<GenerativeModel["generateContent"]>[0],
  mockFixtureName?: "questions" | "answers" | "grades"
): Promise<GenerateContentResult> {
  // Dev-mode mocking check
  if (process.env.MOCK_GEMINI === "true") {
    console.log(`[MOCK_GEMINI=true] Serving canned fixture response for fixture: ${mockFixtureName || "generic"}`);
    let fixturePath = path.join(process.cwd(), "fixtures", "questions.json");
    if (mockFixtureName === "answers") {
      fixturePath = path.join(process.cwd(), "fixtures", "answers.json");
    } else if (mockFixtureName === "grades") {
      fixturePath = path.join(process.cwd(), "fixtures", "grades.json");
    }

    let rawData = '{"questions": []}';
    if (fs.existsSync(fixturePath)) {
      rawData = fs.readFileSync(fixturePath, "utf-8");
    }

    return {
      response: {
        text: () => rawData,
      },
    } as unknown as GenerateContentResult;
  }

  const candidateModels = getCandidateModels();
  const now = Date.now();
  const hardFailed = globalThis.__gemini_hard_failed_models__ || new Set();
  const cooldowns = globalThis.__gemini_quota_cooldowns__ || new Map();

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const modelName = candidateModels[mIdx];

    // Check permanently hard-failed models
    if (hardFailed.has(modelName)) {
      continue;
    }

    // Check active 429 quota cooldowns
    const cooldownUntil = cooldowns.get(modelName);
    if (cooldownUntil && now < cooldownUntil) {
      // Model is in active quota cooldown window, skip immediately
      continue;
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: generationConfig as GenerationConfig,
    });

    try {
      return await model.generateContent(contents);
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      const errorMsg = err?.message || "";
      const status = err?.status;

      // 1. 404 / invalid-argument check (Model not found or invalid config)
      const isNotFound = status === 404 || errorMsg.includes("404") || errorMsg.includes("not found");
      if (isNotFound) {
        console.error(`[Gemini API Config Error] Model '${modelName}' not found or unsupported (404). Permanently blacklisting.`);
        globalThis.__gemini_hard_failed_models__?.add(modelName);
        continue;
      }

      // 2. 5xx Server Error check (Transient Google server error) -> Retry same model once with short backoff
      const isServerError = (status && status >= 500 && status < 600) || errorMsg.includes("500") || errorMsg.includes("503");
      if (isServerError) {
        console.warn(`[Gemini 5xx Server Error on ${modelName}] Retrying same model once after 1.5s backoff...`);
        await new Promise((r) => setTimeout(r, 1500));
        try {
          return await model.generateContent(contents);
        } catch {
          console.warn(`Retry on ${modelName} failed. Transitioning to next candidate model...`);
          continue;
        }
      }

      // 3. 429 Quota / Rate Limit check -> Log warning, set 3-min cooldown, and transition to next candidate model
      const isQuotaError =
        status === 429 ||
        errorMsg.includes("429") ||
        errorMsg.includes("Quota exceeded") ||
        errorMsg.includes("QuotaFailure") ||
        errorMsg.includes("Too Many Requests") ||
        errorMsg.includes("RESOURCE_EXHAUSTED");

      if (isQuotaError) {
        console.warn(`[Gemini Quota Exhausted on ${modelName}] Setting 3-min cooldown and transitioning to next candidate model...`);
        globalThis.__gemini_quota_cooldowns__?.set(modelName, Date.now() + QUOTA_COOLDOWN_MS);
        continue;
      }

      // Other unexpected errors
      console.error(`[Gemini API Unexpected Error on ${modelName}]:`, errorMsg);
    }
  }

  throw new AllModelsExhaustedError("All Gemini models unavailable, please try again shortly");
}
