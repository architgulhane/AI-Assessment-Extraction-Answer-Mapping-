"use client";

export const dynamic = "force-dynamic";

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
  Pencil,
  Check,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";

type FilterType = "all" | "needs-review" | "unanswered";

export default function ReviewPage() {
  const router = useRouter();
  const {
    questions,
    answerBlocks,
    mappedResults,
    setMappedResults,
    gradedResults,
    setGradedResults,
    answerSheetImages,
  } = useVeda();

  const hasData = questions.length > 0 && answerSheetImages.length > 0;

  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Set<string>>(new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Default to collapsed in review!
  const [editingScoreQId, setEditingScoreQId] = useState<string | null>(null);
  const [tempScore, setTempScore] = useState<string>("");
  const [activeRemapBlockId, setActiveRemapBlockId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const handleRemapBlock = (blockId: string, newQuestionId: string | null) => {
    // 1. Remove blockId from any existing mappings
    const updated = mappedResults.map((m) => ({
      ...m,
      answerBlockIds: m.answerBlockIds.filter((id) => id !== blockId),
    }));

    // 2. If assigning to a question
    if (newQuestionId) {
      const existingIndex = updated.findIndex((m) => m.questionId === newQuestionId);
      if (existingIndex >= 0) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          answerBlockIds: [...updated[existingIndex].answerBlockIds, blockId],
          matchMethod: "explicit-label",
        };
      } else {
        updated.push({
          questionId: newQuestionId,
          answerBlockIds: [blockId],
          matchMethod: "explicit-label",
        });
      }
      setSelectedQuestionId(newQuestionId);
    }

    setMappedResults(updated);
    setActiveRemapBlockId(null);
  };

  const handleScoreChange = (qId: string, rawVal: string) => {
    const num = parseFloat(rawVal);
    const existing = gradedResults.find((g) => g.questionId === qId);
    const q = questions.find((item) => item.id === qId);
    const max = existing ? existing.maxMarks : (q?.maxMarks || 5);
    const validScore = isNaN(num) ? 0 : Math.max(0, Math.min(max, num));

    if (existing) {
      setGradedResults(
        gradedResults.map((g) =>
          g.questionId === qId ? { ...g, score: validScore } : g
        )
      );
    } else {
      setGradedResults([
        ...gradedResults,
        {
          questionId: qId,
          score: validScore,
          maxMarks: max,
          feedback: "Manually adjusted score.",
        },
      ]);
    }
    setEditingScoreQId(null);
  };

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

  // Grading Summary calculations
  const totalQuestions = questions.length;
  const answeredCount = questions.filter((q) => {
    const m = mappedResults.find((r) => r.questionId === q.id);
    return m && m.answerBlockIds && m.answerBlockIds.length > 0;
  }).length;
  const unansweredCount = totalQuestions - answeredCount;

  const totalScore = questions.reduce((acc, q) => {
    const g = gradedResults.find((gr) => gr.questionId === q.id);
    return acc + (g ? g.score : 0);
  }, 0);

  const totalPossibleMarks = questions.reduce((acc, q) => {
    const g = gradedResults.find((gr) => gr.questionId === q.id);
    return acc + (g ? g.maxMarks : q.maxMarks || 5);
  }, 0);

  const overallPercentage =
    totalPossibleMarks > 0 ? Math.round((totalScore / totalPossibleMarks) * 100) : 0;

  const filteredQuestions = questions.filter((q) => {
    const { mapping, grading } = getQuestionDetails(q.id);
    const isUnanswered = !mapping || !mapping.answerBlockIds || mapping.answerBlockIds.length === 0;
    
    if (filter === "unanswered") {
      return isUnanswered;
    }
    
    if (filter === "needs-review") {
      const score = grading ? grading.score : 0;
      const max = grading ? grading.maxMarks : q.maxMarks || 5;
      return score < max || isUnanswered;
    }
    
    return true;
  });

  const needsReviewCount = questions.filter((q) => {
    const { mapping, grading } = getQuestionDetails(q.id);
    const isUnanswered = !mapping || !mapping.answerBlockIds || mapping.answerBlockIds.length === 0;
    const score = grading ? grading.score : 0;
    const max = grading ? grading.maxMarks : q.maxMarks || 5;
    return score < max || isUnanswered;
  }).length;

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
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Assessment Overview
                </h2>
              </div>
              <button
                onClick={expandedFeedbackIds.size === questions.length ? collapseAll : expandAll}
                className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 shadow-sm"
              >
                {expandedFeedbackIds.size === questions.length ? "Collapse All" : "Expand All"}
              </button>
            </div>

            {/* Persistent Grading Summary Header */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200/80">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Grading Summary</span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                  overallPercentage >= 80
                    ? "bg-emerald-100 text-emerald-700"
                    : overallPercentage >= 50
                    ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-700"
                }`}>
                  {overallPercentage}% Score
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-xs">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Qs</div>
                  <div className="text-sm font-black text-slate-800">{totalQuestions}</div>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-xs">
                  <div className="text-[10px] text-emerald-600 font-semibold uppercase">Answered</div>
                  <div className="text-sm font-black text-emerald-700">{answeredCount}</div>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-xs">
                  <div className="text-[10px] text-amber-600 font-semibold uppercase">Unanswered</div>
                  <div className="text-sm font-black text-amber-700">{unansweredCount}</div>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-xs">
                  <div className="text-[10px] text-indigo-600 font-semibold uppercase">Marks</div>
                  <div className="text-sm font-black text-indigo-700">{totalScore}/{totalPossibleMarks}</div>
                </div>
              </div>
            </div>

            {/* Filter Toggle Control */}
            <div className="p-3 bg-white border-b border-slate-200/80">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setFilter("all")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    filter === "all"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  All ({questions.length})
                </button>
                <button
                  onClick={() => setFilter("needs-review")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    filter === "needs-review"
                      ? "bg-white text-amber-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Needs Review ({needsReviewCount})
                </button>
                <button
                  onClick={() => setFilter("unanswered")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                    filter === "unanswered"
                      ? "bg-white text-rose-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Unanswered ({unansweredCount})
                </button>
              </div>
            </div>

            {/* Questions list container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {filteredQuestions.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
                  <p className="text-xs font-bold">No questions in this filter.</p>
                </div>
              ) : (
                filteredQuestions.map((q) => {
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
                          
                          {/* Score Badge with Manual Override */}
                          {editingScoreQId === q.id ? (
                            <div
                              className="flex items-center gap-1 bg-white border border-indigo-300 rounded-lg p-0.5 shadow-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="number"
                                step="0.5"
                                min={0}
                                max={max}
                                autoFocus
                                value={tempScore}
                                onChange={(e) => setTempScore(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleScoreChange(q.id, tempScore);
                                  if (e.key === "Escape") setEditingScoreQId(null);
                                }}
                                className="w-10 px-1 py-0.5 text-xs font-bold text-center text-slate-800 focus:outline-none border-b border-indigo-400"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">/{max}</span>
                              <button
                                onClick={() => handleScoreChange(q.id, tempScore)}
                                className="p-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
                                title="Save score"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingScoreQId(q.id);
                                setTempScore(String(score));
                              }}
                              title="Click to override score"
                              className={`group/score flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black leading-none cursor-pointer hover:shadow-xs transition-all ${badgeColor}`}
                            >
                              <span>{score}/{max}</span>
                              <Pencil className="w-2.5 h-2.5 opacity-40 group-hover/score:opacity-100 transition-opacity" />
                            </div>
                          )}
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

                          {/* Match method badge */}
                          {mapping && mapping.answerBlockIds.length > 0 && (
                            mapping.matchMethod === "explicit-label" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-sky-700 font-bold ml-auto bg-sky-50 border border-sky-100 rounded-md px-2 py-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                Student Labeled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-bold ml-auto bg-amber-50 border border-amber-200/70 rounded-md px-2 py-0.5">
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                AI Inferred {mapping.matchConfidence ? `(${Math.round(mapping.matchConfidence * 100)}%)` : ""}
                              </span>
                            )
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
              }))}

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
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-700">Answer Sheet</span>
                
                {/* Color legend */}
                <div className="hidden lg:flex items-center gap-3 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] font-medium text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-orange-200 shrink-0" />
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>Full Marks</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span>Partial</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                    <span>Zero</span>
                  </div>
                </div>
              </div>
              
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
                    const isRemapActive = activeRemapBlockId === block.id;

                    const blockMapping = mappedResults.find((m) =>
                      m.answerBlockIds && m.answerBlockIds.includes(block.id)
                    );
                    const isFallback = blockMapping?.matchMethod === "embedding-fallback";
                    const borderStyle = isFallback || isUnmatched ? "border-dashed" : "border-solid";

                    const matchedQ = questions.find((q) =>
                      mappedResults.find((m) => m.questionId === q.id)?.answerBlockIds.includes(block.id)
                    );
                    const grading = matchedQ ? gradedResults.find((g) => g.questionId === matchedQ.id) : null;
                    const score = grading ? grading.score : 0;
                    const maxMarks = grading ? grading.maxMarks : matchedQ?.maxMarks || 5;

                    const isFull = matchedQ && grading && score === maxMarks && maxMarks > 0;
                    const isPartial = matchedQ && grading && score > 0 && score < maxMarks;
                    const isZero = matchedQ && grading && score === 0;

                    let outcomeBorderColor = "border-slate-400";
                    let outcomeBgColor = "bg-slate-500/10";
                    let labelBgColor = "bg-slate-600";
                    let questionLabelText = "Unmatched";

                    if (matchedQ) {
                      questionLabelText = `Q${matchedQ.number}${matchedQ.subPart ? matchedQ.subPart : ""}`;
                      if (isFull) {
                        outcomeBorderColor = "border-emerald-500";
                        outcomeBgColor = "bg-emerald-500/10";
                        labelBgColor = "bg-emerald-600";
                      } else if (isPartial) {
                        outcomeBorderColor = "border-amber-500";
                        outcomeBgColor = "bg-amber-500/10";
                        labelBgColor = "bg-amber-500";
                      } else if (isZero) {
                        outcomeBorderColor = "border-rose-500";
                        outcomeBgColor = "bg-rose-500/10";
                        labelBgColor = "bg-rose-600";
                      } else {
                        outcomeBorderColor = "border-emerald-500";
                        outcomeBgColor = "bg-emerald-500/10";
                        labelBgColor = "bg-emerald-600";
                      }
                    }

                    // Item 2: Selected state uses Orange exclusively
                    if (isSelected) {
                      labelBgColor = "bg-orange-500";
                    }

                    // Item 3: Resting vs Active (Hovered or Selected) box styling
                    let overlayClass = "";
                    if (isSelected) {
                      overlayClass = `border-2 ${borderStyle} border-orange-500 bg-orange-500/15 ring-4 ring-orange-500/50 shadow-md z-30 scale-[1.005] opacity-100 cursor-pointer`;
                    } else if (isRemapActive) {
                      overlayClass = `border-2 ${borderStyle} ${outcomeBorderColor} ${outcomeBgColor} z-30 opacity-100 shadow-md cursor-pointer`;
                    } else {
                      overlayClass = `border ${borderStyle} ${outcomeBorderColor} opacity-40 bg-transparent hover:opacity-100 hover:border-2 hover:${outcomeBgColor} z-10 hover:z-20 transition-all duration-150 cursor-pointer`;
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
                        {/* Item 4: Question Label Tag sits just outside/above top border (-top-3.5) */}
                        <div className={`absolute -top-3.5 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white whitespace-nowrap shadow-xs z-30 select-none flex items-center gap-1 transition-all ${labelBgColor}`}>
                          <span>{questionLabelText}</span>
                          {/* Item 1: Hover/selected-only small icon-only button (no persistent text badge) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRemapBlockId(activeRemapBlockId === block.id ? null : block.id);
                            }}
                            title="Reassign answer block"
                            className={`p-0.5 rounded hover:bg-black/30 transition-opacity ${
                              isSelected || isRemapActive ? "flex opacity-100" : "hidden group-hover/box:flex"
                            }`}
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {/* Floating Re-map Popover */}
                        {activeRemapBlockId === block.id && (
                          <div
                            className="absolute top-2 left-1 bg-white rounded-xl shadow-2xl border border-slate-200 p-2.5 z-50 min-w-[240px] max-w-[280px] text-slate-800 animate-in fade-in zoom-in-95 cursor-default"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                              <span className="text-[11px] font-bold text-slate-700">Reassign Answer Block</span>
                              <button
                                type="button"
                                onClick={() => setActiveRemapBlockId(null)}
                                className="text-slate-400 hover:text-slate-600 text-xs px-1"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {questions.map((q) => {
                                const isCurrent = matchedQ?.id === q.id;
                                return (
                                  <button
                                    key={q.id}
                                    type="button"
                                    onClick={() => handleRemapBlock(block.id, q.id)}
                                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                      isCurrent
                                        ? "bg-orange-50 text-orange-700 font-bold border border-orange-200"
                                        : "hover:bg-slate-50 text-slate-700 font-medium"
                                    }`}
                                  >
                                    <span className="truncate pr-2">
                                      <span className="font-bold">Q{q.number}{q.subPart || ""}:</span> {q.text}
                                    </span>
                                    {isCurrent && <Check className="w-3.5 h-3.5 shrink-0 text-orange-600" />}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => handleRemapBlock(block.id, null)}
                                className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border-t border-slate-100 mt-1 transition-colors flex items-center justify-between"
                              >
                                <span>Unassign (Mark Unmatched)</span>
                              </button>
                            </div>
                          </div>
                        )}

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
