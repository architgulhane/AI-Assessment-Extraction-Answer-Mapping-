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

// In-memory cache for available models list
let cachedAvailableModels: string[] | null = null;

// Static fallback list if REST/SDK discovery endpoint is unavailable on startup
const STATIC_FALLBACK_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-2.5-flash",
  "gemini-1.5-pro",
];

export async function getAvailableModels(): Promise<string[]> {
  if (cachedAvailableModels && cachedAvailableModels.length > 0) {
    return cachedAvailableModels;
  }

  try {
    // Dynamic discovery via REST endpoint GET /v1beta/models
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
          // Sort by preference order (flash-lite > flash > pro)
          discovered.sort((a: string, b: string) => {
            const getScore = (name: string) => {
              if (name.includes("flash-lite")) return 1;
              if (name.includes("flash")) return 2;
              if (name.includes("pro")) return 3;
              return 4;
            };
            return getScore(a) - getScore(b);
          });

          cachedAvailableModels = discovered;
          console.log("[Gemini API] Dynamically discovered available models:", discovered);
          return discovered;
        }
      }
    }
  } catch (err) {
    console.warn("[Gemini API Warning] Live model discovery failed, using static fallback models list.", err);
  }

  cachedAvailableModels = STATIC_FALLBACK_MODELS;
  return STATIC_FALLBACK_MODELS;
}

export async function getGeminiModel(generationConfig?: GenerationConfig): Promise<GenerativeModel> {
  const models = await getAvailableModels();
  const modelName = process.env.GEMINI_MODEL_NAME || models[0] || "gemini-1.5-flash";
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

  const candidateModels = await getAvailableModels();
  let lastError: unknown = null;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const modelName = candidateModels[mIdx];
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: generationConfig as GenerationConfig,
    });

    try {
      return await model.generateContent(contents);
    } catch (error: unknown) {
      lastError = error;
      const err = error as { message?: string; status?: number };
      const errorMsg = err?.message || "";
      const status = err?.status;

      // 1. 404 / invalid-argument check (Model not found or invalid config)
      const isNotFound = status === 404 || errorMsg.includes("404") || errorMsg.includes("not found");
      if (isNotFound) {
        console.error(`[Gemini API Config Error] Model '${modelName}' not found or unsupported (404). Skipping model.`);
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

      // 3. 429 Quota / Rate Limit check -> Log warning and transition to next candidate model
      const isQuotaError =
        status === 429 ||
        errorMsg.includes("429") ||
        errorMsg.includes("Quota exceeded") ||
        errorMsg.includes("QuotaFailure") ||
        errorMsg.includes("Too Many Requests") ||
        errorMsg.includes("RESOURCE_EXHAUSTED");

      if (isQuotaError) {
        console.warn(`[Gemini Quota Exhausted on ${modelName}] Transitioning to next candidate model...`);
        continue;
      }

      // Other unexpected errors
      console.error(`[Gemini API Unexpected Error on ${modelName}]:`, errorMsg);
    }
  }

  throw new AllModelsExhaustedError(
    `All candidate Gemini models (${candidateModels.join(", ")}) were exhausted or failed. ${
      lastError instanceof Error ? lastError.message : ""
    }`
  );
}
