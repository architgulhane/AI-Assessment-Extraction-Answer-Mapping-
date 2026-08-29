"use client";

import React from "react";
import { ArrowLeft, HelpCircle, Bell } from "lucide-react";
import { useRouter } from "next/navigation";

type TopbarProps = {
  breadcrumbs: string[];
  backUrl?: string;
  actionButton?: React.ReactNode;
};

export default function Topbar({ breadcrumbs, backUrl, actionButton }: TopbarProps) {
  const router = useRouter();

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0">
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
        <nav className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb}>
                {idx > 0 && <span className="text-slate-300">/</span>}
                <span className={isLast ? "text-slate-800 font-semibold" : "hover:text-slate-700 cursor-pointer"}>
                  {crumb}
                </span>
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right side: Action button + Help + Notification + Profile */}
      <div className="flex items-center gap-4">
        {actionButton}
        
        {/* Help icon */}
        <button
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Notification bell */}
        <button
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
        </button>

        <div className="h-8 w-px bg-slate-200"></div>

        {/* User profile */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm shadow-indigo-600/20">
            AG
          </div>
          <div className="flex flex-col hidden sm:flex">
            <span className="text-xs font-semibold text-slate-800 leading-none">Archit Gulhane</span>
            <span className="text-[10px] text-slate-400 mt-0.5 leading-none font-medium">Instructor</span>
          </div>
        </div>
      </div>
    </header>
  );
}
