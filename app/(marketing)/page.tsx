import React from 'react';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingHero } from '@/components/marketing/hero';
import { MarketingFeaturesGrid } from '@/components/marketing/features-grid';
import { MarketingHowItWorks } from '@/components/marketing/how-it-works';
import { MarketingPrivacySection } from '@/components/marketing/privacy-section';
import { MarketingPricing } from '@/components/marketing/pricing';
import { MarketingFooter } from '@/components/marketing/footer';
import { DlpScanBackground } from '@/components/marketing/dlp-scan-background';

export default function MarketingPage() {
  return (
    <div className="relative min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col selection:bg-zinc-800 selection:text-white">
      {/* 1. Global Viewport DLP Scan Canvas (Fixed across entire landing page) */}
      <DlpScanBackground />

      {/* 2. Page Content Column (z-10, relative above background) */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Sticky Top Nav */}
        <MarketingNavbar />

        <main className="flex-1">
          {/* Hero section */}
          <MarketingHero />

          {/* Features grid */}
          <MarketingFeaturesGrid />

          {/* How it works */}
          <MarketingHowItWorks />

          {/* Privacy by design statements */}
          <MarketingPrivacySection />

          {/* Beta pricing */}
          <MarketingPricing />
        </main>

        {/* Minimal footer */}
        <MarketingFooter />
      </div>
    </div>
  );
}
