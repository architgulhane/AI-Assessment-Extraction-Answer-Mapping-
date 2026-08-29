import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
  GenerateContentResult,
} from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";

export const genAI = new GoogleGenerativeAI(apiKey);

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

const CANDIDATE_MODELS = [
  "gemini-1.5-flash",
  "gemini-2.5-flash",
  "gemini-3.6-flash",
  "gemini-1.5-pro",
];

export function getGeminiModel(generationConfig?: GenerationConfig): GenerativeModel {
  const modelName = process.env.GEMINI_MODEL_NAME || CANDIDATE_MODELS[0];
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });
}

// Smart execution wrapper with automatic fallback across candidate models if 429 quota/rate limit is reached
export async function generateContentWithRetry(
  generationConfig: unknown,
  contents: Parameters<GenerativeModel["generateContent"]>[0]
): Promise<GenerateContentResult> {
  let lastError: unknown = null;

  for (let mIdx = 0; mIdx < CANDIDATE_MODELS.length; mIdx++) {
    const modelName = CANDIDATE_MODELS[mIdx];
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

      const isQuotaError =
        status === 429 ||
        errorMsg.includes("429") ||
        errorMsg.includes("Quota exceeded") ||
        errorMsg.includes("QuotaFailure") ||
        errorMsg.includes("Too Many Requests") ||
        errorMsg.includes("RESOURCE_EXHAUSTED");

      if (isQuotaError && mIdx < CANDIDATE_MODELS.length - 1) {
        console.warn(
          `[Quota Exceeded on ${modelName}] Automatically falling back to model ${CANDIDATE_MODELS[mIdx + 1]}...`
        );
        continue;
      } else if (isQuotaError) {
        // All models rate limited, wait 3 seconds and retry last model once
        await new Promise((r) => setTimeout(r, 3000));
        try {
          return await model.generateContent(contents);
        } catch (retryErr) {
          throw retryErr;
        }
      } else {
        throw error;
      }
    }
  }

  throw lastError || new Error("Failed to generate content after checking candidate models.");
}
