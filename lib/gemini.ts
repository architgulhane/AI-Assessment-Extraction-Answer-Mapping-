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

const CANDIDATE_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash"];

export function getGeminiModel(generationConfig?: GenerationConfig): GenerativeModel {
  const modelName = process.env.GEMINI_MODEL_NAME || CANDIDATE_MODELS[0];
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });
}

export async function generateContentWithRetry(
  generationConfig: unknown,
  contents: Parameters<GenerativeModel["generateContent"]>[0]
): Promise<GenerateContentResult> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const modelName of CANDIDATE_MODELS) {
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

        const isQuotaError =
          status === 429 ||
          errorMsg.includes("429") ||
          errorMsg.includes("Quota exceeded") ||
          errorMsg.includes("QuotaFailure") ||
          errorMsg.includes("Too Many Requests") ||
          errorMsg.includes("RESOURCE_EXHAUSTED");

        if (!isQuotaError) {
          throw error;
        }

        console.warn(`[Quota 429 on ${modelName}] Attempt ${attempt}/${maxAttempts}. Trying next candidate model...`);
      }
    }

    // All models returned 429, wait for the temporary free-tier quota window to reset (15s - 30s)
    if (attempt < maxAttempts) {
      console.warn(`[Quota Exceeded] Free tier request quota reached. Waiting 20 seconds for API window reset (Attempt ${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, 20000));
    }
  }

  throw new Error("Gemini API daily free-tier quota exceeded on all candidate models. Please wait a minute or try again with a fresh GEMINI_API_KEY.");
}
