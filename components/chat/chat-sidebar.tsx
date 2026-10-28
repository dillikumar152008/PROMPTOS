'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Conversation } from '@/types/chat';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  LogOut,
  X,
  PanelLeftClose,
  Check,
  Shield,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ChatSidebarProps {
  conversations: Conversation[];
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onConversationDeleted: (id: string) => void;
}

interface GroupedConversations {
  today: Conversation[];
  yesterday: Conversation[];
  previous7Days: Conversation[];
  older: Conversation[];
}

function groupConversationsByDate(conversations: Conversation[]): GroupedConversations {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const groups: GroupedConversations = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  };

  for (const conv of conversations) {
    const timestamp = conv.updated_at || conv.created_at;
    const time = timestamp ? new Date(timestamp).getTime() : 0;

    if (time >= startOfToday) {
      groups.today.push(conv);
    } else if (time >= startOfYesterday) {
      groups.yesterday.push(conv);
    } else if (time >= startOf7DaysAgo) {
      groups.previous7Days.push(conv);
    } else {
      groups.older.push(conv);
    }
  }

  return groups;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  userEmail,
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  onConversationDeleted,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  // Filter conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter((c) =>
      (c.title || 'New conversation').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  // Group by date
  const grouped = useMemo(
    () => groupConversationsByDate(filteredConversations),
    [filteredConversations]
  );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
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

  const handleStartSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  // Render a chat row
  const renderChatRow = (conv: Conversation) => {
    const isActive = pathname === `/chat/${conv.id}`;
    const isConfirming = deletingId === conv.id;

    if (isConfirming) {
      return (
        <div
          key={conv.id}
          className="px-3 py-2 rounded-lg bg-[#2a2a2a] text-xs flex items-center justify-between text-[#ececec]"
        >
          <span className="truncate pr-2">Delete chat?</span>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              disabled={isDeleting}
              onClick={(e) => {
                e.stopPropagation();
                setDeletingId(null);
              }}
              className="p-1 rounded text-[#9b9b9b] hover:text-[#ececec] text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={(e) => handleDelete(conv.id, e)}
              className="p-1 rounded text-red-400 hover:text-red-300 text-xs"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={conv.id} className="relative group">
        <button
          type="button"
          onClick={() => {
            router.push(`/chat/${conv.id}`);
            onClose();
          }}
          className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
            isActive
              ? 'bg-[#212121] text-[#ececec] font-medium'
              : 'text-[#ececec] hover:bg-[#212121]/80 hover:text-white'
          }`}
        >
          <span className="truncate pr-2">{conv.title || 'Untitled chat'}</span>

          <span
            onClick={(e) => {
              e.stopPropagation();
              setDeletingId(conv.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-[#9b9b9b] hover:text-red-400 transition-opacity rounded cursor-pointer shrink-0"
            title="Delete chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>
    );
  };

  const renderSection = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-0.5">
        <div className="px-3 pt-3.5 pb-1 text-[11px] text-[#9b9b9b] font-medium select-none">
          {title}
        </div>
        {items.map(renderChatRow)}
      </div>
    );
  };

  const sidebarContent = (
    <div className="w-[260px] h-full flex flex-col bg-[#171717] text-[#ececec] select-none font-sans">
      {/* Top Bar: PromptOS brand + collapse toggle */}
      <div className="h-14 px-3.5 flex items-center justify-between shrink-0">
        <a href="/chat" className="flex items-center space-x-2 group">
          <div className="w-6 h-6 rounded-md bg-white text-zinc-950 flex items-center justify-center font-mono font-bold text-xs select-none">
            &gt;_
          </div>
          <span className="font-semibold text-sm text-[#ececec]">
            PromptOS
          </span>
        </a>

        {/* Desktop collapse icon / Mobile close icon */}
        <div className="flex items-center">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex p-1.5 rounded-lg text-[#9b9b9b] hover:text-[#ececec] hover:bg-[#212121] transition-colors cursor-pointer"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-[#9b9b9b] hover:text-[#ececec] hover:bg-[#212121] transition-colors"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Action Rows: New Chat & Search */}
      <div className="px-2 space-y-1 shrink-0 pb-2">
        {/* New Chat Row */}
        <button
          type="button"
          onClick={() => {
            router.push('/chat');
            onClose();
          }}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-[#ececec] hover:bg-[#212121] transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#9b9b9b]" />
          <span>New chat</span>
        </button>

        {/* Search Chats Row or Inline Search Input */}
        {isSearching ? (
          <div className="relative px-1 py-0.5">
            <Search className="w-3.5 h-3.5 text-[#9b9b9b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-[#212121] text-[#ececec] text-xs pl-8 pr-7 py-1.5 rounded-lg outline-none placeholder:text-[#9b9b9b]"
            />
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#9b9b9b] hover:text-[#ececec]"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartSearch}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-[#ececec] hover:bg-[#212121] transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#9b9b9b]" />
            <span>Search chats</span>
          </button>
        )}

        {/* DLP Scanner & Audit Navigation Link */}
        <button
          type="button"
          onClick={() => {
            router.push('/dashboard/dlp');
            onClose();
          }}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-[#ececec] hover:bg-[#212121] transition-colors cursor-pointer group"
        >
          <Shield className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
          <span>DLP Shield &amp; Audit</span>
        </button>
      </div>

      {/* Chat List Grouped by Date */}
      <div className="flex-1 overflow-y-auto px-2 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
        {filteredConversations.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-[#9b9b9b]">
            {searchQuery ? 'No matching chats' : 'No chats yet'}
          </div>
        ) : (
          <>
            {renderSection('Today', grouped.today)}
            {renderSection('Yesterday', grouped.yesterday)}
            {renderSection('Previous 7 days', grouped.previous7Days)}
            {renderSection('Older', grouped.older)}
          </>
        )}
      </div>

      {/* Bottom Profile Row */}
      <div className="p-2 border-t border-[#2a2a2a]/60 shrink-0">
        <div className="px-2 py-2 rounded-lg hover:bg-[#212121] transition-colors flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <div className="w-7 h-7 rounded-full bg-[#303030] text-[#ececec] flex items-center justify-center text-xs font-semibold uppercase shrink-0">
              {userEmail ? userEmail.charAt(0) : 'U'}
            </div>
            <span className="text-xs text-[#ececec] truncate font-sans">
              {userEmail}
            </span>
          </div>

          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="p-1.5 rounded-lg text-[#9b9b9b] hover:text-[#ececec] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (Shrink-0, w-[260px], no translation, no clipping) */}
      <aside
        className={`${
          isCollapsed ? 'hidden' : 'hidden md:flex'
        } shrink-0 w-[260px] h-full bg-[#171717] z-20`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer */}
          <div className="relative w-[260px] max-w-[80vw] h-full bg-[#171717] shadow-2xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
