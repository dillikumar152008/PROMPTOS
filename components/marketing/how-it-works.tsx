'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

export const MarketingHowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Type your prompt',
      description: 'Draft your query or paste text. DLP Shield scans your input in real time directly on your device for sensitive data like Aadhaar, PAN, phone numbers, and keys.',
    },
    {
      num: '02',
      title: 'Review and send',
      description: 'Mask detected sensitive data into safe placeholders, or optimize your prompt structure with one click before sending. Sensitive data never leaves in plain text.',
    },
    {
      num: '03',
      title: 'Get your answer',
      description: 'Receive your AI response with original values safely restored in your browser memory. Unmasked data is never stored in server logs or database records.',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-20 border-b border-zinc-800 bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            How PromptOS Works in 3 Steps
          </h2>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
            Privacy enforcement built directly into the client-server boundary.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {steps.map((step) => (
            <div
              key={step.num}
              className="p-5 rounded-md border border-zinc-800 bg-[#09090b] flex flex-col justify-between"
            >
              <div>
                <span className="text-xl font-mono font-bold text-zinc-500">
                  {step.num}
                </span>
                <h3 className="font-sans text-base font-semibold text-white mt-2">
                  {step.title}
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed mt-2 font-normal">
                  {step.description}
                </p>
              </div>

              <div className="mt-6 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>Step {step.num}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs font-mono text-zinc-400">
            More capabilities, including OCR and multi-model comparison, are on the roadmap.
          </p>
        </div>

      </div>
    </section>
  );
};
