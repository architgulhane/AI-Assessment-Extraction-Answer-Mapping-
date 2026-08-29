import { NextResponse } from "next/server";
import { Question, AnswerBlock, MappedResult } from "@/lib/types";
import { getEmbeddings, cosineSimilarity } from "@/lib/embeddings";

// Helper to normalize labels for explicit matching (e.g. "Q11(a)" -> "11a", "q2" -> "2", "26." -> "26")
function normalizeLabel(label: string): string {
  let clean = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (clean.startsWith("question")) {
    clean = clean.substring(8);
  }
  if (clean.startsWith("q")) {
    clean = clean.substring(1);
  }
  return clean;
}

// Substring/token overlap helper to fall back to if Hugging Face API is down or rate-limited
function getSimpleTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  words1.forEach((w) => {
    if (words2.has(w)) intersection++;
  });

  return intersection / Math.max(words1.size, words2.size);
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

    // Step 1: Explicit Label Matching
    const questionNormalMap = new Map<string, Question>();
    questions.forEach((q) => {
      const normId = normalizeLabel(q.id);
      const normNum = normalizeLabel(q.number + (q.subPart || ""));
      questionNormalMap.set(normId, q);
      questionNormalMap.set(normNum, q);
      questionNormalMap.set(normalizeLabel(q.number), q);
    });

    const explicitMappings = new Map<string, string[]>();

    answerBlocks.forEach((block) => {
      let label = block.detectedQuestionLabel;
      
      // Fallback: If detectedQuestionLabel is empty, try parsing leading number from transcribedText (e.g. "26. Distinguish...")
      if (!label || label.trim() === "") {
        const leadingMatch = block.transcribedText.match(/^(?:Q|Question\s*)?(\d+[a-z]?)\b[\.\):]?/i);
        if (leadingMatch) {
          label = leadingMatch[1];
        }
      }

      if (label && label.trim() !== "") {
        const normLabel = normalizeLabel(label);
        let matchedQuestion = questionNormalMap.get(normLabel);

        if (!matchedQuestion) {
          matchedQuestion = questions.find(
            (q) =>
              normalizeLabel(q.number) === normLabel ||
              normalizeLabel(q.id) === normLabel ||
              normalizeLabel(q.number + (q.subPart || "")) === normLabel
          );
        }

        if (matchedQuestion) {
          const list = explicitMappings.get(matchedQuestion.id) || [];
          list.push(block.id);
          explicitMappings.set(matchedQuestion.id, list);
          matchedBlockIds.add(block.id);
        }
      }
    });

    explicitMappings.forEach((blockIds, questionId) => {
      mappedResults.push({
        questionId,
        answerBlockIds: blockIds,
        matchMethod: "explicit-label",
      });
    });

    // Step 2: Embedding / Similarity Fallback Matching
    const unmatchedBlocks = answerBlocks.filter((b) => !matchedBlockIds.has(b.id));
    const unmatchedQuestions = questions.filter(
      (q) => !mappedResults.some((m) => m.questionId === q.id)
    );

    if (unmatchedBlocks.length > 0 && unmatchedQuestions.length > 0) {
      try {
        const questionEmbeddings = await Promise.all(
          unmatchedQuestions.map(async (q) => {
            const vector = await getEmbeddings(`query: ${q.text}`);
            return { questionId: q.id, vector };
          })
        );

        const blockEmbeddings = await Promise.all(
          unmatchedBlocks.map(async (b) => {
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

          if (bestScore >= 0.4 && bestQuestionId) {
            mappedResults.push({
              questionId: bestQuestionId,
              answerBlockIds: [be.blockId],
              matchMethod: "embedding-fallback",
              matchConfidence: parseFloat(bestScore.toFixed(3)),
            });
            matchedBlockIds.add(be.blockId);
          }
        });
      } catch (embError) {
        console.warn("Hugging Face Embedding API failed, falling back to substring overlap heuristic.", embError);

        unmatchedBlocks.forEach((b) => {
          let bestQuestionId = "";
          let bestScore = -1;

          unmatchedQuestions.forEach((q) => {
            const score = getSimpleTextSimilarity(q.text, b.transcribedText);
            if (score > bestScore) {
              bestScore = score;
              bestQuestionId = q.id;
            }
          });

          if (bestScore >= 0.25 && bestQuestionId) {
            mappedResults.push({
              questionId: bestQuestionId,
              answerBlockIds: [b.id],
              matchMethod: "embedding-fallback",
              matchConfidence: parseFloat(bestScore.toFixed(3)),
            });
            matchedBlockIds.add(b.id);
          }
        });
      }
    }

    // Step 3: Handle Unanswered Questions
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
