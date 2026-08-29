export const getEmbeddings = async (text: string): Promise<number[]> => {
  const token = process.env.HUGGINGFACE_API_KEY;
  if (!token) {
    throw new Error("HUGGINGFACE_API_KEY environment variable is not set");
  }

  const response = await fetch(
    "https://api-inference.huggingface.co/models/intfloat/e5-base-v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face API returned error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  // E5-base-v2 inference API typically returns a 2D array if string array input,
  // or a 1D array if a single string was passed, or an array containing the 1D array.
  // Let's handle different returned shapes safely.
  if (Array.isArray(result)) {
    if (typeof result[0] === "number") {
      return result as number[];
    } else if (Array.isArray(result[0]) && typeof result[0][0] === "number") {
      return result[0] as number[];
    }
  }

  throw new Error("Unexpected response format from Hugging Face Inference API");
};

export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};
