'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

export const MarketingNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        
        {/* Brand Wordmark */}
        <div className="flex items-center space-x-3">
          <a href="/" className="flex items-center space-x-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-md">
            <div className="w-7 h-7 rounded-md bg-white text-zinc-950 flex items-center justify-center font-mono font-bold text-xs select-none">
              &gt;_
            </div>
            <span className="font-sans font-semibold text-sm tracking-tight text-white">
              PromptOS
            </span>
          </a>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center space-x-6 text-sm text-zinc-300 font-medium">
          <a href="#features" className="hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-md px-1 py-0.5">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-md px-1 py-0.5">
            How it works
          </a>
          <a href="#pricing" className="hover:text-white transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-md px-1 py-0.5">
            Pricing
          </a>
        </nav>

        {/* Right Auth CTAs */}
        <div className="hidden sm:flex items-center space-x-2">
          <a href="/login" tabIndex={-1}>
            <Button variant="solid" size="sm">
              Log in
            </Button>
          </a>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden p-2 text-zinc-300 hover:text-white cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-zinc-800 bg-[#09090b] px-4 py-4 space-y-3">
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-zinc-300 hover:text-white py-1"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-zinc-300 hover:text-white py-1"
          >
            How it works
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-zinc-300 hover:text-white py-1"
          >
            Pricing
          </a>
          <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
            <a href="/login" className="w-full">
              <Button variant="solid" size="md" className="w-full">
                Log in
              </Button>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
