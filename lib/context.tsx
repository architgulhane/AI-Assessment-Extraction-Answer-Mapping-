"use client";

import React, { createContext, useContext, useState } from "react";
import { Question, AnswerBlock, MappedResult, GradedResult } from "./types";

type VedaContextType = {
  questionPaperName: string;
  setQuestionPaperName: (name: string) => void;
  questionPaperImages: string[];
  setQuestionPaperImages: (images: string[]) => void;
  
  answerSheetName: string;
  setAnswerSheetName: (name: string) => void;
  answerSheetImages: string[];
  setAnswerSheetImages: (images: string[]) => void;

  questions: Question[];
  setQuestions: (questions: Question[]) => void;
  answerBlocks: AnswerBlock[];
  setAnswerBlocks: (blocks: AnswerBlock[]) => void;
  mappedResults: MappedResult[];
  setMappedResults: (results: MappedResult[]) => void;
  gradedResults: GradedResult[];
  setGradedResults: (results: GradedResult[]) => void;

  isProcessing: boolean;
  setIsProcessing: (loading: boolean) => void;
  processingStep: string;
  setProcessingStep: (step: string) => void;
  
  reset: () => void;
};

const VedaContext = createContext<VedaContextType | undefined>(undefined);

export function VedaProvider({ children }: { children: React.ReactNode }) {
  const [questionPaperName, setQuestionPaperName] = useState("");
  const [questionPaperImages, setQuestionPaperImages] = useState<string[]>([]);
  
  const [answerSheetName, setAnswerSheetName] = useState("");
  const [answerSheetImages, setAnswerSheetImages] = useState<string[]>([]);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answerBlocks, setAnswerBlocks] = useState<AnswerBlock[]>([]);
  const [mappedResults, setMappedResults] = useState<MappedResult[]>([]);
  const [gradedResults, setGradedResults] = useState<GradedResult[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");

  const reset = () => {
    setQuestionPaperName("");
    setQuestionPaperImages([]);
    setAnswerSheetName("");
    setAnswerSheetImages([]);
    setQuestions([]);
    setAnswerBlocks([]);
    setMappedResults([]);
    setGradedResults([]);
    setIsProcessing(false);
    setProcessingStep("");
  };

  return (
    <VedaContext.Provider
      value={{
        questionPaperName,
        setQuestionPaperName,
        questionPaperImages,
        setQuestionPaperImages,
        answerSheetName,
        setAnswerSheetName,
        answerSheetImages,
        setAnswerSheetImages,
        questions,
        setQuestions,
        answerBlocks,
        setAnswerBlocks,
        mappedResults,
        setMappedResults,
        gradedResults,
        setGradedResults,
        isProcessing,
        setIsProcessing,
        processingStep,
        setProcessingStep,
        reset,
      }}
    >
      {children}
    </VedaContext.Provider>
  );
}

export function useVeda() {
  const context = useContext(VedaContext);
  if (!context) {
    throw new Error("useVeda must be used within a VedaProvider");
  }
  return context;
}
