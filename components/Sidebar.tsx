"use client";

import React from "react";
import {
  Home,
  Users,
  ClipboardList,
  FileSpreadsheet,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  School,
} from "lucide-react";
import Link from "next/link";

import VedaLogo from "./VedaLogo";

type SidebarProps = {
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
};

export default function Sidebar({ isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const navItems = [
    { name: "Home", icon: Home, href: "#", disabled: true },
    { name: "My Classroom", icon: Users, href: "#", disabled: true },
    { name: "Assignments", icon: ClipboardList, href: "#", disabled: true },
    { name: "Exams", icon: FileSpreadsheet, href: "/", disabled: false },
    { name: "My Library", icon: FolderOpen, href: "#", disabled: true },
  ];

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse(!isCollapsed);
    }
  };

  return (
    <aside
      className={`border-r border-slate-200 bg-white flex flex-col h-full shrink-0 transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"
        }`}
    >
      {/* Brand logo matching Image 3 */}
      <div className={`h-16 flex items-center border-b border-slate-200 shrink-0 ${isCollapsed ? "justify-center px-0" : "px-6"
        }`}>
        <VedaLogo isCollapsed={isCollapsed} size="md" />
      </div>

      {/* AI Teacher's Toolkit Pill */}
      <div className={`px-4 py-4 border-b border-slate-100 ${isCollapsed ? "flex justify-center" : ""}`}>
        {isCollapsed ? (
          <button
            className="w-10 h-10 rounded-full border-[3.5px] border-[#ff6746] bg-[#2c2c2c] text-white flex items-center justify-center shadow-sm hover:bg-[#383838] transition-colors"
            title="AI Teacher&apos;s Toolkit"
          >
            <Sparkles className="w-4 h-4 text-white fill-white" />
          </button>
        ) : (
          <button className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-full border-[3.5px] border-[#ff6746] bg-[#2c2c2c] hover:bg-[#383838] text-white text-xs font-bold transition-all shadow-sm">
            <Sparkles className="w-4 h-4 text-white fill-white shrink-0" />
            <span className="text-white font-bold tracking-tight">AI Teacher&apos;s Toolkit</span>
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.name === "Exams";

          return (
            <Link
              key={item.name}
              href={item.disabled ? "#" : item.href}
              className={`flex items-center rounded-xl text-sm font-semibold transition-all duration-200 ${isCollapsed ? "justify-center p-2.5" : "px-4 py-3 gap-3"
                } ${isActive
                  ? "bg-slate-100 text-slate-900 font-bold"
                  : item.disabled
                    ? "text-slate-400 cursor-not-allowed hover:bg-slate-50/50"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              onClick={(e) => {
                if (item.disabled) {
                  e.preventDefault();
                }
              }}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon
                className={`w-5 h-5 ${isActive ? "text-slate-800" : "text-slate-400 group-hover:text-slate-600"
                  }`}
              />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* School card bottom or collapse indicator */}
      <div className={`p-4 border-t border-slate-100 ${isCollapsed ? "flex flex-col items-center gap-4" : ""}`}>
        {isCollapsed ? (
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shadow-inner">
            <School className="w-5 h-5" />
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-inner">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm shrink-0">
              <School className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-800 leading-tight truncate">Veda AI</span>
              <span className="text-[10px] text-slate-400 leading-none truncate mt-0.5">Archit Gulhane</span>
            </div>
          </div>
        )}

        {/* Collapse toggle button */}
        <button
          onClick={handleToggle}
          className={`flex items-center text-slate-400 hover:text-slate-700 transition-colors mt-4 w-full ${isCollapsed ? "justify-center p-1" : "px-2 py-1 justify-between text-xs font-semibold"
            }`}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <span>Collapse Sidebar</span>
              <ChevronLeft className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
