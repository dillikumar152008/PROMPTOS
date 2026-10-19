import React from 'react';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingHero } from '@/components/marketing/hero';
import { MarketingFeaturesGrid } from '@/components/marketing/features-grid';
import { MarketingHowItWorks } from '@/components/marketing/how-it-works';
import { MarketingPricing } from '@/components/marketing/pricing';
import { MarketingFooter } from '@/components/marketing/footer';

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col">
      {/* 1. Sticky Top Nav */}
      <MarketingNavbar />

      <main className="flex-1">
        {/* 2. Hero with tight-tracking and interactive product mock */}
        <MarketingHero />

        {/* 3. Features grid with 6 compact intent-wired cells */}
        <MarketingFeaturesGrid />

        {/* 4. How it works (3 numbered steps) */}
        <MarketingHowItWorks />

        {/* 5. Pricing (3 plain tiers with 1px borders) */}
        <MarketingPricing />
      </main>

      {/* 6. Final CTA band and minimal footer */}
      <MarketingFooter />
    </div>
  );
}
