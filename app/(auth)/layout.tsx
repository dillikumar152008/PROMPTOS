import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between p-4 sm:p-6 selection:bg-zinc-800 selection:text-white">
      {/* Top branding bar */}
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <a href="/" className="flex items-center space-x-2 group">
          <div className="w-7 h-7 rounded-md bg-white text-zinc-950 flex items-center justify-center font-mono font-bold text-xs select-none">
            &gt;_
          </div>
          <span className="font-sans font-semibold text-sm tracking-tight text-white">
            PromptOS
          </span>
        </a>
      </div>

      {/* Main centered card */}
      <div className="w-full my-8 flex items-center justify-center">
        {children}
      </div>

      {/* Minimal Footer */}
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between text-xs text-zinc-500">
        <span>PromptOS &bull; Single-Purpose AI Platform</span>
        <span>Role-isolated workspace</span>
      </div>
    </div>
  );
}
