"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useVeda } from "@/lib/context";
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Award,
  Sparkles,
  Info,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ReviewPage() {
  const router = useRouter();
  const {
    questionPaperName,
    answerSheetName,
    questions,
    answerBlocks,
    mappedResults,
    gradedResults,
    answerSheetImages,
  } = useVeda();

  // Redirect if no data is present (e.g. page refresh)
  const hasData = questions.length > 0 && answerSheetImages.length > 0;

  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Set<string>>(new Set());

  // Set the first question as selected by default on load
  useEffect(() => {
    if (questions.length > 0) {
      setSelectedQuestionId(questions[0].id);
      // If the first question has a mapped block, jump to its page
      const mapped = mappedResults.find((m) => m.questionId === questions[0].id);
      if (mapped && mapped.answerBlockIds.length > 0) {
        const firstBlock = answerBlocks.find((b) => b.id === mapped.answerBlockIds[0]);
        if (firstBlock) {
          setCurrentPageIndex(firstBlock.pageIndex);
        }
      }
    }
  }, [questions, mappedResults, answerBlocks]);

  if (!hasData) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          <Topbar breadcrumbs={["Exams", "Grading Review"]} />
          <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">No Assessment Loaded</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm">
              It seems there is no assessment data in-memory. This can happen if you refresh the page.
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
            >
              Go to Upload Screen
            </button>
          </main>
        </div>
      </div>
    );
  }

  // Toggle feedback card expanded state
  const toggleFeedback = (qId: string) => {
    const next = new Set(expandedFeedbackIds);
    if (next.has(qId)) {
      next.delete(qId);
    } else {
      next.add(qId);
    }
    setExpandedFeedbackIds(next);
  };

  // Find mapping and grading details for a question
  const getQuestionDetails = (questionId: string) => {
    const mapping = mappedResults.find((m) => m.questionId === questionId);
    const grading = gradedResults.find((g) => g.questionId === questionId);
    return { mapping, grading };
  };

  // Switch to the page containing the selected answer block
  const handleBlockClick = (blockId: string) => {
    const block = answerBlocks.find((b) => b.id === blockId);
    if (block) {
      setCurrentPageIndex(block.pageIndex);
    }
  };

  // Select a question and jump to its first answer block page
  const handleQuestionSelect = (qId: string) => {
    setSelectedQuestionId(qId);
    const mapping = mappedResults.find((m) => m.questionId === qId);
    if (mapping && mapping.answerBlockIds.length > 0) {
      const firstBlock = answerBlocks.find((b) => b.id === mapping.answerBlockIds[0]);
      if (firstBlock) {
        setCurrentPageIndex(firstBlock.pageIndex);
      }
    }
  };

  // Bounding box overlay calculation
  const getBoxStyle = (boxNormalized: [number, number, number, number]) => {
    const [y_min, x_min, y_max, x_max] = boxNormalized;
    const top = y_min / 10;
    const left = x_min / 10;
    const height = (y_max - y_min) / 10;
    const width = (x_max - x_min) / 10;

    return {
      top: `${top}%`,
      left: `${left}%`,
      height: `${height}%`,
      width: `${width}%`,
    };
  };

  // Retrieve blocks mapped to the currently selected question
  const selectedQuestionBlocks = selectedQuestionId
    ? mappedResults.find((m) => m.questionId === selectedQuestionId)?.answerBlockIds || []
    : [];

  // Retrieve blocks that are completely unmatched
  const unmatchedBlockIds = answerBlocks
    .filter(
      (b) =>
        !mappedResults.some(
          (m) => m.answerBlockIds && m.answerBlockIds.includes(b.id)
        )
    )
    .map((b) => b.id);

  // Retrieve total scores and average stats
  const totalScore = gradedResults.reduce((sum, g) => sum + g.score, 0);
  const totalMaxMarks = gradedResults.reduce((sum, g) => sum + g.maxMarks, 0);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Content wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <Topbar
          breadcrumbs={["Exams", "Grading Review"]}
          backUrl="/"
          actionButton={
            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <div className="flex items-center gap-1.5 text-indigo-600">
                <Award className="w-4 h-4" />
                <span>Classroom Grade:</span>
              </div>
              <span className="text-slate-800 text-sm font-bold">
                {totalScore.toFixed(1)} / {totalMaxMarks}
              </span>
            </div>
          }
        />

        {/* Split screen content layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left panel: Graded Question List */}
          <div className="w-[440px] border-r border-slate-200 bg-white flex flex-col overflow-hidden shrink-0">
            
            {/* Header info */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-800 truncate">
                {answerSheetName || "Answer Sheets"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                Question Paper: {questionPaperName || "N/A"}
              </p>
            </div>

            {/* Questions list container */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {questions.map((q) => {
                const { mapping, grading } = getQuestionDetails(q.id);
                const isSelected = selectedQuestionId === q.id;
                const isExpanded = expandedFeedbackIds.has(q.id);
                
                // Color badge logic
                const score = grading ? grading.score : 0;
                const max = grading ? grading.maxMarks : q.maxMarks || 5;
                const isFull = score === max && max > 0;
                const isZero = score === 0;
                
                let badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                if (isFull) {
                  badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                } else if (isZero) {
                  badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
                }

                const isUnanswered = !mapping || mapping.answerBlockIds.length === 0;

                return (
                  <div
                    key={q.id}
                    className={`transition-colors relative ${
                      isSelected ? "bg-indigo-50/20" : "hover:bg-slate-50/50"
                    }`}
                  >
                    {/* Left border selection indicator */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
                    )}

                    <div
                      onClick={() => handleQuestionSelect(q.id)}
                      className="p-5 cursor-pointer flex items-start gap-4"
                    >
                      {/* Question Number circle */}
                      <div
                        className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {q.number}
                        {q.subPart && <span className="text-[10px]">{q.subPart}</span>}
                      </div>

                      {/* Question Text & Badge */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                            Question {q.number}
                            {q.subPart && `(${q.subPart})`}
                          </span>
                          
                          {/* Score Badge */}
                          <div className={`px-2 py-0.5 rounded border text-[11px] font-bold ${badgeColor}`}>
                            {score}/{max}
                          </div>
                        </div>

                        <p className="text-sm font-medium text-slate-800 leading-relaxed mb-3 pr-2">
                          {q.text}
                        </p>

                        {/* Mapped blocks info */}
                        <div className="flex items-center gap-2">
                          {isUnanswered ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold">
                              <Info className="w-3.5 h-3.5" />
                              Not Answered
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {mapping.answerBlockIds.map((blockId, idx) => {
                                const block = answerBlocks.find((b) => b.id === blockId);
                                const isBlockOnCurrentPage = block?.pageIndex === currentPageIndex;
                                return (
                                  <button
                                    key={blockId}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBlockClick(blockId);
                                    }}
                                    className={`px-2 py-0.7 rounded text-[10px] font-semibold transition-all shadow-sm ${
                                      isBlockOnCurrentPage
                                        ? "bg-orange-500 text-white font-bold"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/50"
                                    }`}
                                  >
                                    Page {block ? block.pageIndex + 1 : "?"} (Block {idx + 1})
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {mapping?.matchMethod === "embedding-fallback" && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-bold ml-auto bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                              <Sparkles className="w-3 h-3" />
                              AI Fallback Match ({Math.round((mapping.matchConfidence || 0) * 100)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Feedback Section */}
                    {grading && (
                      <div className="px-5 pb-5 pt-0">
                        <button
                          onClick={() => toggleFeedback(q.id)}
                          className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            AI Grading Feedback
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 text-xs text-slate-700 leading-relaxed shadow-inner animate-fade-in">
                            <p className="font-semibold text-indigo-950 mb-1 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
                              Evaluation Notes:
                            </p>
                            {grading.feedback}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unmatched Answer Blocks Section */}
              {unmatchedBlockIds.length > 0 && (
                <div className="p-5 bg-slate-50/70 border-t border-slate-200">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-slate-400" />
                    Unmatched Answer Blocks
                  </h3>
                  
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    Gemini detected these handwriting blocks, but they could not be mapped to any question on the paper.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {unmatchedBlockIds.map((blockId, idx) => {
                      const block = answerBlocks.find((b) => b.id === blockId);
                      const isBlockOnCurrentPage = block?.pageIndex === currentPageIndex;

                      return (
                        <button
                          key={blockId}
                          onClick={() => {
                            if (block) {
                              setCurrentPageIndex(block.pageIndex);
                              setSelectedQuestionId(null); // clear selected question
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all border ${
                            isBlockOnCurrentPage
                              ? "bg-slate-700 text-white border-slate-700"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          Unmatched {idx + 1} (Page {block ? block.pageIndex + 1 : "?"})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Paginated Answer Sheet Viewer with overlays */}
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Viewer control bar */}
            <div className="h-12 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
              
              {/* Page navigation */}
              <div className="flex items-center gap-3">
                <button
                  disabled={currentPageIndex === 0}
                  onClick={() => setCurrentPageIndex(currentPageIndex - 1)}
                  className={`p-1 rounded-md transition-colors ${
                    currentPageIndex === 0
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs font-semibold text-slate-700">
                  Page {currentPageIndex + 1} of {answerSheetImages.length}
                </span>
                <button
                  disabled={currentPageIndex === answerSheetImages.length - 1}
                  onClick={() => setCurrentPageIndex(currentPageIndex + 1)}
                  className={`p-1 rounded-md transition-colors ${
                    currentPageIndex === answerSheetImages.length - 1
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-2">
                <button
                  disabled={zoomLevel <= 50}
                  onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                  className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-600 min-w-[36px] text-center">
                  {zoomLevel}%
                </span>
                <button
                  disabled={zoomLevel >= 200}
                  onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
                  className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image viewer viewport */}
            <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center items-start shadow-inner">
              <div
                style={{ width: `${zoomLevel}%`, maxWidth: "1000px" }}
                className="relative bg-white shadow-md border border-slate-200 rounded-lg overflow-hidden transition-all duration-150 shrink-0"
              >
                {/* Answer page image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={answerSheetImages[currentPageIndex]}
                  alt={`Answer page ${currentPageIndex + 1}`}
                  className="w-full h-auto select-none block"
                  draggable={false}
                />

                {/* Bounding box overlays */}
                <div className="absolute inset-0">
                  {answerBlocks.map((block) => {
                    // Only show blocks for the current page
                    if (block.pageIndex !== currentPageIndex) return null;

                    const isUnmatched = unmatchedBlockIds.includes(block.id);
                    const isSelected = selectedQuestionBlocks.includes(block.id);
                    
                    // A block is "green-mapped" if it is mapped to a question but that question is NOT currently selected
                    const isMappedButNotSelected = !isUnmatched && !isSelected;

                    let overlayClass = "";
                    if (isSelected) {
                      // Orange highlight for active/selected block
                      overlayClass = "border-3 border-orange-500 bg-orange-500/20 ring-4 ring-orange-500/20 z-20 shadow-lg scale-[1.01]";
                    } else if (isMappedButNotSelected) {
                      // Green highlight for other mapped questions
                      overlayClass = "border-2 border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer z-10 hover:z-20 transition-all";
                    } else {
                      // Neutral gray highlight for unmatched blocks
                      overlayClass = "border-2 border-slate-400 border-dashed bg-slate-500/5 hover:bg-slate-500/15 cursor-pointer z-10 hover:z-20 transition-all";
                    }

                    return (
                      <div
                        key={block.id}
                        style={getBoxStyle(block.boxNormalized)}
                        className={`absolute rounded group/box ${overlayClass}`}
                        onClick={() => {
                          // If user clicks a block, find which question it belongs to and select it
                          const mapping = mappedResults.find((m) =>
                            m.answerBlockIds.includes(block.id)
                          );
                          if (mapping) {
                            setSelectedQuestionId(mapping.questionId);
                          } else {
                            setSelectedQuestionId(null);
                          }
                        }}
                      >
                        {/* Box label (Tooltip or small label) */}
                        <div className={`absolute -top-6 left-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap shadow-sm opacity-0 group-hover/box:opacity-100 transition-opacity duration-150 pointer-events-none z-30 ${
                          isSelected
                            ? "bg-orange-500"
                            : isMappedButNotSelected
                            ? "bg-emerald-600"
                            : "bg-slate-600"
                        }`}>
                          {isUnmatched ? (
                            "Unmatched Handwriting"
                          ) : (
                            `Question ${
                              questions.find(
                                (q) =>
                                  q.id ===
                                  mappedResults.find((m) =>
                                    m.answerBlockIds.includes(block.id)
                                  )?.questionId
                              )?.number || "?"
                            }`
                          )}
                        </div>

                        {/* Overlay Transcription preview tooltip */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-56 p-2 rounded bg-slate-900/95 backdrop-blur-sm text-[10px] text-slate-100 leading-normal shadow-md opacity-0 group-hover/box:opacity-100 transition-opacity duration-200 pointer-events-none z-30 break-words font-medium">
                          <p className="font-bold text-indigo-300 mb-0.5 uppercase tracking-wider text-[8px]">Transcription:</p>
                          &ldquo;{block.transcribedText}&rdquo;
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
