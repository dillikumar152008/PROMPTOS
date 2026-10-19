import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChatLayoutShell } from '@/components/chat/chat-layout-shell';

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/chat');
  }

  // Fetch initial conversations for sidebar using user's anon client (RLS applies)
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false });

  return (
    <ChatLayoutShell
      initialConversations={conversations || []}
      userEmail={user.email || 'user'}
    >
      {children}
    </ChatLayoutShell>
  );
}
