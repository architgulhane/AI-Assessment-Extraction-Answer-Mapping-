"use client";

import React from "react";
import {
  Home,
  Users,
  ClipboardList,
  FileSpreadsheet,
  FolderOpen,
  Settings,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";

export default function Sidebar() {

  const navItems = [
    { name: "Home", icon: Home, href: "#", disabled: true },
    { name: "My Classroom", icon: Users, href: "#", disabled: true },
    { name: "Assignments", icon: ClipboardList, href: "#", disabled: true },
    { name: "Exams", icon: FileSpreadsheet, href: "/", disabled: false },
    { name: "My Library", icon: FolderOpen, href: "#", disabled: true },
    { name: "Settings", icon: Settings, href: "#", disabled: true },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-full shrink-0">
      {/* Brand logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200 gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-600/30">
          V
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 tracking-tight text-sm leading-none">VedaAI</span>
          <span className="text-[10px] text-slate-400 mt-0.5 leading-none">Assessment Mapping</span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          // In our app, the path is either "/" (upload page) or "/review" (review page).
          // Both are considered "Exams" context, so if name is "Exams", it's active.
          const isActive = item.name === "Exams";

          return (
            <Link
              key={item.name}
              href={item.disabled ? "#" : item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : item.disabled
                  ? "text-slate-400 cursor-not-allowed hover:bg-slate-50/50"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              onClick={(e) => {
                if (item.disabled) {
                  e.preventDefault();
                }
              }}
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                }`}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer / Help */}
      <div className="p-4 border-t border-slate-200">
        <a
          href="#"
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          onClick={(e) => e.preventDefault()}
        >
          <HelpCircle className="w-5 h-5 text-slate-400" />
          <span>Help & Support</span>
        </a>
      </div>
    </aside>
  );
}
