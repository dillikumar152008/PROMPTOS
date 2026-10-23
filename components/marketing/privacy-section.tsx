'use client';

import React from 'react';
import { ShieldCheck, HardDrive, Cpu, Lock } from 'lucide-react';

export const MarketingPrivacySection: React.FC = () => {
  const points = [
    {
      icon: HardDrive,
      title: 'In-Memory Placeholder Maps',
      statement: 'Placeholder mapping keys live only in browser memory during your active session. They are never saved to cookies, local storage, database tables, or server logs.',
    },
    {
      icon: ShieldCheck,
      title: 'Client-Side First Masking',
      statement: 'Sensitive patterns—including Aadhaar, PAN, Indian mobile numbers, payment cards, and secret keys—are detected and replaced with tokens on your device before sending.',
    },
    {
      icon: Cpu,
      title: 'Server-Side Safety Net',
      statement: 'The backend re-scans every payload before model dispatch. It rejects any unmasked sensitive content and ensures no plain text leaks to external APIs or models.',
    },
    {
      icon: Lock,
      title: 'Zero Unmasked Persistence',
      statement: 'Only masked conversations and sanitized metadata are stored in Supabase under strict row-level security policies tied exclusively to your authenticated user account.',
    },
  ];

  return (
    <section className="py-16 md:py-20 border-b border-zinc-800 bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Privacy by Design
          </h2>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
            Architectural safeguards that guarantee your data remains confidential at every boundary.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {points.map((pt, idx) => {
            const Icon = pt.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-md border border-zinc-800 bg-[#09090b] flex flex-col justify-between"
              >
                <div>
                  <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 mb-3">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-sans font-semibold text-sm text-white">
                    {pt.title}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed mt-2 font-normal">
                    {pt.statement}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
