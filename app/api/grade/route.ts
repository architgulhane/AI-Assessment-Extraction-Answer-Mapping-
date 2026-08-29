import { NextResponse } from "next/server";
import { Question, AnswerBlock, MappedResult, GradedResult } from "@/lib/types";
import { getGeminiModel, generateContentWithRetry } from "@/lib/gemini";
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

    // Process grading with pacing to avoid hitting rate limits
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      // Find the mapped result for this question
      const mapped = mappedResults.find((m) => m.questionId === question.id);
      const maxMarks = question.maxMarks || 5;

      // Rule: Unanswered questions skip the API call entirely
      if (!mapped || !mapped.answerBlockIds || mapped.answerBlockIds.length === 0) {
        gradedResults.push({
          questionId: question.id,
          score: 0,
          maxMarks,
          feedback: "Not answered.",
        });
        continue;
      }

      // Collect and concatenate all transcribed text from mapped blocks
      const transcribedTexts = mapped.answerBlockIds.map((blockId) => {
        const block = answerBlocks.find((b) => b.id === blockId);
        return block ? block.transcribedText : "";
      }).filter(text => text.trim() !== "");

      if (transcribedTexts.length === 0) {
        gradedResults.push({
          questionId: question.id,
          score: 0,
          maxMarks,
          feedback: "Not answered.",
        });
        continue;
      }

      // Small pacing delay between LLM calls
      if (gradedResults.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const combinedAnswerText = transcribedTexts.join("\n\n");

      // Text-only call for grading (no image)
      const model = getGeminiModel({
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            score: {
              type: SchemaType.NUMBER,
              description: `A numeric score out of ${maxMarks}. You can award decimals or integers. Award partial credit for incomplete or partially correct reasoning.`,
            },
            feedback: {
              type: SchemaType.STRING,
              description: "A concise feedback of 1-2 sentences explaining the points awarded and what was correct/incorrect.",
            },
          },
          required: ["score", "feedback"],
        },
      });

      const prompt = `Grade the following student answer against the question.
Question: "${question.text}"
Max Marks: ${maxMarks}

Student's Transcribed Answer:
"""
${combinedAnswerText}
"""

Instructions:
1. Assign a score between 0 and ${maxMarks}.
2. Award partial credit for partially correct answers, incomplete reasoning, or good attempts. Do not require a verbatim textbook matching answer.
3. Write a short explanation (1-2 sentences) of the grade in the feedback property.
Output response matching the JSON schema.`;

      try {
        const result = await generateContentWithRetry(model, prompt);
        const textResponse = result.response.text();
        const parsed = JSON.parse(textResponse);

        let finalScore = Number(parsed.score);
        if (isNaN(finalScore)) finalScore = 0;
        finalScore = Math.max(0, Math.min(maxMarks, finalScore));
        finalScore = Math.round(finalScore * 10) / 10;

        gradedResults.push({
          questionId: question.id,
          score: finalScore,
          maxMarks,
          feedback: parsed.feedback || "Answer evaluated.",
        });
      } catch (err) {
        console.error(`Error grading question ${question.id}:`, err);
        gradedResults.push({
          questionId: question.id,
          score: 0,
          maxMarks,
          feedback: `AI grading encountered an issue: ${err instanceof Error ? err.message : "safety block or parse failure"}.`,
        });
      }
    }

    return NextResponse.json({ gradedResults });
  } catch (error) {
    console.error("Error in grade API:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
