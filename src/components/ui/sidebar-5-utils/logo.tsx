import React from "react";

export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5">
        <img
          src="/logo.jpg"
          alt="AMCAT Practice"
          className="h-full w-full object-cover"
          onError={(e) => {
            // fallback if logo.jpg is not accessible in standalone contexts
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-[#20a9e0] to-[#3b82f6] ring-2 ring-white" />
      </div>
      <div className="flex flex-col text-left">
        <span className="font-['Space_Grotesk',sans-serif] text-sm font-bold tracking-tight text-slate-900">
          AMCAT Practice
        </span>
        <span className="text-[11px] font-medium tracking-wide text-slate-500">
          Concentrix Hiring Prep
        </span>
      </div>
    </div>
  );
}
