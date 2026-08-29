import { NextResponse } from "next/server";
import { getGeminiModel, base64ToGenerativePart, generateContentWithRetry } from "@/lib/gemini";
import { SchemaType } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const { images } = await request.json();
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    // Convert base64 images to Gemini parts
    const imageParts = images.map((img) => base64ToGenerativePart(img));

    // Get the model with responseSchema config
    const model = getGeminiModel({
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          questions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id: {
                  type: SchemaType.STRING,
                  description: "Unique string id for the question, e.g. 'q1', 'q11a', 'q11b'. Ensure it is lowercase, starts with 'q', and combines number + subPart.",
                },
                number: {
                  type: SchemaType.STRING,
                  description: "The printed number of the question, e.g., '1', '11'.",
                },
                subPart: {
                  type: SchemaType.STRING,
                  description: "The printed sub-part letter if present, e.g., 'a', 'b', 'c'. Omit if none.",
                },
                text: {
                  type: SchemaType.STRING,
                  description: "The transcribed question text in full.",
                },
                maxMarks: {
                  type: SchemaType.NUMBER,
                  description: "The maximum marks or points allocated to this question (usually in brackets at the end of the question). Omit or set to 5 if not visible.",
                },
              },
              required: ["id", "number", "text"],
            },
          },
        },
        required: ["questions"],
      },
    });

    const prompt = `Analyze the provided question paper pages and extract every question in printed order.
Rules:
1. Treat labeled sub-parts (e.g., (a), (b), or a., b.) as separate entries with a shared root number (e.g. Question 11 split into 11a and 11b).
2. Preserve original question numbers exactly as printed.
3. Extract maximum marks/points if printed next to the question. If marks are not visible, default to 5.
4. Output the results strictly formatted as JSON according to the schema.`;

    const result = await generateContentWithRetry(model, [prompt, ...imageParts]);
    const textResponse = result.response.text();
    
    // Parse response
    const parsedData = JSON.parse(textResponse);
    return NextResponse.json({ questions: parsedData.questions });
  } catch (error) {
    console.error("Error in extract-questions api:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
