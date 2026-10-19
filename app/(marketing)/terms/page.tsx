import React from 'react';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingFooter } from '@/components/marketing/footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col">
      <MarketingNavbar />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-16">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-white mb-6">Terms of Service</h1>
        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            By accessing or using PromptOS, you agree to comply with and be bound by these Terms of Service.
          </p>
          <h2 className="font-sans text-lg font-semibold text-white pt-4">1. Use of Service</h2>
          <p>
            PromptOS provides tools for creators to author mini-apps and users to execute authorized workflows. You agree not to use the service for generating abusive, illegal, or malicious prompts.
          </p>
          <h2 className="font-sans text-lg font-semibold text-white pt-4">2. Account Responsibility</h2>
          <p>
            You are responsible for maintaining the security of your account and credentials. PromptOS enforces role-based access control across creator and user accounts.
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
