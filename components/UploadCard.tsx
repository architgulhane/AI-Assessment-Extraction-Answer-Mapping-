"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FileText, FileImage, X, AlertCircle } from "lucide-react";

type UploadCardProps = {
  title: string;
  fileName: string;
  onFileSelect: (file: File) => void;
  onFileClear: () => void;
  fileAccept?: string;
  maxSizeBytes?: number;
};

export default function UploadCard({
  title,
  fileName,
  onFileSelect,
  onFileClear,
  fileAccept = "application/pdf,image/png,image/jpeg,image/jpg",
  maxSizeBytes = 10 * 1024 * 1024, // 10MB default
}: UploadCardProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError(null);

    // Validate type
    const acceptedTypes = fileAccept.split(",").map(t => t.trim());
    const isAcceptedType = acceptedTypes.some((type) => {
      if (type.startsWith("image/")) {
        return file.type.startsWith("image/");
      }
      return file.type === type;
    });

    if (!isAcceptedType) {
      setError("Unsupported file format. Please upload PDF or JPG/PNG image.");
      return;
    }

    // Validate size
    if (file.size > maxSizeBytes) {
      setError("File exceeds 10MB limit. Please upload a smaller file.");
      return;
    }

    onFileSelect(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const isPdf = fileName.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex flex-col h-full w-full">
      <h3 className="text-slate-800 text-sm font-semibold mb-2">{title}</h3>
      
      <div
        className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 relative shadow-sm ${
          fileName
            ? "border-emerald-200 bg-emerald-50/20 shadow-md"
            : isDragActive
            ? "border-indigo-500 bg-indigo-50/30 shadow-md"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-md"
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={fileAccept}
          onChange={handleChange}
        />

        {fileName ? (
          <div className="flex flex-col items-center animate-fade-in w-full max-w-[280px]">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
              {isPdf ? <FileText className="w-7 h-7" /> : <FileImage className="w-7 h-7" />}
            </div>
            <p className="text-sm font-semibold text-slate-800 break-words w-full text-center truncate">
              {fileName}
            </p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">Ready to map</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileClear();
                setError(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="mt-6 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm"
            >
              <X className="w-3.5 h-3.5" />
              Remove File
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-sm group-hover:scale-105 transition-transform duration-200">
              <UploadCloud className="w-6 h-6 text-indigo-500" />
            </div>
            
            <p className="text-sm font-medium text-slate-700">
              Drag & drop files or{" "}
              <button
                type="button"
                onClick={onButtonClick}
                className="text-indigo-600 hover:text-indigo-700 font-semibold underline underline-offset-2"
              >
                click to browse
              </button>
            </p>
            
            <p className="text-xs text-slate-400 mt-2 font-medium">
              Supports PDF, PNG, JPG (Max 10MB)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-rose-600 bg-rose-50/70 border border-rose-100 rounded-lg p-3 text-xs leading-normal animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-medium">{error}</span>
        </div>
      )}
    </div>
  );
}
