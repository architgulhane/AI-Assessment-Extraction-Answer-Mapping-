import { NextResponse } from "next/server";
import { Question, AnswerBlock, MappedResult, GradedResult } from "@/lib/types";
import { genAI } from "@/lib/gemini";
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

    const gradingPromises = questions.map(async (question) => {
      // Find the mapped result for this question
      const mapped = mappedResults.find((m) => m.questionId === question.id);
      
      const maxMarks = question.maxMarks || 5;

      // Rule: Unanswered questions skip the API call entirely
      if (!mapped || !mapped.answerBlockIds || mapped.answerBlockIds.length === 0) {
        return {
          questionId: question.id,
          score: 0,
          maxMarks,
          feedback: "Not answered.",
        } as GradedResult;
      }

      // Collect and concatenate all transcribed text from mapped blocks
      const transcribedTexts = mapped.answerBlockIds.map((blockId) => {
        const block = answerBlocks.find((b) => b.id === blockId);
        return block ? block.transcribedText : "";
      }).filter(text => text.trim() !== "");

      if (transcribedTexts.length === 0) {
        return {
          questionId: question.id,
          score: 0,
          maxMarks,
          feedback: "Not answered.",
        } as GradedResult;
      }

      const combinedAnswerText = transcribedTexts.join("\n\n");

      // Text-only call for grading (no image)
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
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

      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();
      const parsed = JSON.parse(textResponse);

      // Capping score to maxMarks and floor to 0
      let finalScore = Number(parsed.score);
      if (isNaN(finalScore)) finalScore = 0;
      finalScore = Math.max(0, Math.min(maxMarks, finalScore));

      // Round to 1 decimal place if decimal
      finalScore = Math.round(finalScore * 10) / 10;

      return {
        questionId: question.id,
        score: finalScore,
        maxMarks,
        feedback: parsed.feedback || "Answer evaluated.",
      } as GradedResult;
    });

    const gradedResults = await Promise.all(gradingPromises);

    return NextResponse.json({ gradedResults });
  } catch (error) {
    console.error("Error in grade API:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
