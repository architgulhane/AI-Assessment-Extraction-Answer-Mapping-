"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import UploadCard from "@/components/UploadCard";
import { useVeda } from "@/lib/context";
import { convertPdfToImages } from "@/lib/pdfHelper";
import { ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleQpSelect = (file: File) => {
    setQpFile(file);
    setQuestionPaperName(file.name);
    setError(null);
  };

  const handleAsSelect = (file: File) => {
    setAsFile(file);
    setAnswerSheetName(file.name);
    setError(null);
  };

  const handleQpClear = () => {
    setQpFile(null);
    setQuestionPaperName("");
  };

  const handleAsClear = () => {
    setAsFile(null);
    setAnswerSheetName("");
  };

  // Run the end-to-end extraction and mapping pipeline
  const startMappingPipeline = async () => {
    if (!qpFile || !asFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Process Question Paper PDF / Image to base64 images
      setProcessingStep("Reading Question Paper...");
      let qpImages: string[] = [];
      if (qpFile.type === "application/pdf") {
        qpImages = await convertPdfToImages(qpFile);
      } else {
        const b64 = await convertImageToBase64(qpFile);
        qpImages = [b64];
      }
      setQuestionPaperImages(qpImages);

      // 2. Process Answer Sheet PDF / Image to base64 images
      setProcessingStep("Reading Answer Sheet...");
      let asImages: string[] = [];
      if (asFile.type === "application/pdf") {
        asImages = await convertPdfToImages(asFile);
      } else {
        const b64 = await convertImageToBase64(asFile);
        asImages = [b64];
      }
      setAnswerSheetImages(asImages);

      // 3. Extract Questions (Call API)
      setProcessingStep("Extracting Questions using Gemini...");
      const qpResponse = await fetch("/api/extract-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: qpImages }),
      });
      if (!qpResponse.ok) throw new Error("Failed to extract questions from paper");
      const qpData = await qpResponse.json();
      setQuestions(qpData.questions);

      // 4. Extract Answers (Call API)
      setProcessingStep("Transcribing Answer Sheet with Bounding Boxes...");
      const asResponse = await fetch("/api/extract-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: asImages }),
      });
      if (!asResponse.ok) throw new Error("Failed to extract handwritten answers");
      const asData = await asResponse.json();
      setAnswerBlocks(asData.answerBlocks);

      // 5. Map Questions to Answers (Call API)
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

      // 6. Grade Answers (Call API)
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

      // Complete, route to Review screen
      setProcessingStep("Finalizing results...");
      router.push("/review");
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "An unexpected error occurred during processing. Please try again.";
      setError(errMsg);
      setIsProcessing(false);
    }
  };

  const isButtonEnabled = qpFile !== null && asFile !== null && !isProcessing;

  // Render step progress indicator inside the page during processing
  const renderProgressState = () => {
    const steps = [
      { name: "Reading files & processing PDFs", active: processingStep.includes("Reading") },
      { name: "Extracting questions using Gemini Flash", active: processingStep.includes("Extracting") },
      { name: "Transcribing answers & page layouts", active: processingStep.includes("Transcribing") },
      { name: "Mapping answers (Label matching & Embedding fallback)", active: processingStep.includes("Mapping") },
      { name: "Grading answers & compiling feedback", active: processingStep.includes("Grading") || processingStep.includes("Finalizing") },
    ];

    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[400px] text-center max-w-xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-6 shadow-sm">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
        
        <h3 className="text-xl font-bold text-slate-800 mb-2">Analyzing Assessment</h3>
        <p className="text-sm text-slate-500 mb-8 max-w-md">
          Please wait while VedaAI parses the PDF papers, transcribes handwritten text, maps items, and runs AI evaluation.
        </p>

        <div className="w-full bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 text-left">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Progress Tracker</div>
          {steps.map((step, idx) => {
            const isCompleted = steps.slice(0, idx).every(s => !s.active) && !step.active && steps.slice(idx + 1).some(s => s.active);
            const isActive = step.active;

            return (
              <div key={idx} className="flex items-center gap-3.5">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                    {idx + 1}
                  </div>
                )}
                <span
                  className={`text-sm ${
                    isActive
                      ? "text-indigo-600 font-semibold"
                      : isCompleted
                      ? "text-slate-700 font-medium"
                      : "text-slate-400"
                  }`}
                >
                  {step.name}
                </span>
              </div>
            );
          })}
        </div>
        
        <div className="text-xs text-indigo-500 font-semibold uppercase tracking-widest mt-6 animate-pulse">
          Current State: {processingStep}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main content body */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <Topbar breadcrumbs={["Exams", "Upload Papers"]} />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto h-full flex flex-col">
            
            {isProcessing ? (
              <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center">
                {renderProgressState()}
              </div>
            ) : (
              <>
                {/* Header section */}
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upload Exam Assessment</h1>
                  <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                    Upload the original question paper structure and the student answer sheets. VedaAI will automatically transcribe the answers, map them to the questions, and score them.
                  </p>
                </div>

                {/* Upload card container */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch flex-1 min-h-[340px]">
                    <UploadCard
                      title="1. Question Paper (Printed Layout)"
                      fileName={questionPaperName}
                      onFileSelect={handleQpSelect}
                      onFileClear={handleQpClear}
                    />

                    <UploadCard
                      title="2. Answer Sheets (Handwritten Sheets)"
                      fileName={answerSheetName}
                      onFileSelect={handleAsSelect}
                      onFileClear={handleAsClear}
                    />
                  </div>

                  {error && (
                    <div className="mt-6 flex items-start gap-3 text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm leading-relaxed animate-shake">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Pipeline Error:</span> {error}
                      </div>
                    </div>
                  )}

                  {/* Actions footer */}
                  <div className="border-t border-slate-100 mt-8 pt-6 flex justify-end">
                    <button
                      onClick={startMappingPipeline}
                      disabled={!isButtonEnabled}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 ${
                        isButtonEnabled
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 active:scale-[0.98]"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      }`}
                    >
                      <span>Start Mapping & AI Grading</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
