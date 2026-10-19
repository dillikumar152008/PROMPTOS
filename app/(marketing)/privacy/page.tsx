import React from 'react';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFooter } from '@/components/marketing/footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col">
      <MarketingNavbar />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-16">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-white mb-6">Privacy Policy</h1>
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            PromptOS respects your privacy and is committed to protecting your personal data and prompt configurations.
          </p>
          <h2 className="font-sans text-lg font-semibold text-white pt-4">1. Information We Collect</h2>
          <p>
            We collect account email addresses and profile names to authenticate users and manage access to mini-apps.
          </p>
          <h2 className="font-sans text-lg font-semibold text-white pt-4">2. Execution Data</h2>
          <p>
            Model inputs and execution parameters are processed strictly to generate outputs for authorized users and aggregate runtime analytics for creators.
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
