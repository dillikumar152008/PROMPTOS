'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error digest or safe error message
    console.error('[Root Error Boundary]', error.message || 'Unhandled error');
  }, [error]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono font-bold text-sm text-red-400 mx-auto select-none">
          !_
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs text-red-400/80 uppercase tracking-widest">Application Error</p>
          <h1 className="font-sans text-2xl font-bold tracking-tight text-white">
            Something went wrong
          </h1>
          <p className="font-sans text-sm text-zinc-400 leading-relaxed">
            An unexpected error occurred while loading this page. Please try again or return to chat.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-mono font-medium bg-white text-zinc-950 hover:bg-zinc-200 transition-colors shadow-sm cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/chat"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-mono font-medium bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            Go to Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
