import { NextResponse } from "next/server";
import { Question, AnswerBlock, MappedResult, GradedResult } from "@/lib/types";
import { generateContentWithRetry } from "@/lib/gemini";
import { SchemaType } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const { questions, mappedResults, answerBlocks } = await request.json() as {
      questions: Question[];
      mappedResults: MappedResult[];
      answerBlocks: AnswerBlock[];
    };

    if (!questions || !mappedResults || !answerBlocks) {
      return NextResponse.json(
        { error: "Missing questions, mappedResults, or answerBlocks" },
        { status: 400 }
      );
    }

    const gradedResults: GradedResult[] = [];
    const questionsToEvaluate: { question: Question; combinedText: string }[] = [];

    // Filter answered vs unanswered questions
    for (const question of questions) {
      const mapped = mappedResults.find((m) => m.questionId === question.id);
      const maxMarks = question.maxMarks || 5;

      if (!mapped || !mapped.answerBlockIds || mapped.answerBlockIds.length === 0) {
        gradedResults.push({
          questionId: question.id,
          score: 0,
          maxMarks,
          feedback: "Not answered.",
        });
        continue;
      }

      const transcribedTexts = mapped.answerBlockIds
        .map((blockId) => {
          const block = answerBlocks.find((b) => b.id === blockId);
          return block ? block.transcribedText : "";
        })
        .filter((t) => t.trim() !== "");

      if (transcribedTexts.length === 0) {
        gradedResults.push({
          questionId: question.id,
          score: 0,
          maxMarks,
          feedback: "Not answered.",
        });
        continue;
      }

      questionsToEvaluate.push({
        question,
        combinedText: transcribedTexts.join("\n\n"),
      });
    }

    // Grade ALL answered questions in 1 single batched Gemini call!
    if (questionsToEvaluate.length > 0) {
      const formattedItems = questionsToEvaluate
        .map((item, idx) => {
          return `--- ITEM ${idx + 1} ---
Question ID: "${item.question.id}"
Question Text: "${item.question.text}"
Max Marks: ${item.question.maxMarks || 5}
Student Answer:
"""
${item.combinedText}
"""`;
        })
        .join("\n\n");

      const generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            grades: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  questionId: { type: SchemaType.STRING },
                  score: {
                    type: SchemaType.NUMBER,
                    description: "Numeric score awarded based on Max Marks.",
                  },
                  feedback: {
                    type: SchemaType.STRING,
                    description: "Concise feedback (1-2 sentences).",
                  },
                },
                required: ["questionId", "score", "feedback"],
              },
            },
          },
          required: ["grades"],
        },
      };

      const prompt = `Grade the following student answers for the corresponding questions.
For each item, evaluate the student's answer and assign a fair score out of Max Marks along with concise feedback.

${formattedItems}`;

      try {
        const result = await generateContentWithRetry(generationConfig, prompt);
        const textResponse = result.response.text();
        const parsed = JSON.parse(textResponse);

        if (Array.isArray(parsed.grades)) {
          for (const g of parsed.grades) {
            const item = questionsToEvaluate.find((q) => q.question.id === g.questionId);
            const maxMarks = item ? item.question.maxMarks || 5 : 5;

            let finalScore = Number(g.score);
            if (isNaN(finalScore)) finalScore = 0;
            finalScore = Math.max(0, Math.min(maxMarks, finalScore));
            finalScore = Math.round(finalScore * 10) / 10;

            gradedResults.push({
              questionId: g.questionId,
              score: finalScore,
              maxMarks,
              feedback: g.feedback || "Answer evaluated.",
            });
          }
        }
      } catch (err) {
        console.error("Error in batched grading call:", err);
        // Fallback for remaining items if LLM call fails
        for (const item of questionsToEvaluate) {
          if (!gradedResults.some((g) => g.questionId === item.question.id)) {
            gradedResults.push({
              questionId: item.question.id,
              score: 0,
              maxMarks: item.question.maxMarks || 5,
              feedback: "Evaluation unavailable due to API limit.",
            });
          }
        }
      }
    }

    return NextResponse.json({ gradedResults });
  } catch (error) {
    console.error("Error in grade API:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
