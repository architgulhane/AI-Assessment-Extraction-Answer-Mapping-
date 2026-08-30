"use client";

import React from "react";

type VedaLogoProps = {
  size?: "sm" | "md" | "lg";
  isCollapsed?: boolean;
  className?: string;
  textColor?: string;
};

export default function VedaLogo({
  size = "md",
  isCollapsed = false,
  className = "",
  textColor = "text-slate-900",
}: VedaLogoProps) {
  const iconSizes = {
    sm: "w-8 h-8 rounded-xl",
    md: "w-10 h-10 rounded-[14px]",
    lg: "w-12 h-12 rounded-2xl",
  };

  const textSizes = {
    sm: "text-base font-extrabold",
    md: "text-xl font-extrabold",
    lg: "text-2xl font-extrabold",
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Icon Badge: Dark rounded square box matching uploaded logo */}
      <div
        className={`${iconSizes[size]} bg-[#232323] flex items-center justify-center shadow-md shrink-0 border border-white/10 overflow-hidden p-1.5`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/veda-logo.png"
          alt="VedaAI Logo"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Text matching Image 3 */}
      {!isCollapsed && (
        <span className={`${textSizes[size]} ${textColor} tracking-tight font-sans flex items-center`}>
          VedaAI
        </span>
      )}
    </div>
  );
}
