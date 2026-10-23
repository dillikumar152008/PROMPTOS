'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Conversation } from '@/types/chat';
import { ChatSidebar } from './chat-sidebar';
import { Menu, PanelLeft, ChevronDown, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ChatLayoutShellProps {
  initialConversations: Conversation[];
  userEmail: string;
  children: React.ReactNode;
}

export const ChatLayoutShell: React.FC<ChatLayoutShellProps> = ({
  initialConversations,
  userEmail,
  children,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  const handleConversationDeleted = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  // Close model dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModelDropdownOpen(false);
      }
    };

    if (modelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [modelDropdownOpen]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#212121] text-[#ececec] font-sans">
      {/* Sidebar (Desktop Collapsible + Mobile Overlay) */}
      <ChatSidebar
        conversations={conversations}
        userEmail={userEmail}
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        onConversationDeleted={handleConversationDeleted}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#212121]">
        {/* Slim Top Bar (No borders under it) */}
        <header className="h-11 px-3.5 flex items-center bg-[#212121] select-none text-[#ececec] z-10 shrink-0">
          <div className="flex items-center space-x-2">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="p-1.5 rounded-lg text-[#9b9b9b] hover:text-[#ececec] hover:bg-[#2a2a2a] md:hidden transition-colors cursor-pointer"
              title="Open sidebar"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Expand Sidebar Button (Visible only when sidebar is collapsed) */}
            {isCollapsed && (
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="hidden md:flex p-1.5 rounded-lg text-[#9b9b9b] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                title="Open sidebar"
                aria-label="Open sidebar"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}

            {/* Model Selector Dropdown Trigger */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => setModelDropdownOpen((prev) => !prev)}
                className="flex items-center space-x-1.5 px-2 py-1 rounded-lg hover:bg-[#2a2a2a] transition-colors cursor-pointer group focus:outline-none focus-visible:ring-1 focus-visible:ring-[#555]"
                aria-expanded={modelDropdownOpen}
                aria-haspopup="menu"
              >
                <span className="font-semibold text-sm tracking-tight text-[#ececec]">
                  PromptOS
                </span>
                <span className="text-xs text-[#9b9b9b] font-normal">
                  Gemini Flash
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#9b9b9b] group-hover:text-[#ececec] transition-transform duration-150" />
              </button>

              {/* Model Selector Dropdown Popover */}
              {modelDropdownOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full mt-1.5 w-64 rounded-xl bg-[#2a2a2a] border border-[#383838] shadow-2xl p-1.5 z-50 text-xs font-sans space-y-1 animate-in fade-in duration-100"
                >
                  <div className="px-2.5 py-1 text-[11px] font-medium text-[#777777] uppercase tracking-wider">
                    Model
                  </div>

                  {/* Active Item: Gemini Flash */}
                  <div
                    role="menuitem"
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#333333] text-[#ececec] font-medium cursor-default"
                  >
                    <div className="flex flex-col">
                      <span>Gemini Flash</span>
                      <span className="text-[11px] text-[#9b9b9b] font-normal">
                        Fastest responses, active model
                      </span>
                    </div>
                    <Check className="w-4 h-4 text-[#ececec] shrink-0" />
                  </div>

                  {/* Disabled Item: Multi-model comparison */}
                  <div
                    role="menuitem"
                    aria-disabled="true"
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg text-[#777777] cursor-not-allowed opacity-60"
                  >
                    <div className="flex flex-col">
                      <span>Multi-model comparison</span>
                      <span className="text-[11px] text-[#666666]">
                        Compare across models
                      </span>
                    </div>
                    <span className="text-[10px] text-[#888888] bg-[#212121] px-1.5 py-0.5 rounded">
                      Coming soon
                    </span>
                  </div>

                  {/* Disabled Item: Smart routing */}
                  <div
                    role="menuitem"
                    aria-disabled="true"
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg text-[#777777] cursor-not-allowed opacity-60"
                  >
                    <div className="flex flex-col">
                      <span>Smart routing</span>
                      <span className="text-[11px] text-[#666666]">
                        Auto-select optimal model
                      </span>
                    </div>
                    <span className="text-[10px] text-[#888888] bg-[#212121] px-1.5 py-0.5 rounded">
                      Coming soon
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#212121]">
          {children}
        </main>
      </div>
    </div>
  );
};
