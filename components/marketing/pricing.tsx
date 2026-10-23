'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight } from 'lucide-react';

export const MarketingPricing: React.FC = () => {
  const betaFeatures = [
    'Full client-side DLP Shield with automatic placeholder restoration',
    'One-click Prompt Optimizer for role & constraint structuring',
    'Image understanding (up to 2 attachments, 3.5 MB total)',
    'Full chat history, search, and session management',
    'High-speed inference powered by Gemini Flash',
    'Strict row-level security and privacy guarantees',
  ];

  return (
    <section id="pricing" className="py-16 md:py-20 border-b border-zinc-800 bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Simple, Transparent Access
          </h2>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
            PromptOS is free to use during our public beta.
          </p>
        </div>

        {/* Single Centered Beta Tier */}
        <div className="max-w-lg mx-auto rounded-md p-6 sm:p-8 border border-zinc-700 bg-[#09090b] shadow-xs">
          <div className="mb-4">
            <h3 className="font-sans font-semibold text-lg text-white">
              Beta Access
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Complete access to all live features during the beta period.
            </p>
          </div>

          <div className="flex items-baseline space-x-2 my-6">
            <span className="text-4xl font-bold font-mono text-white tabular-nums">
              $0
            </span>
            <span className="text-xs font-mono text-zinc-400">/ free during beta</span>
          </div>

          <div className="border-t border-zinc-800 pt-6 space-y-3 mb-8">
            {betaFeatures.map((feat, idx) => (
              <div key={idx} className="flex items-start space-x-2.5 text-xs text-zinc-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{feat}</span>
              </div>
            ))}
          </div>

          <a href="/login" className="block w-full" tabIndex={-1}>
            <Button variant="solid" size="lg" className="w-full space-x-2">
              <span>Start chatting</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>

      </div>
    </section>
  );
};
