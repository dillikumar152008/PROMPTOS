import React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { extractAuthoritativeRole, isValidRole, type Role } from '@/lib/auth/roles';
import { Terminal, LogOut, CheckCircle2 } from 'lucide-react';

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  let user: any = null;
  let role: Role | null = null;

  // 1. Supabase Auth
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    user = authUser;
    if (user) {
      role = extractAuthoritativeRole(user);
      if (!role) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile && isValidRole(profile.role)) {
          role = profile.role;
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Cookie fallback / dev session
  if (!user) {
    const sessionCookie = cookieStore.get('promptos_session')?.value;
    if (sessionCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sessionCookie));
        if (parsed && isValidRole(parsed.role)) {
          user = parsed;
          role = parsed.role;
        }
      } catch {
        // ignore
      }
    }
  }

  // Defense in depth server-side role check
  if (!user) {
    redirect('/login?next=/dashboard/user');
  }

  if (role !== 'user') {
    // Defense in depth: bounce unauthorized role immediately
    redirect('/dashboard/creator');
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* End-User Execution Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          
          <div className="flex items-center space-x-3">
            <a href="/dashboard/user" className="flex items-center space-x-2 group">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-mono font-bold text-xs shadow-xs group-hover:bg-white transition-colors">
                &gt;_
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-sans font-bold text-sm tracking-tight text-white">
                  PromptOS
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded uppercase">
                  User Runtime
                </span>
              </div>
            </a>

            <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-zinc-800 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-zinc-400 font-medium">Isolated Execution Sandbox</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="font-mono text-[11px] text-zinc-400 hidden md:inline">
              {user.email}
            </span>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-mono transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          </div>

        </div>
      </header>

      {/* Main Execution Sandbox */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 text-xs text-zinc-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span className="font-mono text-[11px]">PromptOS Execution Sandbox &bull; Zero Prompt Exposure</span>
          <span className="font-mono text-[11px]">Protected Edge Compute</span>
        </div>
      </footer>
    </div>
  );
}
