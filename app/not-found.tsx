import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono font-bold text-sm text-emerald-400 mx-auto select-none">
          &gt;_
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest">404 Error</p>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-white">
            Page Not Found
          </h1>
          <p className="font-sans text-sm text-zinc-400 leading-relaxed">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/chat"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-mono font-medium bg-white text-zinc-950 hover:bg-zinc-200 transition-colors shadow-sm"
          >
            Return to PromptOS Chat &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
