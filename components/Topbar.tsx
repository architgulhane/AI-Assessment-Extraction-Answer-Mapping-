"use client";

import React from "react";
import { ArrowLeft, HelpCircle, Bell, Sparkles, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

type TopbarProps = {
  breadcrumbs: string[];
  backUrl?: string;
  actionButton?: React.ReactNode;
};

export default function Topbar({ breadcrumbs, backUrl, actionButton }: TopbarProps) {
  const router = useRouter();

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0 select-none">
      {/* Left side: Back button + Breadcrumbs */}
      <div className="flex items-center gap-4">
        {backUrl && (
          <button
            onClick={() => router.push(backUrl)}
            className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <nav className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
          <span className="flex items-center gap-1.5 hover:text-slate-700 cursor-pointer">
            {/* Notebook icon next to Exams */}
            <svg
              className="w-4 h-4 stroke-current"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="15" y2="17" />
            </svg>
            <span>{breadcrumbs[0]}</span>
          </span>
          {breadcrumbs.slice(1).map((crumb) => (
            <React.Fragment key={crumb}>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-bold">{crumb}</span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right side: Action button + Icons + Profile */}
      <div className="flex items-center gap-4">
        {actionButton}

        {/* Help icon */}
        <button
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="w-5 h-5 text-slate-800" />
        </button>

        {/* Notification bell */}
        <button
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-slate-800" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-white"></span>
        </button>

        {/* Sparkles / star icon in top bar */}
        <button
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Features"
        >
          <Sparkles className="w-5 h-5 text-slate-800" />
        </button>

        <div className="h-8 w-px bg-slate-200"></div>

        {/* User profile */}
        <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-600 font-bold text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/avatar.jpg"
              alt="Archit Gulhane"
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-slate-800">Archit Gulhane</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>
    </header>
  );
}
