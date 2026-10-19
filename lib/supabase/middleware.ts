import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { extractAuthoritativeRole, isValidRole, type Role } from '@/lib/auth/roles';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user: any = null;
  let role: Role | null = null;

  // 1. If Supabase credentials are configured, sync with Supabase Auth
  if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });

      // Authenticate user via Supabase auth service
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;

      if (user) {
        // Read authoritative role from app_metadata (immutable by client)
        role = extractAuthoritativeRole(user);

        // Fallback: If not in app_metadata yet, query authoritative public.profiles
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
    } catch (err) {
      console.error('[Middleware] Supabase auth refresh error:', err);
    }
  }

  // 2. Server-side Cookie Fallback / Dev Simulator
  // If no Supabase user was resolved (e.g. offline dev or demo session cookie)
  if (!user) {
    const sessionCookie = request.cookies.get('promptos_session')?.value;
    if (sessionCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sessionCookie));
        if (parsed && parsed.id && isValidRole(parsed.role)) {
          user = {
            id: parsed.id,
            email: parsed.email,
            app_metadata: { role: parsed.role },
          };
          role = parsed.role;
        }
      } catch {
        // invalid cookie, ignore
      }
    }
  }

  return { response, user, role };
}
