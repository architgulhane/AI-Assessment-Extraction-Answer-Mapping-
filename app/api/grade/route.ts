import { NextResponse } from "next/server";
import { Question, AnswerBlock, MappedResult, GradedResult } from "@/lib/types";
import { generateContentWithRetry } from "@/lib/gemini";
import { batchProcess } from "@/lib/cache";
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
          gradingStatus: "unanswered",
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
          gradingStatus: "unanswered",
        });
        continue;
      }

      questionsToEvaluate.push({
        question,
        combinedText: transcribedTexts.join("\n\n"),
      });
    }

    // Process answered questions in small concurrency-limited batches (4 per batch, 1500ms delay)
    // to stay safely under Gemini free-tier 10 RPM rate limit.
    if (questionsToEvaluate.length > 0) {
      const generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            score: {
              type: SchemaType.NUMBER,
              description: "Numeric score awarded based on answer correctness.",
            },
            feedback: {
              type: SchemaType.STRING,
              description: "Brief constructive feedback explaining the score.",
            },
          },
          required: ["score", "feedback"],
        },
      };

      const evaluatedResults = await batchProcess(
        questionsToEvaluate,
        4,    // Batch size: 4 concurrent calls
        1500, // Delay: 1.5s between batches to respect rate limits
        async (item) => {
          const maxMarks = item.question.maxMarks || 5;
          const prompt = `Question: "${item.question.text}"
Max Marks: ${maxMarks}
Student Transcribed Answer: "${item.combinedText}"

Grade the student's answer out of ${maxMarks} marks. Provide a numerical score awarded and a brief constructive feedback explaining the grade.`;

          try {
            const result = await generateContentWithRetry(generationConfig, prompt, "grades");
            const textResponse = result.response.text();
            const parsed = JSON.parse(textResponse);

            let finalScore = Number(parsed.score);
            if (isNaN(finalScore)) finalScore = 0;
            finalScore = Math.max(0, Math.min(maxMarks, finalScore));
            finalScore = Math.round(finalScore * 10) / 10;

            const feedbackText =
              parsed.feedback && typeof parsed.feedback === "string" && parsed.feedback.trim().length > 0
                ? parsed.feedback.trim()
                : `Score awarded: ${finalScore}/${maxMarks}`;

            return {
              questionId: item.question.id,
              score: finalScore,
              maxMarks,
              feedback: feedbackText,
              gradingStatus: "graded" as const,
            };
          } catch (err) {
            console.error(`Gemini grading failed for question ${item.question.id}:`, err);
            return {
              questionId: item.question.id,
              score: 0,
              maxMarks,
              feedback: "AI feedback unavailable — grading service reached its rate limit. Please review this answer manually.",
              gradingStatus: "failed" as const,
            };
          }
        }
      );

      gradedResults.push(...evaluatedResults);
    }

    return NextResponse.json({ gradedResults });
  } catch (error) {
    console.error("Error in grade API:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
