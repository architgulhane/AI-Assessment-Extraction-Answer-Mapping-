import { NextResponse } from "next/server";
import { base64ToGenerativePart, generateContentWithRetry } from "@/lib/gemini";
import { SchemaType } from "@google/generative-ai";
import { fileCache } from "@/lib/cache";
import { Question } from "@/lib/types";

// Deterministic regex heuristic parser for digital text question papers
function parseQuestionsFromText(text: string): Question[] {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const questions: Question[] = [];

  // Match patterns like Q1., Q1), 1., 1), Question 1:, 11a., 11(a), 26., 26)
  const questionRegex = /^(?:Q|Question\s*)?(\d+)\s*(?:\.|\)|:|\s+([a-z])[\.\)]?)\s*(.*)/i;

  let currentQuestion: Question | null = null;

  for (const line of lines) {
    const match = line.match(questionRegex);
    if (match) {
      if (currentQuestion && currentQuestion.text.length > 3) {
        questions.push(currentQuestion);
      }

      const numStr = match[1];
      const subPartStr = match[2] ? match[2].toLowerCase() : undefined;
      const restText = match[3] || "";

      const marksMatch = restText.match(/\[(\d+)\s*marks?\]|\((\d+)\s*marks?\)|\[(\d+)\]/i);
      const maxMarks = marksMatch ? Number(marksMatch[1] || marksMatch[2] || marksMatch[3]) : 5;

      const qId = subPartStr ? `q${numStr}${subPartStr}` : `q${numStr}`;

      currentQuestion = {
        id: qId,
        number: numStr,
        subPart: subPartStr,
        text: restText,
        maxMarks: maxMarks,
      };
    } else if (currentQuestion) {
      currentQuestion.text += " " + line;
    }
  }

  if (currentQuestion && currentQuestion.text.length > 3) {
    questions.push(currentQuestion);
  }

  return questions;
}

export async function POST(request: Request) {
  try {
    const { images, pdfText } = (await request.json()) as { images: string[]; pdfText?: string };
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    // 1. In-Memory Hash Cache check
    const fileHash = fileCache.getHash(images);
    const cachedQuestions = fileCache.get<Question[]>(fileHash);
    if (cachedQuestions && cachedQuestions.length > 0) {
      console.log(`[Cache Hit] Returning cached questions for hash: ${fileHash.slice(0, 8)}`);
      return NextResponse.json({ questions: cachedQuestions, cached: true });
    }

    // 2. Digital PDF Text Extraction Check - only use if it extracts at least 5 questions
    if (pdfText && pdfText.trim().length > 50) {
      const parsedQuestions = parseQuestionsFromText(pdfText);
      if (parsedQuestions.length >= 5) {
        console.log(`[Text Extraction] Parsed ${parsedQuestions.length} questions deterministically from digital PDF text.`);
        fileCache.set(fileHash, parsedQuestions);
        return NextResponse.json({ questions: parsedQuestions, method: "digital-text-parser" });
      }
    }

    // 3. Complete Gemini Vision Extraction for Question Paper
    const imageParts = images.map((img) => base64ToGenerativePart(img));

    const generationConfig = {
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
                  description: "Unique string id for the question, e.g. 'q1', 'q22', 'q26a'. Lowercase, starts with 'q', combining number + subPart.",
                },
                number: {
                  type: SchemaType.STRING,
                  description: "The printed number of the question, e.g., '1', '22', '26'.",
                },
                subPart: {
                  type: SchemaType.STRING,
                  description: "The printed sub-part letter if present, e.g., 'a', 'b'. Omit if none.",
                },
                text: {
                  type: SchemaType.STRING,
                  description: "The transcribed question text in full.",
                },
                maxMarks: {
                  type: SchemaType.NUMBER,
                  description: "Maximum marks allocated to this question. Default to 5 if not visible.",
                },
              },
              required: ["id", "number", "text"],
            },
          },
        },
        required: ["questions"],
      },
    };

    const prompt = `Examine ALL pages of this question paper. Extract EVERY SINGLE printed question from the start of the paper to the very last page.
Rules:
1. Do not skip any question numbers. Include all questions (e.g. 1 to 34 or all section questions).
2. Treat labeled sub-parts (e.g., (a), (b)) as separate entries with shared root number (e.g. 11a, 11b).
3. Preserve original printed question numbers exactly.
4. Output strictly as JSON adhering to the schema.`;

    const result = await generateContentWithRetry(generationConfig, [prompt, ...imageParts], "questions");
    const textResponse = result.response.text();
    const parsedData = JSON.parse(textResponse);

    const questions: Question[] = parsedData.questions || [];
    fileCache.set(fileHash, questions);

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Error in extract-questions api:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
