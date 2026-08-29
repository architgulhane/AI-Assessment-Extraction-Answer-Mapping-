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
  Sparkles,
  Info,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ReviewPage() {
  const router = useRouter();
  const {
    questions,
    answerBlocks,
    mappedResults,
    gradedResults,
    answerSheetImages,
  } = useVeda();

  const hasData = questions.length > 0 && answerSheetImages.length > 0;

  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Set<string>>(new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Default to collapsed in review!

  useEffect(() => {
    if (questions.length > 0) {
      setSelectedQuestionId(questions[0].id);
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
        <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={setIsSidebarCollapsed} />
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          <Topbar breadcrumbs={["Exams", "Grading Review"]} />
          <main className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
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

  const toggleFeedback = (qId: string) => {
    const next = new Set(expandedFeedbackIds);
    if (next.has(qId)) {
      next.delete(qId);
    } else {
      next.add(qId);
    }
    setExpandedFeedbackIds(next);
  };

  const expandAll = () => {
    setExpandedFeedbackIds(new Set(questions.map((q) => q.id)));
  };

  const collapseAll = () => {
    setExpandedFeedbackIds(new Set());
  };

  const getQuestionDetails = (questionId: string) => {
    const mapping = mappedResults.find((m) => m.questionId === questionId);
    const grading = gradedResults.find((g) => g.questionId === questionId);
    return { mapping, grading };
  };

  const handleBlockClick = (blockId: string) => {
    const block = answerBlocks.find((b) => b.id === blockId);
    if (block) {
      setCurrentPageIndex(block.pageIndex);
    }
  };

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

  const selectedQuestionBlocks = selectedQuestionId
    ? mappedResults.find((m) => m.questionId === selectedQuestionId)?.answerBlockIds || []
    : [];

  const unmatchedBlockIds = answerBlocks
    .filter(
      (b) =>
        !mappedResults.some(
          (m) => m.answerBlockIds && m.answerBlockIds.includes(b.id)
        )
    )
    .map((b) => b.id);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={setIsSidebarCollapsed} />

      {/* Content wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
        <Topbar breadcrumbs={["Exams"]} backUrl="/" />

        {/* Split screen content layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left panel: Graded Question List */}
          <div className="w-[480px] border-r border-slate-200 bg-white flex flex-col overflow-hidden shrink-0">
            
            {/* Header info */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Extracted Questions (from question paper)
                </h2>
              </div>
              <button
                onClick={expandedFeedbackIds.size === questions.length ? collapseAll : expandAll}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 shadow-sm"
              >
                {expandedFeedbackIds.size === questions.length ? "Collapse All" : "Expand All"}
              </button>
            </div>

            {/* Questions list container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {questions.map((q) => {
                const { mapping, grading } = getQuestionDetails(q.id);
                const isSelected = selectedQuestionId === q.id;
                const isExpanded = expandedFeedbackIds.has(q.id);
                
                // Color badge logic
                const score = grading ? grading.score : 0;
                const max = grading ? grading.maxMarks : q.maxMarks || 5;
                const isFull = score === max && max > 0;
                const isZero = score === 0;
                
                let badgeColor = "bg-amber-50 text-amber-600 border-amber-200";
                if (isFull) {
                  badgeColor = "bg-emerald-50 text-emerald-600 border-emerald-100";
                } else if (isZero) {
                  badgeColor = "bg-rose-50 text-rose-600 border-rose-100";
                }

                const isUnanswered = !mapping || mapping.answerBlockIds.length === 0;

                return (
                  <div
                    key={q.id}
                    onClick={() => handleQuestionSelect(q.id)}
                    className={`transition-all duration-200 p-5 rounded-2xl cursor-pointer border ${
                      isSelected
                        ? "border-orange-500 bg-white shadow-sm ring-1 ring-orange-500/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Question Number circle */}
                      <div
                        className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold transition-colors ${
                          isSelected
                            ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                            : "bg-slate-700 text-white"
                        }`}
                      >
                        {q.number}
                        {q.subPart && <span className="text-[10px]">{q.subPart}</span>}
                      </div>

                      {/* Question Text & Badge */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Question {q.number}
                            {q.subPart && `(${q.subPart})`}
                          </span>
                          
                          {/* Score Badge */}
                          <div className={`px-2.5 py-0.5 rounded-full border text-[11px] font-black leading-none ${badgeColor}`}>
                            {score}/{max}
                          </div>
                        </div>

                        <p className="text-sm font-semibold text-slate-800 leading-relaxed mb-3">
                          {q.text}
                        </p>

                        {/* Mapped blocks info */}
                        <div className="flex items-center gap-2">
                          {isUnanswered ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">
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
                                    className={`px-2 py-0.7 rounded text-[10px] font-bold transition-all shadow-sm ${
                                      isBlockOnCurrentPage
                                        ? "bg-orange-500 text-white"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100/50"
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
                      
                      {/* Chevron up/down on card header */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFeedback(q.id);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* AI Feedback Section */}
                    {grading && isExpanded && (
                      <div className="mt-3.5 p-4 rounded-xl border border-slate-100 bg-slate-50 text-xs text-slate-600 leading-relaxed animate-fade-in">
                        <p className="font-bold text-slate-800 mb-1">
                          AI Feedback
                        </p>
                        {grading.feedback}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unmatched Answer Blocks Section */}
              {unmatchedBlockIds.length > 0 && (
                <div className="p-5 bg-slate-100/50 border border-slate-200 rounded-2xl mt-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-slate-400" />
                    Unmatched Answer Blocks
                  </h3>
                  
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    Detected handwriting blocks that could not be mapped to any question on the paper.
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
                              setSelectedQuestionId(null);
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
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            
            {/* Viewer control bar */}
            <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 select-none">
              <span className="text-sm font-bold text-slate-700">Answer Sheet</span>
              
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
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
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
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image viewer viewport */}
            <div className="flex-1 overflow-auto bg-slate-200/50 p-8 flex justify-center items-start shadow-inner">
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
                    if (block.pageIndex !== currentPageIndex) return null;

                    const isUnmatched = unmatchedBlockIds.includes(block.id);
                    const isSelected = selectedQuestionBlocks.includes(block.id);
                    const isMappedButNotSelected = !isUnmatched && !isSelected;

                    let overlayClass = "";
                    let labelBgColor = "bg-slate-600";
                    let questionLabelText = "";

                    if (isSelected) {
                      overlayClass = "border-2 border-orange-500 bg-orange-500/15 z-20 scale-[1.01]";
                      labelBgColor = "bg-orange-500";
                      
                      const matchedQ = questions.find((q) =>
                        mappedResults.find((m) => m.questionId === q.id)?.answerBlockIds.includes(block.id)
                      );
                      questionLabelText = matchedQ ? `Q${matchedQ.number}` : "Select";
                    } else if (isMappedButNotSelected) {
                      overlayClass = "border-2 border-emerald-500 bg-emerald-500/10 cursor-pointer z-10 hover:z-20";
                      labelBgColor = "bg-emerald-500";
                      
                      const matchedQ = questions.find((q) =>
                        mappedResults.find((m) => m.questionId === q.id)?.answerBlockIds.includes(block.id)
                      );
                      questionLabelText = matchedQ ? `Q${matchedQ.number}` : "Mapped";
                    } else {
                      overlayClass = "border-2 border-slate-400 border-dashed bg-slate-500/5 cursor-pointer z-10 hover:z-20";
                      labelBgColor = "bg-slate-500";
                      questionLabelText = "Unmatched";
                    }

                    return (
                      <div
                        key={block.id}
                        style={getBoxStyle(block.boxNormalized)}
                        className={`absolute rounded group/box transition-all ${overlayClass}`}
                        onClick={() => {
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
                        {/* Anchor Question Label Box on Bounding Box Border */}
                        <div className={`absolute -top-3.5 left-2 px-1.5 py-0.5 rounded text-[8px] font-black text-white whitespace-nowrap shadow-sm z-30 select-none ${labelBgColor}`}>
                          {questionLabelText}
                        </div>

                        {/* Overlay Transcription preview tooltip */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-56 p-2.5 rounded-lg bg-slate-900/95 backdrop-blur-sm text-[10px] text-slate-100 leading-relaxed shadow-md opacity-0 group-hover/box:opacity-100 transition-opacity duration-200 pointer-events-none z-30 break-words font-medium">
                          <p className="font-bold text-orange-400 mb-0.5 uppercase tracking-wider text-[8px]">Transcription:</p>
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
