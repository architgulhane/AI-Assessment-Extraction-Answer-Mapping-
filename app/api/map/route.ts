import { NextResponse } from "next/server";
import { Question, AnswerBlock, MappedResult } from "@/lib/types";
import { getEmbeddings, cosineSimilarity } from "@/lib/embeddings";

// Helper to extract clean question number string (e.g. "Q26." -> "26", "26(a)" -> "26a", "Question 26" -> "26")
function extractNumber(text: string): string {
  if (!text) return "";
  let clean = text.toLowerCase().trim();
  clean = clean.replace(/^(?:question|answer|ans|q)\s*/i, "");
  const match = clean.match(/^(\d+[a-z]?)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return clean.replace(/[^a-z0-9]/g, "");
}

export async function POST(request: Request) {
  try {
    const { questions, answerBlocks } = (await request.json()) as {
      questions: Question[];
      answerBlocks: AnswerBlock[];
    };

    if (!questions || !answerBlocks) {
      return NextResponse.json({ error: "Missing questions or answerBlocks" }, { status: 400 });
    }

    const mappedResults: MappedResult[] = [];
    const matchedBlockIds = new Set<string>();

    // Build lookup maps for questions
    const questionByNum = new Map<string, Question>();
    questions.forEach((q) => {
      const numKey = extractNumber(q.number + (q.subPart || ""));
      const simpleNumKey = extractNumber(q.number);
      const idKey = extractNumber(q.id);

      if (numKey) questionByNum.set(numKey, q);
      if (simpleNumKey && !questionByNum.has(simpleNumKey)) questionByNum.set(simpleNumKey, q);
      if (idKey && !questionByNum.has(idKey)) questionByNum.set(idKey, q);
    });

    const explicitMappings = new Map<string, string[]>();

    // Pass 1: Out-of-Order Explicit Number Matching
    answerBlocks.forEach((block) => {
      let extractedLabel = block.detectedQuestionLabel || "";

      // Fallback: extract leading label from transcribed text (e.g. "26. Distinguish...", "Q26: ...")
      if (!extractedLabel || extractedLabel.trim() === "") {
        const textMatch = block.transcribedText.match(/^(?:Q|Question|Ans|Answer)?\s*(\d+[a-z]?)\b[\.\):]?/i);
        if (textMatch) {
          extractedLabel = textMatch[1];
        }
      }

      const cleanLabel = extractNumber(extractedLabel);

      if (cleanLabel) {
        let matchedQ = questionByNum.get(cleanLabel);

        // Try digits-only fallback
        if (!matchedQ) {
          const digitsOnly = cleanLabel.replace(/[^0-9]/g, "");
          if (digitsOnly) {
            matchedQ = questions.find((q) => extractNumber(q.number) === digitsOnly);
          }
        }

        if (matchedQ) {
          const list = explicitMappings.get(matchedQ.id) || [];
          list.push(block.id);
          explicitMappings.set(matchedQ.id, list);
          matchedBlockIds.add(block.id);
        }
      }
    });

    // Save Pass 1 explicit matches
    explicitMappings.forEach((blockIds, questionId) => {
      mappedResults.push({
        questionId,
        answerBlockIds: blockIds,
        matchMethod: "explicit-label",
      });
    });

    // Pass 2: Semantic Similarity Fallback for remaining unmatched blocks
    const remainingBlocks = answerBlocks.filter((b) => !matchedBlockIds.has(b.id));
    const remainingQuestions = questions.filter((q) => !mappedResults.some((m) => m.questionId === q.id));

    if (remainingBlocks.length > 0 && remainingQuestions.length > 0) {
      try {
        const questionEmbeddings = await Promise.all(
          remainingQuestions.map(async (q) => {
            const vector = await getEmbeddings(`query: ${q.text}`);
            return { questionId: q.id, vector };
          })
        );

        const blockEmbeddings = await Promise.all(
          remainingBlocks.map(async (b) => {
            const vector = await getEmbeddings(`passage: ${b.transcribedText}`);
            return { blockId: b.id, vector };
          })
        );

        blockEmbeddings.forEach((be) => {
          let bestQuestionId = "";
          let bestScore = -1;

          questionEmbeddings.forEach((qe) => {
            const score = cosineSimilarity(be.vector, qe.vector);
            if (score > bestScore) {
              bestScore = score;
              bestQuestionId = qe.questionId;
            }
          });

          if (bestScore >= 0.35 && bestQuestionId) {
            mappedResults.push({
              questionId: bestQuestionId,
              answerBlockIds: [be.blockId],
              matchMethod: "embedding-fallback",
              matchConfidence: parseFloat(bestScore.toFixed(3)),
            });
            matchedBlockIds.add(be.blockId);
          }
        });
      } catch (embErr) {
        console.warn("Embedding fallback failed:", embErr);
      }
    }

    // Step 3: Handle Unanswered Questions
    // Any question in the Question Paper without a matching answer block gets marked as Unanswered
    questions.forEach((q) => {
      const isMapped = mappedResults.some((r) => r.questionId === q.id);
      if (!isMapped) {
        mappedResults.push({
          questionId: q.id,
          answerBlockIds: [],
          matchMethod: "unmatched",
        });
      }
    });

    return NextResponse.json({ mappedResults });
  } catch (error) {
    console.error("Error in map API:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
