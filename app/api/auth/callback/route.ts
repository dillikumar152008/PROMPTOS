import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractAuthoritativeRole, getRoleDashboard } from '@/lib/auth/roles';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        const role = extractAuthoritativeRole(data.user);

        // If no authoritative role exists yet, send to onboarding
        if (!role) {
          return NextResponse.redirect(`${requestUrl.origin}/onboarding`);
        }

        if (next && next.startsWith('/')) {
          return NextResponse.redirect(`${requestUrl.origin}${next}`);
        }

        return NextResponse.redirect(`${requestUrl.origin}${getRoleDashboard(role)}`);
      }
    } catch (err) {
      console.error('[OAuth Callback Error]', err);
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/login`);
}
