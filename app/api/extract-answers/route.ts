import { NextResponse } from "next/server";
import { getGeminiModel, base64ToGenerativePart, generateContentWithRetry } from "@/lib/gemini";
import { SchemaType } from "@google/generative-ai";
import { AnswerBlock } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { images } = await request.json();
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const allAnswerBlocks: AnswerBlock[] = [];

    // Process pages sequentially with rate-limit pacing to avoid 429 errors
    for (let pageIndex = 0; pageIndex < images.length; pageIndex++) {
      // Pacing delay between pages
      if (pageIndex > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const imgBase64 = images[pageIndex];
      const imagePart = base64ToGenerativePart(imgBase64);

      // Get model with responseSchema config
      const model = getGeminiModel({
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            answerBlocks: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  boxNormalized: {
                    type: SchemaType.ARRAY,
                    description: "Normalized bounding box for the handwritten block on the page, using the format [y_min, x_min, y_max, x_max] with integers from 0 to 1000. Be as accurate as possible to fit just the handwritten text of this single answer.",
                    items: {
                      type: SchemaType.NUMBER,
                    },
                  },
                  transcribedText: {
                    type: SchemaType.STRING,
                    description: "Accurately transcribe all handwritten text inside this bounding box. Fix minor handwriting ambiguities if needed to make it readable.",
                  },
                  detectedQuestionLabel: {
                    type: SchemaType.STRING,
                    description: "The printed or handwritten question label nearby indicating which question is being answered (e.g. '1', 'Q2', '11.a', '11(b)'). Empty if no label is visible.",
                  },
                },
                required: ["boxNormalized", "transcribedText"],
              },
            },
          },
          required: ["answerBlocks"],
        },
      });

      const prompt = `Analyze this page of a student's answer sheet.
Tasks:
1. Locate every distinct handwritten answer block on the page.
2. For each block, determine its bounding box coordinates, normalized to a 0-1000 scale: [y_min, x_min, y_max, x_max].
3. Transcribe the text written within the bounding box.
4. Extract any question label that is written next to or at the beginning of the block (e.g., 'Q1', '2', 'a)'). If none, leave it empty.
Output the result matching the JSON schema.`;

      const result = await generateContentWithRetry(model, [prompt, imagePart]);
      const textResponse = result.response.text();
      const parsed = JSON.parse(textResponse);

      const blocks: AnswerBlock[] = (parsed.answerBlocks || []).map((b: { boxNormalized?: number[]; transcribedText?: string; detectedQuestionLabel?: string }, blockIndex: number) => {
        let coords: [number, number, number, number] = [0, 0, 0, 0];
        if (Array.isArray(b.boxNormalized) && b.boxNormalized.length === 4) {
          coords = [
            Number(b.boxNormalized[0]),
            Number(b.boxNormalized[1]),
            Number(b.boxNormalized[2]),
            Number(b.boxNormalized[3]),
          ];
        }

        return {
          id: `ans-p${pageIndex}-b${blockIndex}`,
          pageIndex: pageIndex,
          boxNormalized: coords,
          transcribedText: b.transcribedText || "",
          detectedQuestionLabel: b.detectedQuestionLabel || "",
        };
      });

      allAnswerBlocks.push(...blocks);
    }

    return NextResponse.json({ answerBlocks: allAnswerBlocks });
  } catch (error) {
    console.error("Error in extract-answers API:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
