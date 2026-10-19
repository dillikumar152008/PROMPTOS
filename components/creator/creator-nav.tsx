'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, BarChart3, Settings, Menu, X } from 'lucide-react';

interface CreatorNavProps {
  userEmail: string;
}

export const CreatorNav: React.FC<CreatorNavProps> = ({ userEmail }) => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: 'Apps', href: '/dashboard/creator', icon: Layers, exact: true },
    { name: 'Analytics', href: '/dashboard/creator/analytics', icon: BarChart3, exact: false },
    { name: 'Settings', href: '/dashboard/creator/settings', icon: Settings, exact: false },
  ];

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <>
      {/* Mobile Top Bar with Toggle */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-[#09090b]">
        <Link href="/dashboard/creator" className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-md bg-white text-zinc-950 flex items-center justify-center font-mono font-bold text-xs select-none">
            &gt;_
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">PromptOS</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-[#09090b] p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-out ${
                  active
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col shrink-0 border-r border-zinc-800 bg-[#09090b] p-4 space-y-6">
        {/* Brand */}
        <Link href="/dashboard/creator" className="flex items-center space-x-2.5 px-2">
          <div className="w-7 h-7 rounded-md bg-white text-zinc-950 flex items-center justify-center font-mono font-bold text-xs select-none">
            &gt;_
          </div>
          <div>
            <span className="font-semibold text-sm tracking-tight text-white block leading-tight">
              PromptOS
            </span>
            <span className="text-[11px] text-zinc-400 block leading-tight">
              Creator
            </span>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                  active
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
