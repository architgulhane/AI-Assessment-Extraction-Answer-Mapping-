"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useVeda } from "@/lib/context";
import { convertPdfToImages } from "@/lib/pdfHelper";
import { ArrowRight, AlertCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

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
    processingStep,
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
      
      // Calculate meta info: e.g. "2MB • 2 Pages" or "2MB • Image"
      const sizeStr = getFileSizeString(file.size);
      if (file.type === "application/pdf") {
        // Mock page count estimation or default
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
      
      // Calculate meta info: e.g. "8MB • 6 Pages" or "8MB • Image"
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
    setIsSidebarCollapsed(true); // Auto collapse sidebar during processing state!
    setError(null);

    try {
      setProcessingStep("Reading Question Paper...");
      let qpImages: string[] = [];
      if (qpFile.type === "application/pdf") {
        qpImages = await convertPdfToImages(qpFile);
      } else {
        const b64 = await convertImageToBase64(qpFile);
        qpImages = [b64];
      }
      setQuestionPaperImages(qpImages);

      setProcessingStep("Reading Answer Sheet...");
      let asImages: string[] = [];
      if (asFile.type === "application/pdf") {
        asImages = await convertPdfToImages(asFile);
      } else {
        const b64 = await convertImageToBase64(asFile);
        asImages = [b64];
      }
      setAnswerSheetImages(asImages);

      setProcessingStep("Extracting Questions using Gemini...");
      const qpResponse = await fetch("/api/extract-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: qpImages }),
      });
      if (!qpResponse.ok) throw new Error("Failed to extract questions from paper");
      const qpData = await qpResponse.json();
      setQuestions(qpData.questions);

      setProcessingStep("Transcribing Answer Sheet with Bounding Boxes...");
      const asResponse = await fetch("/api/extract-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: asImages }),
      });
      if (!asResponse.ok) throw new Error("Failed to extract handwritten answers");
      const asData = await asResponse.json();
      setAnswerBlocks(asData.answerBlocks);

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

      setProcessingStep("Finalizing results...");
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
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <Topbar breadcrumbs={["Exams"]} />

        <main className="flex-1 overflow-y-auto flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200/50 via-slate-100 to-slate-50/50">
          <div className="w-full max-w-4xl">
            {isProcessing ? (
              /* FIGMA REPLICATED PROCESSING STATE */
              <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-3xl shadow-sm text-center">
                {/* Large Orange Sparkle loading animation */}
                <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                  <div className="absolute w-12 h-12 text-orange-500 animate-pulse">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                      <path d="M12 2l2.4 4.8 5.6.8-4 4 1 5.4-5-2.6-5 2.6 1-5.4-4-4 5.6-.8z" />
                    </svg>
                  </div>
                  <div className="absolute w-8 h-8 text-orange-400 translate-x-6 -translate-y-4 animate-bounce">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                      <path d="M12 2l2.4 4.8 5.6.8-4 4 1 5.4-5-2.6-5 2.6 1-5.4-4-4 5.6-.8z" />
                    </svg>
                  </div>
                  <div className="absolute w-6 h-6 text-orange-300 -translate-x-6 translate-y-4 animate-ping">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                      <path d="M12 2l2.4 4.8 5.6.8-4 4 1 5.4-5-2.6-5 2.6 1-5.4-4-4 5.6-.8z" />
                    </svg>
                  </div>
                </div>
                
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Extracting...</h3>
                <p className="text-sm text-slate-500 font-semibold mt-1">This may take a while</p>
                <div className="text-xs text-indigo-600 font-bold uppercase tracking-widest mt-4 bg-indigo-50 px-3.5 py-1.5 rounded-full animate-pulse">
                  {processingStep}
                </div>
              </div>
            ) : (
              /* FIGMA REPLICATED UPLOAD STATE */
              <div className="flex flex-col items-center">
                {/* Title */}
                <h1 className="text-3xl font-black text-slate-800 text-center tracking-tight leading-normal mb-1">
                  Upload <span className="inline-block px-4 py-1 rounded-2xl bg-orange-100/70 border border-orange-200/50 text-orange-600 text-2xl font-extrabold shadow-sm">Question Paper & Answer Sheets</span>
                </h1>
                
                {/* Subtitle */}
                <p className="text-sm font-semibold text-slate-500 text-center mb-8">
                  Upload both files to get started
                </p>

                {/* Circular Teacher illustration */}
                <div className="relative w-32 h-32 mb-10 flex items-center justify-center">
                  {/* Circular border rings */}
                  <div className="absolute inset-0 rounded-full border border-orange-200/30 scale-110"></div>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-b from-orange-100 to-orange-50/20 shadow-inner flex items-center justify-center overflow-hidden border border-orange-200/50">
                    {/* SVG Teacher avatar representation holding a notebook */}
                    <svg
                      viewBox="0 0 100 100"
                      className="w-20 h-20 text-slate-800 mt-4"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Avatar Head */}
                      <circle cx="50" cy="35" r="18" fill="#F8C39E" />
                      {/* Avatar Hair */}
                      <path d="M30 35c0-12 8-20 20-20s20 8 20 20c0 4-2 8-6 10-2-8-6-10-14-10s-12 2-14 10c-4-2-6-6-6-10z" fill="#2E2E2E" />
                      {/* Glasses */}
                      <rect x="38" y="32" width="10" height="6" rx="2" fill="none" stroke="#2E2E2E" strokeWidth="2" />
                      <rect x="52" y="32" width="10" height="6" rx="2" fill="none" stroke="#2E2E2E" strokeWidth="2" />
                      <line x1="48" y1="35" x2="52" y2="35" stroke="#2E2E2E" strokeWidth="2" />
                      {/* Mouth/Eyes */}
                      <path d="M47 43c2 1 4 1 6 0" stroke="#2E2E2E" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                      {/* Body & Book */}
                      <path d="M25 85c0-10 10-18 25-18s25 8 25 18H25z" fill="#3B82F6" />
                      <rect x="40" y="60" width="20" height="24" rx="2" fill="#E2E8F0" stroke="#1E293B" strokeWidth="2" />
                      <line x1="50" y1="64" x2="50" y2="80" stroke="#94A3B8" strokeWidth="1.5" />
                      {/* Hands */}
                      <circle cx="38" cy="72" r="5" fill="#F8C39E" />
                      <circle cx="62" cy="72" r="5" fill="#F8C39E" />
                    </svg>
                  </div>
                  {/* Floating orange bubbles */}
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-sm flex items-center justify-center text-[8px] text-white font-bold">1</div>
                  <div className="absolute bottom-4 left-0 w-3 h-3 rounded-full bg-orange-400 border-2 border-white shadow-sm"></div>
                  <div className="absolute bottom-1 right-2 w-3.5 h-3.5 rounded-full bg-orange-300 border-2 border-white shadow-sm"></div>
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
                <p className="text-[11px] font-semibold text-slate-400 text-center mt-3">
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
