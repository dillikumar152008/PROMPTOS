'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Conversation } from '@/types/chat';
import { Plus, Search, MessageSquare, Trash2, LogOut, X, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ChatSidebarProps {
  conversations: Conversation[];
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
  onConversationDeleted: (id: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  userEmail,
  isOpen,
  onClose,
  onConversationDeleted,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const supabase = createClient();

  // Client-side search filter
  const filteredConversations = conversations.filter((c) =>
    (c.title || 'New conversation').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      // Delete conversation from Supabase using user's anon client (RLS applies)
      const { error } = await supabase.from('conversations').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete conversation:', error.message);
      } else {
        onConversationDeleted(id);
        setDeletingId(null);
        if (pathname === `/chat/${id}`) {
          router.push('/chat');
        }
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#09090b] border-r border-zinc-800/90 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header: Logo + New Chat */}
        <div className="p-4 border-b border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <a href="/chat" className="flex items-center space-x-2 group">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-mono font-bold text-xs shadow-xs group-hover:bg-white transition-colors">
                &gt;_
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="font-sans font-bold text-sm tracking-tight text-white">
                  PromptOS
                </span>
              </div>
            </a>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={onClose}
              className="md:hidden text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={() => {
              router.push('/chat');
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-mono font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New chat</span>
          </button>
        </div>

        {/* Search Box */}
        <div className="p-3 border-b border-zinc-800/60">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-zinc-900/80 text-zinc-200 text-xs font-mono pl-8 pr-3 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-500"
            />
          </div>
        </div>

        {/* Recents Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800">
          <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Recents ({filteredConversations.length})
          </div>

          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs font-mono text-zinc-500">
              {searchQuery ? 'No matching conversations' : 'No chats yet'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = pathname === `/chat/${conv.id}`;
              const isConfirmingDelete = deletingId === conv.id;

              return (
                <div key={conv.id} className="relative group">
                  {isConfirmingDelete ? (
                    <div className="p-2 rounded-xl bg-red-950/40 border border-red-800/60 text-xs space-y-2">
                      <div className="flex items-center space-x-1.5 text-red-300 text-[11px] font-mono">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span>Delete this conversation?</span>
                      </div>
                      <div className="flex items-center space-x-1.5 justify-end">
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={(e) => handleDelete(conv.id, e)}
                          className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-mono font-medium"
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/chat/${conv.id}`);
                        onClose();
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-zinc-900 border-zinc-700 text-white font-medium'
                          : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                        <span className="truncate">{conv.title || 'Untitled chat'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-zinc-500 rounded transition-opacity"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom User Area */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <span className="font-mono text-[11px] text-zinc-400 block truncate">
              {userEmail}
            </span>
          </div>

          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
};
