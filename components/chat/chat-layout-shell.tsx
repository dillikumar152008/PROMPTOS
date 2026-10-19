'use client';

import React, { useState, useEffect } from 'react';
import { Conversation } from '@/types/chat';
import { ChatSidebar } from './chat-sidebar';
import { Menu } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const supabase = createClient();

  const refreshConversations = async () => {
    try {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      if (data) {
        setConversations(data);
      }
    } catch (err) {
      console.error('Error refreshing conversations:', err);
    }
  };

  const handleConversationDeleted = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#09090b] text-zinc-100">
      {/* Sidebar */}
      <ChatSidebar
        conversations={conversations}
        userEmail={userEmail}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onConversationDeleted={handleConversationDeleted}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="h-12 border-b border-zinc-800/80 px-4 flex items-center justify-between md:hidden bg-[#09090b]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white"
            title="Open sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-1.5 font-sans font-bold text-xs text-white">
            <span>&gt;_ PromptOS</span>
          </div>
          <div className="w-7" />
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
