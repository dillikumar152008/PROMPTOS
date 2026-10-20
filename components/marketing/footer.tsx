'use client';

import React from 'react';

export const MarketingFooter: React.FC = () => {
  return (
    <footer className="py-8 bg-transparent text-xs text-zinc-400 border-t border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded-md bg-white text-zinc-950 flex items-center justify-center font-mono font-bold text-[11px] select-none">
            &gt;_
          </div>
          <span className="font-sans font-semibold text-sm text-white">PromptOS</span>
          <span className="text-zinc-600">&bull;</span>
          <span className="text-zinc-400 text-xs">Private, DLP-shielded AI chat</span>
        </div>

        <div className="flex items-center space-x-6 text-xs text-zinc-400 font-medium">
          <a
            href="#features"
            className="hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-sm"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-sm"
          >
            How it works
          </a>
          <a
            href="/login"
            className="hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-sm"
          >
            Login
          </a>
          <span className="text-zinc-600">&copy; {new Date().getFullYear()} PromptOS</span>
        </div>
      </div>
    </footer>
  );
};
