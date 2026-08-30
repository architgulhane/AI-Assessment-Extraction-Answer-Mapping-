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

  const svgSizes = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-7 h-7",
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Icon Badge: Dark rounded square box matching Image 3 */}
      <div
        className={`${iconSizes[size]} bg-[#232323] flex items-center justify-center shadow-md shrink-0 border border-white/10`}
      >
        <svg
          className={`${svgSizes[size]}`}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Subtle silver gradient for left arm fold */}
            <linearGradient id="vedaVLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#ECEFF1" />
              <stop offset="100%" stopColor="#CFD8DC" />
            </linearGradient>
            <linearGradient id="vedaVRight" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>
          </defs>

          {/* Authentic VedaAI Logo V Mark matching Image 3 */}
          {/* Left folded arm */}
          <path
            d="M 24 30 C 24 24, 30 24, 34 28 L 50 66 C 52 71, 48 76, 42 76 C 37 76, 34 72, 32 66 L 25 36 C 24 33, 24 30, 24 30 Z"
            fill="url(#vedaVLeft)"
          />
          {/* Right arm */}
          <path
            d="M 42 76 C 47 76, 51 72, 53 66 L 74 28 C 77 23, 71 22, 67 27 L 48 64 C 46 68, 44 76, 42 76 Z"
            fill="url(#vedaVRight)"
          />
          {/* Subtle inner fold shadow curve */}
          <path
            d="M 33 60 L 42 76 C 39 76, 36 72, 34 65 Z"
            fill="#B0BEC5"
            opacity="0.9"
          />
        </svg>
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
