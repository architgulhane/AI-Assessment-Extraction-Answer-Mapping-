import { NextResponse } from "next/server";
import { Question, AnswerBlock, MappedResult } from "@/lib/types";
import { getEmbeddings, cosineSimilarity } from "@/lib/embeddings";

// Helper to normalize labels for explicit matching (e.g. "Q11(a)" -> "11a", "q2" -> "2")
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
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let intersection = 0;
  words1.forEach(w => {
    if (words2.has(w)) intersection++;
  });
  
  return intersection / Math.max(words1.size, words2.size);
}

export async function POST(request: Request) {
  try {
    const { questions, answerBlocks } = await request.json() as {
      questions: Question[];
      answerBlocks: AnswerBlock[];
    };

    if (!questions || !answerBlocks) {
      return NextResponse.json({ error: "Missing questions or answerBlocks" }, { status: 400 });
    }

    const mappedResults: MappedResult[] = [];
    const matchedBlockIds = new Set<string>();

    // Step 1: Explicit Label Matching
    // Map answer blocks that have a label like "Q1" or "11a" directly to matching questions
    const questionNormalMap = new Map<string, Question>();
    questions.forEach(q => {
      // e.g. "q11a" -> "11a"
      const normQ = normalizeLabel(q.id);
      questionNormalMap.set(normQ, q);
    });

    // Group explicit matches by question ID
    const explicitMappings = new Map<string, string[]>(); // questionId -> answerBlockIds[]

    answerBlocks.forEach(block => {
      if (block.detectedQuestionLabel && block.detectedQuestionLabel.trim() !== "") {
        const normLabel = normalizeLabel(block.detectedQuestionLabel);
        // Find if any question normalizes to this label
        let matchedQuestion = questionNormalMap.get(normLabel);
        
        // If not found, try to match by number directly (e.g. label "11" matches question "11a" if no other fits,
        // or matches "11" if exact)
        if (!matchedQuestion) {
          matchedQuestion = questions.find(q => normalizeLabel(q.number) === normLabel);
        }

        if (matchedQuestion) {
          const list = explicitMappings.get(matchedQuestion.id) || [];
          list.push(block.id);
          explicitMappings.set(matchedQuestion.id, list);
          matchedBlockIds.add(block.id);
        }
      }
    });

    // Write explicit matches to final results
    explicitMappings.forEach((blockIds, questionId) => {
      mappedResults.push({
        questionId,
        answerBlockIds: blockIds,
        matchMethod: "explicit-label",
      });
    });

    // Step 2: Embedding Fallback Matching for unmatched answer blocks
    const unmatchedBlocks = answerBlocks.filter(b => !matchedBlockIds.has(b.id));
    const unmatchedQuestions = questions.filter(q => !mappedResults.some(m => m.questionId === q.id));

    if (unmatchedBlocks.length > 0 && unmatchedQuestions.length > 0) {
      try {
        // Fetch embeddings for unmatched questions (E5 query prefix)
        const questionEmbeddings = await Promise.all(
          unmatchedQuestions.map(async (q) => {
            const vector = await getEmbeddings(`query: ${q.text}`);
            return { questionId: q.id, vector };
          })
        );

        // Fetch embeddings for unmatched blocks (E5 passage prefix)
        const blockEmbeddings = await Promise.all(
          unmatchedBlocks.map(async (b) => {
            const vector = await getEmbeddings(`passage: ${b.transcribedText}`);
            return { blockId: b.id, vector };
          })
        );

        // Map unmatched blocks to their highest similarity unmatched question (brute-force cosine similarity)
        blockEmbeddings.forEach(be => {
          let bestQuestionId = "";
          let bestScore = -1;

          questionEmbeddings.forEach(qe => {
            const score = cosineSimilarity(be.vector, qe.vector);
            if (score > bestScore) {
              bestScore = score;
              bestQuestionId = qe.questionId;
            }
          });

          // Match only if similarity satisfies the 0.5 threshold
          if (bestScore >= 0.5 && bestQuestionId) {
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
        // ASSUMPTION: Fall back to substring / token overlap similarity heuristic if Hugging Face API fails or is rate-limited
        console.warn("Hugging Face Embedding API failed, falling back to substring overlap heuristic.", embError);
        
        unmatchedBlocks.forEach(b => {
          let bestQuestionId = "";
          let bestScore = -1;

          unmatchedQuestions.forEach(q => {
            const score = getSimpleTextSimilarity(q.text, b.transcribedText);
            if (score > bestScore) {
              bestScore = score;
              bestQuestionId = q.id;
            }
          });

          if (bestScore >= 0.3 && bestQuestionId) {
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
    // Any question with zero matched blocks after both passes must be present in the results with an empty answerBlockIds array
    questions.forEach(q => {
      const isMapped = mappedResults.some(r => r.questionId === q.id);
      if (!isMapped) {
        mappedResults.push({
          questionId: q.id,
          answerBlockIds: [],
          matchMethod: "unmatched",
        });
      }
    });

    // Step 4: Group multi-page / multi-block answers
    // In case multiple blocks mapped to the same question (can happen if multiple explicit labels exist, or fallback matched them),
    // group them under a single MappedResult and sort by pageIndex / block coordinate order.
    const groupedMap = new Map<string, MappedResult>();
    mappedResults.forEach(r => {
      const existing = groupedMap.get(r.questionId);
      if (existing) {
        // Combine answerBlockIds and remove duplicates
        existing.answerBlockIds = Array.from(new Set([...existing.answerBlockIds, ...r.answerBlockIds]));
        // Keep the best matchMethod
        if (existing.matchMethod === "unmatched") {
          existing.matchMethod = r.matchMethod;
          existing.matchConfidence = r.matchConfidence;
        }
      } else {
        groupedMap.set(r.questionId, r);
      }
    });

    const finalMappedResults = Array.from(groupedMap.values());

    // Sort answer blocks inside each mapped result in page order, then by vertical coordinate (y_min)
    finalMappedResults.forEach(r => {
      if (r.answerBlockIds.length > 1) {
        r.answerBlockIds.sort((id1, id2) => {
          const b1 = answerBlocks.find(b => b.id === id1);
          const b2 = answerBlocks.find(b => b.id === id2);
          if (!b1 || !b2) return 0;
          if (b1.pageIndex !== b2.pageIndex) {
            return b1.pageIndex - b2.pageIndex;
          }
          return b1.boxNormalized[0] - b2.boxNormalized[0]; // sort by y_min
        });
      }
    });

    // Extract completely unmatched blocks (for informational layout rendering)
    const unmatchedAnswerBlockIds = answerBlocks
      .filter(b => !matchedBlockIds.has(b.id))
      .map(b => b.id);

    return NextResponse.json({
      mappedResults: finalMappedResults,
      unmatchedAnswerBlockIds,
    });
  } catch (error) {
    console.error("Error in map API:", error);
    const errMsg = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
