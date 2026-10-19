import React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { extractAuthoritativeRole, isValidRole, type Role } from '@/lib/auth/roles';
import { CreatorNav } from '@/components/creator/creator-nav';

export default async function CreatorLayout({
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

  // Server-side authoritative creator role check
  if (!user) {
    redirect('/login?next=/dashboard/creator');
  }

  if (role !== 'creator') {
    redirect('/dashboard/user');
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col md:flex-row">
      {/* Sidebar & Mobile Navigation */}
      <CreatorNav userEmail={user.email || 'creator'} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-zinc-800 bg-[#09090b] px-4 sm:px-6 flex items-center justify-between">
          <div className="text-xs text-zinc-400 font-medium truncate max-w-xs sm:max-w-md">
            Signed in as <span className="text-white font-mono">{user.email}</span>
          </div>

          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-md border border-zinc-800 hover:bg-zinc-900 transition-colors duration-150 ease-out cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              Sign out
            </button>
          </form>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
