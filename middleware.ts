import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const normalizedPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';

  // ── RULE 0: Legacy routes disabled for everyone -> 404 ──
  // Check BEFORE any static/dot early returns, case-insensitively, handling trailing slashes and dots (e.g. /app/a.b)
  if (
    normalizedPath === '/app' ||
    normalizedPath.startsWith('/app/') ||
    normalizedPath === '/api/apps' ||
    normalizedPath.startsWith('/api/apps/') ||
    normalizedPath === '/api/creator' ||
    normalizedPath.startsWith('/api/creator/') ||
    normalizedPath === '/api/user' ||
    normalizedPath.startsWith('/api/user/')
  ) {
    return new NextResponse(null, { status: 404 });
  }

  // Static files and internal Next.js assets should be ignored
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Other API routes (/api/chat, /api/auth/*) bypass page session checks
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Refresh session and read authoritative role from server
  const { response, user } = await updateSession(request);
  const isAuthenticated = !!user;

  // ── RULE 1: Unauthenticated on /chat/* -> redirect to /login?next=<path> ──
  if (pathname.startsWith('/chat')) {
    if (!isAuthenticated) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('next', pathname + search);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // ── RULE 2: /dashboard/dlp is allowed; all other /dashboard/* redirect to /chat ──
  if (pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('next', pathname + search);
      return NextResponse.redirect(redirectUrl);
    }
    // Allow DLP Shield & Audit page through
    if (pathname.startsWith('/dashboard/dlp')) {
      return NextResponse.next();
    }
    // All other legacy /dashboard/* routes -> /chat
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  // ── RULE 3: Authenticated visitor on /login or /signup -> redirect to /chat ──
  if (isAuthenticated && (pathname === '/login' || pathname === '/signup')) {
    const nextParam = request.nextUrl.searchParams.get('next');
    if (nextParam && nextParam.startsWith('/chat')) {
      return NextResponse.redirect(new URL(nextParam, request.url));
    }
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  // ── RULE 4: Authenticated visitor on /onboarding -> redirect to /chat ──
  if (isAuthenticated && pathname === '/onboarding') {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
