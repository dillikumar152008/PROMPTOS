import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export const MarketingFooter: React.FC = () => {
  return (
    <>
      {/* Final CTA Band */}
      <section className="py-16 md:py-20 border-b border-zinc-800 bg-[#09090b] text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-5">
          <h2 className="font-sans text-2xl sm:text-4xl font-semibold tracking-tight text-white max-w-2xl mx-auto">
            Ready to deploy your first AI mini-app?
          </h2>
          <p className="text-sm text-zinc-300 max-w-md mx-auto leading-relaxed">
            Create single-purpose tools from plain English instructions in minutes.
          </p>
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="/signup?role=creator&from=bottom-cta" className="w-full sm:w-auto" tabIndex={-1}>
              <Button variant="solid" size="lg" className="w-full sm:w-auto space-x-1.5">
                <span>Start building as Creator</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <a href="/signup?role=user&from=bottom-cta" className="w-full sm:w-auto" tabIndex={-1}>
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                <span>Explore tools as User</span>
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-8 bg-[#09090b] text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <span className="font-mono font-semibold text-zinc-200">&gt;_ PromptOS</span>
            <span>&bull;</span>
            <span className="text-zinc-400">Single-purpose AI mini-apps platform</span>
          </div>

          <div className="flex items-center space-x-6 text-xs text-zinc-400 font-medium">
            <a href="/terms" className="hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-sm">
              Terms
            </a>
            <a href="/privacy" className="hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-sm">
              Privacy
            </a>
            <a href="/login" className="hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-sm">
              Log in
            </a>
            <a href="/signup" className="hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-sm">
              Sign up
            </a>
            <span className="text-zinc-500">&copy; {new Date().getFullYear()} PromptOS</span>
          </div>
        </div>
      </footer>
    </>
  );
};
