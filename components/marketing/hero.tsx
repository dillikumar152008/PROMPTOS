'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShieldCheck, ArrowDown } from 'lucide-react';

export const MarketingHero: React.FC = () => {
  return (
    <section className="relative pt-12 sm:pt-14 md:pt-18 pb-16 md:pb-24 border-b border-zinc-800 bg-transparent">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
        
        {/* Tight-Tracking Headline */}
        <h1 className="font-sans text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          Private AI chat that protects sensitive data before it leaves your device.
        </h1>

        {/* One-Line Subcopy */}
        <p className="mt-4 text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
          Ask questions, optimize prompts, and analyze images with built-in client-side data loss prevention. Personal data is masked in your browser and restored in the reply.
        </p>

        {/* Two High-Contrast Intent CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="/login" className="w-full sm:w-auto" tabIndex={-1}>
            <Button variant="solid" size="lg" className="w-full sm:w-auto space-x-1.5">
              <span>Start chatting</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
          <a href="#features" className="w-full sm:w-auto" tabIndex={-1}>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto space-x-1.5">
              <span>Explore features</span>
              <ArrowDown className="w-4 h-4 text-zinc-400" />
            </Button>
          </a>
        </div>

        {/* ── STATIC CHAT PREVIEW IN MATCHED CARD STYLE ── */}
        <div className="mt-12 max-w-3xl mx-auto rounded-md bg-[#09090b] text-left border border-zinc-800 overflow-hidden shadow-xs">
          
          {/* Mock Header Bar */}
          <div className="px-4 py-2.5 bg-[#09090b] border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-zinc-700"></span>
              <span className="w-2 h-2 rounded-full bg-zinc-700"></span>
              <span className="w-2 h-2 rounded-full bg-zinc-700"></span>
              <span className="text-zinc-300 font-mono text-[11px] ml-1.5">PromptOS Secure Chat</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[11px] font-mono text-zinc-400">DLP Shield Active</span>
            </div>
          </div>

          {/* Chat Messages Preview Area */}
          <div className="p-4 sm:p-6 space-y-4 bg-[#09090b]">
            
            {/* User Message with Aadhaar */}
            <div className="flex items-start justify-end gap-2.5">
              <div className="max-w-[85%] sm:max-w-[75%] rounded-md bg-zinc-800 text-zinc-100 p-3.5 text-xs font-sans leading-relaxed">
                Can you review the account verification status for Aadhaar 9876 5432 1098 and confirm all documents are in order?
              </div>
            </div>

            {/* DLP Shield Notice (matches chat app style: rounded-lg, #2a2a2a, sans, muted) */}
            <div className="flex justify-start my-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2a2a2a] border border-zinc-800 text-xs font-sans text-zinc-400">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>
                  1 item masked. Aadhaar replaced with{' '}
                  <code className="font-mono text-zinc-300 text-[11px] bg-zinc-800/80 px-1 py-0.5 rounded">[AADHAAR_1]</code>{' '}
                  before sending
                </span>
              </div>
            </div>

            {/* AI Assistant Reply with Restored Placeholder */}
            <div className="flex items-start justify-start gap-2.5">
              <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-zinc-200 shrink-0 mt-0.5">
                &gt;_
              </div>
              <div className="max-w-[88%] sm:max-w-[80%] rounded-md bg-zinc-900/60 border border-zinc-800/80 text-zinc-200 p-3.5 text-xs font-sans leading-relaxed space-y-2">
                <p>
                  I reviewed the verification records for <strong>[AADHAAR_1]</strong>:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-zinc-300">
                  <li>Identity documentation is fully verified and matches registration records.</li>
                  <li>Account status is active with no compliance holds or pending audits.</li>
                  <li>Next scheduled re-verification cycle is October 2027.</li>
                </ul>
                <div className="pt-2 border-t border-zinc-800/60 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                  <span>Client-side restored locally</span>
                  <span>Tokens: 142 &bull; Model: Gemini Flash</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
