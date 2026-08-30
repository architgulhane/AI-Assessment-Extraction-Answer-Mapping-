"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useVeda } from "@/lib/context";
import { convertPdfToImages, extractPdfText } from "@/lib/pdfHelper";
import { ArrowRight, AlertCircle, X, CheckCircle2, Loader2, Circle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

const PIPELINE_STEPS = [
  { id: "read-qp", title: "Reading Question Paper", desc: "Converting PDF pages into images" },
  { id: "read-as", title: "Reading Answer Sheet", desc: "Rasterizing student answer sheet pages" },
  { id: "extract-q", title: "Extracting Questions", desc: "Parsing question text & structure with Gemini" },
  { id: "extract-a", title: "Transcribing Answer Blocks", desc: "Detecting handwriting blocks & bounding boxes" },
  { id: "map", title: "Mapping Answers to Questions", desc: "Running 2-pass explicit & semantic matching" },
  { id: "grade", title: "AI Grading & Feedback", desc: "Evaluating answers & writing feedback" },
  { id: "finalize", title: "Finalizing Workspace", desc: "Preparing review screen dashboard" },
];

export default function UploadPage() {
  const router = useRouter();
  const {
    questionPaperName,
    setQuestionPaperName,
    setQuestionPaperImages,
    answerSheetName,
    setAnswerSheetName,
    setAnswerSheetImages,
    isProcessing,
    setIsProcessing,
    setProcessingStep,
    setQuestions,
    setAnswerBlocks,
    setMappedResults,
    setGradedResults,
  } = useVeda();

  const [qpFile, setQpFile] = useState<File | null>(null);
  const [asFile, setAsFile] = useState<File | null>(null);
  
  const [qpMeta, setQpMeta] = useState<string>("");
  const [asMeta, setAsMeta] = useState<string>("");
  
  const [error, setError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const getFileSizeString = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)}KB`;
    return `${(kb / 1024).toFixed(0)}MB`;
  };

  const handleQpSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError("Question Paper exceeds 10MB limit.");
        return;
      }
      setQpFile(file);
      setQuestionPaperName(file.name);
      
      const sizeStr = getFileSizeString(file.size);
      if (file.type === "application/pdf") {
        setQpMeta(`${sizeStr} • 2 Pages`);
      } else {
        setQpMeta(`${sizeStr} • Image`);
      }
    }
  };

  const handleAsSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError("Answer Sheet exceeds 10MB limit.");
        return;
      }
      setAsFile(file);
      setAnswerSheetName(file.name);
      
      const sizeStr = getFileSizeString(file.size);
      if (file.type === "application/pdf") {
        setAsMeta(`${sizeStr} • 4 Pages`);
      } else {
        setAsMeta(`${sizeStr} • Image`);
      }
    }
  };

  const startMappingPipeline = async () => {
    if (!qpFile || !asFile) return;

    setIsProcessing(true);
    setIsSidebarCollapsed(true);
    setError(null);
    setCompletedStepIds([]);
    setCurrentStepIdx(0);

    try {
      // Step 0: Read QP
      setCurrentStepIdx(0);
      setProcessingStep("Reading Question Paper...");
      let qpImages: string[] = [];
      let pdfText = "";

      if (qpFile.type === "application/pdf") {
        qpImages = await convertPdfToImages(qpFile);
        pdfText = await extractPdfText(qpFile);
      } else {
        const b64 = await convertImageToBase64(qpFile);
        qpImages = [b64];
      }
      setQuestionPaperImages(qpImages);
      setCompletedStepIds((prev) => [...prev, "read-qp"]);

      // Step 1: Read AS
      setCurrentStepIdx(1);
      setProcessingStep("Reading Answer Sheet...");
      let asImages: string[] = [];
      if (asFile.type === "application/pdf") {
        asImages = await convertPdfToImages(asFile);
      } else {
        const b64 = await convertImageToBase64(asFile);
        asImages = [b64];
      }
      setAnswerSheetImages(asImages);
      setCompletedStepIds((prev) => [...prev, "read-as"]);

      // Step 2: Extract Questions
      setCurrentStepIdx(2);
      setProcessingStep("Extracting Questions...");
      const qpResponse = await fetch("/api/extract-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: qpImages, pdfText }),
      });
      if (!qpResponse.ok) throw new Error("Failed to extract questions from paper");
      const qpData = await qpResponse.json();
      setQuestions(qpData.questions);
      setCompletedStepIds((prev) => [...prev, "extract-q"]);

      // Step 3: Transcribe Answer Blocks
      setCurrentStepIdx(3);
      setProcessingStep("Transcribing Answer Sheet with Bounding Boxes...");
      const asResponse = await fetch("/api/extract-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: asImages }),
      });
      if (!asResponse.ok) throw new Error("Failed to extract handwritten answers");
      const asData = await asResponse.json();
      setAnswerBlocks(asData.answerBlocks);
      setCompletedStepIds((prev) => [...prev, "extract-a"]);

      // Step 4: Map
      setCurrentStepIdx(4);
      setProcessingStep("Mapping Answer Blocks to Questions...");
      const mapResponse = await fetch("/api/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: qpData.questions,
          answerBlocks: asData.answerBlocks,
        }),
      });
      if (!mapResponse.ok) throw new Error("Failed to map answers to questions");
      const mapData = await mapResponse.json();
      setMappedResults(mapData.mappedResults);
      setCompletedStepIds((prev) => [...prev, "map"]);

      // Step 5: Grade
      setCurrentStepIdx(5);
      setProcessingStep("Grading answers and generating AI feedback...");
      const gradeResponse = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: qpData.questions,
          mappedResults: mapData.mappedResults,
          answerBlocks: asData.answerBlocks,
        }),
      });
      if (!gradeResponse.ok) throw new Error("Failed to grade answers");
      const gradeData = await gradeResponse.json();
      setGradedResults(gradeData.gradedResults);
      setCompletedStepIds((prev) => [...prev, "grade"]);

      // Step 6: Finalize
      setCurrentStepIdx(6);
      setProcessingStep("Finalizing results...");
      setCompletedStepIds((prev) => [...prev, "finalize"]);

      router.push("/review");
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "An unexpected error occurred during processing. Please try again.";
      setError(errMsg);
      setIsProcessing(false);
      setIsSidebarCollapsed(false);
    }
  };

  const isButtonEnabled = qpFile !== null && asFile !== null && !isProcessing;

  const handleQpClear = () => {
    setQpFile(null);
    setQuestionPaperName("");
  };

  const handleAsClear = () => {
    setAsFile(null);
    setAnswerSheetName("");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={setIsSidebarCollapsed} />

      {/* Main content body */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
        <Topbar breadcrumbs={["Exams"]} />

        <main className="flex-1 overflow-y-auto flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-100 via-slate-200/70 to-slate-400/60 relative shadow-2xl">
          {/* Soft dark vignette gradient overlay for enhanced depth */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_rgba(15,23,42,0.12)_100%)] pointer-events-none" />
          <div className="w-full max-w-4xl relative z-10 my-auto">
            {isProcessing ? (
              /* PROCESSING STATE WITH LIVE CHECKPOINT LOGS */
              <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-white border border-slate-200/80 rounded-3xl shadow-hero-card text-center w-full max-w-xl mx-auto animate-fade-in">
                {/* Large Orange Sparkle loading animation */}
                <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-orange-100/60 animate-ping" />
                  <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-md">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Extracting Assessment Data</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1 mb-5">
                  Step {Math.min(currentStepIdx + 1, PIPELINE_STEPS.length)} of {PIPELINE_STEPS.length} Checkpoints
                </p>

                {/* Overall Progress Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-6 border border-slate-200/60">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-amber-500 h-full transition-all duration-500 ease-out rounded-full"
                    style={{
                      width: `${Math.round((completedStepIds.length / PIPELINE_STEPS.length) * 100)}%`,
                    }}
                  />
                </div>

                {/* Checkpoint Logs Container */}
                <div className="w-full bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3.5 text-left space-y-2.5 max-h-[340px] overflow-y-auto">
                  {PIPELINE_STEPS.map((step, idx) => {
                    const isCompleted = completedStepIds.includes(step.id);
                    const isCurrent = currentStepIdx === idx && !isCompleted;

                    return (
                      <div
                        key={step.id}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${
                          isCurrent
                            ? "bg-white border-2 border-orange-500/80 shadow-xs ring-2 ring-orange-500/10"
                            : isCompleted
                            ? "bg-white/90 border border-emerald-200/70"
                            : "bg-slate-100/40 border border-transparent opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          {/* Status Icon */}
                          {isCompleted ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : isCurrent ? (
                            <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200/80 text-slate-400 flex items-center justify-center shrink-0">
                              <Circle className="w-3.5 h-3.5" />
                            </div>
                          )}

                          {/* Step Info */}
                          <div className="min-w-0">
                            <p
                              className={`text-xs font-bold truncate ${
                                isCurrent
                                  ? "text-orange-950"
                                  : isCompleted
                                  ? "text-slate-800"
                                  : "text-slate-400"
                              }`}
                            >
                              {step.title}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium truncate">
                              {step.desc}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isCompleted ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                              Done ✓
                            </span>
                          ) : isCurrent ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold animate-pulse">
                              Processing...
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-medium">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* UPLOAD STATE - MATCHING REFERENCE IMAGE 1 & 2 */
              <div className="flex flex-col items-center">
                {/* Title using Poppins weights */}
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center tracking-tight leading-tight mb-2 flex items-center justify-center flex-wrap gap-2.5">
                  <span className="font-bold">Upload</span>
                  <span className="inline-flex items-center px-4 py-1 rounded-2xl bg-[#faece7] border border-[#fbd4c8]/60 text-[#ff5622] text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Question Paper &amp; Answer Sheets
                  </span>
                </h1>
                
                {/* Subtitle */}
                <p className="text-sm font-medium text-slate-500 text-center mb-8">
                  Upload both files to get started
                </p>

                {/* 3D Teacher Avatar Hero Illustration */}
                <div className="relative w-56 h-56 mb-6 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/teacher-hero.png"
                    alt="VedaAI Teacher Hero"
                    className="w-full h-full object-contain drop-shadow-md select-none"
                  />
                </div>

                {/* Upload Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-8 items-stretch">
                  
                  {/* Card 1: Question Paper */}
                  <div className="border-2 border-dashed border-slate-200 bg-white rounded-2xl p-6 flex flex-col items-center justify-center text-center relative hover:border-slate-300 hover:bg-slate-50/30 transition-all duration-300 min-h-[180px]">
                    {questionPaperName ? (
                      /* Files selected view */
                      <div className="flex items-center gap-3.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 w-full relative animate-fade-in pr-10">
                        <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                          PDF
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate leading-snug">
                            {questionPaperName}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                            {qpMeta}
                          </p>
                        </div>
                        <button
                          onClick={handleQpClear}
                          className="absolute top-1/2 right-3 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      /* Select file upload slots */
                      <label className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                        <input
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/jpg"
                          onChange={handleQpSelect}
                          className="hidden"
                        />
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3 shadow-sm">
                          <svg className="w-5 h-5 stroke-current text-slate-700" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-slate-700">
                          Upload <span className="text-orange-500 font-extrabold">Question Paper</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 font-semibold">Max 10MB</p>
                      </label>
                    )}
                  </div>

                  {/* Card 2: Answer Sheets */}
                  <div className="border-2 border-dashed border-slate-200 bg-white rounded-2xl p-6 flex flex-col items-center justify-center text-center relative hover:border-slate-300 hover:bg-slate-50/30 transition-all duration-300 min-h-[180px]">
                    {answerSheetName ? (
                      /* Files selected view */
                      <div className="flex items-center gap-3.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 w-full relative animate-fade-in pr-10">
                        <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                          PDF
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate leading-snug">
                            {answerSheetName}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                            {asMeta}
                          </p>
                        </div>
                        <button
                          onClick={handleAsClear}
                          className="absolute top-1/2 right-3 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      /* Select file upload slots */
                      <label className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                        <input
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/jpg"
                          onChange={handleAsSelect}
                          className="hidden"
                        />
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3 shadow-sm">
                          <svg className="w-5 h-5 stroke-current text-slate-700" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-slate-700">
                          Upload <span className="text-orange-500 font-extrabold">Answer Sheet</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 font-semibold">Max 10MB</p>
                      </label>
                    )}
                  </div>

                </div>

                {error && (
                  <div className="mb-6 w-full max-w-3xl flex items-start gap-3 text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl p-4 text-sm leading-relaxed animate-shake">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Pipeline Error:</span> {error}
                    </div>
                  </div>
                )}

                {/* Start Mapping Action Button */}
                <button
                  onClick={startMappingPipeline}
                  disabled={!isButtonEnabled}
                  className={`px-8 py-3 rounded-full text-xs font-bold tracking-wide transition-all duration-200 flex items-center gap-2 shadow-sm ${
                    isButtonEnabled
                      ? "bg-zinc-800 text-white hover:bg-zinc-900 border border-zinc-800 shadow-md active:scale-95 cursor-pointer"
                      : "bg-slate-300 text-slate-400 cursor-not-allowed border border-slate-300"
                  }`}
                >
                  <span>Start Mapping</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Helper subtext */}
                <p className="text-[11px] font-semibold text-slate-500 text-center mt-3">
                  Once both files are uploaded, you&apos;ll able to map answers with questions
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
