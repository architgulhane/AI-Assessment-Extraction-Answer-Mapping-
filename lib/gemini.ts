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

export function getGeminiModel(generationConfig?: GenerationConfig): GenerativeModel {
  // Use gemini-3.6-flash as default model (active, high-quota, latest feature set)
  const modelName = process.env.GEMINI_MODEL_NAME || "gemini-3.6-flash";
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });
}

export async function generateContentWithRetry(
  model: GenerativeModel,
  contents: Parameters<GenerativeModel["generateContent"]>[0],
  maxRetries = 3
): Promise<GenerateContentResult> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await model.generateContent(contents);
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      const errorMsg = err?.message || "";
      const status = err?.status;

      const isRateLimit =
        status === 429 ||
        errorMsg.includes("429") ||
        errorMsg.includes("Too Many Requests") ||
        errorMsg.includes("QuotaFailure") ||
        errorMsg.includes("RESOURCE_EXHAUSTED");

      if (isRateLimit && attempt < maxRetries) {
        attempt++;
        const backoffMs = Math.pow(2, attempt) * 1500;
        console.warn(
          `[Gemini API 429 Rate Limit] Retrying attempt ${attempt}/${maxRetries} after ${backoffMs}ms delay...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Failed to generate content after maximum retries.");
}
