export type Question = {
  id: string;              // e.g. "q11a"
  number: string;           // printed number, e.g. "11"
  subPart?: string;         // e.g. "a"
  text: string;
  maxMarks?: number;
};

export type AnswerBlock = {
  id: string;
  pageIndex: number;
  boxNormalized: [number, number, number, number]; // [y_min, x_min, y_max, x_max], 0-1000
  transcribedText: string;
  detectedQuestionLabel?: string; // number Gemini thinks this answers, if visible
};

export type MappedResult = {
  questionId: string;
  answerBlockIds: string[];   // supports multi-page / multi-block answers
  matchMethod: "explicit-label" | "embedding-fallback" | "unmatched";
  matchConfidence?: number;    // only for embedding-fallback
};

export type GradedResult = {
  questionId: string;
  score: number;
  maxMarks: number;
  feedback: string;
  gradingStatus?: "graded" | "failed" | "unanswered";
};
