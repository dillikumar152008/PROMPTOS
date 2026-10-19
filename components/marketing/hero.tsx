'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Copy, Check } from 'lucide-react';

export const MarketingHero: React.FC = () => {
  const [sampleInput, setSampleInput] = useState(
    '3-bed, 2-bath mid-century modern in East Austin. Asking $645k. Features original terrazzo floors, detached cedar studio office, and zero-maintenance xeriscaped yard. Walking distance to local coffee shops.'
  );
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>(
    `1. The Lifestyle Interrupt:\n"Austin remote workers are trading downtown apartments for this detached cedar studio office."\n\n2. The Architectural Hook:\n"Most buyers walk past this 1958 Austin home without realizing the entire floor is original terrazzo."\n\n3. The Investment Angle:\n"At $645k in East Austin, that detached backyard studio can offset half your monthly mortgage."`
  );
  const [copied, setCopied] = useState(false);

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sampleInput.trim() || isRunning) return;

    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setOutput(
        `1. Direct Hook:\n"Here is what $645k gets you in East Austin: terrazzo floors, a detached cedar office, and zero grass to mow."\n\n2. Pattern Interrupt:\n"Stop touring cookie-cutter new builds until you see this 1958 mid-century with a private backyard studio."\n\n3. Value Summary:\n"3 beds, 2 baths, and a separate work-from-home cedar studio within walking distance of East Austin coffee."`
      );
    }, 300);
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="pt-16 pb-16 md:pt-24 md:pb-24 border-b border-zinc-800 bg-[#09090b]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
        
        {/* Release Pill */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 mb-6 select-none">
          <span>PromptOS Platform</span>
          <span className="text-zinc-600">&bull;</span>
          <span>Role-Isolated Architecture</span>
        </div>

        {/* Tight-Tracking Headline */}
        <h1 className="font-sans text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          Build single-purpose AI mini-apps from plain English.
        </h1>

        {/* One-Line Subcopy */}
        <p className="mt-4 text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
          Creators build locked-down tools with unique URLs. End-users run them in clean, distraction-free environments.
        </p>

        {/* Two High-Contrast Intent CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="/signup?role=creator" className="w-full sm:w-auto" tabIndex={-1}>
            <Button variant="solid" size="lg" className="w-full sm:w-auto space-x-1.5">
              <span>Start building</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
          <a href="/signup?role=user" className="w-full sm:w-auto" tabIndex={-1}>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              <span>Explore tools</span>
            </Button>
          </a>
        </div>

        {/* ── MATCHED PRODUCT MOCK IN CODE ── */}
        <div className="mt-12 max-w-4xl mx-auto rounded-md bg-[#09090b] text-left border border-zinc-800">
          
          {/* Mock Header Bar */}
          <div className="px-4 py-2.5 bg-[#09090b] border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-zinc-700"></span>
              <span className="w-2 h-2 rounded-full bg-zinc-700"></span>
              <span className="w-2 h-2 rounded-full bg-zinc-700"></span>
              <span className="text-zinc-300 font-mono text-[11px] ml-1.5">Real Estate Video Hook Architect</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">/app/real-estate-hooks</span>
          </div>

          {/* Two-Column Mock: Left Input, Right Output */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
            
            {/* Left: Input Form */}
            <form onSubmit={handleRun} className="p-4 sm:p-5 space-y-3 bg-[#09090b]">
              <div className="flex items-center justify-between">
                <label htmlFor="hero-sample-input" className="text-xs font-medium text-zinc-300">
                  Input
                </label>
                <span className="text-[11px] text-zinc-400 font-mono">Property listing summary</span>
              </div>

              <textarea
                id="hero-sample-input"
                rows={6}
                value={sampleInput}
                onChange={(e) => setSampleInput(e.target.value)}
                className="w-full bg-[#09090b] text-zinc-200 text-xs font-mono p-3 rounded-md border border-zinc-800 focus:outline-none focus:border-[#2563eb] transition-colors resize-none leading-relaxed"
                placeholder="Enter listing details..."
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-400">Max 5,000 characters</span>
                <Button
                  type="submit"
                  variant="solid"
                  size="sm"
                  disabled={isRunning || !sampleInput.trim()}
                  className="space-x-1.5"
                >
                  <Play className="w-3 h-3 fill-zinc-950" />
                  <span>{isRunning ? 'Running…' : 'Run mini-app'}</span>
                </Button>
              </div>
            </form>

            {/* Right: Matched Output */}
            <div className="p-4 sm:p-5 space-y-3 bg-[#09090b]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">
                  Output
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs text-zinc-400 hover:text-white flex items-center space-x-1 transition-colors duration-150 ease-out cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] px-1 py-0.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="p-3 rounded-md bg-[#09090b] border border-zinc-800 text-xs font-mono text-zinc-200 leading-relaxed min-h-[175px] whitespace-pre-wrap select-text">
                {isRunning ? (
                  <div className="h-40 flex items-center justify-center text-zinc-400 text-xs font-mono">
                    Generating output...
                  </div>
                ) : (
                  output
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
